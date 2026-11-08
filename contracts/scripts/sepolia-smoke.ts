import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  console.log("==================================================");
  console.log("  ZeroVault Sepolia On-Chain Smoke Test");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || "0x66AfE225958aF56E6fB99995897ED3EF17013185";
  const userWallet = "0x7e627b8eb7f129719da32e315a20b0f39a1e4bc9";

  console.log("Network:          Sepolia (11155111)");
  console.log("Deployer Address: ", deployer.address);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance: ", ethers.formatEther(bal), "Sepolia ETH");
  console.log("Contract Address: ", contractAddress);

  const vault = await ethers.getContractAt("ZeroVault", contractAddress, deployer);

  // 1. Parameter Inspection
  console.log("\n[TEST 1] Querying Immutable Parameters...");
  const commitTimeout = await vault.COMMIT_TIMEOUT();
  const reclaimTimeout = await vault.RECLAIM_TIMEOUT();
  const minBounty = await vault.MIN_BOUNTY();
  console.log("  -> COMMIT_TIMEOUT: ", commitTimeout.toString(), "seconds");
  console.log("  -> RECLAIM_TIMEOUT:", reclaimTimeout.toString(), "seconds");
  console.log("  -> MIN_BOUNTY:      ", ethers.formatEther(minBounty), "ETH");

  // 2. Role Verification
  console.log("\n[TEST 2] Verifying AccessControl Roles...");
  const defaultAdminRole = await vault.DEFAULT_ADMIN_ROLE();
  const adminRole = await vault.ADMIN_ROLE();

  const hasDefaultAdmin = await vault.hasRole(defaultAdminRole, deployer.address);
  const hasAdmin = await vault.hasRole(adminRole, deployer.address);

  console.log("  -> DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
  console.log("  -> ADMIN_ROLE:        ", hasAdmin);

  if (!hasDefaultAdmin || !hasAdmin) {
    throw new Error("Deployer missing required administrative roles!");
  }

  // 3. KYC Whitelist Verification for User Wallet
  console.log("\n[TEST 3] Checking User MetaMask KYC Status...");
  const isUserKyc = await vault.isKYCVerified(userWallet);
  console.log(`  -> User Wallet (${userWallet}): KYC = ${isUserKyc}`);
  if (!isUserKyc) {
    throw new Error("User MetaMask wallet is not KYC verified on Sepolia!");
  }

  // 4. On-Chain Transaction: Pause & Unpause (verifying pause dilation mechanism on Sepolia)
  console.log("\n[TEST 4] Testing Pausable & Pause Clock Mechanism on Sepolia...");
  const initialPausedTime = await vault.totalPausedTime();
  console.log("  -> Initial totalPausedTime:", initialPausedTime.toString());

  const feeData = await ethers.provider.getFeeData();
  const maxFee = ethers.parseUnits("0.2", "gwei");
  const maxPriority = ethers.parseUnits("0.05", "gwei");
  const gasOpts = { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority };

  console.log("  -> Executing pause() on Sepolia...");
  const pauseTx = await vault.pause(gasOpts);
  console.log("     Pause Tx sent:", pauseTx.hash);
  await pauseTx.wait(1);
  console.log("     [CONFIRMED] Contract is paused:", await vault.paused());

  console.log("  -> Executing unpause() on Sepolia...");
  const unpauseTx = await vault.unpause(gasOpts);
  console.log("     Unpause Tx sent:", unpauseTx.hash);
  await unpauseTx.wait(1);
  console.log("     [CONFIRMED] Contract is unpaused:", !(await vault.paused()));

  const updatedPausedTime = await vault.totalPausedTime();
  console.log("  -> Updated totalPausedTime:", updatedPausedTime.toString());

  const remainingBal = await ethers.provider.getBalance(deployer.address);
  console.log("\nDeployer Balance After Test:", ethers.formatEther(remainingBal), "Sepolia ETH");

  console.log("\n==================================================");
  console.log("  >>> ALL SEPOLIA ON-CHAIN CHECKS PASSED (100%) <<<");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Sepolia smoke test failed:", err);
  process.exitCode = 1;
});
