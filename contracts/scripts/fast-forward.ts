import { ethers, network } from "hardhat";

async function main() {
  const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
  
  console.log("Current block timestamp:", (await ethers.provider.getBlock("latest"))?.timestamp);
  console.log(`Fast-forwarding time by 7 days (${SEVEN_DAYS_IN_SECONDS} seconds)...`);
  
  await network.provider.send("evm_increaseTime", [SEVEN_DAYS_IN_SECONDS]);
  await network.provider.send("evm_mine"); // mine the next block with the new timestamp
  
  console.log("New block timestamp:", (await ethers.provider.getBlock("latest"))?.timestamp);
  console.log("Done! You can now test the Dead Man's Switch.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
