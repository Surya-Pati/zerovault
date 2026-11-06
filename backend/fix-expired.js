const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const listingId = "fa94b355-2dd1-419c-a5fc-f9ed244db099";
  
  const listing = await prisma.vulnerabilityListing.findUnique({
    where: { id: listingId }
  });

  if (listing) {
    await prisma.vulnerabilityListing.update({
      where: { id: listingId },
      data: { status: 'COMMITTED' }
    });
    
    // Also revert escrow transaction
    const escrow = await prisma.escrowTransaction.findUnique({
      where: { listing_id: listingId }
    });
    if (escrow) {
      await prisma.escrowTransaction.update({
        where: { listing_id: listingId },
        data: { 
          status: 'COMMITTED',
          tx_hash_fund: null,
          tx_hash_settle: null,
          decryption_key: null,
          bounty_locked_at: null
        }
      });
    }
    
    console.log(`Reverted listing ${listingId} from SETTLED back to COMMITTED in database.`);
  } else {
    console.log("Listing not found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
