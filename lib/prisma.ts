// ============================================================
// lib/prisma.ts — PrismaClient 單例
// ------------------------------------------------------------
// 用 globalThis 快取，避免 Next.js dev 模式 HMR 反覆 new
// PrismaClient 造成「too many connections」。
//
// ⚠️ 只能在 server 端 import（server component / server action /
//    route handler）。client component 不可直接或間接 import 此檔，
//    否則 Prisma 會被打進 client bundle。
// ============================================================
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
