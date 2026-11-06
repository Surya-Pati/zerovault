import axios from 'axios';
import { ethers } from 'ethers';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001/api';
const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Hardhat default accounts
const SELLER_PRIV = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Account 0
const BUYER_PRIV = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Account 1

const ABI = [
  "function listVulnerability(bytes32 merkleRoot, uint256 price) external",
  "function fundEscrow(bytes32 merkleRoot) external payable",
  "function revealAndClaim(bytes32 merkleRoot, string calldata decryptionKey) external"
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting E2E Test...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const sellerWallet = new ethers.Wallet(SELLER_PRIV, provider);
  const buyerWallet = new ethers.Wallet(BUYER_PRIV, provider);
  const sellerContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, sellerWallet);
  const buyerContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, buyerWallet);

  // 1. Register users (ignore if already registered)
  let sellerToken, buyerToken;
  try {
    await axios.post(`${API_URL}/auth/register`, { email: 'seller_e2e@test.com', password: 'Password123!', role: 'RESEARCHER' });
  } catch (e) {}
  try {
    await axios.post(`${API_URL}/auth/register`, { email: 'buyer_e2e@test.com', password: 'Password123!', role: 'BUYER' });
  } catch (e) {}

  const sellerRes = await axios.post(`${API_URL}/auth/login`, { email: 'seller_e2e@test.com', password: 'Password123!' });
  sellerToken = sellerRes.data.token;
  console.log("Seller logged in.");

  const buyerRes = await axios.post(`${API_URL}/auth/login`, { email: 'buyer_e2e@test.com', password: 'Password123!' });
  buyerToken = buyerRes.data.token;
  console.log("Buyer logged in.");

  // 2. Create Listing
  const dummyFilePath = path.join(__dirname, 'dummy_e2e.txt');
  fs.writeFileSync(dummyFilePath, 'This is a test vulnerability payload.');
  
  const form = new FormData();
  form.append('title', 'E2E Test Vulnerability');
  form.append('category', 'AI');
  form.append('severity', 'CRITICAL');
  form.append('price_wei', ethers.parseEther('1.0').toString());
  form.append('payload', fs.createReadStream(dummyFilePath));

  const createRes = await axios.post(`${API_URL}/listings`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${sellerToken}` }
  });
  const listingId = createRes.data.id;
  const merkleRoot = createRes.data.merkle_root;
  const decryptionKey = createRes.data.decryption_key;
  console.log(`Listing created! ID: ${listingId}, Merkle: ${merkleRoot}`);

  // 3. Seller: listVulnerability on-chain (so buyer can fund it)
  // Wait, does the backend do this? No, the frontend researcher does this. But they only need to deploy it if they want.
  // Actually, the contract doesn't require `listVulnerability` for `fundEscrow` if it just funds it directly?
  // Let's call listVulnerability just in case the contract expects it.
  console.log("Seller submitting listVulnerability on-chain...");
  const txList = await sellerContract.listVulnerability(merkleRoot, ethers.parseEther('1.0'));
  await txList.wait();

  // 4. Buyer: Fund Escrow
  console.log("Buyer funding escrow on-chain...");
  const txFund = await buyerContract.fundEscrow(merkleRoot, { value: ethers.parseEther('1.0') });
  const rxFund = await txFund.wait();
  console.log(`Fund Tx Hash: ${rxFund.hash}`);

  console.log("Buyer calling POST /fund...");
  const fundApiRes = await axios.post(`${API_URL}/listings/${listingId}/fund`, { tx_hash_fund: rxFund.hash }, {
    headers: { Authorization: `Bearer ${buyerToken}` }
  });
  console.log("Fund API Response:", fundApiRes.data.listing.status);

  // 5. Seller: Reveal Key
  console.log("Seller revealing key on-chain...");
  const txSettle = await sellerContract.revealAndClaim(merkleRoot, decryptionKey);
  const rxSettle = await txSettle.wait();
  console.log(`Settle Tx Hash: ${rxSettle.hash}`);

  console.log("Seller calling POST /settle...");
  const settleApiRes = await axios.post(`${API_URL}/listings/${listingId}/settle`, { 
    tx_hash_settle: rxSettle.hash, 
    decryptionKey: decryptionKey 
  }, {
    headers: { Authorization: `Bearer ${sellerToken}` }
  });
  console.log("Settle API Response:", settleApiRes.data.listing.status);

  if (settleApiRes.data.listing.status === 'SETTLED') {
    console.log("✅ E2E TEST PASSED SUCCESSFULLY!");
  } else {
    console.log("❌ E2E TEST FAILED!");
  }

  // Cleanup
  if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
}

main().catch(console.error);
