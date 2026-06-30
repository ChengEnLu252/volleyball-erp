'use server'

// ============================================================
// app/actions/ledger.ts — 月記帳 upsert（P2.2d，server action）
// ------------------------------------------------------------
// 館長每日記帳從 localStorage 改成寫進 Supabase ledger_days（一館一天唯一）。
//   授權：owner / manager，且該 venue 在可見範圍內（工讀生唯讀，不能記帳）。
//   寫入：upsert by (venueId, date) + AuditLog(UPSERT_LEDGER)。
//   數字定義（小計/總計/冷門/冷氣試算）由前端即時算、不存（見 data/ledger-core）。
// ============================================================

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, getVenuesForUserAsync, getLedgerMonthDaysAsync, getLedgerReviewAsync,
  type UserScope,
} from '@/data/server/queries'
import type { LedgerDay, LedgerSlotValue } from '@/types'
import type { LedgerReconResult, LedgerMonthSummary } from '@/data/ledger-core'

type Err = { ok: false; reason: string }

/** 解析登入者 scope；只有 owner / manager 可記帳 */
async function requireEditorScope(): Promise<UserScope | null> {
  const me = await getSessionUser()
  if (!me) return null
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return null
  return scope
}

function venueAllowed(scope: UserScope, venueId: string): boolean {
  return scope.visibleVenueIds === 'all' || scope.visibleVenueIds.includes(venueId)
}

function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 解析有效的 venue/月份（venue 不在 scope → 退回第一個可見館） */
function resolveSel(venues: { id: string }[], venueId?: string, ym?: string) {
  const vid = venues.find((v) => v.id === venueId)?.id ?? venues[0]?.id ?? ''
  const m = /^\d{4}-\d{2}$/.test(ym ?? '') ? ym! : currentYm()
  return { vid, m }
}

// ── 載入（client 自取，避免 server-only 進 client bundle）─────────

export type LedgerInputBundle = {
  ok: true
  venues: { id: string; name: string }[]
  venueId: string
  ym: string
  canEdit: boolean
  monthDays: LedgerDay[]
  userId: string
} | { ok: false }

/** 月記帳輸入頁資料（可見球館 + 選定館月已填記帳）。owner/staff 皆可讀，staff 唯讀 */
export async function loadLedgerInputAction(args: { venueId?: string; ym?: string }): Promise<LedgerInputBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }

  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const { vid, m } = resolveSel(venues, args.venueId, args.ym)
  const canEdit = scope.role === 'owner' || scope.role === 'manager'
  const { days } = vid ? await getLedgerMonthDaysAsync(scope, vid, m) : { days: [] }
  return { ok: true, venues, venueId: vid, ym: m, canEdit, monthDays: days, userId: scope.userId }
}

export type LedgerReviewBundle = {
  ok: true
  venues: { id: string; name: string }[]
  venueId: string
  ym: string
  recon: LedgerReconResult | null
  summary: LedgerMonthSummary | null
} | { ok: false }

/** 月記帳對帳頁資料（對帳結果 + 月摘要）。owner/staff 皆可讀 */
export async function loadLedgerReviewAction(args: { venueId?: string; ym?: string }): Promise<LedgerReviewBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }

  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const { vid, m } = resolveSel(venues, args.venueId, args.ym)
  const [recon, monthInfo] = vid
    ? await Promise.all([getLedgerReviewAsync(scope, vid, m), getLedgerMonthDaysAsync(scope, vid, m)])
    : [null, null]
  return { ok: true, venues, venueId: vid, ym: m, recon, summary: monthInfo?.summary ?? null }
}

const int = (n: unknown): number => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? v : 0
}
const str = (s: unknown): string => (typeof s === 'string' ? s : '')

/** 清洗 slots：只留 number 或非空 string，key 限白名單外仍保留（前端定義為準）*/
function cleanSlots(raw: unknown): Record<string, LedgerSlotValue> {
  const out: Record<string, LedgerSlotValue> = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
      else if (typeof v === 'string' && v.trim() !== '') out[k] = v
    }
  }
  return out
}

export interface SaveLedgerInput {
  venueId: string
  date: string // YYYY-MM-DD
  slots: Record<string, LedgerSlotValue>
  merch: number; snacks: number; drinks: number; ac: number; other: number
  seasonFee: number; privatePrepay: number; acFee: number; refund: number
  acDegrees: number
  bookingNote: string; refundNote: string; merchNote: string
  reported: boolean
}

export async function saveLedgerDayAction(
  input: SaveLedgerInput,
): Promise<{ ok: true } | Err> {
  const scope = await requireEditorScope()
  if (!scope) return { ok: false, reason: '無權限記帳（限館長／老闆）' }
  if (!venueAllowed(scope, input.venueId)) return { ok: false, reason: '不可記帳其他球館' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, reason: '日期格式錯誤' }

  const data = {
    slots: cleanSlots(input.slots) as Prisma.InputJsonValue,
    merch: int(input.merch), snacks: int(input.snacks), drinks: int(input.drinks), ac: int(input.ac), other: int(input.other),
    seasonFee: int(input.seasonFee), privatePrepay: int(input.privatePrepay), acFee: int(input.acFee), refund: int(input.refund),
    acDegrees: int(input.acDegrees),
    bookingNote: str(input.bookingNote), refundNote: str(input.refundNote), merchNote: str(input.merchNote),
    reported: !!input.reported,
    updatedBy: scope.userId,
  }
  const dateObj = new Date(input.date)

  const saved = await prisma.ledgerDay.upsert({
    where: { venueId_date: { venueId: input.venueId, date: dateObj } },
    create: { venueId: input.venueId, date: dateObj, ...data },
    update: data,
  })

  await prisma.auditLog.create({
    data: {
      userId: scope.userId, action: 'UPSERT_LEDGER',
      entityType: 'LedgerDay', entityId: saved.id,
      newValues: { venueId: input.venueId, date: input.date, reported: data.reported },
    },
  })

  revalidatePath('/reconciliation/ledger')
  revalidatePath('/reconciliation/ledger/review')
  return { ok: true }
}
