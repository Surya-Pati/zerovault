import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In test environments, create a fresh instance per mock scope.
// In development and production, reuse the singleton instance on globalThis to prevent connection pool exhaustion.
export const prisma =
  process.env.NODE_ENV === 'test'
    ? new PrismaClient()
    : (globalForPrisma.prisma ??= new PrismaClient());

export default prisma;
