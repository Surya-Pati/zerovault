import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

const ZERO_VAULT_ABI = [
  "function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external"
];

async function main() {
  console.log('Seeding demo listing into the database AND blockchain...');

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  
  // Use Hardhat Account 0 as the Seller
  const sellerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  
  // The user's metamask is usually Account 1 (0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
  const vendorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = new ethers.Contract(contractAddress, ZERO_VAULT_ABI, sellerWallet);

  // Generate a random merkle root to avoid conflicts if ran multiple times
  const uniqueMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes(`merkle_${Date.now()}`));
  const dummyKeyHash = ethers.keccak256(ethers.toUtf8Bytes("demo_key"));

  console.log('Committing to blockchain...');
  try {
    const tx = await contract.commitVulnerability(uniqueMerkleRoot, dummyKeyHash, vendorAddress);
    await tx.wait();
    console.log('✅ Blockchain commit successful!');
  } catch (err: any) {
    console.error('Blockchain commit failed. Make sure your local hardhat node is running.');
    console.error(err.message);
    process.exit(1);
  }

  // Create a dummy seller in DB
  const seller = await prisma.user.create({
    data: {
      email: `demo_seller_${Date.now()}@zerovault.io`,
      password_hash: 'dummyhash',
      role: 'RESEARCHER',
    }
  });

  // Create a dummy listing in DB mapping to the blockchain escrow
  const listing = await prisma.vulnerabilityListing.create({
    data: {
      seller_id: seller.id,
      title: 'Demo: Zero-Day RCE in Nginx 1.24.0 (On-Chain Linked)',
      category: 'Web Server',
      severity: 'CRITICAL',
      merkle_root: uniqueMerkleRoot,
      price_wei: '1500000000000000000', // 1.5 ETH
      status: 'COMMITTED',
      encrypted_payload_uri: null,
    }
  });

  console.log('✅ Demo Listing Created!');
  console.log(`Listing ID: ${listing.id}`);
  console.log(`Merkle Root: ${uniqueMerkleRoot}`);
  console.log(`Title: ${listing.title}`);
  console.log('You can now test the marketplace UI with this listing.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
