'use server'

// ============================================================
// app/actions/registrations.ts — 公開報名寫入（server action）
// ------------------------------------------------------------
// 客戶端報名（LINE 報名）→ 自動建客戶檔 + 寫 Registration。
//   - 手機去重：若手機已存在，回 needsResolution 讓前端三選一
//       use_existing：沿用舊客戶（不動舊資料）
//       overwrite   ：沿用舊客戶，但用這次資料覆蓋（姓名/性別/程度）
//       create_new  ：同手機另建一筆新客戶
//   - 容量滿 → 候補(waitlist)；否則 registered
//   - 公開未登入：授權＝場次有效 + 容量，不綁 user session
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { Gender, SkillLevel } from '@/types'
import { averageSkillLevel, type FourSkills } from '@/data/skill'
import {
  getBookingDatesWithSessionsAsync, getBookingSessionsByDateAsync, getPublicSessionAsync,
} from '@/data/server/queries'
import type { PublicSession } from '@/data/api'

// ── 公開讀取（對外站台改查真 DB，讓館長增減場次即時反映、名額即時準）──
/** 某館未來 N 天每日可報名概況 */
export async function getBookingDatesAction(venueId: string, fromDate: string, days: number) {
  return getBookingDatesWithSessionsAsync(venueId, fromDate, days)
}
/** 某館某日公開場次（含即時名額） */
export async function getBookingSessionsAction(venueId: string, date: string): Promise<PublicSession[]> {
  return getBookingSessionsByDateAsync(venueId, date)
}
/** 單一公開場次（報名明細頁） */
export async function getPublicSessionAction(sessionId: string): Promise<PublicSession | null> {
  return getPublicSessionAsync(sessionId)
}

// app SkillLevel(B+/A+/S*) → Prisma enum 名稱(B_PLUS…)
const SKILL_TO_PRISMA: Record<string, string> = { 'B+': 'B_PLUS', 'A+': 'A_PLUS', 'S*': 'S_STAR' }
const toPrismaSkill = (s?: string | null): string | undefined =>
  s ? (SKILL_TO_PRISMA[s] ?? s) : undefined

export type ExistingCustomer = {
  id: string; name: string; phone: string | null
  skillLevel: string | null; gender: string | null
}

export type BookingInput = {
  sessionId: string
  name: string
  phone: string
  gender: Gender | null
  /** 綜合程度（向後相容）；若有帶 skills 則以 skills 平均為準 */
  skillLevel: SkillLevel | null
  /** 四項能力自評（攻擊/防守/舉球/攔網）；有帶則存四項 + skillLevel=平均 */
  skills?: FourSkills | null
  resolution?: 'use_existing' | 'overwrite' | 'create_new'
  existingCustomerId?: string
}

/** 依 input 決定要寫入客戶的程度欄位（四項 + 綜合平均） */
function buildSkillData(input: BookingInput): Record<string, string | undefined> {
  const s = input.skills
  if (s && (s.attack || s.defense || s.setting || s.block)) {
    const avg = averageSkillLevel(s) ?? input.skillLevel
    return {
      skillLevel: toPrismaSkill(avg),
      skillAttack: toPrismaSkill(s.attack),
      skillDefense: toPrismaSkill(s.defense),
      skillSetting: toPrismaSkill(s.setting),
      skillBlock: toPrismaSkill(s.block),
    }
  }
  return { skillLevel: toPrismaSkill(input.skillLevel) }
}

export type BookingResult =
  | { ok: true; registrationId: string; customerId: string; status: 'registered' | 'waitlist' }
  | { ok: false; needsResolution: true; existing: ExistingCustomer[] }
  | { ok: false; error: string }

/** 依手機查既有客戶（phone 已非唯一，可能多筆）*/
export async function lookupCustomersByPhone(phone: string): Promise<ExistingCustomer[]> {
  const p = phone.trim()
  if (!p) return []
  return prisma.customer.findMany({
    where: { phone: p },
    select: { id: true, name: true, phone: true, skillLevel: true, gender: true },
  })
}

export async function submitPublicBooking(input: BookingInput): Promise<BookingResult> {
  const name = input.name?.trim() ?? ''
  const phone = input.phone?.trim() ?? ''
  if (name.length < 1) return { ok: false, error: '請輸入姓名' }
  if (!/^[0-9-]{6,20}$/.test(phone)) return { ok: false, error: '請輸入有效的手機號碼' }

  const session = await prisma.session.findUnique({ where: { id: input.sessionId } })
  if (!session) return { ok: false, error: '找不到場次' }
  if (session.status === 'cancelled') return { ok: false, error: '此場次已取消' }

  // 手機重複 → 需前端三選一
  const existing = await lookupCustomersByPhone(phone)
  if (existing.length > 0 && !input.resolution) {
    return { ok: false, needsResolution: true, existing }
  }

  const skillData = buildSkillData(input) as never
  const gender = (input.gender ?? undefined) as never | undefined

  // 決定 / 建立客戶
  let customerId: string
  if (existing.length === 0 || input.resolution === 'create_new') {
    const c = await prisma.customer.create({ data: { name, phone, gender, ...(skillData as object) } })
    customerId = c.id
  } else {
    const target =
      input.existingCustomerId && existing.some(e => e.id === input.existingCustomerId)
        ? input.existingCustomerId
        : existing[0].id
    if (input.resolution === 'overwrite') {
      await prisma.customer.update({ where: { id: target }, data: { name, gender, ...(skillData as object) } })
    }
    customerId = target
  }

  // 同場是否已報名
  const dup = await prisma.registration.findUnique({
    where: { sessionId_customerId: { sessionId: input.sessionId, customerId } },
  })
  if (dup && dup.status !== 'cancelled') {
    return { ok: false, error: '此客戶已報名這個場次' }
  }

  // 容量 → 滿則候補
  const count = await prisma.registration.count({
    where: { sessionId: input.sessionId, status: { not: 'cancelled' } },
  })
  const status: 'registered' | 'waitlist' = count >= session.maxCapacity ? 'waitlist' : 'registered'

  let registrationId: string
  if (dup) {
    const r = await prisma.registration.update({
      where: { id: dup.id },
      data: { status, type: 'walk_in', registeredBySource: 'self', registeredBy: null },
    })
    registrationId = r.id
  } else {
    const r = await prisma.registration.create({
      data: {
        sessionId: input.sessionId, customerId,
        type: 'walk_in', registeredBySource: 'self', registeredBy: null, status,
      },
    })
    registrationId = r.id
  }

  await prisma.auditLog.create({
    data: {
      userId: null, action: 'CREATE_REGISTRATION',
      entityType: 'Registration', entityId: registrationId,
      newValues: { sessionId: input.sessionId, customerId, type: 'walk_in', source: 'self', status },
    },
  })

  revalidatePath('/book')
  return { ok: true, registrationId, customerId, status }
}
