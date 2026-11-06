import { ethers, network, run } from "hardhat";

async function main() {
  console.log("Deploying ZeroVault instances...");
  console.log("Network:", network.name);

  if (network.name !== "sepolia" && network.name !== "hardhat" && network.name !== "localhost") {
    throw new Error("Must ask user before deploying anywhere other than Sepolia testnet or local network.");
  }

  const ZeroVault = await ethers.getContractFactory("ZeroVault");

  // 1. Production Config (7 days, 14 days)
  const prodCommit = 7 * 24 * 60 * 60;
  const prodReclaim = 14 * 24 * 60 * 60;
  console.log("Deploying Production Config...");
  const prodVault = await ZeroVault.deploy(prodCommit, prodReclaim);
  await prodVault.waitForDeployment();
  const prodAddress = await prodVault.getAddress();
  console.log(`Production ZeroVault deployed to: ${prodAddress}`);

  // 2. Demo Config (5 mins, 10 mins)
  const demoCommit = 5 * 60;
  const demoReclaim = 10 * 60;
  console.log("Deploying Demo Config...");
  const demoVault = await ZeroVault.deploy(demoCommit, demoReclaim);
  await demoVault.waitForDeployment();
  const demoAddress = await demoVault.getAddress();
  console.log(`Demo ZeroVault deployed to: ${demoAddress}`);

  // Automatically grant ADMIN_ROLE and DEFAULT_ADMIN_ROLE to local admin account in dev
  if (network.name === "localhost" || network.name === "hardhat") {
    const localAdmin = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const adminRole = await prodVault.ADMIN_ROLE();
    const defaultAdminRole = await prodVault.DEFAULT_ADMIN_ROLE();
    await (await prodVault.grantRole(adminRole, localAdmin)).wait(1);
    await (await prodVault.grantRole(defaultAdminRole, localAdmin)).wait(1);
    await (await demoVault.grantRole(adminRole, localAdmin)).wait(1);
    await (await demoVault.grantRole(defaultAdminRole, localAdmin)).wait(1);
    console.log(`Granted ADMIN_ROLE and DEFAULT_ADMIN_ROLE to ${localAdmin}`);
  }

  if (network.name !== "hardhat" && network.name !== "localhost") {
    // Wait for a few block confirmations to ensure Etherscan has the bytecode
    console.log("Waiting for block confirmations...");
    await prodVault.deploymentTransaction()?.wait(5);
    await demoVault.deploymentTransaction()?.wait(5);

    console.log("Verifying Production ZeroVault on Etherscan...");
    try {
      await run("verify:verify", {
        address: prodAddress,
        constructorArguments: [prodCommit, prodReclaim],
      });
    } catch (e: any) {
      console.error("Verification failed:", e.message);
    }

    console.log("Verifying Demo ZeroVault on Etherscan...");
    try {
      await run("verify:verify", {
        address: demoAddress,
        constructorArguments: [demoCommit, demoReclaim],
      });
    } catch (e: any) {
      console.error("Verification failed:", e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
