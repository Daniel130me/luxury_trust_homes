import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * Single shared Prisma client.
 *
 * In development we keep one instance across hot reloads (tsx watch restarts
 * the process, so this mainly helps tests). Connection pooling is handled by
 * the Neon pooled endpoint configured in DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
