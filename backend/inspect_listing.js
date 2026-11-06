const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const listing = await prisma.vulnerabilityListing.findUnique({
    where: { id: '20403a7a-cf98-4121-9469-4dbccb73a425' },
    select: {
      id: true,
      merkle_root: true,
      claims: true,
      title: true,
      category: true,
      severity: true,
    }
  });

  if (!listing) {
    console.log('Listing not found');
    return;
  }

  console.log('=== LISTING ===');
  console.log('ID:', listing.id);
  console.log('Title:', listing.title);
  console.log('Category:', listing.category);
  console.log('Severity:', listing.severity);
  console.log('Merkle Root:', listing.merkle_root);
  console.log('');
  console.log('=== CLAIMS (raw JSON) ===');
  console.log(JSON.stringify(listing.claims, null, 2));
  console.log('');
  console.log('=== CLAIMS COUNT:', Array.isArray(listing.claims) ? listing.claims.length : 'NOT ARRAY');

  if (Array.isArray(listing.claims)) {
    listing.claims.forEach((c, i) => {
      console.log(`\n--- Claim ${i} ---`);
      console.log('Key:', c.key);
      console.log('Value:', c.value ? c.value.substring(0, 80) : 'MISSING');
      console.log('Has proof:', !!(c.proof && c.proof.length > 0));
      console.log('Proof length:', c.proof ? c.proof.length : 0);
      console.log('Has salt:', !!c.salt);
      console.log('Revealed:', c.revealed);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
