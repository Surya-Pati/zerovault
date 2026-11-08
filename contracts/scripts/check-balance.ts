import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [signer] = await ethers.getSigners();
  const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || "0x66AfE225958aF56E6fB99995897ED3EF17013185";
  const userWallet = "0x7e627b8eb7f129719da32e315a20b0f39a1e4bc9";
  
  const signerBalance = await ethers.provider.getBalance(signer.address);
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  const userBalance = await ethers.provider.getBalance(userWallet);
  
  console.log("==================================================");
  console.log("  ZeroVault Network & Balance Diagnostic");
  console.log("==================================================");
  console.log("Network Name:    ", (await ethers.provider.getNetwork()).name);
  console.log("Network ChainId: ", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("Signer Address:  ", signer.address);
  console.log("Signer Balance:  ", ethers.formatEther(signerBalance), "ETH");
  console.log("Contract Address:", contractAddress);
  console.log("Contract Balance:", ethers.formatEther(contractBalance), "ETH");
  console.log("User Wallet:     ", userWallet);
  console.log("User Balance:    ", ethers.formatEther(userBalance), "ETH");

  const code = await ethers.provider.getCode(contractAddress);
  console.log("Contract Bytecode Present:", code !== "0x");

  if (code !== "0x") {
    const vault = await ethers.getContractAt("ZeroVault", contractAddress);
    const isSignerKyc = await vault.isKYCVerified(signer.address);
    const isUserKyc = await vault.isKYCVerified(userWallet);
    console.log("Signer KYC Status: ", isSignerKyc);
    console.log("User KYC Status:   ", isUserKyc);
  }
}

main().catch(console.error).finally(() => process.exit(0));
