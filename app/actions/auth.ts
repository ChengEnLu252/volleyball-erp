'use server'

// ============================================================
// app/actions/auth.ts — 自助註冊 + 老闆審核（server actions）
// ------------------------------------------------------------
// 寫入一律走 server action（後端強制授權）。
//   - registerUser：公開，建立 pending 帳號 + UserVenueRole
//   - approveUser / rejectUser：僅 owner（server 端再驗一次）
// ============================================================

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'

export type RegisterInput = {
  name: string
  username: string
  password: string
  position: 'manager' | 'staff' // 館長 / 工讀生
  venueId: string
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function registerUser(input: RegisterInput): Promise<ActionResult> {
  const name = input.name?.trim() ?? ''
  const username = input.username?.trim() ?? ''
  const password = input.password ?? ''
  const { position, venueId } = input

  // —— 後端驗證 ——
  if (name.length < 2) return { ok: false, error: '請輸入姓名' }
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username))
    return { ok: false, error: '登入代號需 3–50 字，僅限英數與 _ . -' }
  if (password.length < 4) return { ok: false, error: '密碼至少 4 碼' }
  if (position !== 'manager' && position !== 'staff')
    return { ok: false, error: '職位不正確' }

  const venue = await prisma.venue.findUnique({ where: { id: venueId } })
  if (!venue || !venue.isActive) return { ok: false, error: '請選擇有效的球館' }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    await prisma.user.create({
      data: {
        name,
        username,
        email: `${username}@pending.local`, // email 仍為必填 unique；簽約後可改真 email
        passwordHash,
        globalRole: 'staff',          // 館長/工讀生 globalRole 皆 staff，差別在 venueRole
        approvalStatus: 'pending',    // 等老闆審核
        venueRoles: { create: [{ venueId, role: position }] },
      },
    })
    return { ok: true }
  } catch (e) {
    // 代號或 email 重複
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: '此登入代號已被使用，請換一個' }
    }
    return { ok: false, error: '註冊失敗，請稍後再試' }
  }
}

/** owner 專用：審核通過 */
export async function approveUser(userId: string): Promise<ActionResult> {
  const me = await getSessionUser()
  if (!me || me.globalRole !== 'owner') return { ok: false, error: '只有老闆可以審核' }
  await prisma.user.update({ where: { id: userId }, data: { approvalStatus: 'approved' } })
  revalidatePath('/approvals')
  return { ok: true }
}

/** owner 專用：退回（拒絕） */
export async function rejectUser(userId: string): Promise<ActionResult> {
  const me = await getSessionUser()
  if (!me || me.globalRole !== 'owner') return { ok: false, error: '只有老闆可以審核' }
  await prisma.user.update({ where: { id: userId }, data: { approvalStatus: 'rejected' } })
  revalidatePath('/approvals')
  return { ok: true }
}
