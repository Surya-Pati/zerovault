import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { encryptPayload } from '@zerovault/shared/dist/crypto';
import { createMerkleTree } from '@zerovault/shared/dist/merkle';

const prisma = new PrismaClient();

const ZERO_VAULT_ABI = [
  "function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external"
];

const PUBLIC_STORAGE_DIR = path.join(__dirname, 'storage', 'public');

async function main() {
  console.log('Seeding PERFECT demo listing...');

  // Ensure public storage directory exists
  if (!fs.existsSync(PUBLIC_STORAGE_DIR)) {
    fs.mkdirSync(PUBLIC_STORAGE_DIR, { recursive: true });
  }

  // 1. Prepare Payload & Cryptography
  const claims = [
    { key: "target", value: "Nginx 1.24.0" },
    { key: "cve", value: "CVE-2026-ZERO" },
    { key: "severity", value: "CRITICAL" }
  ];
  const treeResult = createMerkleTree(claims);
  const merkleRoot = treeResult.root;

  const rawPayload = "This is the highly sensitive 0-day exploit for Nginx 1.24.0. POC: GET / HTTP/2 ... BOOM!";
  
  // Encrypt payload (generates a valid 32-byte AES key)
  const encrypted = await encryptPayload(rawPayload);
  const decryptionKey = encrypted.key;
  
  // Hash the key for the smart contract commit
  const keyHash = ethers.keccak256(ethers.toUtf8Bytes(decryptionKey));

  // 2. Connect to Blockchain
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const sellerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const vendorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // User's MetaMask
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contract = new ethers.Contract(contractAddress, ZERO_VAULT_ABI, sellerWallet);

  console.log('Committing to blockchain with Merkle Root:', merkleRoot);
  try {
    const tx = await contract.commitVulnerability(merkleRoot, keyHash, vendorAddress);
    await tx.wait();
    console.log('✅ Blockchain commit successful!');
  } catch (err: any) {
    console.error('Blockchain commit failed:', err.message);
    process.exit(1);
  }

  // 3. Database Seed
  const seller = await prisma.user.create({
    data: {
      email: `demo_seller_${Date.now()}@zerovault.io`,
      password_hash: 'dummyhash',
      role: 'RESEARCHER',
    }
  });

  const listingId = `listing-${Date.now()}`;
  const filename = `${listingId}.enc`;
  const uri = path.join(PUBLIC_STORAGE_DIR, filename);

  const listing = await prisma.vulnerabilityListing.create({
    data: {
      id: listingId,
      seller_id: seller.id,
      title: 'Demo: Real Zero-Day Payload (Test Decryption)',
      category: 'Web Server',
      severity: 'CRITICAL',
      merkle_root: merkleRoot,
      price_wei: '1500000000000000000', // 1.5 ETH
      status: 'COMMITTED',
      encrypted_payload_uri: uri,
    }
  });

  // 4. Write Ciphertext File to Disk
  fs.writeFileSync(uri, JSON.stringify({
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv
  }));
  
  console.log('✅ Encrypted Payload written to disk at:', uri);
  console.log('✅ Demo Listing Created in Database!');
  console.log(`\n======================================`);
  console.log(`DECRYPTION KEY (SAVE THIS!): ${decryptionKey}`);
  console.log(`======================================\n`);
  
  // Also write a reveal script for this specific key
  const revealScript = `
import { ethers } from 'ethers';
const ZERO_VAULT_ABI = ["function revealAndClaim(bytes32 merkleRoot, string memory decryptionKey) external"];
async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const sellerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const contract = new ethers.Contract("${contractAddress}", ZERO_VAULT_ABI, sellerWallet);
  console.log("Revealing key and claiming bounty...");
  const tx = await contract.revealAndClaim("${merkleRoot}", "${decryptionKey}");
  await tx.wait();
  console.log("✅ Settlement Confirmed on Blockchain!");
}
main();
  `;
  fs.writeFileSync(path.join(__dirname, 'trigger_reveal.ts'), revealScript);
  console.log('I have created a `trigger_reveal.ts` script. Run it after the buyer locks the bounty!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
