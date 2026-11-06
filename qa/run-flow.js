"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
// Module 2 & 3: Cryptography (simplified for test)
const crypto_1 = __importDefault(require("crypto"));
const API_URL = 'http://localhost:3001/api';
const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// ABI for ZeroVault
const abi = [
    "function commitVulnerability(bytes32,bytes32,address)",
    "function setKYCStatus(address,bool)",
    "function lockBounty(bytes32) payable",
    "function revealAndClaim(bytes32,string)",
    "function raiseDispute(bytes32)",
    "function resolveDispute(bytes32,bool)"
];
async function run() {
    console.log('=== ZeroVault E2E Flow Execution ===\n');
    const provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
    const seller = new ethers_1.ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider); // Hardhat #1
    const buyer = new ethers_1.ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", provider); // Hardhat #2
    const admin = new ethers_1.ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider); // Hardhat #0 (deployer)
    const contract = new ethers_1.ethers.Contract(CONTRACT_ADDRESS, abi, provider);
    // Axios instances with cookies
    const sellerClient = axios_1.default.create({ baseURL: API_URL, withCredentials: true });
    const buyerClient = axios_1.default.create({ baseURL: API_URL, withCredentials: true });
    const adminClient = axios_1.default.create({ baseURL: API_URL, withCredentials: true });
    const getCsrf = async (client) => {
        const res = await client.get('/auth/csrf-token');
        const cookie = res.headers['set-cookie']?.join('; ');
        if (cookie)
            client.defaults.headers.Cookie = cookie;
        client.defaults.headers['x-csrf-token'] = res.data.csrfToken;
    };
    const login = async (client, wallet, role) => {
        const nonceRes = await client.get(`/auth/nonce?address=${wallet.address}`);
        const nonce = nonceRes.data;
        const nonceCookie = nonceRes.headers['set-cookie']?.join('; ');
        if (nonceCookie) {
            client.defaults.headers.Cookie = (client.defaults.headers.Cookie || '') + '; ' + nonceCookie;
        }
        const msg = `localhost:3000 wants you to sign in with your Ethereum account:\n${wallet.address}\n\nSign in to ZeroVault.\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 31337\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
        const signature = await wallet.signMessage(msg);
        let res;
        try {
            res = await client.post('/auth/verify-siwe', { message: msg, signature, role });
        }
        catch (e) {
            if (e.response && e.response.status === 409) {
                // Already registered, retry without role to just login
                res = await client.post('/auth/verify-siwe', { message: msg, signature });
            }
            else {
                throw e;
            }
        }
        const cookie = res.headers['set-cookie']?.join('; ');
        if (cookie) {
            client.defaults.headers.Cookie = (client.defaults.headers.Cookie || '') + '; ' + cookie;
        }
        console.log(`[+] Logged in as ${role} (${wallet.address})`);
    };
    await getCsrf(adminClient);
    await login(adminClient, admin, 'BUYER'); // Admin is technically a buyer/admin depending on setup
    await getCsrf(sellerClient);
    await login(sellerClient, seller, 'RESEARCHER');
    await getCsrf(buyerClient);
    await login(buyerClient, buyer, 'BUYER');
    // STEP 1: Admin whitelists buyer for KYC
    console.log('\n[STEP 1] Admin sets KYC status for Buyer');
    const kycTx = await contract.connect(admin).setKYCStatus(buyer.address, true);
    await kycTx.wait();
    console.log(`[+] KYC set on-chain for ${buyer.address}`);
    // Create fake payload
    const payloadStr = JSON.stringify({ vulnerability: "SQL Injection", severity: "High" });
    const key = crypto_1.default.randomBytes(32).toString('hex');
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const ciphertext = Buffer.concat([cipher.update(payloadStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedPayloadBase64 = Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    // Use a simple hash for merkle root for test
    const merkleRoot = "0x" + crypto_1.default.createHash('sha256').update(Date.now().toString()).digest('hex');
    const keyHash = "0x" + crypto_1.default.createHash('sha256').update(key).digest('hex');
    // STEP 2: Commit Vulnerability
    console.log('\n[STEP 2] Seller commits vulnerability');
    const commitTx = await contract.connect(seller).commitVulnerability(merkleRoot, keyHash, buyer.address);
    await commitTx.wait();
    console.log(`[+] On-chain commit successful. Root: ${merkleRoot}`);
    await getCsrf(sellerClient);
    await sellerClient.post('/listings', {
        title: 'E2E Test Vuln',
        description: 'Testing the flow',
        severity: 'HIGH',
        target: 'zerovault.io',
        price_eth: '1.0',
        vendor_address: buyer.address,
        encrypted_payload: encryptedPayloadBase64,
        merkle_root: merkleRoot,
        key_hash: keyHash,
        claims: ['SQLi found'],
        txHash: commitTx.hash
    });
    console.log('[+] Backend listing created');
    // Need to wait for bridge to pick it up or we just let DB sync manually
    await new Promise(r => setTimeout(r, 2000));
    // STEP 3: Lock Bounty
    console.log('\n[STEP 3] Buyer locks bounty');
    const lockTx = await contract.connect(buyer).lockBounty(merkleRoot, { value: ethers_1.ethers.parseEther("1.0") });
    await lockTx.wait();
    console.log(`[+] Bounty locked on-chain (1.0 ETH). txHash: ${lockTx.hash}`);
    // Wait for bridge
    await new Promise(r => setTimeout(r, 2000));
    // STEP 4: Reveal and Claim
    console.log('\n[STEP 4] Seller reveals decryption key');
    const revealTx = await contract.connect(seller).revealAndClaim(merkleRoot, key);
    await revealTx.wait();
    console.log(`[+] Key revealed on-chain. Key: ${key}`);
    // We must hit backend settle endpoint so backend stores the key
    let listingData = await buyerClient.get('/listings');
    const listingId = listingData.data.listings.find((l) => l.merkle_root === merkleRoot)?.id;
    await getCsrf(sellerClient);
    await sellerClient.post(`/listings/${listingId}/settle`, { txHash: revealTx.hash, decryptionKey: key });
    console.log(`[+] Backend state updated to SETTLED/PENDING_SETTLEMENT`);
    // Wait for worker
    await new Promise(r => setTimeout(r, 3000));
    // STEP 5: Buyer downloads and decrypts
    console.log('\n[STEP 5] Buyer downloads decrypted payload');
    const downloadRes = await buyerClient.get(`/listings/${listingId}/payload`, { responseType: 'arraybuffer' });
    console.log(`[+] Payload downloaded successfully. Size: ${downloadRes.data.byteLength} bytes`);
    // (Optional) STEP 6: Raise Dispute
    console.log('\n[STEP 6] Buyer raises dispute');
    const disputeTx = await contract.connect(buyer).raiseDispute(merkleRoot);
    await disputeTx.wait();
    console.log(`[+] Dispute raised on-chain`);
    console.log('\n=== E2E Flow Executed Successfully ===\n');
}
run().catch(console.error);
