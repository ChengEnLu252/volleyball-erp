'use server'

// ============================================================
// app/actions/blacklist.ts — 黑名單 / 違規管理（owner / manager）
// ------------------------------------------------------------
// 違規來源：no-show（場次結算自動）、unpaid（結算自動）、manual（館長手動）。
// 累計 3 次未解除 → 自動列黑名單（queries.recordCustomerViolationAsync），
// 並入 LINE 通知佇列（憑證到再自動發）。繳清 → 解除。七館同步。
// ============================================================

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import {
  resolveUserScope, type UserScope,
  recordCustomerViolationAsync, getViolationStatsForCustomersAsync,
} from '@/data/server/queries'

type Fail = { ok: false; reason: string }
type Ok = { ok: true }

async function requireStaff(): Promise<{ scope: UserScope } | Fail> {
  const me = await getSessionUser()
  if (!me) return { ok: false, reason: '未登入' }
  const scope = await resolveUserScope(me.id)
  if (!scope || (scope.role !== 'owner' && scope.role !== 'manager')) return { ok: false, reason: '無權限（限館長／老闆）' }
  return { scope }
}
function venueAllowed(scope: UserScope, venueId: string | null): boolean {
  if (scope.visibleVenueIds === 'all') return true
  return !!venueId && scope.visibleVenueIds.includes(venueId)
}

// —— 館長手動記一次違規 ——
export async function recordManualViolationAction(args: { customerId: string; venueId: string | null; reason: string; amount?: number }): Promise<{ ok: true; banned: boolean; count: number } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  if (!args.customerId) return { ok: false, reason: '缺少客戶' }
  if (args.venueId && !venueAllowed(g.scope, args.venueId)) return { ok: false, reason: '不可記錄其他球館的違規' }
  const r = await recordCustomerViolationAsync({
    customerId: args.customerId, venueId: args.venueId ?? null, type: 'manual',
    reason: args.reason?.trim() || '館長手動記錄', amount: args.amount ?? 0, createdBy: g.scope.userId,
  })
  return { ok: true, banned: r.banned, count: r.count }
}

// —— 場次結算：自動偵測 no-show / 未付款 → 記違規 ——
export async function finalizeSessionViolationsAction(sessionId: string): Promise<{ ok: true; noShow: number; unpaid: number; newBans: number } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) return { ok: false, reason: '找不到場次' }
  if (!venueAllowed(g.scope, session.venueId)) return { ok: false, reason: '不可結算其他球館的場次' }

  const expected = session.courtFee + (session.acEnabled ? session.acFee : 0)
  // 只針對付費類型（臨打 / 補位）；季打免費不計
  const regs = await prisma.registration.findMany({
    where: { sessionId, type: { in: ['walk_in', 'season_substitute'] }, status: { not: 'cancelled' } },
    include: { payments: true },
  })

  let noShow = 0, unpaid = 0, newBans = 0
  for (const r of regs) {
    const hasPaid = r.selfReportedPaid || r.payments.some((p) => p.status === 'paid')
    let type: 'no_show' | 'unpaid' | null = null
    if (r.status !== 'attended') type = 'no_show'      // 已報名卻未到場
    else if (!hasPaid) type = 'unpaid'                 // 到場但未付款
    if (!type) continue
    const res = await recordCustomerViolationAsync({
      customerId: r.customerId, venueId: session.venueId, type,
      reason: type === 'no_show' ? '未到場（未取消 / 未找替補）' : '到場未付款',
      sessionId, amount: expected, createdBy: g.scope.userId,
    })
    if (res.recorded) { if (type === 'no_show') noShow++; else unpaid++; if (res.banned) newBans++ }
  }
  return { ok: true, noShow, unpaid, newBans }
}

// —— 繳清 → 解除黑名單（解除所有未解除違規）——
export async function clearCustomerDuesAction(customerId: string): Promise<Ok | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
  if (!c) return { ok: false, reason: '找不到客戶' }
  await prisma.$transaction([
    prisma.customerViolation.updateMany({ where: { customerId, resolvedAt: null }, data: { resolvedAt: new Date() } }),
    prisma.customer.update({ where: { id: customerId }, data: { isBanned: false, bannedAt: null, banReason: null } }),
  ])
  return { ok: true }
}

// —— 黑名單總覽（七館同步 → 全部 staff 皆可見全部黑名單）——
export type BlacklistEntry = {
  customerId: string; name: string; phone: string | null
  owed: number; violationCount: number; bannedAt: string | null; banReason: string | null
}
export type PendingLineNote = { id: string; customerId: string; name: string; title: string; body: string; owedAmount: number; createdAt: string }

export async function loadBlacklistAction(): Promise<{ ok: true; entries: BlacklistEntry[]; pending: PendingLineNote[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const banned = await prisma.customer.findMany({ where: { isBanned: true }, orderBy: { bannedAt: 'desc' }, select: { id: true, name: true, phone: true, bannedAt: true, banReason: true } })
  const stats = await getViolationStatsForCustomersAsync(banned.map((b) => b.id))
  const entries: BlacklistEntry[] = banned.map((b) => ({
    customerId: b.id, name: b.name, phone: b.phone,
    owed: stats.get(b.id)?.owed ?? 0, violationCount: stats.get(b.id)?.count ?? 0,
    bannedAt: b.bannedAt?.toISOString() ?? null, banReason: b.banReason,
  }))
  const notes = await prisma.lineNotification.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 100 })
  const nameById = new Map(banned.map((b) => [b.id, b.name]))
  const missing = notes.map((n) => n.customerId).filter((id) => !nameById.has(id))
  if (missing.length) {
    const more = await prisma.customer.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })
    for (const m of more) nameById.set(m.id, m.name)
  }
  const pending: PendingLineNote[] = notes.map((n) => ({
    id: n.id, customerId: n.customerId, name: nameById.get(n.customerId) ?? '（未知）',
    title: n.title, body: n.body, owedAmount: n.owedAmount, createdAt: n.createdAt.toISOString(),
  }))
  return { ok: true, entries, pending }
}

// —— 客戶搜尋（手動記違規用；姓名 / 電話）——
export async function searchCustomersForViolationAction(q: string): Promise<{ ok: true; results: { id: string; name: string; phone: string | null; isBanned: boolean; activeViolations: number }[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const term = (q ?? '').trim()
  if (term.length < 1) return { ok: true, results: [] }
  const rows = await prisma.customer.findMany({
    where: { OR: [{ name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] },
    take: 12, orderBy: { name: 'asc' }, select: { id: true, name: true, phone: true, isBanned: true },
  })
  const stats = await getViolationStatsForCustomersAsync(rows.map((r) => r.id))
  return { ok: true, results: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, isBanned: r.isBanned, activeViolations: stats.get(r.id)?.count ?? 0 })) }
}

// —— 某客戶違規明細（客戶頁 / 黑名單頁展開）——
export type ViolationRow = { id: string; type: string; reason: string | null; venueName: string | null; amount: number; resolved: boolean; createdAt: string }
export async function getCustomerViolationsAction(customerId: string): Promise<{ ok: true; rows: ViolationRow[] } | Fail> {
  const g = await requireStaff()
  if ('ok' in g) return g
  const vs = await prisma.customerViolation.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } })
  const venueIds = [...new Set(vs.map((v) => v.venueId).filter((x): x is string => !!x))]
  const venues = venueIds.length ? await prisma.venue.findMany({ where: { id: { in: venueIds } }, select: { id: true, name: true } }) : []
  const vn = new Map(venues.map((v) => [v.id, v.name]))
  return {
    ok: true,
    rows: vs.map((v) => ({
      id: v.id, type: v.type, reason: v.reason, venueName: v.venueId ? (vn.get(v.venueId) ?? null) : null,
      amount: v.amount, resolved: !!v.resolvedAt, createdAt: v.createdAt.toISOString(),
    })),
  }
}
