const { BrowserProvider, Contract, parseEther, formatEther, keccak256, toUtf8Bytes, JsonRpcProvider, Wallet } = require('ethers');

const ZEROVAULT_ABI = [
  "function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external"
];

async function test() {
  try {
    const provider = new JsonRpcProvider('http://127.0.0.1:8545');
    // Using a random account to simulate the researcher
    const wallet = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider);
    const contract = new Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', ZEROVAULT_ABI, wallet);

    // Provide invalid vendor address or repeat the same commit to trigger a revert
    // A duplicate commit should revert!
    const root = '0x3de02e5b8d86e7ff0c4ff0000bf5fd8cb6cb57a7efdac89538eb259d0fcddc66';
    const keyHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const vendor = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    console.log("Sending tx...");
    const tx = await contract.commitVulnerability(root, keyHash, vendor, { gasLimit: 300000 });
    console.log("Tx hash:", tx.hash);
    
    console.log("Waiting...");
    const receipt = await tx.wait();
    console.log("Receipt status:", receipt.status);
    
  } catch (err) {
    console.error("Caught error:");
    console.error(err);
  }
}

test();
