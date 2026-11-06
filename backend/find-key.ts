import { JsonRpcProvider, Contract, Interface } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('http://127.0.0.1:8545');
  const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  
  const abi = [
    "function revealAndClaim(bytes32 merkleRoot, string _decryptionKey)"
  ];
  const iface = new Interface(abi);

  const currentBlock = await provider.getBlockNumber();
  
  // Search last 50 blocks
  for (let i = currentBlock; i > Math.max(0, currentBlock - 50); i--) {
    const block = await provider.getBlock(i, true);
    if (!block) continue;
    
    for (const tx of block.prefetchedTransactions) {
      if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
        try {
          const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
          if (decoded && decoded.name === 'revealAndClaim') {
            const merkleRoot = decoded.args[0];
            const decryptionKey = decoded.args[1];
            console.log(`Found revealAndClaim in block ${i}`);
            console.log(`MerkleRoot: ${merkleRoot}`);
            console.log(`DecryptionKey: ${decryptionKey}`);
            
            // Only update if it matches the current listing's merkle root
            if (merkleRoot === '0x8c578a3caa35e3c27ba5fce8bcfc9a3e9697efc91454de204c93e28c9051db14') {
              console.log("MATCH FOUND!");
              
              const { PrismaClient } = require('@prisma/client');
              const prisma = new PrismaClient();
              
              const listing = await prisma.vulnerabilityListing.findFirst({
                where: { merkle_root: merkleRoot },
                include: { escrow: true }
              });
              
              if (listing && listing.escrow) {
                await prisma.escrowTransaction.update({
                  where: { id: listing.escrow.id },
                  data: { decryption_key: decryptionKey }
                });
                console.log(`Updated database with decryption key for listing ${listing.id}`);
              }
              return; // Done
            }
          }
        } catch (e) {
          // Ignore parse errors (other functions)
        }
      }
    }
  }
  console.log("Not found");
}

main().catch(console.error);
