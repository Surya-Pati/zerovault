import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const targetAddress = process.argv[2];
  if (!targetAddress || !ethers.isAddress(targetAddress)) {
    console.log("Usage: npx hardhat run scripts/whitelist-sepolia-buyer.ts --network sepolia <WALLET_ADDRESS>");
    process.exit(1);
  }

  const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || "0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091";
  const [signer] = await ethers.getSigners();

  console.log("==================================================");
  console.log("  Sepolia Buyer KYC Whitelist Manager");
  console.log("==================================================");
  console.log("Admin Signer:", signer.address);
  console.log("ZeroVault Contract:", contractAddress);
  console.log("Target Buyer Wallet:", targetAddress);

  const vault = await ethers.getContractAt("ZeroVault", contractAddress, signer);

  const isAlready = await vault.isKYCVerified(targetAddress);
  if (isAlready) {
    console.log(`\n[OK] Wallet ${targetAddress} is ALREADY verified for KYC on-chain!`);
    return;
  }

  console.log(`\nSubmitting setKYCStatus(${targetAddress}, true) to Sepolia...`);
  const tx = await vault.setKYCStatus(targetAddress, true);
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation on Sepolia...");
  await tx.wait(1);

  console.log(`\n>>> [SUCCESS] Wallet ${targetAddress} is now KYC-verified on Sepolia!`);
}

main().catch((err) => {
  console.error("KYC Whitelisting failed:", err);
  process.exitCode = 1;
});
