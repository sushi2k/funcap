import "server-only";
import { PrismaClient } from "@prisma/client";

// Singleton Prisma client. Imported only by DAL modules (security.md DAL-1).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
