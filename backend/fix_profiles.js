const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { profile_name: null } });
  for (const user of users) {
    if (user.wallet_address) {
      const profileName = `${user.role === 'BUYER' ? 'Buyer' : 'Researcher'}-${user.wallet_address.slice(2, 8).toUpperCase()}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { profile_name: profileName }
      });
    }
  }
  console.log('Fixed existing users profile names');
}

main().catch(console.error).finally(() => prisma.$disconnect());
