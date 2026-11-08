import { ethers, network, run } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  console.log("==================================================");
  console.log("  ZeroVault Sepolia Testnet Deployment");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "Sepolia ETH");

  if (balance < ethers.parseEther("0.005")) {
    console.warn("WARNING: Low Sepolia ETH balance. Make sure you have at least 0.005 Sepolia ETH for gas.");
  }

  // Demo timeouts: 15 seconds for live presentation
  // (Allows demonstrating Dead Man's Switch and Bounty Reclaim within 1-2 Sepolia blocks)
  const commitTimeout = process.env.SEPOLIA_COMMIT_TIMEOUT ? parseInt(process.env.SEPOLIA_COMMIT_TIMEOUT) : 15;
  const reclaimTimeout = process.env.SEPOLIA_RECLAIM_TIMEOUT ? parseInt(process.env.SEPOLIA_RECLAIM_TIMEOUT) : 15;

  console.log(`\nDeploying ZeroVault with COMMIT_TIMEOUT=${commitTimeout}s, RECLAIM_TIMEOUT=${reclaimTimeout}s...`);
  const maxPriorityFee = ethers.parseUnits("0.05", "gwei");
  const maxFee = ethers.parseUnits("0.2", "gwei");
  console.log(`Gas configuration: maxFeePerGas = 0.2 gwei, maxPriorityFee = 0.05 gwei, gasLimit = 13,500,000`);

  const ZeroVault = await ethers.getContractFactory("ZeroVault");
  const vault = await ZeroVault.deploy(commitTimeout, reclaimTimeout, {
    gasLimit: 13500000,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxPriorityFee,
  });
  
  console.log("Waiting for deployment transaction confirmation on Sepolia...");
  await vault.waitForDeployment();
  const contractAddress = await vault.getAddress();

  console.log(`\n>>> [SUCCESS] ZeroVault deployed to Sepolia: ${contractAddress}`);
  console.log(`Etherscan link: https://sepolia.etherscan.io/address/${contractAddress}`);

  // Whitelist buyers for demo
  console.log("\nWhitelisting buyer accounts on Sepolia...");
  const buyerWallets = [
    "0x7e627b8eb7f129719da32e315a20b0f39a1e4bc9", // User MetaMask wallet
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ];
  for (const buyer of buyerWallets) {
    try {
      console.log(`  -> Whitelisting ${buyer}...`);
      const kycTx = await vault.setKYCStatus(buyer, true, {
        gasLimit: 60000,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriorityFee,
      });
      await kycTx.wait(1);
      console.log(`     [OK] ${buyer} whitelisted on Sepolia.`);
    } catch (e: any) {
      console.warn(`     [WARN] Could not whitelist ${buyer}:`, e.message);
    }
  }

  // Automatically update config files
  console.log("\nUpdating configuration files to point to Sepolia...");
  const rootEnvPath = path.resolve(__dirname, "../../.env");
  const backendEnvPath = path.resolve(__dirname, "../../backend/.env");
  const frontendContractsPath = path.resolve(__dirname, "../../frontend/src/lib/contracts.ts");

  const sepoliaRpc = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/alch_6Vg9aD0dEisSAvxZ4lUfn";

  if (fs.existsSync(rootEnvPath)) {
    let content = fs.readFileSync(rootEnvPath, "utf8");
    content = content.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${contractAddress}"`);
    content = content.replace(/RPC_URL=".*?"/, `RPC_URL="${sepoliaRpc}"`);
    fs.writeFileSync(rootEnvPath, content, "utf8");
    console.log("  -> Updated root .env");
  }

  if (fs.existsSync(backendEnvPath)) {
    let content = fs.readFileSync(backendEnvPath, "utf8");
    content = content.replace(/ZEROVAULT_CONTRACT_ADDRESS=".*?"/, `ZEROVAULT_CONTRACT_ADDRESS="${contractAddress}"`);
    content = content.replace(/RPC_URL=".*?"/, `RPC_URL="${sepoliaRpc}"`);
    fs.writeFileSync(backendEnvPath, content, "utf8");
    console.log("  -> Updated backend/.env");
  }

  // Update frontend .env.local
  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env.local");
  const frontendEnvContent = `NEXT_PUBLIC_ZEROVAULT_ADDRESS="${contractAddress}"
NEXT_PUBLIC_RPC_URL="${sepoliaRpc}"
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_API_URL=http://localhost:3001/api
`;
  fs.writeFileSync(frontendEnvPath, frontendEnvContent, "utf8");
  console.log("  -> Generated frontend/.env.local");

  if (fs.existsSync(frontendContractsPath)) {
    let content = fs.readFileSync(frontendContractsPath, "utf8");
    content = content.replace(
      /DEFAULT_ZEROVAULT_ADDRESS = process\.env\.NEXT_PUBLIC_ZEROVAULT_ADDRESS \|\| ['"].*?['"];/,
      `DEFAULT_ZEROVAULT_ADDRESS = process.env.NEXT_PUBLIC_ZEROVAULT_ADDRESS || '${contractAddress}';`
    );
    fs.writeFileSync(frontendContractsPath, content, "utf8");
    console.log("  -> Updated frontend/src/lib/contracts.ts address fallback");
  }

  // Attempt Etherscan verification
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nWaiting 5 block confirmations for Etherscan verification...");
    try {
      await vault.deploymentTransaction()?.wait(5);
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [commitTimeout, reclaimTimeout],
      });
      console.log("  -> [OK] Contract verified on Etherscan!");
    } catch (err: any) {
      console.warn("  -> Verification notice:", err.message);
    }
  }

  console.log("\n==================================================");
  console.log("  Sepolia Setup Complete!");
  console.log(`  Contract: ${contractAddress}`);
  console.log("  Chain ID: 11155111");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
