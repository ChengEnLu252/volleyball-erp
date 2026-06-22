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
