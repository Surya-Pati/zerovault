
import { ethers } from 'ethers';
const ZERO_VAULT_ABI = ["function revealAndClaim(bytes32 merkleRoot, string memory decryptionKey) external"];
async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const sellerWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const contract = new ethers.Contract("0x5FbDB2315678afecb367f032d93F642f64180aa3", ZERO_VAULT_ABI, sellerWallet);
  console.log("Revealing key and claiming bounty...");
  const tx = await contract.revealAndClaim("0x3de02e5b8d86e7ff0c4ff0000bf5fd8cb6cb57a7efdac89538eb259d0fcddc66", "379bf2699ea2549e2784e704dc99c466dea76ee6bde03c1f598d5c3b197f0f88");
  await tx.wait();
  console.log("✅ Settlement Confirmed on Blockchain!");
}
main();
  