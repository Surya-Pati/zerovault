import { ethers, network } from "hardhat";

async function main() {
  const ZERO_VAULT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // Get the most recent merkle root from the database via a raw file read or just hardcoding it?
  // We can just ask the contract if we know the merkleRoot. But we don't know it.
  // Actually we know it from the DB! Let's read it.
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const listing = await prisma.vulnerabilityListing.findFirst({
    where: { id: "fa94b355-2dd1-419c-a5fc-f9ed244db099" } // The one we just reverted
  });
  
  if (!listing) {
    console.log("Listing not found in DB.");
    return;
  }
  
  const merkleRoot = listing.merkle_root;
  console.log("Found Merkle Root:", merkleRoot);
  
  // Calculate mapping storage slot for escrows[merkleRoot]
  // Mapping is at slot 0 in the contract.
  const mappingSlot = 0;
  
  // slot = keccak256(abi.encode(key, mappingSlot))
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256"],
    [merkleRoot, mappingSlot]
  );
  const baseSlot = ethers.keccak256(encoded);
  
  // Struct layout:
  // slot + 0: keyHash
  // slot + 1: seller
  // slot + 2: vendor
  // slot + 3: bountyAmount
  // slot + 4: commitTimestamp
  // slot + 5: bountyLockedAt
  // slot + 6: state (enum)
  const stateSlotOffset = 6n;
  const stateSlotBigInt = BigInt(baseSlot) + stateSlotOffset;
  const stateSlotHex = "0x" + stateSlotBigInt.toString(16);
  
  // State.COMMITTED is 1
  const newValue = ethers.zeroPadValue("0x01", 32);
  
  console.log("Setting storage at slot", stateSlotHex, "to", newValue);
  await network.provider.send("hardhat_setStorageAt", [
    ZERO_VAULT_ADDRESS,
    stateSlotHex,
    newValue,
  ]);
  
  // Reset time to present (revert the +7 days)
  // Hardhat allows setting exact timestamp of next block
  const currentRealTimeSeconds = Math.floor(Date.now() / 1000);
  console.log("Reverting blockchain time back to current real-world time:", currentRealTimeSeconds);
  await network.provider.send("evm_setNextBlockTimestamp", [currentRealTimeSeconds]);
  await network.provider.send("evm_mine");
  
  console.log("Done! On-chain state and time have been reverted to normal.");
}

main().catch(console.error).finally(() => process.exit(0));
