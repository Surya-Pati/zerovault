import { ethers } from "hardhat";

async function main() {
  const txHash = "0x2b89463b5ce408bd7b21e976f14bd025a227f1b2f19365aae3be1fcf18b2879c";
  const tx = await ethers.provider.getTransaction(txHash);
  if (!tx) {
    console.log("Tx not found");
    return;
  }
  console.log("Tx data:", tx.data);
  
  // The ABI is: revealAndClaim(bytes32 merkleRoot, string calldata decryptionKey)
  // We can decode this using the interface
  const ABI = ["function revealAndClaim(bytes32 merkleRoot, string calldata decryptionKey)"];
  const iface = new ethers.Interface(ABI);
  try {
    const decoded = iface.decodeFunctionData("revealAndClaim", tx.data);
    console.log("Decryption Key from tx:", decoded.decryptionKey);
  } catch (err) {
    console.log("Could not decode:", err);
  }
}

main().catch(console.error);
