const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    let profileName = '';
    if (user.role === 'BUYER') {
      profileName = `Acme Corp ${i}`;
    } else {
      profileName = `ZeroCool ${i}`;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { profile_name: profileName }
    });
  }
  console.log('Profiles updated.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
