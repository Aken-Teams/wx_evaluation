import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/** Prisma 單例（避免開發熱重載時重複建立連線）。連線字串由 env 依模式決定。 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
