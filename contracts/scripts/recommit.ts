import { ethers, network } from "hardhat";
import { PrismaClient, ListingStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("  ZeroVault State Reconciliation Engine");
  console.log("  Network:", network.name);
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer / Admin Signer:", deployer.address);

  const forceDeploy = process.env.FORCE_DEPLOY === "true";
  let targetAddress =
    process.env.ZEROVAULT_CONTRACT_ADDRESS || "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
  console.log("Contract Address:", targetAddress);

  let newlyDeployed = false;
  const code = await ethers.provider.getCode(targetAddress);
  if (forceDeploy || !code || code === "0x") {
    console.log(`[Recommit] ${forceDeploy ? "FORCE_DEPLOY requested" : "No contract bytecode found"}. Deploying fresh ZeroVault...`);
    const commitTimeout = process.env.COMMIT_TIMEOUT ? parseInt(process.env.COMMIT_TIMEOUT) : 1;
    const reclaimTimeout = process.env.RECLAIM_TIMEOUT ? parseInt(process.env.RECLAIM_TIMEOUT) : 1;
    console.log(`[Recommit] Deploying ZeroVault with COMMIT_TIMEOUT=${commitTimeout}s, RECLAIM_TIMEOUT=${reclaimTimeout}s (Instant Demo Mode)...`);
    const ZeroVault = await ethers.getContractFactory("ZeroVault");
    const deployedVault = await ZeroVault.deploy(commitTimeout, reclaimTimeout);
    await deployedVault.waitForDeployment();
    targetAddress = await deployedVault.getAddress();
    newlyDeployed = true;
    console.log(`[Recommit] ZeroVault deployed to: ${targetAddress}`);

    // Auto-update backend/.env and frontend/src/lib/contracts.ts
    try {
      const fs = await import("fs");
      const path = await import("path");

      const rootEnvPath = path.resolve(__dirname, "../../.env");
      if (fs.existsSync(rootEnvPath)) {
        let envContent = fs.readFileSync(rootEnvPath, "utf8");
        envContent = envContent.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${targetAddress}"`);
        fs.writeFileSync(rootEnvPath, envContent, "utf8");
        console.log(`  -> Auto-updated root .env with ${targetAddress}`);
      }

      const backendEnvPath = path.resolve(__dirname, "../../backend/.env");
      if (fs.existsSync(backendEnvPath)) {
        let envContent = fs.readFileSync(backendEnvPath, "utf8");
        envContent = envContent.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${targetAddress}"`);
        fs.writeFileSync(backendEnvPath, envContent, "utf8");
        console.log(`  -> Auto-updated backend/.env with ${targetAddress}`);
      }

      const frontendContractsPath = path.resolve(__dirname, "../../frontend/src/lib/contracts.ts");
      if (fs.existsSync(frontendContractsPath)) {
        let contractsContent = fs.readFileSync(frontendContractsPath, "utf8");
        contractsContent = contractsContent.replace(
          /DEFAULT_ZEROVAULT_ADDRESS = process\.env\.NEXT_PUBLIC_ZEROVAULT_ADDRESS \|\| ['"].*?['"];/,
          `DEFAULT_ZEROVAULT_ADDRESS = process.env.NEXT_PUBLIC_ZEROVAULT_ADDRESS || '${targetAddress}';`
        );
        fs.writeFileSync(frontendContractsPath, contractsContent, "utf8");
        console.log(`  -> Auto-updated frontend/src/lib/contracts.ts with ${targetAddress}`);
      }
    } catch (e: any) {
      console.warn("Could not auto-update config files:", e.message);
    }
  }

  const vault = await ethers.getContractAt("ZeroVault", targetAddress, deployer);
  const adminRole = await vault.ADMIN_ROLE();
  const defaultAdminRole = await vault.DEFAULT_ADMIN_ROLE();

  // ─────────────────────────────────────────────────────────────
  // 1. RECONCILE ADMIN ROLES
  // ─────────────────────────────────────────────────────────────
  console.log("\n[1/4] Reconciling Admin Roles...");
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
  });

  for (const admin of adminUsers) {
    if (!admin.wallet_address) continue;
    const hasAdmin = await vault.hasRole(adminRole, admin.wallet_address);
    if (!hasAdmin) {
      console.log(`  -> Granting ADMIN_ROLE to ${admin.profile_name || 'Admin'} (${admin.wallet_address})...`);
      const tx = await vault.grantRole(adminRole, admin.wallet_address);
      await tx.wait(1);
      console.log(`     [OK] ADMIN_ROLE granted.`);
    } else {
      console.log(`  -> ${admin.profile_name || 'Admin'} (${admin.wallet_address}) already has ADMIN_ROLE.`);
    }

    const hasDefaultAdmin = await vault.hasRole(defaultAdminRole, admin.wallet_address);
    if (!hasDefaultAdmin) {
      console.log(`  -> Granting DEFAULT_ADMIN_ROLE (emergency pause) to ${admin.profile_name || 'Admin'} (${admin.wallet_address})...`);
      const tx = await vault.grantRole(defaultAdminRole, admin.wallet_address);
      await tx.wait(1);
      console.log(`     [OK] DEFAULT_ADMIN_ROLE granted.`);
    } else {
      console.log(`  -> ${admin.profile_name || 'Admin'} (${admin.wallet_address}) already has DEFAULT_ADMIN_ROLE.`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RECONCILE BUYER KYC STATUS
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2/4] Reconciling Buyer KYC Status...");
  const buyers = await prisma.user.findMany({
    where: { role: "BUYER" },
  });

  for (const buyer of buyers) {
    if (!buyer.wallet_address) continue;
    const onChainKYC = await vault.isKYCVerified(buyer.wallet_address);

    if (buyer.verified_buyer && !onChainKYC) {
      console.log(`  -> Setting on-chain KYC for ${buyer.profile_name || 'Buyer'} (${buyer.wallet_address}) to TRUE...`);
      const tx = await vault.setKYCStatus(buyer.wallet_address, true);
      await tx.wait(1);
      console.log(`     [OK] KYC status verified on-chain.`);
    } else if (!buyer.verified_buyer && onChainKYC) {
      console.log(`  -> Updating DB KYC status for ${buyer.profile_name || 'Buyer'} to TRUE (matching on-chain)...`);
      await prisma.user.update({
        where: { id: buyer.id },
        data: { verified_buyer: true },
      });
      console.log(`     [OK] Database updated to verified.`);
    } else {
      console.log(`  -> ${buyer.profile_name || 'Buyer'} (${buyer.wallet_address}) KYC is in sync (${onChainKYC ? 'VERIFIED' : 'UNVERIFIED'}).`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RECONCILE LISTINGS & COMMITMENTS
  // ─────────────────────────────────────────────────────────────
  console.log("\n[3/4] Reconciling Vulnerability Listings...");
  const listings = await prisma.vulnerabilityListing.findMany({
    where: {
      status: {
        in: [ListingStatus.COMMITTED, ListingStatus.BOUNTY_LOCKED],
      },
    },
    include: { seller: true },
  });

  for (const listing of listings) {
    if (!listing.merkle_root) continue;

    try {
      const escrow = await vault.escrows(listing.merkle_root);
      const onChainState = Number(escrow.state);

      if (onChainState === 0) {
        // State.NONE -> Listing is in DB but missing on-chain
        console.log(`  -> Re-committing listing "${listing.title}" (${listing.merkle_root.slice(0, 14)}...)...`);
        
        let sellerSigner: any = deployer;
        if (listing.seller?.wallet_address) {
          try {
            sellerSigner = await ethers.getSigner(listing.seller.wallet_address);
          } catch {
            sellerSigner = deployer;
          }
        }

        let vendor = listing.vendor_address || ethers.ZeroAddress;
        // Seller cannot be vendor
        if (sellerSigner.address.toLowerCase() === vendor.toLowerCase()) {
          vendor = ethers.ZeroAddress;
        }

        let askingPrice = ethers.parseEther("0.01");
        if (listing.price_wei) {
          try {
            askingPrice = BigInt(listing.price_wei);
          } catch {
            askingPrice = ethers.parseEther("0.01");
          }
        } else if ((listing as any).asking_price_eth) {
          try {
            askingPrice = ethers.parseEther((listing as any).asking_price_eth.toString());
          } catch {
            askingPrice = ethers.parseEther("0.01");
          }
        }
        if (askingPrice < 1000000000000000n) { // MIN_BOUNTY 0.001 ETH
          askingPrice = 1000000000000000n;
        }

        const ipfsHash = listing.ipfs_hash || ethers.keccak256(ethers.toUtf8Bytes(listing.id || "default_ipfs"));

        const tx = await vault.connect(sellerSigner).commitVulnerability(
          listing.merkle_root,
          listing.key_hash || ethers.ZeroHash,
          vendor,
          askingPrice,
          ipfsHash
        );
        await tx.wait(1);
        console.log(`     [OK] Successfully re-committed on-chain by seller ${sellerSigner.address}.`);
      } else {
        const stateLabels = ["NONE", "COMMITTED", "BOUNTY_LOCKED", "SETTLED", "EXPIRED", "REFUNDED"];
        console.log(`  -> "${listing.title}" exists on-chain with state: ${stateLabels[onChainState] || onChainState}. Seller: ${escrow.seller}, Vendor: ${escrow.vendor}`);
      }
    } catch (err: any) {
      console.warn(`  -> Could not check/commit listing "${listing.title}":`, err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. RECONCILE BRIDGE BLOCK CURSOR
  // ─────────────────────────────────────────────────────────────
  console.log("\n[4/4] Reconciling Web3 Bridge Sync State...");
  const currentBlock = await ethers.provider.getBlockNumber();
  await prisma.syncState.upsert({
    where: { id: "singleton" },
    update: { last_processed_block: currentBlock },
    create: { id: "singleton", last_processed_block: currentBlock },
  });
  console.log(`  -> SyncState cursor set to block ${currentBlock}.`);

  console.log("\n==================================================");
  console.log("  Reconciliation Complete! All states synchronized.");
  console.log("==================================================");
}

main()
  .catch((error) => {
    console.error("Reconciliation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
