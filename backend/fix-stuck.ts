import { PrismaClient } from '@prisma/client';
import { JsonRpcProvider, Contract } from 'ethers';

const ZEROVAULT_ABI = [
  "function escrows(bytes32) view returns (bytes32 keyHash, address seller, address vendor, uint256 bountyAmount, uint256 commitTimestamp, uint256 bountyLockedAt, uint8 state)"
];

async function main() {
  const prisma = new PrismaClient();
  const provider = new JsonRpcProvider('http://127.0.0.1:8545');
  const contractAddress = process.env.ZEROVAULT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const contract = new Contract(contractAddress, ZEROVAULT_ABI, provider);

  const listings = await prisma.vulnerabilityListing.findMany({
    where: { status: 'COMMITTED' }
  });

  for (const l of listings) {
    try {
      const result = await contract.escrows(l.merkle_root);
      const state = Number(result[6] || result.state);
      if (state === 2) {
        console.log(`Fixing listing ${l.id} to BOUNTY_LOCKED`);
        await prisma.vulnerabilityListing.update({
          where: { id: l.id },
          data: { status: 'BOUNTY_LOCKED' }
        });
      }
    } catch (e) {
      console.log(`Error checking ${l.id}`, e);
    }
  }
}
main();
