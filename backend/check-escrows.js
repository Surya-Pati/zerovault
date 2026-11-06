const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const listings = await prisma.vulnerabilityListing.findMany({
    orderBy: { created_at: 'desc' },
    take: 1,
    include: { escrow: true }
  });
  console.log("Recent listing:", JSON.stringify(listings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
