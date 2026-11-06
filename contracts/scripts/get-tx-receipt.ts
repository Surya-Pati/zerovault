import { ethers } from "hardhat";

async function main() {
  const latestBlockNum = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlockNum);
  
  for (let i = Math.max(0, latestBlockNum - 5); i <= latestBlockNum; i++) {
    const block = await ethers.provider.getBlock(i);
    if (!block || block.transactions.length === 0) continue;
    
    for (const txHash of block.transactions) {
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      if (!receipt) continue;
      console.log(`Block ${i} - Tx ${txHash} - To ${receipt.to} - Status ${receipt.status}`);
      if (receipt.logs.length > 0) {
        console.log(`  Emitted ${receipt.logs.length} logs`);
        console.log(`    Log topics:`, receipt.logs.map(l => l.topics));
      }
    }
  }
}

main().catch(console.error);
