import { ethers } from "hardhat";
import crypto from 'crypto';

async function main() {
  console.log("=== On-Chain E2E Execution ===");
  const [admin, seller, buyer] = await ethers.getSigners();
  
  const ZeroVault = await ethers.getContractFactory("ZeroVault");
  const vault = await ZeroVault.deploy(7 * 24 * 60 * 60, 14 * 24 * 60 * 60);
  await vault.waitForDeployment();
  console.log("[+] Vault deployed at:", await vault.getAddress());

  console.log("\n[STEP 1] KYC");
  await vault.connect(admin).setKYCStatus(buyer.address, true);
  console.log("  -> Buyer whitelisted");

  console.log("\n[STEP 2] Commit");
  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("vuln_1"));
  const keyHash = ethers.keccak256(ethers.toUtf8Bytes("secret_key"));
  await vault.connect(seller).commitVulnerability(merkleRoot, keyHash, buyer.address);
  console.log("  -> Vulnerability committed");

  console.log("\n[STEP 3] Lock Bounty");
  await vault.connect(buyer).lockBounty(merkleRoot, { value: ethers.parseEther("1.0") });
  console.log("  -> 1.0 ETH locked");

  console.log("\n[STEP 4] Reveal & Atomic Claim");
  await vault.connect(seller).revealAndClaim(merkleRoot, "secret_key");
  console.log("  -> Key verified and 1.0 ETH paid to seller atomically");
  console.log("\n=== Success ===");
}

main().catch(console.error);
