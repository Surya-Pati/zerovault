import { JsonRpcProvider, Wallet, Contract, parseEther } from 'ethers';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3001/api';
const RPC_URL = 'http://127.0.0.1:8545';
const ZEROVAULT_ABI = [
  "function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external",
  "function lockBounty(bytes32 merkleRoot) external payable",
  "function revealAndClaim(bytes32 merkleRoot, string calldata key) external"
];
// Hardhat default accounts
const SELLER_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // Account 2
const BUYER_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // Account 3
const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'; // from .env

async function auth(wallet: Wallet, role: 'RESEARCHER' | 'BUYER') {
  const address = await wallet.getAddress();
  const wallet_address = address.toLowerCase();
  
  // 1. Ensure user exists
  let user = await prisma.user.findUnique({ where: { wallet_address } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        wallet_address,
        role,
        profile_name: `Test${role}-${wallet_address.slice(2,8)}`
      }
    });
  }
  
  // 2. Generate JWT
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-only-do-not-use-in-production-12345';
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const tokenCookie = `session=${token}`;
  
  // 3. Fetch CSRF token to seed double-csrf
  const csrfRes = await fetch(`${API_BASE}/auth/csrf-token`);
  const csrfData: any = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  
  const csrfCookieHeader = csrfRes.headers.get('set-cookie') || '';
  let justCsrfCookie = '';
  const csrfMatch = csrfCookieHeader.match(/(_csrf=[^;]+)/);
  if (csrfMatch) justCsrfCookie = csrfMatch[1];
  
  const fullCookie = `${justCsrfCookie}; ${tokenCookie}`;
  return { csrfToken, cookie: fullCookie };
}

async function main() {
  console.log("Starting E2E Test...");
  const provider = new JsonRpcProvider(RPC_URL);
  const sellerWallet = new Wallet(SELLER_KEY, provider);
  const buyerWallet = new Wallet(BUYER_KEY, provider);

  const sellerContract = new Contract(CONTRACT_ADDRESS, ZEROVAULT_ABI, sellerWallet);
  const buyerContract = new Contract(CONTRACT_ADDRESS, ZEROVAULT_ABI, buyerWallet);

  // 1. Auth
  console.log("Authenticating Seller...");
  const sellerAuth = await auth(sellerWallet, "RESEARCHER");
  console.log("Authenticating Buyer...");
  const buyerAuth = await auth(buyerWallet, "BUYER");

  const buyerAddress = await buyerWallet.getAddress();
  
  // 2. Submit Listing
  console.log("Seller creating listing...");
  const payloadText = "Super secret vulnerability " + Date.now();
  const resListing = await fetch(`${API_BASE}/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sellerAuth.cookie, 'x-csrf-token': sellerAuth.csrfToken },
    body: JSON.stringify({
      title: "E2E Test Bug " + Date.now(),
      category: "SMART_CONTRACT",
      severity: "HIGH",
      price_wei: parseEther("0.1").toString(),
      vendor_id: buyerAddress,
      payloadText
    }) 
  });
  
  if (!resListing.ok) throw new Error("Failed to create listing: " + await resListing.text());
  const listingData: any = await resListing.json();
  const listing = listingData.listing;
  const decryptionKey = listing.decryptionKey;
  
  // Compute keyHash since backend does not return it in the listing response
  const { keccak256, toUtf8Bytes } = require('ethers');
  const keyHash = keccak256(toUtf8Bytes(decryptionKey));
  
  console.log(`Listing Created: ID ${listing.id}, Merkle: ${listing.merkle_root}, KeyHash: ${keyHash}`);

  await new Promise(r => setTimeout(r, 1000));

  // 3. Commit on Chain
  console.log("Seller committing on-chain...");
  const tx1 = await sellerContract.commitVulnerability(listing.merkle_root, keyHash, buyerAddress);
  await tx1.wait();
  console.log("Committed.");

  await new Promise(r => setTimeout(r, 1000));

  // 4. Buyer locks bounty
  console.log("Buyer locking bounty...");
  const tx2 = await buyerContract.lockBounty(listing.merkle_root, { value: parseEther("0.1") });
  await tx2.wait();
  console.log("Bounty Locked.");

  await new Promise(r => setTimeout(r, 1000));

  // 5. Buyer syncs /fund
  console.log("Buyer syncing /fund...");
  const resFund = await fetch(`${API_BASE}/listings/${listing.id}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': buyerAuth.cookie, 'x-csrf-token': buyerAuth.csrfToken },
    body: JSON.stringify({ tx_hash_fund: tx2.hash, contract_address: CONTRACT_ADDRESS })
  });
  if (!resFund.ok) throw new Error("Fund failed: " + await resFund.text());
  console.log("Fund sync successful.");

  await new Promise(r => setTimeout(r, 2000));

  // 6. Seller reveals key
  console.log("Seller revealing key...");
  const tx3 = await sellerContract.revealAndClaim(listing.merkle_root, decryptionKey);
  await tx3.wait();
  console.log("Key revealed.");

  await new Promise(r => setTimeout(r, 1000));

  // 7. Seller syncs /settle
  console.log("Seller syncing /settle...");
  const resSettle = await fetch(`${API_BASE}/listings/${listing.id}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sellerAuth.cookie, 'x-csrf-token': sellerAuth.csrfToken },
    body: JSON.stringify({ tx_hash_settle: tx3.hash, decryptionKey })
  });
  if (!resSettle.ok) throw new Error("Settle failed: " + await resSettle.text());
  console.log("Settle sync successful.");

  await new Promise(r => setTimeout(r, 1000));

  // 8. Buyer downloads payload
  console.log("Buyer downloading payload...");
  const resPayload = await fetch(`${API_BASE}/listings/${listing.id}/payload`, {
    headers: { 'Cookie': buyerAuth.cookie } // GET request doesn't strictly need csrf, but good to have cookie
  });
  if (!resPayload.ok) throw new Error("Payload fetch failed: " + await resPayload.text());
  
  const encData: any = await resPayload.json();
  console.log("Downloaded Encrypted Payload successfully.");

  // 9. Buyer decrypts payload locally (simulating the client-side decryption)
  console.log("Decrypting payload...");
  try {
    const iv = Buffer.from(encData.iv, 'hex');
    const key = Buffer.from(decryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    const ciphertextBuf = Buffer.from(encData.ciphertext, 'base64');
    const tag = ciphertextBuf.subarray(ciphertextBuf.length - 16);
    const content = ciphertextBuf.subarray(0, ciphertextBuf.length - 16);
    
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(content);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    if (decrypted.toString('utf8') === payloadText) {
      console.log("SUCCESS! E2E Flow verified perfectly.");
    } else {
      console.log("FAILED! Plaintext mismatch. Got: " + decrypted.toString('utf8'));
    }
  } catch (err) {
    console.log("Decryption threw error:", err);
  }
}

main().catch(console.error);
