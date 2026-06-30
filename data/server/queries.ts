// ============================================================
// data/server/queries.ts — Prisma 真資料庫「讀取」層（server-only）
// ------------------------------------------------------------
// 🔒 server-only：此模組（直接/間接）只能被 server component /
//    server action / route handler import。client component 不可
//    import，否則 Prisma 會被打進 client bundle → build 失敗。
//    第一行的 `import 'server-only'` 會在違規時讓 build 直接報錯。
//
// 設計（對齊 CLAUDE.md：data/api.ts 仍是頁面層唯一入口）：
//   - 既有 data/api.ts 的 sync listX()/getX() 完全不動（仍讀記憶體
//     GENERATED），未遷移的頁面照常運作。
//   - 這裡是「新增」的 async 版本，每個函式吃明確的 UserScope 參數
//     （不讀 getCurrentUserId()）→ 後端依登入者角色 scope 資料。
//   - Round 6/9 的 server 殼會呼叫這裡，把結果當 initialData 傳給
//     既有 client UI；client 端不再直接碰 DB。
//
// 對應：CLAUDE.md 第 6 節 P1 ②③、計畫 Round 3。
// ============================================================
import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deriveEffectiveRole, type EffectiveRole } from '@/data/permissions'
import type {
  Customer, Session, SeasonRental, Timeslot, Season, Venue,
  SkillLevel, SessionStatus, SeasonRentalStatus,
} from '@/types'

// 與 data/api.ts 的同名 filter 對齊（刻意內聯，避免從 api.ts import）
export type SessionFilter = {
  venueId?: string
  date?: string
  dateFrom?: string
  dateTo?: string
  status?: SessionStatus
}
export type SeasonRentalFilter = {
  venueId?: string
  captainId?: string
  status?: SeasonRentalStatus
}

// ── Prisma → app type 對應 helper ───────────────────────────
// Prisma client 的 SkillLevel enum 用 schema 名稱（B_PLUS…），
// 但 app 型別用原始字串（B+…）→ 讀出時反向轉回。
const SKILL_FROM_PRISMA: Record<string, SkillLevel> = {
  B_PLUS: 'B+', A_PLUS: 'A+', S_STAR: 'S*',
}
const fromSkill = (s: string | null | undefined): SkillLevel | null =>
  s == null ? null : ((SKILL_FROM_PRISMA[s] ?? s) as SkillLevel)

// Prisma 回 Date 物件；app 型別（Timestamp/日期）用 string。
const iso = (d: Date | null | undefined): string | null => (d == null ? null : d.toISOString())
const ymd = (d: Date): string => d.toISOString().split('T')[0]

// ── 使用者 scope（後端授權的核心）──────────────────────────
export type UserScope = {
  userId: string
  globalRole: 'owner' | 'staff'
  role: EffectiveRole
  /** 'all' = owner 看全部；string[] = 該使用者可見的 venue id */
  visibleVenueIds: string[] | 'all'
}

/** 從 DB 解析使用者的 effective role 與可見球館。找不到使用者回 null。 */
export async function resolveUserScope(userId: string): Promise<UserScope | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { venueRoles: true },
  })
  if (!user) return null
  const venueRoles = user.venueRoles.map((r) => ({
    userId: r.userId, venueId: r.venueId, role: r.role,
  }))
  const role = deriveEffectiveRole(user.globalRole, venueRoles)
  const visibleVenueIds =
    role === 'owner' ? ('all' as const)
    : role === 'none' ? []
    : Array.from(new Set(venueRoles.map((r) => r.venueId)))
  return { userId, globalRole: user.globalRole, role, visibleVenueIds }
}

/** scope → Prisma venueId where 片段（owner 不限、none 永遠查不到） */
function venueWhere(visible: string[] | 'all') {
  if (visible === 'all') return {}
  // none / 空集合 → 用不可能命中的條件，確保 fail-closed
  return { venueId: { in: visible.length ? visible : ['__none__'] } }
}

// ── mappers ─────────────────────────────────────────────────
type CustomerRow = {
  id: string; name: string; phone: string | null; email: string | null
  skillLevel: string | null; preferredNetHeight: string | null; gender: string | null
  notes: string | null; isBanned: boolean; createdAt: Date
}
function mapCustomer(c: CustomerRow): Customer {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    skillLevel: (fromSkill(c.skillLevel) ?? 'E') as SkillLevel,
    preferredNetHeight: (c.preferredNetHeight ?? 'adjustable') as Customer['preferredNetHeight'],
    gender: (c.gender ?? null) as Customer['gender'],
    notes: c.notes, isBanned: c.isBanned, createdAt: iso(c.createdAt)!,
  }
}

function mapVenue(v: { id: string; name: string; address: string | null; phone: string | null; isActive: boolean; createdAt: Date }): Venue {
  return { id: v.id, name: v.name, address: v.address ?? '', phone: v.phone ?? '', isActive: v.isActive, createdAt: iso(v.createdAt)! }
}

function mapSeason(s: { id: string; name: string; startDate: Date; endDate: Date; numWeeks: number; isActive: boolean; createdAt: Date }): Season {
  return { id: s.id, name: s.name, startDate: ymd(s.startDate), endDate: ymd(s.endDate), numWeeks: s.numWeeks, isActive: s.isActive, createdAt: iso(s.createdAt)! }
}

function mapTimeslot(t: any): Timeslot {
  return {
    id: t.id, venueId: t.venueId, label: t.label, dayOfWeek: t.dayOfWeek,
    startTime: t.startTime, endTime: t.endTime, court: t.court,
    defaultNetHeight: t.defaultNetHeight, defaultSessionType: t.defaultSessionType,
    defaultMinSkillRequired: fromSkill(t.defaultMinSkillRequired),
    defaultMaxSkillAllowed: fromSkill(t.defaultMaxSkillAllowed),
    defaultMaxCapacity: t.defaultMaxCapacity, defaultCourtFee: t.defaultCourtFee,
    isHotZone: t.isHotZone, isActive: t.isActive,
    createdAt: iso(t.createdAt)!, updatedAt: iso(t.updatedAt)!,
  }
}

/** Session mapper；可選 venueName / currentCount 衍生欄位 */
function mapSession(s: any, extra?: { venueName?: string; currentCount?: number }): Session {
  return {
    id: s.id, venueId: s.venueId, timeslotId: s.timeslotId, seasonRentalId: s.seasonRentalId,
    createdBy: s.createdBy, sessionDate: ymd(s.sessionDate), startTime: s.startTime, endTime: s.endTime,
    court: s.court, netHeight: s.netHeight, sessionType: s.sessionType,
    courtFee: s.courtFee, acFee: s.acFee, acEnabled: s.acEnabled, maxCapacity: s.maxCapacity,
    minSkillRequired: fromSkill(s.minSkillRequired), maxSkillAllowed: fromSkill(s.maxSkillAllowed),
    status: s.status, isUnattended: s.isUnattended, notes: s.notes,
    createdAt: iso(s.createdAt)!, updatedAt: iso(s.updatedAt)!,
    venueName: extra?.venueName,
    currentCount: extra?.currentCount,
  }
}

function mapSeasonRental(r: any): SeasonRental {
  return {
    id: r.id, timeslotId: r.timeslotId, seasonId: r.seasonId, captainId: r.captainId,
    pricePerSession: r.pricePerSession, totalAmount: r.totalAmount, paidAmount: r.paidAmount,
    accessToken: r.accessToken, accessTokenExpiresAt: iso(r.accessTokenExpiresAt)!,
    status: r.status, notes: r.notes, createdAt: iso(r.createdAt)!, updatedAt: iso(r.updatedAt)!,
    captainName: r.captain?.name,
    captainPhone: r.captain?.phone ?? '',
    venueName: r.timeslot?.venue?.name,
    seasonName: r.season?.name,
    timeslotLabel: r.timeslot?.label ?? (r.timeslot ? `${r.timeslot.startTime}-${r.timeslot.endTime}` : undefined),
  }
}

// ── 註冊 / 審核（Round 5C）──────────────────────────────────
/** 公開：啟用中的球館（註冊表單選球館用，無需登入）*/
export async function getActiveVenuesPublic(): Promise<{ id: string; name: string }[]> {
  return prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })
}

export type PendingUserRow = {
  id: string
  name: string
  username: string | null
  createdAt: string
  venues: { venueName: string; role: 'manager' | 'staff' }[]
}
/** owner 審核頁：列出待審核帳號 + 其申請的球館/職位 */
export async function getPendingUsers(): Promise<PendingUserRow[]> {
  const rows = await prisma.user.findMany({
    where: { approvalStatus: 'pending' },
    include: { venueRoles: { include: { venue: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    createdAt: iso(u.createdAt)!,
    venues: u.venueRoles.map((vr) => ({ venueName: vr.venue.name, role: vr.role })),
  }))
}

// ── 球館 / 季 / 時段（基礎讀取）────────────────────────────
export async function getVenuesForUserAsync(scope: UserScope): Promise<Venue[]> {
  const rows = await prisma.venue.findMany({
    where: scope.visibleVenueIds === 'all' ? {} : { id: { in: scope.visibleVenueIds.length ? scope.visibleVenueIds : ['__none__'] } },
    orderBy: { id: 'asc' },
  })
  return rows.map(mapVenue)
}

export async function getActiveSeasonAsync(): Promise<Season | null> {
  const s = await prisma.season.findFirst({ where: { isActive: true } })
  return s ? mapSeason(s) : null
}

export async function getTimeslotsForUserAsync(scope: UserScope, venueId?: string): Promise<Timeslot[]> {
  const base = venueWhere(scope.visibleVenueIds)
  const rows = await prisma.timeslot.findMany({
    where: { ...base, ...(venueId ? { venueId } : {}) },
    orderBy: [{ venueId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  return rows.map(mapTimeslot)
}

// ── 客戶（角色 scope）───────────────────────────────────────
/**
 * owner：全部客戶；manager/staff：在「可見球館場次」有過報名的客戶
 * （對齊既有 customers 頁的前端過濾邏輯）。none → 空。
 */
export async function getCustomersForUserAsync(scope: UserScope): Promise<Customer[]> {
  if (scope.role === 'none') return []
  const where =
    scope.visibleVenueIds === 'all'
      ? {}
      : { registrations: { some: { session: venueWhere(scope.visibleVenueIds) } } }
  const rows = await prisma.customer.findMany({ where, orderBy: { name: 'asc' } })
  return rows.map(mapCustomer)
}

export async function getCustomerByIdForUserAsync(scope: UserScope, id: string): Promise<Customer | null> {
  if (scope.role === 'none') return null
  const c = await prisma.customer.findUnique({ where: { id } })
  if (!c) return null
  if (scope.visibleVenueIds !== 'all') {
    // 限館使用者：客戶需在可見球館有過報名才看得到
    const hit = await prisma.registration.findFirst({
      where: { customerId: id, session: venueWhere(scope.visibleVenueIds) },
      select: { id: true },
    })
    if (!hit) return null
  }
  return mapCustomer(c)
}

/**
 * 客戶頁專用：角色 scope 的客戶 + 每位客戶統計（出席場次數 / 累計消費 / 最近參加）。
 * 統計用單一聚合查詢（子查詢避免 join 重複計數），對齊既有頁面語意（只計 attended）。
 */
export async function getCustomersPageData(scope: UserScope): Promise<{
  customers: Customer[]
  stats: Record<string, { sessions: number; amount: number; lastVisit: string | null }>
}> {
  const customers = await getCustomersForUserAsync(scope)
  const stats: Record<string, { sessions: number; amount: number; lastVisit: string | null }> = {}
  if (customers.length === 0) return { customers, stats }

  const ids = customers.map((c) => c.id)
  const rows = await prisma.$queryRaw<
    Array<{ customer_id: string; sessions: bigint; amount: bigint | null; last_visit: Date | string | null }>
  >`
    SELECT c.id AS customer_id,
           COALESCE(a.sessions, 0) AS sessions,
           COALESCE(pay.amount, 0) AS amount,
           a.last_visit AS last_visit
    FROM customers c
    LEFT JOIN (
      SELECT r.customer_id, COUNT(*) AS sessions, MAX(s.session_date) AS last_visit
      FROM registrations r JOIN sessions s ON s.id = r.session_id
      WHERE r.status = 'attended'
      GROUP BY r.customer_id
    ) a ON a.customer_id = c.id
    LEFT JOIN (
      SELECT r.customer_id, SUM(p.amount) AS amount
      FROM payments p JOIN registrations r ON r.id = p.registration_id
      WHERE r.status = 'attended'
      GROUP BY r.customer_id
    ) pay ON pay.customer_id = c.id
    WHERE c.id IN (${Prisma.join(ids)})
  `
  for (const row of rows) {
    const lv = row.last_visit
    stats[row.customer_id] = {
      sessions: Number(row.sessions),
      amount: Number(row.amount ?? 0),
      lastVisit: lv == null ? null : (typeof lv === 'string' ? lv.split('T')[0] : ymd(lv)),
    }
  }
  return { customers, stats }
}

// ── 場次（角色 scope）───────────────────────────────────────
export async function getSessionsForUserAsync(scope: UserScope, filter?: SessionFilter): Promise<Session[]> {
  if (scope.role === 'none') return []
  const where: any = { ...venueWhere(scope.visibleVenueIds) }
  if (filter?.venueId) where.venueId = filter.venueId
  if (filter?.status) where.status = filter.status
  if (filter?.date) where.sessionDate = new Date(filter.date)
  if (filter?.dateFrom || filter?.dateTo) {
    where.sessionDate = {}
    if (filter.dateFrom) where.sessionDate.gte = new Date(filter.dateFrom)
    if (filter.dateTo) where.sessionDate.lte = new Date(filter.dateTo)
  }
  const rows = await prisma.session.findMany({
    where,
    include: {
      venue: { select: { name: true } },
      registrations: { select: { status: true } },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
  })
  return rows.map((s) =>
    mapSession(s, {
      venueName: s.venue?.name,
      currentCount: s.registrations.filter((r) => r.status !== 'cancelled').length,
    }),
  )
}

export async function getSessionByIdForUserAsync(scope: UserScope, id: string): Promise<Session | null> {
  if (scope.role === 'none') return null
  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      venue: { select: { name: true } },
      registrations: { select: { status: true } },
    },
  })
  if (!s) return null
  if (scope.visibleVenueIds !== 'all' && !scope.visibleVenueIds.includes(s.venueId)) return null
  return mapSession(s, {
    venueName: s.venue?.name,
    currentCount: s.registrations.filter((r) => r.status !== 'cancelled').length,
  })
}

// ── 季租單（角色 scope；以 timeslot.venueId 判可見）─────────
export async function getSeasonRentalsForUserAsync(scope: UserScope, filter?: SeasonRentalFilter): Promise<SeasonRental[]> {
  if (scope.role === 'none') return []
  const where: any = {}
  if (filter?.captainId) where.captainId = filter.captainId
  if (filter?.status) where.status = filter.status
  const timeslotWhere: any = {}
  if (scope.visibleVenueIds !== 'all') timeslotWhere.venueId = { in: scope.visibleVenueIds.length ? scope.visibleVenueIds : ['__none__'] }
  if (filter?.venueId) timeslotWhere.venueId = filter.venueId
  if (Object.keys(timeslotWhere).length) where.timeslot = timeslotWhere
  const rows = await prisma.seasonRental.findMany({
    where,
    include: {
      captain: { select: { name: true, phone: true } },
      season: { select: { name: true } },
      timeslot: { select: { label: true, startTime: true, endTime: true, venue: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapSeasonRental)
}

/**
 * 主揪 token 查詢（公開頁用，無 user session）。
 * 回傳季租單 + 是否過期；完整 portal 組裝留待 Round 8。
 */
export async function getSeasonRentalByTokenAsync(token: string): Promise<{ rental: SeasonRental; expired: boolean } | null> {
  const r = await prisma.seasonRental.findUnique({
    where: { accessToken: token },
    include: {
      captain: { select: { name: true, phone: true } },
      season: { select: { name: true } },
      timeslot: { select: { label: true, startTime: true, endTime: true, venue: { select: { name: true } } } },
    },
  })
  if (!r) return null
  const expired = r.accessTokenExpiresAt.getTime() < Date.now()
  return { rental: mapSeasonRental(r), expired }
}

// ── Dashboard（Round 9D，忠實重現）───────────────────────────
export type DashVenue = {
  venueId: string; venueName: string
  totalRevenue: number; totalPlayers: number; totalSessions: number
  unpaidCount: number; unpaidAmount: number; giftRatio: number; stockAlerts: number
}
export type DashUnpaid = {
  registrationId: string; customerName: string; venueId: string; venueName: string
  sessionDate: string; sessionTime: string; amount: number; waitedMinutes: number
}
export type DashAlert = { id: string; venueName: string; message: string; type: string; severity: string }
export type DashInsight = { icon: string; color: string; bg: string; text: string }
export type DashboardBundle = {
  isAllVenues: boolean
  venues: DashVenue[]
  alerts: DashAlert[]
  unpaidRegistrations: DashUnpaid[]
  stats: {
    totalRevenue: number; totalPlayers: number; totalSessions: number
    totalUnpaid: number; totalUnpaidAmount: number
    revenueDelta: { today: number; prev: number; deltaPercent: number }
    fillRate: number; activeVenueCount: number
  }
  insights: DashInsight[]
}

type DaySessionRow = {
  id: string; venueId: string; maxCapacity: number; courtFee: number; acFee: number; acEnabled: boolean
  startTime: string; sessionDate: Date; status: string
  registrations: { type: string; customer: { name: string }; payments: { amount: number; status: string }[] }[]
}

/** 某日各館營收（session 已收 Payment + product sale）；回 per-venue map */
function revenueByVenue(sessions: DaySessionRow[], tx: { venueId: string; type: string; totalAmount: number | null }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    const rev = s.registrations.reduce((sum, r) => sum + r.payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0), 0)
    m.set(s.venueId, (m.get(s.venueId) ?? 0) + rev)
  }
  for (const t of tx) {
    if (t.type === 'sale') m.set(t.venueId, (m.get(t.venueId) ?? 0) + (t.totalAmount ?? 0))
  }
  return m
}

export async function getDashboardForUserAsync(scope: UserScope, todayStr?: string): Promise<DashboardBundle> {
  const isAll = scope.visibleVenueIds === 'all'
  const venueIdFilter: string[] | undefined =
    scope.visibleVenueIds === 'all'
      ? undefined
      : (scope.visibleVenueIds.length ? scope.visibleVenueIds : ['__none__'])
  const today = todayStr ?? new Date().toISOString().split('T')[0]
  const yesterday = new Date(new Date(today + 'T00:00:00.000Z').getTime() - 86400000).toISOString().split('T')[0]
  const since7 = new Date(new Date(today + 'T00:00:00.000Z').getTime() - 7 * 86400000).toISOString().split('T')[0]

  const venueWhere = venueIdFilter ? { id: { in: venueIdFilter } } : {}
  const vWhere = venueIdFilter ? { venueId: { in: venueIdFilter } } : {}

  const sessionInclude = {
    registrations: {
      where: { status: { not: 'cancelled' as const } },
      include: { customer: { select: { name: true } }, payments: { select: { amount: true, status: true } } },
    },
  }

  const [venues, todaySessions, ydaySessions, todayTx, ydayTx, alertRows, weekSessions] = await Promise.all([
    prisma.venue.findMany({ where: venueWhere, orderBy: { id: 'asc' } }),
    prisma.session.findMany({ where: { ...vWhere, sessionDate: new Date(today) }, include: sessionInclude }),
    prisma.session.findMany({ where: { ...vWhere, sessionDate: new Date(yesterday) }, include: sessionInclude }),
    prisma.productTransaction.findMany({ where: { ...vWhere, operatedAt: { gte: new Date(today + 'T00:00:00.000Z'), lt: new Date(new Date(today + 'T00:00:00.000Z').getTime() + 86400000) } }, select: { venueId: true, type: true, totalAmount: true } }),
    prisma.productTransaction.findMany({ where: { ...vWhere, operatedAt: { gte: new Date(yesterday + 'T00:00:00.000Z'), lt: new Date(new Date(yesterday + 'T00:00:00.000Z').getTime() + 86400000) } }, select: { venueId: true, type: true, totalAmount: true } }),
    prisma.anomalyAlert.findMany({ where: vWhere, orderBy: { createdAt: 'desc' } }),
    prisma.session.findMany({ where: { ...vWhere, status: 'completed', sessionDate: { gte: new Date(since7), lte: new Date(today) } }, select: { venueId: true, maxCapacity: true, _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } } }),
  ])

  const todayRevMap = revenueByVenue(todaySessions as DaySessionRow[], todayTx)
  const ydayRevMap = revenueByVenue(ydaySessions as DaySessionRow[], ydayTx)

  const nowMs = Date.now()
  const unpaidList: DashUnpaid[] = []

  const dashVenues: DashVenue[] = venues.map((v) => {
    const vs = (todaySessions as DaySessionRow[]).filter((s) => s.venueId === v.id)
    let players = 0, unpaidCount = 0, unpaidAmount = 0
    for (const s of vs) {
      const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
      for (const r of s.registrations) {
        players++
        const expected = r.type === 'season_player' ? 0 : fee
        const paid = r.payments.some((p) => p.status === 'paid')
        if (expected > 0 && !paid) {
          unpaidCount++; unpaidAmount += expected
          const startMs = new Date(`${ymd(s.sessionDate)}T${s.startTime}:00Z`).getTime()
          unpaidList.push({
            registrationId: `${s.id}-${unpaidList.length}`, customerName: r.customer.name,
            venueId: v.id, venueName: v.name, sessionDate: ymd(s.sessionDate), sessionTime: s.startTime,
            amount: expected, waitedMinutes: Math.max(0, Math.floor((nowMs - startMs) / 60000)),
          })
        }
      }
    }
    const tx = todayTx.filter((t) => t.venueId === v.id)
    const giftCount = tx.filter((t) => t.type === 'gift').length
    const saleCount = tx.filter((t) => t.type === 'sale').length
    const giftRatio = saleCount + giftCount > 0 ? Math.round((giftCount / (saleCount + giftCount)) * 100) : 0
    return {
      venueId: v.id, venueName: v.name,
      totalRevenue: todayRevMap.get(v.id) ?? 0, totalPlayers: players, totalSessions: vs.length,
      unpaidCount, unpaidAmount, giftRatio, stockAlerts: 0,
    }
  })

  // 統計
  const sum = (f: (d: DashVenue) => number) => dashVenues.reduce((a, d) => a + f(d), 0)
  const todayTotalRev = [...todayRevMap.values()].reduce((a, b) => a + b, 0)
  const prevTotalRev = [...ydayRevMap.values()].reduce((a, b) => a + b, 0)
  const deltaPercent = prevTotalRev > 0 ? Math.round(((todayTotalRev - prevTotalRev) / prevTotalRev) * 1000) / 10 : 0
  const fillCap = (todaySessions as DaySessionRow[]).reduce((a, s) => a + s.maxCapacity, 0)
  const fillReg = (todaySessions as DaySessionRow[]).reduce((a, s) => a + s.registrations.length, 0)
  const fillRate = fillCap > 0 ? Math.round((fillReg / fillCap) * 100) : 0

  // AI insights（近 7 日各館 completed 滿場率 + alert 推導）
  const weekByVenue = new Map<string, { cap: number; reg: number; count: number }>()
  for (const s of weekSessions) {
    const cur = weekByVenue.get(s.venueId) ?? { cap: 0, reg: 0, count: 0 }
    cur.cap += s.maxCapacity; cur.reg += s._count.registrations; cur.count++
    weekByVenue.set(s.venueId, cur)
  }
  const insights: DashInsight[] = []
  const fillRates = venues.map((v) => {
    const w = weekByVenue.get(v.id)
    if (!w || w.count < 3) return null
    return { name: v.name, rate: w.cap > 0 ? Math.round((w.reg / w.cap) * 100) : 0, count: w.count }
  }).filter((x): x is { name: string; rate: number; count: number } => x !== null)
  if (fillRates.length > 0) {
    const top = fillRates.reduce((a, b) => (b.rate > a.rate ? b : a))
    if (top.rate >= 75) insights.push({ icon: '📈', color: '#059669', bg: '#dcfce7', text: `${top.name}館本週滿場率達 ${top.rate}%（${top.count} 場），建議考慮調升熱門時段價格 5-10%。` })
    const low = fillRates.reduce((a, b) => (b.rate < a.rate ? b : a))
    if (low.rate < 55) insights.push({ icon: '📉', color: '#9a3412', bg: '#ffedd5', text: `${low.name}館本週滿場率僅 ${low.rate}%，建議調整冷門時段或加強推廣。` })
  }
  const giftAlert = alertRows.find((a) => a.type === 'gift_ratio')
  if (giftAlert) insights.push({ icon: '🎁', color: '#9d174d', bg: '#fce7f3', text: giftAlert.message })
  const dropAlert = alertRows.find((a) => a.type === 'revenue_drop')
  if (dropAlert) insights.push({ icon: '⚠️', color: '#991b1b', bg: '#fee2e2', text: dropAlert.message })

  return {
    isAllVenues: isAll,
    venues: dashVenues,
    alerts: alertRows.map((a) => ({ id: a.id, venueName: '', message: a.message, type: a.type, severity: a.severity })).map((a, i) => ({ ...a, venueName: venues.find(v => v.id === alertRows[i].venueId)?.name ?? '' })),
    unpaidRegistrations: unpaidList.sort((a, b) => b.waitedMinutes - a.waitedMinutes).slice(0, 8),
    stats: {
      totalRevenue: sum((d) => d.totalRevenue), totalPlayers: sum((d) => d.totalPlayers), totalSessions: sum((d) => d.totalSessions),
      totalUnpaid: sum((d) => d.unpaidCount), totalUnpaidAmount: sum((d) => d.unpaidAmount),
      revenueDelta: { today: todayTotalRev, prev: prevTotalRev, deltaPercent },
      fillRate, activeVenueCount: isAll ? venues.filter((v) => v.isActive).length : venues.length,
    },
    insights,
  }
}

// ── 批量展開預覽（Round 9C）───────────────────────────────────
function fmtYMDLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type BatchPreview =
  | { ok: false; reason: string }
  | {
      ok: true
      timeslot: { id: string; dayOfWeek: number; startTime: string; endTime: string; label: string | null }
      venueName: string
      dates: Array<{ date: string; skip: boolean; reason: string | null }>
      totalNew: number
      totalSkipped: number
    }

export async function getBatchExpansionPreviewAsync(
  scope: UserScope,
  args: { timeslotId: string; fromDate: string; weeks: number },
): Promise<BatchPreview> {
  if (scope.role === 'none') return { ok: false, reason: '無權限' }
  if (args.weeks <= 0 || args.weeks > 26) return { ok: false, reason: '週數需介於 1~26' }
  const ts = await prisma.timeslot.findUnique({
    where: { id: args.timeslotId },
    include: { venue: { select: { name: true } } },
  })
  if (!ts) return { ok: false, reason: '找不到此時段範本' }
  if (scope.visibleVenueIds !== 'all' && !scope.visibleVenueIds.includes(ts.venueId)) {
    return { ok: false, reason: '無權限操作他館範本' }
  }

  const start = new Date(args.fromDate + 'T00:00:00')
  const offset = (ts.dayOfWeek - start.getDay() + 7) % 7
  start.setDate(start.getDate() + offset)
  const dateStrs: string[] = []
  for (let i = 0; i < args.weeks; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    dateStrs.push(fmtYMDLocal(d))
  }

  const existing = await prisma.session.findMany({
    where: { timeslotId: ts.id, sessionDate: { in: dateStrs.map((s) => new Date(s)) } },
    select: { sessionDate: true, status: true },
  })
  const existMap = new Map(existing.map((e) => [ymd(e.sessionDate), e.status]))

  const dates = dateStrs.map((date) => {
    const st = existMap.get(date)
    if (st) {
      return { date, skip: true, reason: st === 'cancelled' ? '此日已有相同範本場次（已取消，保留紀錄）' : '此日已有相同範本場次' }
    }
    return { date, skip: false, reason: null as string | null }
  })
  const totalSkipped = dates.filter((d) => d.skip).length
  return {
    ok: true,
    timeslot: { id: ts.id, dayOfWeek: ts.dayOfWeek, startTime: ts.startTime, endTime: ts.endTime, label: ts.label },
    venueName: ts.venue?.name ?? '未知球館',
    dates,
    totalNew: dates.length - totalSkipped,
    totalSkipped,
  }
}

// ── 場次明細（Round 9B）───────────────────────────────────────
export type SessionRegRow = {
  id: string
  type: 'season_player' | 'season_substitute' | 'walk_in'
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended'
  paymentStatus: 'paid' | 'unpaid' | 'partial' | 'refunded'
  paymentMethod: 'cash' | 'transfer' | 'online'
  expectedAmount: number
  // P2.1c：客戶自助回報（僅無人場次；尚未經館長確認入帳）
  selfReportedPaid: boolean
  selfPaymentMethod: 'cash' | 'transfer' | 'online' | null
  customer: { name: string; phone: string | null; skillLevel: SkillLevel | null }
}
export type SessionDetailBundle = {
  session: Session
  registrations: SessionRegRow[]
  pendingRefundCount: number
}

export async function getSessionDetailForUserAsync(
  scope: UserScope,
  id: string,
): Promise<SessionDetailBundle | null> {
  if (scope.role === 'none') return null
  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { status: { not: 'cancelled' } },
        include: {
          customer: { select: { name: true, phone: true, skillLevel: true } },
          payments: { select: { amount: true, method: true, status: true } },
        },
      },
    },
  })
  if (!s) return null
  if (scope.visibleVenueIds !== 'all' && !scope.visibleVenueIds.includes(s.venueId)) return null

  const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
  let pendingRefundCount = 0
  const registrations: SessionRegRow[] = s.registrations.map((r) => {
    const paid = r.payments.find((p) => p.status === 'paid')
    const isSeasonPlayer = r.type === 'season_player'
    if (!isSeasonPlayer && paid) pendingRefundCount++
    return {
      id: r.id,
      type: r.type as SessionRegRow['type'],
      status: r.status as SessionRegRow['status'],
      paymentStatus: paid ? 'paid' : 'unpaid',
      paymentMethod: (paid?.method ?? 'cash') as SessionRegRow['paymentMethod'],
      expectedAmount: isSeasonPlayer ? 0 : fee,
      selfReportedPaid: r.selfReportedPaid,
      selfPaymentMethod: (r.selfPaymentMethod ?? null) as SessionRegRow['selfPaymentMethod'],
      customer: {
        name: r.customer.name,
        phone: r.customer.phone,
        skillLevel: fromSkill(r.customer.skillLevel),
      },
    }
  })

  return {
    session: mapSession(s, { venueName: s.venue?.name, currentCount: s.registrations.length }),
    registrations,
    pendingRefundCount,
  }
}

// ── 前台報到 / 收款（P2.1b）────────────────────────────────────
export type CheckinSession = {
  session: Session
  registrations: SessionRegRow[]
}
export type CheckinBundle = {
  date: string        // 實際顯示的日期（今天無場次時回退到最近一個有場次的日子）
  isToday: boolean
  sessions: CheckinSession[]
}

/** 當日（或最近一個有場次的日子）該使用者可見館的場次 + 名單，供前台報到/收款 */
export async function getCheckinDataForUserAsync(scope: UserScope, todayStr?: string): Promise<CheckinBundle> {
  if (scope.role === 'none') return { date: todayStr ?? new Date().toISOString().split('T')[0], isToday: true, sessions: [] }
  const today = todayStr ?? new Date().toISOString().split('T')[0]
  const baseWhere = { ...venueWhere(scope.visibleVenueIds), status: { not: 'cancelled' } as any }

  // 優先今天；今天沒場次 → 回退到 <= today 最近一個有場次的日期（避免測試時空畫面）
  let target = today
  let count = await prisma.session.count({ where: { ...baseWhere, sessionDate: new Date(today) } })
  if (count === 0) {
    const latest = await prisma.session.findFirst({
      where: { ...baseWhere, sessionDate: { lte: new Date(today) } },
      orderBy: { sessionDate: 'desc' }, select: { sessionDate: true },
    })
    if (latest) target = latest.sessionDate.toISOString().split('T')[0]
  }

  const rows = await prisma.session.findMany({
    where: { ...baseWhere, sessionDate: new Date(target) },
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { status: { not: 'cancelled' } },
        include: {
          customer: { select: { name: true, phone: true, skillLevel: true } },
          payments: { select: { amount: true, method: true, status: true } },
        },
      },
    },
    orderBy: [{ startTime: 'asc' }],
  })

  const sessions: CheckinSession[] = rows.map((s) => {
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const registrations: SessionRegRow[] = s.registrations.map((r) => {
      const paid = r.payments.find((p) => p.status === 'paid')
      const isSeasonPlayer = r.type === 'season_player'
      return {
        id: r.id,
        type: r.type as SessionRegRow['type'],
        status: r.status as SessionRegRow['status'],
        paymentStatus: paid ? 'paid' : 'unpaid',
        paymentMethod: (paid?.method ?? 'cash') as SessionRegRow['paymentMethod'],
        expectedAmount: isSeasonPlayer ? 0 : fee,
        selfReportedPaid: r.selfReportedPaid,
        selfPaymentMethod: (r.selfPaymentMethod ?? null) as SessionRegRow['selfPaymentMethod'],
        customer: { name: r.customer.name, phone: r.customer.phone, skillLevel: fromSkill(r.customer.skillLevel) },
      }
    })
    return { session: mapSession(s, { venueName: s.venue?.name, currentCount: s.registrations.length }), registrations }
  })

  return { date: target, isToday: target === today, sessions }
}

// ── 自助回報（無人場次，公開）P2.1c ───────────────────────────
export type SelfCheckinReg = {
  registrationId: string
  customerName: string
  customerPhoneMasked: string
  expectedAmount: number
  selfReportedPaid: boolean
  selfPaymentMethod: 'cash' | 'transfer' | 'online' | null
  selfReportedAt: string | null
  updatedAt: string
}
export type SelfCheckinBundle = {
  sessionId: string
  venueName: string
  sessionDate: string
  startTime: string
  endTime: string
  courtFee: number
  acFee: number
  acEnabled: boolean
  totalAmount: number
  payableRegistrations: SelfCheckinReg[]
}

/** 公開：無人場次自助回報所需資料（無登入 / 無 token；僅開放 isUnattended 場次）*/
export async function getSelfCheckinDataAsync(sessionId: string): Promise<SelfCheckinBundle | null> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { status: { not: 'cancelled' }, type: { not: 'season_player' } },
        include: { customer: { select: { name: true, phone: true } } },
      },
    },
  })
  if (!s) return null
  if (!s.isUnattended) return null
  const totalAmount = s.courtFee + (s.acEnabled ? s.acFee : 0)
  return {
    sessionId: s.id,
    venueName: s.venue?.name ?? '?',
    sessionDate: s.sessionDate.toISOString().split('T')[0],
    startTime: s.startTime,
    endTime: s.endTime,
    courtFee: s.courtFee,
    acFee: s.acFee,
    acEnabled: s.acEnabled,
    totalAmount,
    payableRegistrations: s.registrations.map((r) => {
      const phone = r.customer.phone ?? ''
      const masked = phone ? phone.slice(0, 4) + '-***-' + phone.slice(-3) : '（未提供）'
      return {
        registrationId: r.id,
        customerName: r.customer.name,
        customerPhoneMasked: masked,
        expectedAmount: totalAmount,
        selfReportedPaid: r.selfReportedPaid,
        selfPaymentMethod: (r.selfPaymentMethod ?? null) as SelfCheckinReg['selfPaymentMethod'],
        selfReportedAt: r.selfReportedAt ? r.selfReportedAt.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
      }
    }),
  }
}

// ── 退費鏈（P2.1d）─────────────────────────────────────────────
// 形狀對齊 data/api.ts 的 PendingRefundRow / RefundHistoryRow。
// 退費後設資料（金額/方式/原因/誰/何時）由「負額 Payment + AuditLog」推導，不另存欄位。
type RefundMethod = 'cash' | 'transfer' | 'online'
export type PendingRefundRow = {
  registrationId: string
  registrationUpdatedAt: string
  sessionId: string
  sessionDate: string
  sessionStartTime: string
  venueId: string
  venueName: string
  customerId: string
  customerName: string
  customerPhone: string | null
  registrationType: 'season_player' | 'season_substitute' | 'walk_in'
  netPaid: number
  lastPaymentMethod: RefundMethod | null
  sessionCancelledAt: string | null
  sessionCancelDetail: string | null
}
export type RefundHistoryRow = {
  registrationId: string
  decision: 'refunded' | 'waived'
  decidedAt: string | null
  decidedBy: string | null
  refundedAmount: number | null
  refundMethod: RefundMethod | null
  refundNotes: string | null
  waiveReason: string | null
  sessionId: string
  sessionDate: string
  sessionStartTime: string
  venueId: string
  venueName: string
  customerId: string
  customerName: string
  customerPhone: string | null
}
export type RefundHistoryFilter = { decision?: 'refunded' | 'waived' | 'all'; venueId?: string | 'all' }

/** 待退費：已取消場次中、尚未決定退費（refundDecision=null）且 netPaid>0 的報名 */
export async function getPendingRefundsForUserAsync(scope: UserScope): Promise<PendingRefundRow[]> {
  if (scope.role === 'none') return []
  const sessions = await prisma.session.findMany({
    where: { status: 'cancelled', ...venueWhere(scope.visibleVenueIds) },
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { refundDecision: null },
        include: {
          customer: { select: { name: true, phone: true } },
          payments: { select: { amount: true, method: true, paidAt: true } },
        },
      },
    },
  })
  const sessionIds = sessions.map((s) => s.id)
  const cancelLogs = sessionIds.length
    ? await prisma.auditLog.findMany({
        where: { action: 'CANCEL_SESSION', entityType: 'Session', entityId: { in: sessionIds } },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, createdAt: true, newValues: true },
      })
    : []
  const cancelBySession = new Map<string, { at: string; detail: string | null }>()
  for (const log of cancelLogs) {
    if (log.entityId && !cancelBySession.has(log.entityId)) {
      const nv = (log.newValues ?? {}) as { reason?: string }
      cancelBySession.set(log.entityId, { at: log.createdAt.toISOString(), detail: nv.reason ?? null })
    }
  }
  const rows: PendingRefundRow[] = []
  for (const s of sessions) {
    const cancel = cancelBySession.get(s.id)
    for (const r of s.registrations) {
      const netPaid = r.payments.reduce((sum, p) => sum + p.amount, 0)
      if (netPaid <= 0) continue
      const positives = r.payments.filter((p) => p.amount > 0).sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
      rows.push({
        registrationId: r.id,
        registrationUpdatedAt: r.updatedAt.toISOString(),
        sessionId: s.id,
        sessionDate: s.sessionDate.toISOString().split('T')[0],
        sessionStartTime: s.startTime,
        venueId: s.venueId,
        venueName: s.venue?.name ?? '?',
        customerId: r.customerId,
        customerName: r.customer.name,
        customerPhone: r.customer.phone,
        registrationType: r.type as PendingRefundRow['registrationType'],
        netPaid,
        lastPaymentMethod: positives.length ? (positives[positives.length - 1].method as RefundMethod) : null,
        sessionCancelledAt: cancel?.at ?? null,
        sessionCancelDetail: cancel?.detail ?? null,
      })
    }
  }
  rows.sort((a, b) => {
    const ax = a.sessionCancelledAt ?? '', bx = b.sessionCancelledAt ?? ''
    return ax !== bx ? bx.localeCompare(ax) : a.customerName.localeCompare(b.customerName)
  })
  return rows
}

/** 退費歷史：已決定退費（refundDecision != null）的報名 + audit/Payment 推導後設資料 */
export async function getRefundHistoryForUserAsync(scope: UserScope, filter?: RefundHistoryFilter): Promise<RefundHistoryRow[]> {
  if (scope.role === 'none') return []
  const sessionWhere: { venueId?: string | { in: string[] } } = { ...venueWhere(scope.visibleVenueIds) }
  if (filter?.venueId && filter.venueId !== 'all') sessionWhere.venueId = filter.venueId
  const where: Prisma.RegistrationWhereInput = { refundDecision: { not: null }, session: sessionWhere }
  if (filter?.decision && filter.decision !== 'all') where.refundDecision = filter.decision

  const regs = await prisma.registration.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true } },
      session: { include: { venue: { select: { name: true } } } },
      payments: { select: { amount: true, method: true, status: true, notes: true, paidAt: true } },
    },
  })
  const regIds = regs.map((r) => r.id)
  const logs = regIds.length
    ? await prisma.auditLog.findMany({
        where: { entityType: 'Registration', entityId: { in: regIds }, action: { in: ['ISSUE_REFUND', 'WAIVE_REFUND'] } },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      })
    : []
  const logByReg = new Map<string, (typeof logs)[number]>()
  for (const log of logs) { if (log.entityId && !logByReg.has(log.entityId)) logByReg.set(log.entityId, log) }

  const rows: RefundHistoryRow[] = regs.map((r) => {
    const log = logByReg.get(r.id)
    const decision = r.refundDecision as 'refunded' | 'waived'
    let refundedAmount: number | null = null, refundMethod: RefundMethod | null = null, refundNotes: string | null = null, waiveReason: string | null = null
    if (decision === 'refunded') {
      const neg = r.payments.filter((p) => p.status === 'refunded' || p.amount < 0).sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0]
      if (neg) { refundedAmount = Math.abs(neg.amount); refundMethod = neg.method as RefundMethod; refundNotes = neg.notes }
    } else {
      const nv = (log?.newValues ?? {}) as { reason?: string }
      waiveReason = nv.reason ?? null
    }
    return {
      registrationId: r.id,
      decision,
      decidedAt: log ? log.createdAt.toISOString() : null,
      decidedBy: log?.user?.name ?? null,
      refundedAmount, refundMethod, refundNotes, waiveReason,
      sessionId: r.sessionId,
      sessionDate: r.session.sessionDate.toISOString().split('T')[0],
      sessionStartTime: r.session.startTime,
      venueId: r.session.venueId,
      venueName: r.session.venue?.name ?? '?',
      customerId: r.customerId,
      customerName: r.customer.name,
      customerPhone: r.customer.phone,
    }
  })
  rows.sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
  return rows
}

// ── 場次對帳（P2.1e）───────────────────────────────────────────
// 形狀對齊 data/api.ts 的 SessionReconciliation。實收 = sum(該場報名的 Payment.amount)。
export type SessionReconStatus = 'matched' | 'shortfall' | 'overpaid' | 'no_charge'
export type SessionReconRow = {
  sessionId: string
  sessionDate: string
  startTime: string
  endTime: string
  venueId: string
  venueName: string
  courtFee: number
  acFee: number
  acEnabled: boolean
  walkInCount: number
  substituteCount: number
  seasonPlayerCount: number
  expectedRevenue: number
  grossExpectedRevenue: number
  actualRevenue: number
  gap: number
  unpaidCount: number
  status: SessionReconStatus
  isUnattended: boolean
  hasSelfReportMismatch: boolean
}
export type SessionReconFilter = { period?: 'week' | 'month' | 'season' | 'all'; venueId?: string; onlyShortfall?: boolean }

export async function getSessionReconciliationForUserAsync(scope: UserScope, filter?: SessionReconFilter): Promise<SessionReconRow[]> {
  if (scope.role === 'none') return []
  const period = filter?.period ?? 'week'
  const today = new Date().toISOString().split('T')[0]
  const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().split('T')[0] }
  let range: { from: string; to: string } | null = null
  if (period === 'week') range = { from: addDays(today, -6), to: today }
  else if (period === 'month') range = { from: addDays(today, -29), to: today }
  else if (period === 'season') { const s = await getActiveSeasonAsync(); range = s ? { from: s.startDate, to: s.endDate } : null }

  const where: Prisma.SessionWhereInput = { ...venueWhere(scope.visibleVenueIds) }
  if (filter?.venueId) where.venueId = filter.venueId
  if (range) where.sessionDate = { gte: new Date(range.from), lte: new Date(range.to) }

  const sessions = await prisma.session.findMany({
    where,
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { status: { not: 'cancelled' } },
        select: { type: true, selfReportedPaid: true, payments: { select: { amount: true, status: true } } },
      },
    },
  })

  const rows: SessionReconRow[] = sessions.map((s) => {
    const regs = s.registrations
    const walkIn = regs.filter((r) => r.type === 'walk_in').length
    const sub = regs.filter((r) => r.type === 'season_substitute').length
    const seasonP = regs.filter((r) => r.type === 'season_player').length
    const feePerHead = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const expected = feePerHead * (walkIn + sub)
    const grossExpected = feePerHead * (walkIn + sub + seasonP)
    let actual = 0, unpaid = 0, paymentRows = 0
    for (const r of regs) {
      actual += r.payments.reduce((a, p) => a + p.amount, 0)
      paymentRows += r.payments.length
      if (r.type !== 'season_player' && !r.payments.some((p) => p.status === 'paid')) unpaid++
    }
    const gap = expected - actual
    const status: SessionReconStatus = expected === 0 ? 'no_charge' : gap > 0 ? 'shortfall' : gap < 0 ? 'overpaid' : 'matched'
    let hasSelfReportMismatch = false
    if (s.isUnattended) {
      const selfReports = regs.filter((r) => r.selfReportedPaid).length
      hasSelfReportMismatch = selfReports > paymentRows
    }
    return {
      sessionId: s.id,
      sessionDate: s.sessionDate.toISOString().split('T')[0],
      startTime: s.startTime, endTime: s.endTime,
      venueId: s.venueId, venueName: s.venue?.name ?? '?',
      courtFee: s.courtFee, acFee: s.acFee, acEnabled: s.acEnabled,
      walkInCount: walkIn, substituteCount: sub, seasonPlayerCount: seasonP,
      expectedRevenue: expected, grossExpectedRevenue: grossExpected, actualRevenue: actual,
      gap, unpaidCount: unpaid, status, isUnattended: s.isUnattended, hasSelfReportMismatch,
    }
  })

  const filtered = filter?.onlyShortfall ? rows.filter((r) => r.gap > 0) : rows
  filtered.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || a.startTime.localeCompare(b.startTime))
  return filtered
}

// ── 無人場次自助回報對照（P2.2a）───────────────────────────────
// 形狀對齊 data/api.ts 的 UnattendedReportOverview。實收 = sum(status='paid' Payment)。
const UNATTENDED_LOOKBACK_DAYS = 60
const SUSPICIOUS_UNREPORTED_THRESHOLD = 3

export type UnattendedRegRow = {
  registrationId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  registrationType: 'season_player' | 'season_substitute' | 'walk_in'
  isPayable: boolean
  expectedAmount: number
  selfReportedPaid: boolean
  selfPaymentMethod: 'cash' | 'transfer' | 'online' | null
  selfPaymentEvidence: string | null
  selfReportedAt: string | null
  hasActualPayment: boolean
  actualPaidAmount: number
  reportedNoPay: boolean
  paidNotReported: boolean
}
export type UnattendedSessionRow = {
  sessionId: string
  venueId: string
  venueName: string
  sessionDate: string
  startTime: string
  endTime: string
  expectedRevenue: number
  actualRevenue: number
  registeredCount: number
  seasonPlayerCount: number
  payableCount: number
  selfReportedCount: number
  actualPaidCount: number
  reportedButNoPayCount: number
  paidButNotReportedCount: number
  discrepancyAmount: number
  selfReportRate: number
  rows: UnattendedRegRow[]
}
export type SuspiciousCustomerRow = {
  customerId: string
  customerName: string
  customerPhone: string | null
  unattendedRegistrationsCount: number
  selfReportedCount: number
  unreportedCount: number
  totalOwedFromUnreported: number
  recentUnreportedDates: string[]
  primaryVenueId: string
  primaryVenueName: string
}
export type UnattendedReportBundle = {
  sessions: UnattendedSessionRow[]
  totalExpected: number
  totalActual: number
  totalDiscrepancy: number
  overallSelfReportRate: number
  trustGapCount: number
  suspiciousCustomers: SuspiciousCustomerRow[]
  lookbackDays: number
  suspiciousThreshold: number
  demoSessionId: string | null
}

export async function getUnattendedReportForUserAsync(scope: UserScope): Promise<UnattendedReportBundle> {
  const empty: UnattendedReportBundle = { sessions: [], totalExpected: 0, totalActual: 0, totalDiscrepancy: 0, overallSelfReportRate: 0, trustGapCount: 0, suspiciousCustomers: [], lookbackDays: UNATTENDED_LOOKBACK_DAYS, suspiciousThreshold: SUSPICIOUS_UNREPORTED_THRESHOLD, demoSessionId: null }
  if (scope.role === 'none') return empty

  const today = new Date().toISOString().split('T')[0]
  const cutoff = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - UNATTENDED_LOOKBACK_DAYS); return d.toISOString().split('T')[0] })()

  const sessionsRaw = await prisma.session.findMany({
    where: { isUnattended: true, sessionDate: { gte: new Date(cutoff), lte: new Date(today) }, ...venueWhere(scope.visibleVenueIds) },
    include: {
      venue: { select: { name: true } },
      registrations: {
        where: { status: { not: 'cancelled' } },
        include: {
          customer: { select: { name: true, phone: true } },
          payments: { where: { status: 'paid' }, select: { amount: true } },
        },
      },
    },
    orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
  })

  const sessions: UnattendedSessionRow[] = sessionsRaw.map((s) => {
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const regs = s.registrations
    let actualRevenue = 0, actualPaidCount = 0, reportedButNoPayCount = 0, paidButNotReportedCount = 0, selfReportedCount = 0
    const rows: UnattendedRegRow[] = regs.map((r) => {
      const isPayable = r.type !== 'season_player'
      const paidAmount = r.payments.reduce((a, p) => a + p.amount, 0)
      const hasPay = isPayable && r.payments.length > 0
      if (isPayable) {
        actualRevenue += paidAmount
        if (hasPay) actualPaidCount++
        if (r.selfReportedPaid && !hasPay) reportedButNoPayCount++
        if (!r.selfReportedPaid && hasPay) paidButNotReportedCount++
        if (r.selfReportedPaid) selfReportedCount++
      }
      return {
        registrationId: r.id, customerId: r.customerId, customerName: r.customer.name, customerPhone: r.customer.phone,
        registrationType: r.type as UnattendedRegRow['registrationType'],
        isPayable, expectedAmount: isPayable ? fee : 0,
        selfReportedPaid: r.selfReportedPaid, selfPaymentMethod: (r.selfPaymentMethod ?? null) as UnattendedRegRow['selfPaymentMethod'],
        selfPaymentEvidence: r.selfPaymentEvidence, selfReportedAt: r.selfReportedAt ? r.selfReportedAt.toISOString() : null,
        hasActualPayment: hasPay, actualPaidAmount: paidAmount,
        reportedNoPay: r.selfReportedPaid && !hasPay && isPayable,
        paidNotReported: !r.selfReportedPaid && hasPay && isPayable,
      }
    })
    rows.sort((a, b) => (a.hasActualPayment !== b.hasActualPayment ? (a.hasActualPayment ? -1 : 1) : a.selfReportedPaid !== b.selfReportedPaid ? (a.selfReportedPaid ? -1 : 1) : a.customerName.localeCompare(b.customerName, 'zh-Hant')))
    const payableCount = regs.filter((r) => r.type !== 'season_player').length
    const seasonPlayerCount = regs.length - payableCount
    const expectedRevenue = payableCount * fee
    return {
      sessionId: s.id, venueId: s.venueId, venueName: s.venue?.name ?? '?',
      sessionDate: s.sessionDate.toISOString().split('T')[0], startTime: s.startTime, endTime: s.endTime,
      expectedRevenue, actualRevenue, registeredCount: regs.length, seasonPlayerCount, payableCount,
      selfReportedCount, actualPaidCount, reportedButNoPayCount, paidButNotReportedCount,
      discrepancyAmount: expectedRevenue - actualRevenue, selfReportRate: payableCount > 0 ? selfReportedCount / payableCount : 0,
      rows,
    }
  })

  // 可疑客戶：lookback 內無人場次的「應付」報名，依客戶聚合，未回報次數 ≥ 門檻
  const byCustomer = new Map<string, { name: string; phone: string | null; entries: { venueId: string; venueName: string; date: string; selfReported: boolean; owed: number }[] }>()
  for (const s of sessionsRaw) {
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    for (const r of s.registrations) {
      if (r.type === 'season_player') continue
      let c = byCustomer.get(r.customerId)
      if (!c) { c = { name: r.customer.name, phone: r.customer.phone, entries: [] }; byCustomer.set(r.customerId, c) }
      c.entries.push({ venueId: s.venueId, venueName: s.venue?.name ?? '?', date: s.sessionDate.toISOString().split('T')[0], selfReported: r.selfReportedPaid, owed: fee })
    }
  }
  const suspiciousCustomers: SuspiciousCustomerRow[] = []
  for (const [customerId, c] of byCustomer) {
    const unreported = c.entries.filter((e) => !e.selfReported)
    if (unreported.length < SUSPICIOUS_UNREPORTED_THRESHOLD) continue
    const venueCount = new Map<string, { name: string; n: number }>()
    for (const e of c.entries) { const v = venueCount.get(e.venueId) ?? { name: e.venueName, n: 0 }; v.n++; venueCount.set(e.venueId, v) }
    const primary = [...venueCount.entries()].sort((a, b) => b[1].n - a[1].n)[0]
    suspiciousCustomers.push({
      customerId, customerName: c.name, customerPhone: c.phone,
      unattendedRegistrationsCount: c.entries.length, selfReportedCount: c.entries.length - unreported.length,
      unreportedCount: unreported.length, totalOwedFromUnreported: unreported.reduce((a, e) => a + e.owed, 0),
      recentUnreportedDates: unreported.map((e) => e.date).sort().reverse().slice(0, 5),
      primaryVenueId: primary[0], primaryVenueName: primary[1].name,
    })
  }
  suspiciousCustomers.sort((a, b) => b.unreportedCount - a.unreportedCount || b.totalOwedFromUnreported - a.totalOwedFromUnreported)

  const totalExpected = sessions.reduce((a, s) => a + s.expectedRevenue, 0)
  const totalActual = sessions.reduce((a, s) => a + s.actualRevenue, 0)
  const totalPayable = sessions.reduce((a, s) => a + s.payableCount, 0)
  const totalReported = sessions.reduce((a, s) => a + s.selfReportedCount, 0)
  const trustGapCount = sessions.reduce((a, s) => a + s.reportedButNoPayCount, 0)

  // demo self-checkin 連結：優先 lookback 內最近一場；否則任一無人場次
  let demoSessionId: string | null = sessions[0]?.sessionId ?? null
  if (!demoSessionId) {
    const any = await prisma.session.findFirst({ where: { isUnattended: true, ...venueWhere(scope.visibleVenueIds) }, orderBy: { sessionDate: 'desc' }, select: { id: true } })
    demoSessionId = any?.id ?? null
  }

  return {
    sessions, totalExpected, totalActual, totalDiscrepancy: totalExpected - totalActual,
    overallSelfReportRate: totalPayable > 0 ? totalReported / totalPayable : 0, trustGapCount,
    suspiciousCustomers, lookbackDays: UNATTENDED_LOOKBACK_DAYS, suspiciousThreshold: SUSPICIOUS_UNREPORTED_THRESHOLD, demoSessionId,
  }
}

// ── 季租單對帳（Round 9A）─────────────────────────────────────
// 形狀對齊 data/api.ts 的 SeasonRentalReconciliation。
export type SeasonRentalReconRow = {
  rentalId: string
  captainId: string
  captainName: string
  captainPhone: string
  venueId: string
  venueName: string
  timeslotLabel: string
  seasonName: string
  pricePerSession: number
  totalAmount: number
  paidAmount: number
  gap: number
  paidRatio: number
  status: SeasonRentalStatus
  generatedSessionCount: number
  completedSessionCount: number
  remainingSessionCount: number
  isFullyPaid: boolean
  isUnpaid: boolean
  isCritical: boolean
}

export async function getSeasonRentalReconciliationForUserAsync(
  scope: UserScope,
  venueId?: string,
): Promise<SeasonRentalReconRow[]> {
  if (scope.role === 'none') return []
  const timeslotWhere: any = {}
  if (scope.visibleVenueIds !== 'all') {
    timeslotWhere.venueId = { in: scope.visibleVenueIds.length ? scope.visibleVenueIds : ['__none__'] }
  }
  if (venueId) timeslotWhere.venueId = venueId

  const rows = await prisma.seasonRental.findMany({
    where: Object.keys(timeslotWhere).length ? { timeslot: timeslotWhere } : {},
    include: {
      captain: { select: { name: true, phone: true } },
      season: { select: { name: true } },
      timeslot: { select: { label: true, startTime: true, endTime: true, venueId: true, venue: { select: { name: true } } } },
      sessions: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((r): SeasonRentalReconRow => {
    const gap = r.totalAmount - r.paidAmount
    const paidRatio = r.totalAmount > 0 ? r.paidAmount / r.totalAmount : 0
    const generated = r.sessions.length
    const completed = r.sessions.filter((s) => s.status === 'completed').length
    return {
      rentalId: r.id,
      captainId: r.captainId,
      captainName: r.captain?.name ?? '?',
      captainPhone: r.captain?.phone ?? '',
      venueId: r.timeslot?.venueId ?? '',
      venueName: r.timeslot?.venue?.name ?? '?',
      timeslotLabel: r.timeslot?.label ?? (r.timeslot ? `${r.timeslot.startTime}-${r.timeslot.endTime}` : '?'),
      seasonName: r.season?.name ?? '?',
      pricePerSession: r.pricePerSession,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      gap,
      paidRatio,
      status: r.status as SeasonRentalStatus,
      generatedSessionCount: generated,
      completedSessionCount: completed,
      remainingSessionCount: generated - completed,
      isFullyPaid: gap <= 0,
      isUnpaid: gap > 0,
      isCritical: r.status === 'pending' && paidRatio < 1.0,
    }
  })
}

// ── 主揪 portal 完整資料包（Round 8A）─────────────────────────
// 一次查好整個 rental 的場次 + 名單，client 端純渲染、本地切換場次。
export type CaptainRegRow = {
  registrationId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  customerSkillLevel: SkillLevel | null
  type: 'season_player' | 'season_substitute' | 'walk_in'
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended'
  updatedAt: string
}
export type CaptainSessionBundle = {
  session: Session
  isPast: boolean
  isToday: boolean
  seasonPlayerCount: number
  substituteCount: number
  walkInCount: number
  feePerPaidPerson: number
  expectedRevenue: number
  paymentCollected: number
  /** 季打名單（含請假/cancelled，供請假切換）*/
  seasonPlayersWithLeave: CaptainRegRow[]
  substitutes: CaptainRegRow[]
  walkIns: CaptainRegRow[]
}
export type CaptainPortalBundle = {
  rental: SeasonRental
  tokenStatus: 'active' | 'expired'
  seasonPlayerCount: number
  totalSessions: number
  pastSessions: number
  upcomingSessions: number
  paidAmount: number
  expectedAmount: number
  outstandingAmount: number
  paidRatio: number
  isPaymentCritical: boolean
  sessions: CaptainSessionBundle[]
}

function mapRegRow(r: {
  id: string; customerId: string; type: string; status: string; updatedAt: Date
  customer: { name: string; phone: string | null; skillLevel: string | null }
}): CaptainRegRow {
  return {
    registrationId: r.id,
    customerId: r.customerId,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    customerSkillLevel: fromSkill(r.customer.skillLevel),
    type: r.type as CaptainRegRow['type'],
    status: r.status as CaptainRegRow['status'],
    updatedAt: iso(r.updatedAt)!,
  }
}

/**
 * 主揪 token → 完整 portal 資料（找不到回 null）。
 * 授權：場次範圍 scope 死在查詢（同 rental.timeslotId + 該季日期區間），
 * 主揪只看得到自己 rental 的場次。
 */
export async function getCaptainPortalByTokenAsync(token: string): Promise<CaptainPortalBundle | null> {
  const r = await prisma.seasonRental.findUnique({
    where: { accessToken: token },
    include: {
      captain: { select: { name: true, phone: true } },
      season: { select: { name: true, startDate: true, endDate: true } },
      timeslot: { select: { label: true, startTime: true, endTime: true, venue: { select: { name: true } } } },
    },
  })
  if (!r) return null

  const today = new Date().toISOString().split('T')[0]
  const tokenStatus: 'active' | 'expired' = r.accessTokenExpiresAt.getTime() < Date.now() ? 'expired' : 'active'

  // 該 rental 範圍內的場次（同 timeslot + 該季日期區間）— 對齊 _findCaptainSessions
  const sessionRows = await prisma.session.findMany({
    where: {
      timeslotId: r.timeslotId,
      sessionDate: { gte: r.season.startDate, lte: r.season.endDate },
    },
    include: {
      registrations: {
        include: {
          customer: { select: { name: true, phone: true, skillLevel: true } },
          payments: { select: { amount: true } },
        },
      },
    },
    orderBy: { sessionDate: 'asc' },
  })

  const seasonPlayerIds = new Set<string>()
  const sessions: CaptainSessionBundle[] = sessionRows.map((s) => {
    const ymdDate = ymd(s.sessionDate)
    const active = s.registrations.filter((rg) => rg.status !== 'cancelled')
    const sp = active.filter((rg) => rg.type === 'season_player')
    const sub = active.filter((rg) => rg.type === 'season_substitute')
    const wi = active.filter((rg) => rg.type === 'walk_in')
    sp.forEach((rg) => seasonPlayerIds.add(rg.customerId))
    const fee = s.courtFee + (s.acEnabled ? s.acFee : 0)
    const paymentCollected = active.reduce(
      (sum, rg) => sum + rg.payments.reduce((a, p) => a + p.amount, 0), 0,
    )
    return {
      session: mapSession(s),
      isPast: ymdDate < today,
      isToday: ymdDate === today,
      seasonPlayerCount: sp.length,
      substituteCount: sub.length,
      walkInCount: wi.length,
      feePerPaidPerson: fee,
      expectedRevenue: (sub.length + wi.length) * fee,
      paymentCollected,
      // 季打名單含 cancelled（請假切換用）；補位/臨打只列未取消
      seasonPlayersWithLeave: s.registrations.filter((rg) => rg.type === 'season_player').map(mapRegRow),
      substitutes: sub.map(mapRegRow),
      walkIns: wi.map(mapRegRow),
    }
  })

  const outstandingAmount = r.totalAmount - r.paidAmount
  return {
    rental: mapSeasonRental(r),
    tokenStatus,
    seasonPlayerCount: seasonPlayerIds.size,
    totalSessions: sessions.length,
    pastSessions: sessions.filter((s) => s.isPast).length,
    upcomingSessions: sessions.filter((s) => !s.isPast && !s.isToday).length,
    paidAmount: r.paidAmount,
    expectedAmount: r.totalAmount,
    outstandingAmount,
    paidRatio: r.totalAmount > 0 ? r.paidAmount / r.totalAmount : 0,
    isPaymentCritical: outstandingAmount > 0,
    sessions,
  }
}
