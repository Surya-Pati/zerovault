import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const targetWallet = process.argv[2];
  const amountEth = process.argv[3] || "0.005";

  if (!targetWallet || !ethers.isAddress(targetWallet)) {
    console.log("Usage: npx hardhat run scripts/fund-sepolia-wallets.ts --network sepolia <WALLET_ADDRESS> [AMOUNT_ETH]");
    process.exit(1);
  }

  const [funder] = await ethers.getSigners();
  console.log("==================================================");
  console.log("  Sepolia Wallet Funding Dispenser");
  console.log("==================================================");
  console.log("Funder Address:", funder.address);

  const funderBal = await ethers.provider.getBalance(funder.address);
  console.log("Funder Balance:", ethers.formatEther(funderBal), "Sepolia ETH");

  console.log(`\nSending ${amountEth} Sepolia ETH to ${targetWallet}...`);
  const tx = await funder.sendTransaction({
    to: targetWallet,
    value: ethers.parseEther(amountEth)
  });

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation on Sepolia...");
  await tx.wait(1);

  const newBal = await ethers.provider.getBalance(targetWallet);
  console.log(`>>> [SUCCESS] Wallet ${targetWallet} funded!`);
  console.log(`Current Balance: ${ethers.formatEther(newBal)} Sepolia ETH`);
}

main().catch((err) => {
  console.error("Funding failed:", err);
  process.exitCode = 1;
});
