const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const listingId = "fa94b355-2dd1-419c-a5fc-f9ed244db099";
  
  await prisma.escrowTransaction.update({
    where: { listing_id: listingId },
    data: { 
      contract_address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" 
    }
  });
  
  console.log("Updated contract address in DB.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
