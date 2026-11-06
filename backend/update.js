const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { wallet_address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' },
    data: { role: 'RESEARCHER' }
  });
  console.log('Updated 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 to RESEARCHER');
}

main().catch(console.error).finally(() => prisma.$disconnect());
