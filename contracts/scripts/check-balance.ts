import { ethers } from "hardhat";

async function main() {
  const sellerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  const sellerBalance = await ethers.provider.getBalance(sellerAddress);
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  
  console.log("Seller ETH Balance:", ethers.formatEther(sellerBalance));
  console.log("Contract ETH Balance:", ethers.formatEther(contractBalance));
  
  // Let's also check the escrow state just in case it wasn't settled
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const listing = await prisma.vulnerabilityListing.findFirst({
    where: { id: "fa94b355-2dd1-419c-a5fc-f9ed244db099" }
  });
  
  if (listing) {
    const ZeroVault = await ethers.getContractAt("ZeroVault", contractAddress);
    const escrow = await ZeroVault.escrows(listing.merkle_root);
    console.log("Escrow on-chain state:", Number(escrow.state));
    console.log("Escrow on-chain bountyAmount:", ethers.formatEther(escrow.bountyAmount));
  }
}

main().catch(console.error).finally(() => process.exit(0));
