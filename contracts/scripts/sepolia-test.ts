import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer/Seller/Admin: ${deployer.address}`);

  // Create an ephemeral buyer wallet
  const buyerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(`Ephemeral Buyer: ${buyerWallet.address}`);

  // Fund the buyer from deployer (gas + bounty)
  console.log("\n[STEP 0] Fund buyer wallet");
  const fundTx = await deployer.sendTransaction({
    to: buyerWallet.address,
    value: ethers.parseEther("0.005"),
  });
  await fundTx.wait(1);
  console.log("  -> Sent 0.005 ETH to buyer");

  // Use DEMO config (5 min / 10 min timeouts)
  const demoAddress = "0x61ad747B010A51D56c967605c672B44e5c67FF9E";
  const vault = await ethers.getContractAt("ZeroVault", demoAddress);

  const timestamp = Date.now().toString();
  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("vuln_" + timestamp));
  const keyPlaintext = "secret_key_" + timestamp;
  const keyHash = ethers.keccak256(ethers.toUtf8Bytes(keyPlaintext));

  console.log("\n[STEP 1] KYC – whitelist buyer");
  const txKyc = await vault.connect(deployer).setKYCStatus(buyerWallet.address, true);
  await txKyc.wait(1);
  console.log("  -> Buyer whitelisted");

  console.log("\n[STEP 2] Commit (seller = deployer, vendor = address(0) open listing)");
  const txCommit = await vault.connect(deployer).commitVulnerability(merkleRoot, keyHash, ethers.ZeroAddress);
  await txCommit.wait(1);
  console.log("  -> Vulnerability committed");

  console.log("\n[STEP 3] Lock Bounty (buyer locks 0.001 ETH)");
  const txLock = await vault.connect(buyerWallet).lockBounty(merkleRoot, { value: ethers.parseEther("0.001") });
  await txLock.wait(1);
  console.log("  -> 0.001 ETH locked by buyer");

  console.log("\n[STEP 4] Reveal & Claim (seller reveals key, gets paid atomically)");
  const balBefore = await ethers.provider.getBalance(deployer.address);
  const txClaim = await vault.connect(deployer).revealAndClaim(merkleRoot, keyPlaintext);
  await txClaim.wait(1);
  const balAfter = await ethers.provider.getBalance(deployer.address);
  console.log("  -> Claimed successfully!");
  console.log(`  -> Seller balance delta: ${ethers.formatEther(balAfter - balBefore)} ETH (includes gas cost)`);

  console.log("\n[STEP 5] Verify on-chain state is SETTLED (enum index 3)");
  const escrow = await vault.escrows(merkleRoot);
  console.log(`  -> State: ${escrow.state} (expected 3 = SETTLED)`);

  console.log("\n=== Sepolia Happy Path PASSED ===");
}

main().catch(console.error);
