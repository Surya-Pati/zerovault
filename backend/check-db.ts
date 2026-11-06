import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

async function main() {
  console.log('Attempting to connect to the remote Supabase database...');
  console.log('URL:', process.env.DATABASE_URL);
  
  try {
    // Attempt a simple query to verify connection
    await prisma.$connect();
    const count = await prisma.user.count();
    console.log(`[SUCCESS] Connected to database! Found ${count} users.`);
  } catch (error) {
    console.error('[ERROR] Failed to connect to the database:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
