const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const listingId = "fa94b355-2dd1-419c-a5fc-f9ed244db099";
  const listing = await prisma.vulnerabilityListing.findUnique({
    where: { id: listingId },
    include: { seller: true, escrow: true }
  });
  console.log(JSON.stringify(listing, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
