// ============================================================
// data/api.ts — 資料存取的統一入口
// ============================================================
// 此檔是頁面層存取資料的「唯一管道」。所有頁面只能 import
// from '@/data/api'，禁止直接 import '@/data/generator'。
//
// 設計：
//   - listX() / getX()：sync 函式，給 client component 用
//                       直接回傳 in-memory 資料
//   - getXAsync() / async：給 server component（如 dashboard）用
//                          目前只是 thin wrapper，但未來換成真資料庫
//                          時，只需要在這個檔內部把 GENERATED 換成
//                          SQL/ORM queries。頁面層完全不用改。
//   - 衍生計算函式：getRevenueDelta, getCapacityFillRate,
//                  getAiInsights ... 把 dashboard 上原本寫死的
//                  「↑較昨日 +8.3%」等變成真實計算。
//
// 階段 1.4 規劃：
//   - 把這裡 sync 函式都改成 async（一次性把所有頁面切到 await）
//   - 但對 1.3 demo，sync 在 React 客戶端使用更簡單，先這樣。
// ============================================================

import { GENERATED } from './generator'
import type {
  Venue, User, Customer, Session, SessionStatus, Registration,
  Payment, Product, ProductTransaction, Timeslot, Season, SeasonRental,
  SeasonRentalStatus, AnomalyAlert, UnpaidRegistration,
  VenueDailySummary, DashboardData,
} from '@/types'


// ── 內部 helper ─────────────────────────────────────────────

const TODAY_STR = new Date().toISOString().split('T')[0]

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}


// ============================================================
// 一、實體查詢（Entity queries）
// ============================================================

// ── Venues ──────────────────────────────────────────────────

export function listVenues(): Venue[] {
  return GENERATED.venues
}

export function getVenue(id: string): Venue | null {
  return GENERATED.venues.find(v => v.id === id) ?? null
}

/** 啟用中的球館數量 */
export function getActiveVenueCount(): number {
  return GENERATED.venues.filter(v => v.isActive).length
}


// ── Users ───────────────────────────────────────────────────

export function listUsers(): User[] {
  return GENERATED.users
}

export function getUser(id: string): User | null {
  return GENERATED.users.find(u => u.id === id) ?? null
}


// ── Customers ───────────────────────────────────────────────

export function listCustomers(): Customer[] {
  return GENERATED.customers
}

export function getCustomer(id: string): Customer | null {
  return GENERATED.customers.find(c => c.id === id) ?? null
}


// ── Sessions ────────────────────────────────────────────────

export type SessionFilter = {
  venueId?: string
  /** 精確日期，YYYY-MM-DD */
  date?: string
  /** 從 YYYY-MM-DD（含） */
  dateFrom?: string
  /** 到 YYYY-MM-DD（含） */
  dateTo?: string
  status?: SessionStatus
}

export function listSessions(filter?: SessionFilter): Session[] {
  let result = GENERATED.sessions
  if (filter?.venueId)  result = result.filter(s => s.venueId === filter.venueId)
  if (filter?.date)     result = result.filter(s => s.sessionDate === filter.date)
  if (filter?.dateFrom) result = result.filter(s => s.sessionDate >= filter.dateFrom!)
  if (filter?.dateTo)   result = result.filter(s => s.sessionDate <= filter.dateTo!)
  if (filter?.status)   result = result.filter(s => s.status === filter.status)
  return result
}

export function getSession(id: string): Session | null {
  return GENERATED.sessions.find(s => s.id === id) ?? null
}


// ── Registrations ───────────────────────────────────────────

/** 報名記錄帶上對應 Customer，方便 UI 直接顯示姓名/程度 */
export type RegistrationWithCustomer = Registration & { customer: Customer }

/** 取得某場次的所有報名（已 join customer，已過濾 cancelled） */
export function listSessionRegistrations(sessionId: string): RegistrationWithCustomer[] {
  return GENERATED.registrations
    .filter(r => r.sessionId === sessionId && r.status !== 'cancelled')
    .map(r => {
      const customer = GENERATED.customers.find(c => c.id === r.customerId)
      return customer ? { ...r, customer } : null
    })
    .filter((x): x is RegistrationWithCustomer => x !== null)
}

export function listRegistrations(filter?: { sessionId?: string; customerId?: string }): Registration[] {
  let result = GENERATED.registrations
  if (filter?.sessionId)  result = result.filter(r => r.sessionId === filter.sessionId)
  if (filter?.customerId) result = result.filter(r => r.customerId === filter.customerId)
  return result
}


// ── Payments ────────────────────────────────────────────────

export function listPayments(filter?: { registrationId?: string }): Payment[] {
  let result = GENERATED.payments
  if (filter?.registrationId) result = result.filter(p => p.registrationId === filter.registrationId)
  return result
}


// ── Seasons ─────────────────────────────────────────────────

export function listSeasons(): Season[] {
  return GENERATED.seasons
}

export function getActiveSeason(): Season | null {
  return GENERATED.seasons.find(s => s.isActive) ?? null
}


// ── Timeslots ───────────────────────────────────────────────

export function listTimeslots(venueId?: string): Timeslot[] {
  let result = GENERATED.timeslots
  if (venueId) result = result.filter(t => t.venueId === venueId)
  return result
}


// ── SeasonRentals ───────────────────────────────────────────

export type SeasonRentalFilter = {
  venueId?: string
  captainId?: string
  status?: SeasonRentalStatus
}

export function listSeasonRentals(filter?: SeasonRentalFilter): SeasonRental[] {
  let result = GENERATED.seasonRentals
  if (filter?.captainId) result = result.filter(r => r.captainId === filter.captainId)
  if (filter?.status)    result = result.filter(r => r.status === filter.status)
  if (filter?.venueId) {
    const venueTimeslotIds = new Set(listTimeslots(filter.venueId).map(t => t.id))
    result = result.filter(r => venueTimeslotIds.has(r.timeslotId))
  }
  return result
}

/** 主揪用 token 登入 */
export function getSeasonRentalByToken(token: string): SeasonRental | null {
  return GENERATED.seasonRentals.find(r => r.accessToken === token) ?? null
}


// ── Products ────────────────────────────────────────────────

export function listProducts(venueId?: string): Product[] {
  return GENERATED.products.filter(p => !venueId || p.venueId === null || p.venueId === venueId)
}

export type ProductTransactionFilter = {
  venueId?: string
  /** YYYY-MM-DD 起（含） */
  dateFrom?: string
  /** YYYY-MM-DD 至（含） */
  dateTo?: string
}

export function listProductTransactions(filter?: ProductTransactionFilter): ProductTransaction[] {
  let result = GENERATED.productTransactions
  if (filter?.venueId)  result = result.filter(t => t.venueId === filter.venueId)
  if (filter?.dateFrom) result = result.filter(t => t.operatedAt.split('T')[0] >= filter.dateFrom!)
  if (filter?.dateTo)   result = result.filter(t => t.operatedAt.split('T')[0] <= filter.dateTo!)
  return result
}

/** products 頁專用的「各館商品」彙總 shape */
export function listVenueProducts() {
  return GENERATED.venueProducts
}


// ── 異常通知 / 未付款 / 各館每日彙總 ──────────────────────

export function listAlerts(): AnomalyAlert[] {
  return GENERATED.alerts
}

export function listUnpaidRegistrations(): UnpaidRegistration[] {
  return GENERATED.unpaid
}

/** 列出某日各館彙總（預設今天） */
export function listVenueSummaries(date?: string): VenueDailySummary[] {
  const dateStr = date ?? TODAY_STR
  // 今天的彙總已在 generator 預先計算好，直接用
  if (dateStr === TODAY_STR) return GENERATED.venueSummaries
  // 其他日期：on-demand 計算
  return GENERATED.venues.map(v => computeVenueDailySummary(v.id, dateStr))
}


// ============================================================
// 二、客戶端報名頁專用（自有 shape）
// ============================================================

const VENUE_BY_SLUG_RAW: Record<string, { id: string; name: string; address: string; phone: string; transferInfo: string }> = {
  flywing:    { id: 'v3', name: '飛翼排球館',     address: '新北市板橋區文化路一段', phone: '02-2956-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx 飛翼體育' },
  ace:        { id: 'v2', name: 'Ace 排球館',     address: '台北市信義區松仁路',     phone: '02-2345-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx Ace 體育' },
  magicblock: { id: 'v1', name: '球魔方排球館',    address: '台北市大安區復興南路',   phone: '02-2701-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx 球魔方' },
  hibi:       { id: 'v4', name: '日日排球館',     address: '台北市中山區中山北路',   phone: '02-2521-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx 日日體育' },
  playone:    { id: 'v5', name: 'Playone 排球館', address: '台北市松山區八德路',     phone: '02-2748-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx Playone' },
  smash:      { id: 'v6', name: '就醬瘋排球館',    address: '新北市新莊區新莊路',     phone: '02-2201-xxxx', transferInfo: '玉山銀行 808-xxxx-xxxxxx 就醬瘋' },
}

export type PublicVenueInfo = typeof VENUE_BY_SLUG_RAW[string]

export function getVenueBySlug(slug: string): PublicVenueInfo | null {
  return VENUE_BY_SLUG_RAW[slug] ?? null
}

const _NEXT_WEEK = dateAddDays(TODAY_STR, 7)
const _TWO_WEEKS = dateAddDays(TODAY_STR, 14)

/** 客人端報名頁的場次預覽（自有 shape，含 price 欄位） */
const PUBLIC_SESSIONS_RAW = [
  { id: 'ps1', venueId: 'v3', sessionDate: TODAY_STR, startTime: '14:00', endTime: '17:00', sessionType: 'male_mixed',   netHeight: 'male',   price: 280, maxCapacity: 18, currentCount: 13, minSkillRequired: 'B',  status: 'open',  notes: '男女不限，B 以上' },
  { id: 'ps2', venueId: 'v3', sessionDate: TODAY_STR, startTime: '16:00', endTime: '19:00', sessionType: 'male_only',    netHeight: 'male',   price: 300, maxCapacity: 18, currentCount: 18, minSkillRequired: 'A',  status: 'full',  notes: '純男場，A 以上' },
  { id: 'ps3', venueId: 'v3', sessionDate: _NEXT_WEEK, startTime: '10:00', endTime: '13:00', sessionType: 'female_mixed', netHeight: 'female', price: 250, maxCapacity: 18, currentCount: 6,  minSkillRequired: null, status: 'open',  notes: '女網混排，不限程度' },
  { id: 'ps4', venueId: 'v3', sessionDate: _NEXT_WEEK, startTime: '14:00', endTime: '17:00', sessionType: 'male_mixed',   netHeight: 'male',   price: 280, maxCapacity: 18, currentCount: 9,  minSkillRequired: 'B',  status: 'open',  notes: '男女混排，B 以上' },
  { id: 'ps5', venueId: 'v3', sessionDate: _TWO_WEEKS, startTime: '09:00', endTime: '12:00', sessionType: 'female_only',  netHeight: 'female', price: 220, maxCapacity: 18, currentCount: 0,  minSkillRequired: null, status: 'open',  notes: '純女場，不限程度' },
] as const

export type PublicSession = typeof PUBLIC_SESSIONS_RAW[number]

export function listPublicSessions(venueId?: string): PublicSession[] {
  return venueId ? PUBLIC_SESSIONS_RAW.filter(s => s.venueId === venueId) : [...PUBLIC_SESSIONS_RAW]
}

export function getPublicSession(id: string): PublicSession | null {
  return PUBLIC_SESSIONS_RAW.find(s => s.id === id) ?? null
}

const RENTAL_SLOTS_RAW = [
  { id: 'r1', venueId: 'v3', venueName: '飛翼排球館', date: _NEXT_WEEK, startTime: '08:00', endTime: '11:00', pricePerHour: 1200, totalHours: 3, totalPrice: 3600, status: 'available', notes: '可協商延長' },
  { id: 'r2', venueId: 'v3', venueName: '飛翼排球館', date: _NEXT_WEEK, startTime: '19:00', endTime: '22:00', pricePerHour: 1500, totalHours: 3, totalPrice: 4500, status: 'available', notes: '晚場，假日加收 $200' },
  { id: 'r3', venueId: 'v3', venueName: '飛翼排球館', date: _TWO_WEEKS, startTime: '08:00', endTime: '11:00', pricePerHour: 1200, totalHours: 3, totalPrice: 3600, status: 'pending',   notes: '洽談中' },
  { id: 'r4', venueId: 'v3', venueName: '飛翼排球館', date: _TWO_WEEKS, startTime: '14:00', endTime: '17:00', pricePerHour: 1500, totalHours: 3, totalPrice: 4500, status: 'available', notes: '假日下午場' },
] as const

export type RentalSlot = typeof RENTAL_SLOTS_RAW[number]

export function listRentalSlots(venueId?: string): RentalSlot[] {
  return venueId ? RENTAL_SLOTS_RAW.filter(s => s.venueId === venueId) : [...RENTAL_SLOTS_RAW]
}


// ============================================================
// 三、衍生計算（Computed metrics）
// ============================================================

/**
 * 今日營收 vs 昨日營收的變化
 * 用於 Dashboard「↑ 較昨日 +X.X%」這條 sub-text
 */
export type RevenueDelta = {
  /** 指定日的營收（預設今天） */
  today: number
  /** 昨日營收 */
  prev: number
  /** 變化百分比（正/負，保留 1 位小數） */
  deltaPercent: number
}

export function getRevenueDelta(date?: string): RevenueDelta {
  const todayStr = date ?? TODAY_STR
  const yesterdayStr = dateAddDays(todayStr, -1)
  const today = listVenueSummaries(todayStr).reduce((s, v) => s + v.totalRevenue, 0)
  const prev  = listVenueSummaries(yesterdayStr).reduce((s, v) => s + v.totalRevenue, 0)
  const deltaPercent = prev > 0
    ? Math.round(((today - prev) / prev) * 1000) / 10
    : 0
  return { today, prev, deltaPercent }
}

/**
 * 滿場率 — 今日所有場次的 (報名人數總和 / 容量總和)
 * 用於 Dashboard「滿場率 X%」這條 sub-text
 */
export function getCapacityFillRate(date?: string): number {
  const dateStr = date ?? TODAY_STR
  const todaySessions = listSessions({ date: dateStr })
    .filter(s => s.status !== 'cancelled')
  if (todaySessions.length === 0) return 0
  const totalCapacity = todaySessions.reduce((s, x) => s + x.maxCapacity, 0)
  const totalRegs     = todaySessions.reduce((s, x) => s + (x.currentCount ?? 0), 0)
  return totalCapacity > 0 ? Math.round((totalRegs / totalCapacity) * 100) : 0
}


// ============================================================
// 四、AI 智能洞察（從真實資料推導）
// ============================================================

export type AiInsight = {
  icon: string
  color: string
  bg: string
  text: string
}

/**
 * 從目前 alerts 與營運數據推導出的「AI 觀察」清單
 * 取代原本 components/AiSection.tsx 內寫死的 4 條提示，
 * demo 時不會再出現「館主問為何贈送 42% 但異常通知說 67%」的尷尬。
 */
export function getAiInsights(): AiInsight[] {
  const insights: AiInsight[] = []

  // 1. 各館近 7 日滿場率（要至少有 3 場資料才有意義）
  const since = dateAddDays(TODAY_STR, -7)
  const venueFillRates = listVenues().map(v => {
    const sessions = listSessions({ venueId: v.id, dateFrom: since, dateTo: TODAY_STR })
      .filter(s => s.status === 'completed')
    if (sessions.length < 3) return null
    const cap = sessions.reduce((s, x) => s + x.maxCapacity, 0)
    const reg = sessions.reduce((s, x) => s + (x.currentCount ?? 0), 0)
    return { venue: v, rate: cap > 0 ? Math.round((reg / cap) * 100) : 0, count: sessions.length }
  }).filter((x): x is { venue: Venue; rate: number; count: number } => x !== null)

  // 推薦 1：滿場率最高館 → 建議調漲
  if (venueFillRates.length > 0) {
    const top = venueFillRates.reduce((a, b) => b.rate > a.rate ? b : a)
    if (top.rate >= 75) {
      insights.push({
        icon: '📈', color: '#059669', bg: '#dcfce7',
        text: `${top.venue.name}館本週滿場率達 ${top.rate}%（${top.count} 場），建議考慮調升熱門時段價格 5-10%。`,
      })
    }
  }

  // 推薦 2：贈送比例異常（從 alerts 抓）
  const giftAlert = listAlerts().find(a => a.type === 'gift_ratio')
  if (giftAlert) {
    insights.push({
      icon: '⚠️', color: '#d97706', bg: '#fef3c7',
      text: `${giftAlert.venueName}館${giftAlert.message}，建議館主確認是否有異常贈送行為。`,
    })
  }

  // 推薦 3：營收下滑警示（從 alerts 抓）
  const revAlert = listAlerts().find(a => a.type === 'revenue_drop')
  if (revAlert) {
    insights.push({
      icon: '💡', color: '#2563eb', bg: '#dbeafe',
      text: `${revAlert.venueName}館${revAlert.message}，建議檢視冷門時段是否有未開場狀況。`,
    })
  }

  // 推薦 4：滿場率最低館 → 建議調整
  if (venueFillRates.length > 1) {
    const bot = venueFillRates.reduce((a, b) => b.rate < a.rate ? b : a)
    if (bot.rate < 55) {
      insights.push({
        icon: '🏐', color: '#7c3aed', bg: '#ede9fe',
        text: `${bot.venue.name}館本週滿場率僅 ${bot.rate}%（${bot.count} 場），建議調整時段排程或推出新客優惠。`,
      })
    }
  }

  return insights
}


// ============================================================
// 五、Dashboard 彙總（async — server component 用）
// ============================================================

export async function getDashboard(): Promise<DashboardData> {
  return GENERATED.dashboard
}

export type DashboardStats = {
  totalRevenue: number
  totalPlayers: number
  totalSessions: number
  totalUnpaid: number
  totalUnpaidAmount: number
  /** 今日 vs 昨日營收變化（給 sub-text 用） */
  revenueDelta: RevenueDelta
  /** 今日滿場率，0-100 */
  fillRate: number
  /** 啟用中的館數 */
  activeVenueCount: number
}

/** Dashboard 上層彙總所需的所有數字（含衍生） */
export async function getDashboardStats(date?: string): Promise<DashboardStats> {
  const dateStr = date ?? TODAY_STR
  const summaries = listVenueSummaries(dateStr)
  return {
    totalRevenue:      summaries.reduce((s, v) => s + v.totalRevenue,  0),
    totalPlayers:      summaries.reduce((s, v) => s + v.totalPlayers,  0),
    totalSessions:     summaries.reduce((s, v) => s + v.totalSessions, 0),
    totalUnpaid:       summaries.reduce((s, v) => s + v.unpaidCount,   0),
    totalUnpaidAmount: summaries.reduce((s, v) => s + v.unpaidAmount,  0),
    revenueDelta:      getRevenueDelta(dateStr),
    fillRate:          getCapacityFillRate(dateStr),
    activeVenueCount:  getActiveVenueCount(),
  }
}


// ============================================================
// 六、內部 helper：某日某館的彙總計算
// ============================================================
// 與 generator 內的 computeVenueDailySummary 邏輯一致，但這裡
// 重新實作以維持 api.ts 的「自包含」（不依賴 generator 的私有
// helper）。未來生成器邏輯異動時，這邊要同步。

function computeVenueDailySummary(venueId: string, dateStr: string): VenueDailySummary {
  const venue = getVenue(venueId)
  const venueName = venue?.name ?? '?'

  const todaySessions = GENERATED.sessions.filter(s =>
    s.venueId === venueId && s.sessionDate === dateStr
  )
  const todayRegs = GENERATED.registrations.filter(r =>
    todaySessions.some(s => s.id === r.sessionId) && r.status !== 'cancelled'
  )
  const todayTx = GENERATED.productTransactions.filter(t =>
    t.venueId === venueId && t.operatedAt.startsWith(dateStr)
  )

  const sessionRev = todaySessions.reduce((sum, s) => sum + (s.actualRevenue ?? 0), 0)
  const productRev = todayTx
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + (t.totalAmount ?? 0), 0)
  const totalRevenue = sessionRev + productRev

  const giftCount = todayTx.filter(t => t.type === 'gift').length
  const saleCount = todayTx.filter(t => t.type === 'sale').length
  const giftRatio = (saleCount + giftCount > 0)
    ? Math.round((giftCount / (saleCount + giftCount)) * 100)
    : 0

  const unpaidRegs = todayRegs.filter(r => (r.expectedAmount ?? 0) > 0 && (r.paidAmount ?? 0) === 0)
  const unpaidAmount = unpaidRegs.reduce((sum, r) => sum + (r.expectedAmount ?? 0), 0)

  const venueProducts = GENERATED.venueProducts.find(v => v.venueId === venueId)?.products ?? []
  const stockAlerts = venueProducts.filter(p => p.currentStock <= p.lowStockThreshold).length

  return {
    venueId,
    venueName,
    date: dateStr,
    totalRevenue,
    totalPlayers: todayRegs.length,
    totalSessions: todaySessions.length,
    unpaidCount: unpaidRegs.length,
    unpaidAmount,
    giftRatio,
    stockAlerts,
  }
}


// ============================================================
// 五、對帳系統（Reconciliation）— 階段 2
// ============================================================
// 老闆從 Excel 對帳遷移到系統。
// 全部走「衍生計算」，不存資料表。
//
// 應收金額來源：
//   - Session.expectedRevenue（generator 已寫回，= walk_in/sub 人數 × 球費 + 冷氣費）
//   - SeasonRental.totalAmount（季初應收）
// 實收金額來源：
//   - Session.actualRevenue（generator 已寫回，= sum(Payment.amount)）
//   - SeasonRental.paidAmount（主揪實際繳交）
//
// 階段 2 為 read-only：純呈現「應收 vs 實收」差異。
// 未來補錄差異功能再加 mutation 函式。
// ============================================================

// ── 共用：時間範圍 ─────────────────────────────────────────

export type ReconciliationPeriod = 'week' | 'month' | 'season' | 'all'

export const RECONCILIATION_PERIOD_LABEL: Record<ReconciliationPeriod, string> = {
  week:   '本週',
  month:  '本月',
  season: '本季',
  all:    '全部',
}

interface DateRange { from: string; to: string }

function getReconciliationRange(period: ReconciliationPeriod): DateRange | null {
  if (period === 'all')   return null
  if (period === 'week')  return { from: dateAddDays(TODAY_STR, -6),  to: TODAY_STR }
  if (period === 'month') return { from: dateAddDays(TODAY_STR, -29), to: TODAY_STR }
  if (period === 'season') {
    const s = getActiveSeason()
    return s ? { from: s.startDate, to: s.endDate } : null
  }
  return null
}


// ── A. 場次對帳 ────────────────────────────────────────────

export type SessionReconciliationStatus =
  | 'matched'    // 應收 = 實收 且 應收 > 0
  | 'shortfall'  // 應收 > 實收（少收）
  | 'overpaid'   // 實收 > 應收（多收，理論上不該發生）
  | 'no_charge'  // 應收 = 0（全季打場次）

export const SESSION_RECON_STATUS_LABEL: Record<SessionReconciliationStatus, string> = {
  matched:   '已對齊',
  shortfall: '少收',
  overpaid:  '多收',
  no_charge: '免收費',
}

export interface SessionReconciliation {
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
  actualRevenue: number
  /** 應收 - 實收（正 = 少收） */
  gap: number
  /** 未繳人數（只看 walk_in / substitute） */
  unpaidCount: number
  status: SessionReconciliationStatus
  isUnattended: boolean
  /** 無人場次：自助回報已付筆數 > Payment 筆數 */
  hasSelfReportMismatch: boolean
}

export interface SessionReconciliationFilter {
  /** 預設 'week' */
  period?: ReconciliationPeriod
  venueId?: string
  /** 只看有缺口的 */
  onlyShortfall?: boolean
}

export function getSessionReconciliation(
  filter?: SessionReconciliationFilter,
): SessionReconciliation[] {
  const period = filter?.period ?? 'week'
  const range = getReconciliationRange(period)

  let sessions = GENERATED.sessions
  if (range) {
    sessions = sessions.filter(s =>
      s.sessionDate >= range.from && s.sessionDate <= range.to
    )
  }
  if (filter?.venueId) {
    sessions = sessions.filter(s => s.venueId === filter.venueId)
  }

  const venueNameById = new Map(GENERATED.venues.map(v => [v.id, v.name]))

  const rows = sessions.map((s): SessionReconciliation => {
    const regs = GENERATED.registrations.filter(
      r => r.sessionId === s.id && r.status !== 'cancelled',
    )
    const walkIn    = regs.filter(r => r.type === 'walk_in').length
    const sub       = regs.filter(r => r.type === 'season_substitute').length
    const seasonP   = regs.filter(r => r.type === 'season_player').length
    const expected  = s.expectedRevenue ?? 0
    const actual    = s.actualRevenue   ?? 0
    const gap       = expected - actual
    const unpaid    = regs.filter(
      r => (r.expectedAmount ?? 0) > 0 && (r.paidAmount ?? 0) === 0,
    ).length

    let status: SessionReconciliationStatus
    if (expected === 0)      status = 'no_charge'
    else if (gap > 0)        status = 'shortfall'
    else if (gap < 0)        status = 'overpaid'
    else                     status = 'matched'

    let hasSelfReportMismatch = false
    if (s.isUnattended) {
      const selfReports = regs.filter(r => r.selfReportedPaid).length
      const regIds = new Set(regs.map(r => r.id))
      const payments = GENERATED.payments.filter(p => regIds.has(p.registrationId)).length
      hasSelfReportMismatch = selfReports > payments
    }

    return {
      sessionId:        s.id,
      sessionDate:      s.sessionDate,
      startTime:        s.startTime,
      endTime:          s.endTime,
      venueId:          s.venueId,
      venueName:        venueNameById.get(s.venueId) ?? '?',
      courtFee:         s.courtFee,
      acFee:            s.acFee,
      acEnabled:        s.acEnabled,
      walkInCount:      walkIn,
      substituteCount:  sub,
      seasonPlayerCount: seasonP,
      expectedRevenue:  expected,
      actualRevenue:    actual,
      gap,
      unpaidCount:      unpaid,
      status,
      isUnattended:     s.isUnattended,
      hasSelfReportMismatch,
    }
  })

  const filtered = filter?.onlyShortfall ? rows.filter(r => r.gap > 0) : rows

  return filtered.sort((a, b) =>
    b.sessionDate.localeCompare(a.sessionDate)
    || a.startTime.localeCompare(b.startTime),
  )
}


// ── B. 季租單對帳 ──────────────────────────────────────────

export interface SeasonRentalReconciliation {
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
  /** 應收 - 實收（正 = 主揪欠款） */
  gap: number
  /** 已繳比例 0~1 */
  paidRatio: number
  status: SeasonRentalStatus
  generatedSessionCount: number
  completedSessionCount: number
  remainingSessionCount: number
  isFullyPaid: boolean
  isUnpaid: boolean
  /** pending 且 paidRatio < 1.0 — 故事點 4 */
  isCritical: boolean
}

export function getSeasonRentalReconciliation(filter?: {
  venueId?: string
}): SeasonRentalReconciliation[] {
  const venueNameById = new Map(GENERATED.venues.map(v => [v.id, v.name]))
  const timeslotById  = new Map(GENERATED.timeslots.map(t => [t.id, t]))

  let rentals = GENERATED.seasonRentals
  if (filter?.venueId) {
    rentals = rentals.filter(r => {
      const ts = timeslotById.get(r.timeslotId)
      return ts?.venueId === filter.venueId
    })
  }

  return rentals.map((r): SeasonRentalReconciliation => {
    const ts      = timeslotById.get(r.timeslotId)
    const venueId = ts?.venueId ?? ''
    const sessionsForRental = GENERATED.sessions.filter(s => s.seasonRentalId === r.id)
    const completed = sessionsForRental.filter(s => s.status === 'completed').length
    const gap       = r.totalAmount - r.paidAmount
    const paidRatio = r.totalAmount > 0 ? r.paidAmount / r.totalAmount : 0

    return {
      rentalId:               r.id,
      captainId:              r.captainId,
      captainName:            r.captainName ?? '?',
      captainPhone:           r.captainPhone ?? '',
      venueId,
      venueName:              venueNameById.get(venueId) ?? '?',
      timeslotLabel:          r.timeslotLabel ?? '?',
      seasonName:             r.seasonName ?? '?',
      pricePerSession:        r.pricePerSession,
      totalAmount:            r.totalAmount,
      paidAmount:             r.paidAmount,
      gap,
      paidRatio,
      status:                 r.status,
      generatedSessionCount:  sessionsForRental.length,
      completedSessionCount:  completed,
      remainingSessionCount:  sessionsForRental.length - completed,
      isFullyPaid:            gap <= 0,
      isUnpaid:               gap > 0,
      isCritical:             r.status === 'pending' && paidRatio < 1.0,
    }
  })
}


// ── C. 商品對帳 ────────────────────────────────────────────

/**
 * 商品對帳。
 *
 * ⚠️ 限制：generator 目前不產 purchase_in / adjustment 交易，
 * 所以「理論期末庫存 vs 實際盤點」算不出來。
 * 改用兩條替代線：
 *   1. 贈送比例異常（gift / (sale + gift)）— 對應故事點 2（飛翼贈送 67%）
 *   2. 現有庫存健康度（low_stock 標記）
 *
 * 異常判定看「重災館」：因為飛翼的贈送異常會被其他館稀釋成正常數字，
 * 所以判定條件用 worstVenue.giftRatio，不用整體 giftRatio。
 */
export interface ProductVenueBreakdown {
  venueId: string
  venueName: string
  saleCount: number
  giftCount: number
  giftRatio: number
}

export interface ProductReconciliation {
  productId: string
  productName: string
  unitPrice: number
  currentStock: number
  lowStockThreshold: number
  isLowStock: boolean
  /** 過去 30 天全館合計：販售件數 */
  saleCount: number
  saleRevenue: number
  giftCount: number
  /** 贈送總損失 = giftCount × unitPrice */
  giftValue: number
  /** 全館合計贈送比例 0~1 */
  giftRatio: number
  /** 各館明細（按該館贈送比例降冪，過濾掉沒交易的館） */
  byVenue: ProductVenueBreakdown[]
  /** 贈送比例最高的館（樣本量 ≥ 5） */
  worstVenue: ProductVenueBreakdown | null
  /** worstVenue.giftRatio > 0.3 — 故事點 2 抓得到 */
  hasGiftAnomaly: boolean
}

export function getProductReconciliation(filter?: {
  venueId?: string
}): ProductReconciliation[] {
  const venueNameById = new Map(GENERATED.venues.map(v => [v.id, v.name]))
  const cutoff = dateAddDays(TODAY_STR, -29) + 'T00:00:00'

  return GENERATED.products
    .filter(p => p.isActive)
    .map((p): ProductReconciliation => {
      let txs = GENERATED.productTransactions.filter(
        t => t.productId === p.id && t.operatedAt >= cutoff,
      )
      if (filter?.venueId) {
        txs = txs.filter(t => t.venueId === filter.venueId)
      }

      // 全館合計
      const sales = txs.filter(t => t.type === 'sale')
      const gifts = txs.filter(t => t.type === 'gift')
      const saleCount   = sales.reduce((sum, t) => sum + Math.abs(t.quantity), 0)
      const saleRevenue = sales.reduce((sum, t) => sum + (t.totalAmount ?? 0), 0)
      const giftCount   = gifts.reduce((sum, t) => sum + Math.abs(t.quantity), 0)
      const giftValue   = giftCount * p.unitPrice
      const total       = saleCount + giftCount
      const giftRatio   = total > 0 ? giftCount / total : 0

      // 各館明細
      const byVenueMap = new Map<string, { sale: number; gift: number }>()
      for (const t of txs) {
        const cur = byVenueMap.get(t.venueId) ?? { sale: 0, gift: 0 }
        if (t.type === 'sale') cur.sale += Math.abs(t.quantity)
        if (t.type === 'gift') cur.gift += Math.abs(t.quantity)
        byVenueMap.set(t.venueId, cur)
      }
      const byVenue: ProductVenueBreakdown[] = []
      for (const [vid, c] of byVenueMap) {
        const t = c.sale + c.gift
        byVenue.push({
          venueId:    vid,
          venueName:  venueNameById.get(vid) ?? '?',
          saleCount:  c.sale,
          giftCount:  c.gift,
          giftRatio:  t > 0 ? c.gift / t : 0,
        })
      }
      byVenue.sort((a, b) => b.giftRatio - a.giftRatio)

      // 重災館（樣本 ≥ 5 才算數）
      const worstVenue = byVenue.find(v => v.saleCount + v.giftCount >= 5) ?? null

      return {
        productId:          p.id,
        productName:        p.name,
        unitPrice:          p.unitPrice,
        currentStock:       p.currentStock,
        lowStockThreshold:  p.lowStockThreshold,
        isLowStock:         p.currentStock <= p.lowStockThreshold,
        saleCount,
        saleRevenue,
        giftCount,
        giftValue,
        giftRatio,
        byVenue,
        worstVenue,
        hasGiftAnomaly:     worstVenue !== null && worstVenue.giftRatio > 0.3,
      }
    })
}


// ── D. 月結對帳 ────────────────────────────────────────────

export type MonthlyGrain = 'month' | 'season'

export interface MonthlyReconciliationRow {
  venueId: string
  venueName: string
  /** 場地：應收（場次 expectedRevenue 加總） */
  sessionExpected: number
  sessionActual: number
  sessionGap: number
  sessionCount: number
  /** 季租單：按期間內 session 比例分攤 */
  rentalAllocated: number
  rentalActualPaid: number
  /** 商品銷售總收入（贈送不入帳） */
  productRevenue: number
  /** 贈送的「等值損失」 */
  productGiftValue: number
  /** 期間內總應收 = sessionExpected + rentalAllocated + productRevenue */
  totalExpected: number
  /** 期間內總實收 = sessionActual + rentalActualPaid + productRevenue */
  totalActual: number
  totalGap: number
}

export interface MonthlyReconciliationResult {
  grain: MonthlyGrain
  /** YYYY-MM 或 seasonId */
  periodKey: string
  /** 顯示用，例：「2026年5月」或「當前季 (03/13 – 06/05)」 */
  periodLabel: string
  rangeFrom: string
  rangeTo: string
  rows: MonthlyReconciliationRow[]
  totals: {
    sessionExpected: number
    sessionActual: number
    rentalAllocated: number
    rentalActualPaid: number
    productRevenue: number
    productGiftValue: number
    totalExpected: number
    totalActual: number
    totalGap: number
  }
}

export function getMonthlyReconciliation(
  grain: MonthlyGrain,
  key?: string,
): MonthlyReconciliationResult {
  let periodKey:   string
  let periodLabel: string
  let rangeFrom:   string
  let rangeTo:     string

  if (grain === 'month') {
    periodKey = key ?? TODAY_STR.substring(0, 7)
    const [y, m] = periodKey.split('-').map(Number)
    rangeFrom = `${periodKey}-01`
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    rangeTo   = `${periodKey}-${String(lastDay).padStart(2, '0')}`
    periodLabel = `${y}年${m}月`
  } else {
    const seasonId = key ?? 'sn-current'
    const season   = GENERATED.seasons.find(s => s.id === seasonId) ?? getActiveSeason()
    if (season) {
      periodKey   = season.id
      periodLabel = `${season.name} (${season.startDate.slice(5).replace('-', '/')} – ${season.endDate.slice(5).replace('-', '/')})`
      rangeFrom   = season.startDate
      rangeTo     = season.endDate
    } else {
      periodKey = ''; periodLabel = '無季'
      rangeFrom = TODAY_STR; rangeTo = TODAY_STR
    }
  }

  const timeslotById  = new Map(GENERATED.timeslots.map(t => [t.id, t]))
  const productById   = new Map(GENERATED.products.map(p => [p.id, p]))

  const periodSessions = GENERATED.sessions.filter(
    s => s.sessionDate >= rangeFrom && s.sessionDate <= rangeTo,
  )

  const rows: MonthlyReconciliationRow[] = GENERATED.venues
    .filter(v => v.isActive)
    .map(v => {
      const venueSessions   = periodSessions.filter(s => s.venueId === v.id)
      const sessionExpected = venueSessions.reduce((sum, s) => sum + (s.expectedRevenue ?? 0), 0)
      const sessionActual   = venueSessions.reduce((sum, s) => sum + (s.actualRevenue   ?? 0), 0)

      // 季租單按期間內 session 比例分攤
      let rentalAllocated  = 0
      let rentalActualPaid = 0
      for (const r of GENERATED.seasonRentals) {
        const ts = timeslotById.get(r.timeslotId)
        if (ts?.venueId !== v.id) continue
        const all = GENERATED.sessions.filter(s => s.seasonRentalId === r.id)
        if (all.length === 0) continue
        const inPeriod = all.filter(
          s => s.sessionDate >= rangeFrom && s.sessionDate <= rangeTo,
        ).length
        const ratio = inPeriod / all.length
        rentalAllocated  += r.totalAmount * ratio
        rentalActualPaid += r.paidAmount  * ratio
      }
      rentalAllocated  = Math.round(rentalAllocated)
      rentalActualPaid = Math.round(rentalActualPaid)

      const venueTx = GENERATED.productTransactions.filter(t =>
        t.venueId === v.id
        && t.operatedAt >= rangeFrom + 'T00:00:00'
        && t.operatedAt <= rangeTo   + 'T23:59:59',
      )
      const productRevenue   = venueTx
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + (t.totalAmount ?? 0), 0)
      const productGiftValue = venueTx
        .filter(t => t.type === 'gift')
        .reduce((sum, t) => sum + (productById.get(t.productId)?.unitPrice ?? 0) * Math.abs(t.quantity), 0)

      const totalExpected = sessionExpected + rentalAllocated  + productRevenue
      const totalActual   = sessionActual   + rentalActualPaid + productRevenue
      return {
        venueId:           v.id,
        venueName:         v.name,
        sessionExpected,
        sessionActual,
        sessionGap:        sessionExpected - sessionActual,
        sessionCount:      venueSessions.length,
        rentalAllocated,
        rentalActualPaid,
        productRevenue,
        productGiftValue,
        totalExpected,
        totalActual,
        totalGap:          totalExpected - totalActual,
      }
    })

  const totals = rows.reduce((acc, r) => ({
    sessionExpected:   acc.sessionExpected   + r.sessionExpected,
    sessionActual:     acc.sessionActual     + r.sessionActual,
    rentalAllocated:   acc.rentalAllocated   + r.rentalAllocated,
    rentalActualPaid:  acc.rentalActualPaid  + r.rentalActualPaid,
    productRevenue:    acc.productRevenue    + r.productRevenue,
    productGiftValue:  acc.productGiftValue  + r.productGiftValue,
    totalExpected:     acc.totalExpected     + r.totalExpected,
    totalActual:       acc.totalActual       + r.totalActual,
    totalGap:          acc.totalGap          + r.totalGap,
  }), {
    sessionExpected: 0, sessionActual: 0,
    rentalAllocated: 0, rentalActualPaid: 0,
    productRevenue: 0, productGiftValue: 0,
    totalExpected: 0, totalActual: 0, totalGap: 0,
  })

  return { grain, periodKey, periodLabel, rangeFrom, rangeTo, rows, totals }
}


// ── E. 異常清單 ────────────────────────────────────────────

export type ReconciliationAnomalyType =
  | 'session_shortfall'      // 場次少收（過去 7 天）
  | 'rental_unpaid'          // 季租單未繳齊
  | 'gift_excess'            // 商品贈送異常
  | 'self_report_mismatch'   // 無人場次自助回報筆數 > Payment 筆數

export type AnomalySeverity = 'high' | 'medium' | 'low'

export interface ReconciliationAnomaly {
  id: string
  type: ReconciliationAnomalyType
  severity: AnomalySeverity
  venueId: string
  venueName: string
  date?: string
  title: string
  description: string
  /** 涉及金額（缺口 / 損失估算） */
  amount: number
  linkType: 'session' | 'rental' | 'product'
  linkId: string
}

export const ANOMALY_TYPE_LABEL: Record<ReconciliationAnomalyType, string> = {
  session_shortfall:    '場次少收',
  rental_unpaid:        '季租單未繳齊',
  gift_excess:          '商品贈送異常',
  self_report_mismatch: '自助回報異常',
}

export const ANOMALY_SEVERITY_LABEL: Record<AnomalySeverity, string> = {
  high:   '高',
  medium: '中',
  low:    '低',
}

export function getReconciliationAnomalies(filter?: {
  venueId?: string
  type?: ReconciliationAnomalyType
}): ReconciliationAnomaly[] {
  const out: ReconciliationAnomaly[] = []
  const venueNameById = new Map(GENERATED.venues.map(v => [v.id, v.name]))

  // 1. 季租單未繳齊
  for (const r of getSeasonRentalReconciliation()) {
    if (r.gap <= 0) continue
    const sev: AnomalySeverity =
      r.paidRatio < 0.6 ? 'high' :
      r.paidRatio < 0.9 ? 'medium' : 'low'
    out.push({
      id:          `anom-rental-${r.rentalId}`,
      type:        'rental_unpaid',
      severity:    sev,
      venueId:     r.venueId,
      venueName:   r.venueName,
      title:       `${r.captainName} 季租單未繳齊（${Math.round(r.paidRatio * 100)}%）`,
      description: `${r.timeslotLabel}：應收 $${r.totalAmount.toLocaleString()}，實收 $${r.paidAmount.toLocaleString()}`,
      amount:      r.gap,
      linkType:    'rental',
      linkId:      r.rentalId,
    })
  }

  // 2. 場次少收（過去 7 天，缺口 ≥ 200 才算 — 至少 1 個 walk_in 沒繳）
  const weekSessions = getSessionReconciliation({ period: 'week' })
  for (const s of weekSessions) {
    if (s.gap < 200) continue
    const sev: AnomalySeverity =
      s.gap >= 1000 ? 'high' :
      s.gap >= 500  ? 'medium' : 'low'
    out.push({
      id:          `anom-session-${s.sessionId}`,
      type:        'session_shortfall',
      severity:    sev,
      venueId:     s.venueId,
      venueName:   s.venueName,
      date:        s.sessionDate,
      title:       `${s.venueName} ${s.sessionDate} ${s.startTime} 少收 $${s.gap.toLocaleString()}`,
      description: `應收 $${s.expectedRevenue.toLocaleString()}，實收 $${s.actualRevenue.toLocaleString()}（${s.unpaidCount} 人未繳）`,
      amount:      s.gap,
      linkType:    'session',
      linkId:      s.sessionId,
    })
  }

  // 3. 商品贈送異常
  for (const p of getProductReconciliation()) {
    if (!p.hasGiftAnomaly || !p.worstVenue) continue
    const w = p.worstVenue
    const sev: AnomalySeverity = w.giftRatio > 0.5 ? 'high' : 'medium'
    // 該館的贈送損失估算
    const venueGiftLoss = w.giftCount * p.unitPrice
    out.push({
      id:          `anom-product-${p.productId}-${w.venueId}`,
      type:        'gift_excess',
      severity:    sev,
      venueId:     w.venueId,
      venueName:   w.venueName,
      title:       `${w.venueName}「${p.productName}」贈送比例 ${Math.round(w.giftRatio * 100)}%`,
      description: `近 30 天該館：販售 ${w.saleCount} 件、贈送 ${w.giftCount} 件，估算損失 $${venueGiftLoss.toLocaleString()}`,
      amount:      venueGiftLoss,
      linkType:    'product',
      linkId:      p.productId,
    })
  }

  // 4. 無人場次自助回報筆數 > Payment 筆數
  for (const s of GENERATED.sessions) {
    if (!s.isUnattended) continue
    const regs = GENERATED.registrations.filter(
      r => r.sessionId === s.id && r.status !== 'cancelled',
    )
    const selfReports = regs.filter(r => r.selfReportedPaid).length
    const regIds = new Set(regs.map(r => r.id))
    const payments = GENERATED.payments.filter(p => regIds.has(p.registrationId)).length
    if (selfReports <= payments) continue
    const missing = selfReports - payments
    const expected = (s.courtFee + (s.acEnabled ? s.acFee : 0)) * missing
    out.push({
      id:          `anom-selfreport-${s.id}`,
      type:        'self_report_mismatch',
      severity:    missing >= 3 ? 'high' : 'medium',
      venueId:     s.venueId,
      venueName:   venueNameById.get(s.venueId) ?? '?',
      date:        s.sessionDate,
      title:       `${venueNameById.get(s.venueId)} ${s.sessionDate} 自助回報 ${missing} 筆未對到 Payment`,
      description: `自助回報 ${selfReports} 筆 vs 系統 Payment ${payments} 筆，落差約 $${expected.toLocaleString()}`,
      amount:      expected,
      linkType:    'session',
      linkId:      s.id,
    })
  }

  // 套用 filter
  let result = out
  if (filter?.venueId) result = result.filter(a => a.venueId === filter.venueId)
  if (filter?.type)    result = result.filter(a => a.type    === filter.type)

  // 排序：severity high → low；同 severity 按 amount 降冪
  const sevOrder: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 }
  result.sort((a, b) =>
    sevOrder[a.severity] - sevOrder[b.severity] || b.amount - a.amount,
  )
  return result
}


// ── 主頁總覽 ───────────────────────────────────────────────

export interface ReconciliationOverview {
  /** 本週滾動 */
  week: {
    expected: number
    actual: number
    gap: number
    sessionCount: number
  }
  /** 本月（含季租單分攤、商品） */
  month: {
    expected: number
    actual: number
    gap: number
  }
  summary: {
    sessionShortfallCount: number
    sessionShortfallAmount: number
    rentalUnpaidCount: number
    rentalUnpaidAmount: number
    productAnomalyCount: number
    monthlyMaxGap: { venueName: string; gap: number } | null
    anomalyTotalCount: number
  }
  /** 故事點：最高 severity 異常前 3 筆 */
  topAnomalies: ReconciliationAnomaly[]
}

export function getReconciliationOverview(): ReconciliationOverview {
  const weekSessions  = getSessionReconciliation({ period: 'week' })
  const monthRecon    = getMonthlyReconciliation('month')
  const rentalRecon   = getSeasonRentalReconciliation()
  const productRecon  = getProductReconciliation()
  const anomalies     = getReconciliationAnomalies()

  const weekExpected = weekSessions.reduce((sum, s) => sum + s.expectedRevenue, 0)
  const weekActual   = weekSessions.reduce((sum, s) => sum + s.actualRevenue,   0)

  const sessionShortfall = weekSessions.filter(s => s.gap > 0)
  const rentalUnpaid     = rentalRecon.filter(r => r.gap > 0)
  const productAnomaly   = productRecon.filter(p => p.hasGiftAnomaly)

  const venueGaps = monthRecon.rows.filter(r => r.totalGap > 0)
  const monthlyMaxGap = venueGaps.length > 0
    ? venueGaps.reduce((max, r) => r.totalGap > max.totalGap ? r : max)
    : null

  return {
    week: {
      expected:     weekExpected,
      actual:       weekActual,
      gap:          weekExpected - weekActual,
      sessionCount: weekSessions.length,
    },
    month: {
      expected:     monthRecon.totals.totalExpected,
      actual:       monthRecon.totals.totalActual,
      gap:          monthRecon.totals.totalGap,
    },
    summary: {
      sessionShortfallCount:  sessionShortfall.length,
      sessionShortfallAmount: sessionShortfall.reduce((sum, s) => sum + s.gap, 0),
      rentalUnpaidCount:      rentalUnpaid.length,
      rentalUnpaidAmount:     rentalUnpaid.reduce((sum, r) => sum + r.gap, 0),
      productAnomalyCount:    productAnomaly.length,
      monthlyMaxGap:          monthlyMaxGap
        ? { venueName: monthlyMaxGap.venueName, gap: monthlyMaxGap.totalGap }
        : null,
      anomalyTotalCount:      anomalies.length,
    },
    topAnomalies: anomalies.slice(0, 3),
  }
}


// ════════════════════════════════════════════════════════════
// 六、主揪系統（階段 3）
// ════════════════════════════════════════════════════════════
//
// 設計原則：
//   - 全部 read-only 查詢函式（互動由 page 端 alert / placeholder 負責）
//   - 不寫 audit log、不寫 in-memory（demo 不需要真寫入）
//   - 不修改既有 api.ts 函式，只在此處 append
//   - token 過期比對用 new Date() 即時計算（generator 用 TODAY 為錨點，所以一致）
//
// 設計細節：
//   主揪頁顯示的「我的場次」用 timeslotId + season 日期範圍 反查，
//   而非 Session.seasonRentalId。因為 generator 對 pending 狀態的 rental
//   不會把 session.seasonRentalId 寫成 rental.id（業務上「未繳款=未啟動」）。
//   但主揪頁要讓林小明看到「我這個時段本季的場次」— 即使 rental 還在 pending。
//
// 包含：
//   getCaptainPortalData(token)         — 主揪入口頁主資料 hub
//   listCaptainSessions(rentalId)       — 主揪本季所有場次摘要
//   getCaptainSessionDetail(sessionId)  — 主揪展開某場的名單詳情
//   listSeasonRentalsForAdmin()         — 館長端：所有季租單管理視圖
//   buildCaptainUrl(token)              — helper：產生主揪頁 URL（給館長端複製用）

export type CaptainTokenStatus = 'active' | 'expired'

/** 內部 helper：找出主揪該看到的所有場次（含 pending 狀態的 rental） */
function _findCaptainSessions(rental: SeasonRental): Session[] {
  const season = GENERATED.seasons.find(s => s.id === rental.seasonId)
  if (!season) return []
  return GENERATED.sessions
    .filter(s =>
      s.timeslotId === rental.timeslotId &&
      s.sessionDate >= season.startDate &&
      s.sessionDate <= season.endDate
    )
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
}

/** 主揪入口頁載入時所需的全部摘要資料 */
export interface CaptainPortalData {
  rental:               SeasonRental
  tokenStatus:          CaptainTokenStatus
  // 名單統計
  seasonPlayerCount:    number  // 季打 18 人（去重 customerId）
  // 場次統計
  totalSessions:        number
  pastSessions:         number
  upcomingSessions:     number
  todaySession:         Session | null
  nextSession:          Session | null  // 最近的未來場次（含今天）
  // 財務
  paidAmount:           number
  expectedAmount:       number
  outstandingAmount:    number  // = expectedAmount - paidAmount，正數代表欠款
  paidRatio:            number  // 0~1
  isPaymentCritical:    boolean // outstandingAmount > 0
}

export function getCaptainPortalData(token: string): CaptainPortalData | null {
  const rental = getSeasonRentalByToken(token)
  if (!rental) return null

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const expired = new Date(rental.accessTokenExpiresAt) < now

  const sessions = _findCaptainSessions(rental)

  const pastSessions     = sessions.filter(s => s.sessionDate <  today).length
  const todaySession     = sessions.find(s => s.sessionDate === today) ?? null
  const upcomingSessions = sessions.filter(s => s.sessionDate >  today).length
  const nextSession      = sessions.find(s => s.sessionDate >= today) ?? null

  // 季打 18 人：所有 type === 'season_player' 的 customer 去重
  const sessionIds = new Set(sessions.map(s => s.id))
  const seasonPlayerIds = new Set(
    GENERATED.registrations
      .filter(r => r.type === 'season_player' && sessionIds.has(r.sessionId))
      .map(r => r.customerId)
  )

  const outstandingAmount = rental.totalAmount - rental.paidAmount
  const paidRatio = rental.totalAmount > 0 ? rental.paidAmount / rental.totalAmount : 0

  return {
    rental,
    tokenStatus:        expired ? 'expired' : 'active',
    seasonPlayerCount:  seasonPlayerIds.size,
    totalSessions:      sessions.length,
    pastSessions,
    upcomingSessions,
    todaySession,
    nextSession,
    paidAmount:         rental.paidAmount,
    expectedAmount:     rental.totalAmount,
    outstandingAmount,
    paidRatio,
    isPaymentCritical:  outstandingAmount > 0,
  }
}

/** 主揪本季每一場的摘要（卡片式列表） */
export interface CaptainSessionSummary {
  session:             Session
  isPast:              boolean
  isToday:             boolean
  seasonPlayerCount:   number
  substituteCount:     number
  walkInCount:         number
  expectedRevenue:     number  // (sub + walkIn) × (courtFee + acEnabled?acFee:0)
  paymentCollected:    number  // 此場已收到的 sum(Payment.amount)
}

export function listCaptainSessions(seasonRentalId: string): CaptainSessionSummary[] {
  const rental = GENERATED.seasonRentals.find(r => r.id === seasonRentalId)
  if (!rental) return []
  const today = new Date().toISOString().split('T')[0]
  const sessions = _findCaptainSessions(rental)

  return sessions.map(session => {
    const regs = listSessionRegistrations(session.id)
    const seasonPlayerCount = regs.filter(r => r.type === 'season_player').length
    const substituteCount   = regs.filter(r => r.type === 'season_substitute').length
    const walkInCount       = regs.filter(r => r.type === 'walk_in').length
    const fee = session.courtFee + (session.acEnabled ? session.acFee : 0)

    // 此場實收 = 該場所有 registration 的 payment 加總
    const regIds = new Set(regs.map(r => r.id))
    const paymentCollected = GENERATED.payments
      .filter(p => regIds.has(p.registrationId))
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      session,
      isPast:            session.sessionDate <  today,
      isToday:           session.sessionDate === today,
      seasonPlayerCount,
      substituteCount,
      walkInCount,
      expectedRevenue:   (substituteCount + walkInCount) * fee,
      paymentCollected,
    }
  })
}

/** 場次詳情（按 type 分組的名單） */
export interface CaptainSessionDetail {
  session:             Session
  rental:              SeasonRental
  seasonPlayers:       RegistrationWithCustomer[]
  substitutes:         RegistrationWithCustomer[]
  walkIns:             RegistrationWithCustomer[]
  feePerPaidPerson:    number  // courtFee + (acEnabled ? acFee : 0)
  expectedRevenue:     number  // (substitutes + walkIns) × feePerPaidPerson
  isPast:              boolean
  isToday:             boolean
}

export function getCaptainSessionDetail(
  sessionId: string,
  rentalId: string,
): CaptainSessionDetail | null {
  const session = getSession(sessionId)
  if (!session) return null
  const rental = GENERATED.seasonRentals.find(r => r.id === rentalId)
  if (!rental) return null

  // 安全檢查：sessionId 必須屬於 rental 的時段範圍
  // （避免主揪用 token 看到別人的場次）
  const season = GENERATED.seasons.find(s => s.id === rental.seasonId)
  const inRange = season != null
    && session.timeslotId === rental.timeslotId
    && session.sessionDate >= season.startDate
    && session.sessionDate <= season.endDate
  if (!inRange) return null

  const today = new Date().toISOString().split('T')[0]
  const regs = listSessionRegistrations(sessionId)
  const seasonPlayers = regs.filter(r => r.type === 'season_player')
  const substitutes   = regs.filter(r => r.type === 'season_substitute')
  const walkIns       = regs.filter(r => r.type === 'walk_in')
  const feePerPaidPerson = session.courtFee + (session.acEnabled ? session.acFee : 0)

  return {
    session,
    rental,
    seasonPlayers,
    substitutes,
    walkIns,
    feePerPaidPerson,
    expectedRevenue:    (substitutes.length + walkIns.length) * feePerPaidPerson,
    isPast:             session.sessionDate <  today,
    isToday:            session.sessionDate === today,
  }
}

/** 館長管理頁的單筆季租單摘要 */
export interface AdminSeasonRentalRow {
  rental:               SeasonRental
  tokenExpired:         boolean
  paidRatio:            number
  gap:                  number     // = totalAmount - paidAmount
  isCritical:           boolean    // gap > 0
  totalSessions:        number
  pastSessions:         number
  remainingSessions:    number
  captainUrl:           string     // 給「複製連結」按鈕用的相對路徑
}

export function listSeasonRentalsForAdmin(): AdminSeasonRentalRow[] {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  return GENERATED.seasonRentals
    .map(rental => {
      const sessions = _findCaptainSessions(rental)
      const pastSessions      = sessions.filter(s => s.sessionDate <  today).length
      const remainingSessions = sessions.filter(s => s.sessionDate >= today).length
      const gap = rental.totalAmount - rental.paidAmount
      return {
        rental,
        tokenExpired: new Date(rental.accessTokenExpiresAt) < now,
        paidRatio:    rental.totalAmount > 0 ? rental.paidAmount / rental.totalAmount : 0,
        gap,
        isCritical:   gap > 0,
        totalSessions: sessions.length,
        pastSessions,
        remainingSessions,
        captainUrl:   buildCaptainUrl(rental.accessToken),
      }
    })
    // 排序：欠款的排最前 → 然後 token 過期 → 然後 active
    .sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1
      if (a.tokenExpired !== b.tokenExpired) return a.tokenExpired ? -1 : 1
      return b.gap - a.gap
    })
}

/** Helper：給館長端「複製主揪連結」按鈕用 */
export function buildCaptainUrl(token: string): string {
  return `/captain/${token}`
}


// ============================================================
// 七、Mutations + Audit + Current User（階段 3 production 升級）
// ============================================================
// 此 section 都是「會改資料」的高階函式（vs 上面 sections 都是 read）。
// 內部呼叫 store.ts 的 low-level primitives，每次 mutation 都會：
//   1. In-place mutate GENERATED 陣列（既有 read 函式自動見到）
//   2. 寫一筆 diff 到 localStorage（重整不還原）
//   3. 推一筆 AuditLog（在 /audit 頁顯示）
//   4. notify 訂閱者重新 render
// ============================================================

import type {
  AuditAction, AuditActorType, AuditLog,
  RegistrationStatus, RegistrationType,
} from '@/types'
import {
  addCustomer, addRegistration, addSeasonRental, appendAuditLog,
  getAuditLogs, getCurrentUserId,
  patchRegistrationStatus, patchSeasonRental,
  setCurrentUserId as storeSetCurrentUserId,
} from './store'

// ── 7.1 ID / token 產生（runtime，不走 Mulberry seed） ─────────

function genId(prefix: string): string {
  // 32-bit random suffix；夠用避免 collide
  const r = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${prefix}_${Date.now().toString(36)}_${r}`
}

function genToken(): string {
  // 跟 generator.ts randomToken() 同字元集 + 同長度
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let t = ''
  for (let i = 0; i < 24; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}


// ── 7.2 Actor 解析 ───────────────────────────────────────────

interface AuditActor {
  type: AuditActorType
  id: string
  name: string
}

/** 從目前登入的 user 取得 admin actor */
function getAdminActor(): AuditActor {
  const uid = getCurrentUserId()
  const user = GENERATED.users.find(u => u.id === uid)
  return {
    type: 'user',
    id: uid,
    name: user?.name ?? '未知人員',
  }
}

/** 從 SeasonRental 取得 captain actor（actorId 用 rentalId）*/
function getCaptainActor(rentalId: string): AuditActor {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  return {
    type: 'captain',
    id: rentalId,
    name: r?.captainName ?? '主揪',
  }
}


// ── 7.3 Audit log 寫入 helper ────────────────────────────────

function writeAudit(args: {
  actor: AuditActor
  venue: string | null
  action: AuditAction
  entityType: string
  entityId: string
  targetLabel: string
  detail: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}): void {
  const log: AuditLog = {
    id: genId('audit'),
    userId: args.actor.type === 'user' ? args.actor.id : null,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    oldValues: args.oldValues ?? null,
    newValues: args.newValues ?? null,
    ipAddress: null,
    createdAt: new Date().toISOString(),
    // 衍生 / 階段 3 production 新增的顯示欄位：
    userName: args.actor.name,
    actorType: args.actor.type,
    actorName: args.actor.name,
    venue: args.venue,
    targetLabel: args.targetLabel,
    detail: args.detail,
  }
  appendAuditLog(log)
}


// ── 7.4 主揪頁 mutations ─────────────────────────────────────

/**
 * Helper：取得某場次的季打人員（**含請假者**，即 status='cancelled'）。
 * 既有 listSessionRegistrations 會濾掉 cancelled，但主揪頁需要顯示請假者
 * 以便主揪可以「取消請假」。
 */
export function listSessionSeasonPlayersWithLeave(sessionId: string): RegistrationWithCustomer[] {
  return GENERATED.registrations
    .filter(r => r.sessionId === sessionId && r.type === 'season_player')
    .map(r => {
      const customer = GENERATED.customers.find(c => c.id === r.customerId)
      return customer ? { ...r, customer } : null
    })
    .filter((x): x is RegistrationWithCustomer => x !== null)
}

/**
 * 主揪將某報名標記為「請假」（status: 'registered' → 'cancelled'）。
 * 同時推一筆 audit log。
 */
export function captainMarkLeave(args: {
  rentalId: string
  registrationId: string
}): { ok: true } | { ok: false; reason: string } {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.status === 'cancelled') return { ok: false, reason: '已是請假狀態' }

  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const session  = GENERATED.sessions.find(s => s.id === reg.sessionId)
  const venue    = session ? GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null : null

  patchRegistrationStatus(args.registrationId, 'cancelled')
  writeAudit({
    actor: getCaptainActor(args.rentalId),
    venue,
    action: 'CANCEL_REGISTRATION',
    entityType: 'Registration',
    entityId: args.registrationId,
    targetLabel: customer?.name ?? '?',
    detail: session ? `${session.sessionDate} ${session.startTime} 主揪標記請假` : '主揪標記請假',
    oldValues: { status: 'registered' },
    newValues: { status: 'cancelled' },
  })
  return { ok: true }
}

/** 主揪取消請假（'cancelled' → 'registered'）*/
export function captainUnmarkLeave(args: {
  rentalId: string
  registrationId: string
}): { ok: true } | { ok: false; reason: string } {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.status !== 'cancelled') return { ok: false, reason: '不在請假狀態' }

  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const session  = GENERATED.sessions.find(s => s.id === reg.sessionId)
  const venue    = session ? GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null : null

  patchRegistrationStatus(args.registrationId, 'registered')
  writeAudit({
    actor: getCaptainActor(args.rentalId),
    venue,
    action: 'UNCANCEL_REGISTRATION',
    entityType: 'Registration',
    entityId: args.registrationId,
    targetLabel: customer?.name ?? '?',
    detail: session ? `${session.sessionDate} ${session.startTime} 主揪取消請假` : '主揪取消請假',
    oldValues: { status: 'cancelled' },
    newValues: { status: 'registered' },
  })
  return { ok: true }
}

/**
 * 主揪為某 session 新增一名「臨打」或「補位」。
 * - 若 name 是新名字 → 建立新 Customer + 新 Registration
 * - registrationType: 'walk_in' 或 'season_substitute'（補位）
 */
export function captainAddWalkIn(args: {
  rentalId: string
  sessionId: string
  name: string
  /** 預設 'walk_in'；若主揪指明是「請假補位」可傳 'season_substitute' */
  type?: RegistrationType
}): { ok: true; registrationId: string } | { ok: false; reason: string } {
  const name = args.name.trim()
  if (!name) return { ok: false, reason: '姓名不可空白' }

  const session = GENERATED.sessions.find(s => s.id === args.sessionId)
  if (!session) return { ok: false, reason: '找不到場次' }

  const venueName = GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null

  // 新建 Customer（不嘗試 dedupe — 主揪 input 太自由，避免誤合）
  const newCustomer: Customer = {
    id: genId('cust'),
    name,
    phone: null,
    email: null,
    skillLevel: null,
    preferredNetHeight: null,
    notes: '主揪新增',
    isBanned: false,
    createdAt: new Date().toISOString(),
  }
  addCustomer(newCustomer)

  // 新建 Registration
  const regType: RegistrationType = args.type ?? 'walk_in'
  const newReg: Registration = {
    id: genId('reg'),
    sessionId: args.sessionId,
    customerId: newCustomer.id,
    type: regType,
    registeredBy: null,            // 主揪建立的，不對應 User
    registeredBySource: 'captain',
    status: 'registered',
    notes: null,
    registeredAt: new Date().toISOString(),
    selfReportedPaid: false,
    selfPaymentMethod: null,
    selfPaymentEvidence: null,
    selfReportedAt: null,
  }
  addRegistration(newReg)

  writeAudit({
    actor: getCaptainActor(args.rentalId),
    venue: venueName,
    action: 'ADD_WALKIN_BY_CAPTAIN',
    entityType: 'Registration',
    entityId: newReg.id,
    targetLabel: name,
    detail: `${session.sessionDate} ${session.startTime} 新增${regType === 'season_substitute' ? '補位' : '臨打'}`,
    newValues: { customerId: newCustomer.id, sessionId: args.sessionId, type: regType },
  })
  return { ok: true, registrationId: newReg.id }
}


// ── 7.5 館長端 mutations ─────────────────────────────────────

/** 館長複製主揪連結（只記 log，clipboard 由 UI 端做）*/
export function adminLogCopyToken(rentalId: string): void {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  if (!r) return
  writeAudit({
    actor: getAdminActor(),
    venue: r.venueName ?? null,
    action: 'COPY_CAPTAIN_TOKEN',
    entityType: 'SeasonRental',
    entityId: rentalId,
    targetLabel: r.captainName ?? '主揪',
    detail: '複製主揪連結',
  })
}

/**
 * 重發 token：產生新 token + 延長 expiresAt 到本季結束。
 * 舊 token 立即失效（因 SeasonRental.accessToken 直接被覆寫）。
 */
export function adminRegenerateToken(rentalId: string): { ok: true; newToken: string } | { ok: false; reason: string } {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  if (!r) return { ok: false, reason: '找不到季租單' }

  const newToken = genToken()
  // expiresAt：用 rental 對應 season 的 endDate，若找不到就延長 30 天
  const season = GENERATED.seasons.find(s => s.id === r.seasonId)
  const newExpiresAt = season
    ? `${season.endDate}T23:59:59`
    : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

  patchSeasonRental(rentalId, {
    accessToken: newToken,
    accessTokenExpiresAt: newExpiresAt,
    updatedAt: new Date().toISOString(),
  })
  writeAudit({
    actor: getAdminActor(),
    venue: r.venueName ?? null,
    action: 'UPDATE_SEASON_RENTAL',
    entityType: 'SeasonRental',
    entityId: rentalId,
    targetLabel: r.captainName ?? '主揪',
    detail: `重發 token（舊 token 失效，新 expiresAt: ${newExpiresAt.slice(0, 10)}）`,
    oldValues: { accessToken: r.accessToken, accessTokenExpiresAt: r.accessTokenExpiresAt },
    newValues: { accessToken: newToken, accessTokenExpiresAt: newExpiresAt },
  })
  return { ok: true, newToken }
}

/** 停用季租單：status: 'active'/'pending' → 'cancelled'  */
export function adminDeactivateRental(rentalId: string): { ok: true } | { ok: false; reason: string } {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  if (!r) return { ok: false, reason: '找不到季租單' }
  if (r.status === 'cancelled') return { ok: false, reason: '此季租單已停用' }

  const oldStatus = r.status
  patchSeasonRental(rentalId, { status: 'cancelled', updatedAt: new Date().toISOString() })
  writeAudit({
    actor: getAdminActor(),
    venue: r.venueName ?? null,
    action: 'CANCEL_SEASON_RENTAL',
    entityType: 'SeasonRental',
    entityId: rentalId,
    targetLabel: r.captainName ?? '主揪',
    detail: '停用季租單 + token 失效',
    oldValues: { status: oldStatus },
    newValues: { status: 'cancelled' },
  })
  return { ok: true }
}

/**
 * 新增季租單。
 * - 自動產 id + token + expiresAt
 * - totalAmount = pricePerSession × season.numWeeks
 * - 預設 status='pending'，paidAmount=0
 * - 寫入後既有 listSeasonRentalsForAdmin() 自然見到
 */
export function adminCreateRental(args: {
  timeslotId: string
  seasonId: string
  captainCustomerId: string
  pricePerSession: number
  notes?: string | null
}): { ok: true; rentalId: string; token: string } | { ok: false; reason: string } {
  const timeslot = GENERATED.timeslots.find(t => t.id === args.timeslotId)
  if (!timeslot) return { ok: false, reason: '找不到時段' }
  const season = GENERATED.seasons.find(s => s.id === args.seasonId)
  if (!season) return { ok: false, reason: '找不到季' }
  const captain = GENERATED.customers.find(c => c.id === args.captainCustomerId)
  if (!captain) return { ok: false, reason: '找不到主揪客戶' }

  const venue = GENERATED.venues.find(v => v.id === timeslot.venueId)

  const id = genId('sr')
  const token = genToken()
  const now = new Date().toISOString()
  const numWeeks = season.numWeeks ?? 12
  const totalAmount = args.pricePerSession * numWeeks

  const newRental: SeasonRental = {
    id,
    timeslotId: args.timeslotId,
    seasonId: args.seasonId,
    captainId: args.captainCustomerId,
    pricePerSession: args.pricePerSession,
    totalAmount,
    paidAmount: 0,
    accessToken: token,
    accessTokenExpiresAt: `${season.endDate}T23:59:59`,
    status: 'pending',
    notes: args.notes ?? null,
    createdAt: now,
    updatedAt: now,
    // 衍生欄位（補上以便 list 顯示一致）
    captainName: captain.name,
    captainPhone: captain.phone ?? undefined,
    venueName: venue?.name,
    seasonName: season.name,
    timeslotLabel: `${dayLabel(timeslot.dayOfWeek)} ${timeslot.startTime}-${timeslot.endTime}`,
    generatedSessionCount: 0,
    shortfallCount: 0,
  }

  addSeasonRental(newRental)
  writeAudit({
    actor: getAdminActor(),
    venue: venue?.name ?? null,
    action: 'CREATE_SEASON_RENTAL',
    entityType: 'SeasonRental',
    entityId: id,
    targetLabel: captain.name,
    detail: `新增「${venue?.name ?? ''} ${dayLabel(timeslot.dayOfWeek)} ${timeslot.startTime}-${timeslot.endTime}」季租單，應收 $${totalAmount.toLocaleString()}`,
    newValues: { rentalId: id, captainId: captain.id, totalAmount, pricePerSession: args.pricePerSession },
  })
  return { ok: true, rentalId: id, token }
}

function dayLabel(d: number): string {
  return ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d] ?? `星期${d}`
}


// ── 7.6 Audit log 讀取 ───────────────────────────────────────

/** Captain action: 由主揪在 /captain/[token] 頁觸發的 actions */
const CAPTAIN_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'CAPTAIN_LOGIN',
  'MARK_ATTENDANCE_BY_CAPTAIN',
  'ADD_WALKIN_BY_CAPTAIN',
  'CANCEL_REGISTRATION',     // 主揪請假（actorType='captain' 時）
  'UNCANCEL_REGISTRATION',   // 主揪取消請假
])

/** Admin action: 由館長 / 工讀生在 ERP 內觸發的 actions */
const ADMIN_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'CREATE_SEASON_RENTAL',
  'UPDATE_SEASON_RENTAL',
  'CANCEL_SEASON_RENTAL',
  'COPY_CAPTAIN_TOKEN',
  'CREATE_REGISTRATION',
  'UPDATE_PAYMENT',
  'ADD_PAYMENT',
  'ADD_PRODUCT_SALE',
  'ADD_PRODUCT_GIFT',
  'ADJUST_STOCK',
  'UPDATE_SESSION',
  'CANCEL_SESSION',
])

export interface AuditLogFilter {
  /** 'all' = 全部；其他值依 actor + action 分類 */
  category?: 'all' | 'captain' | 'admin'
  venue?: string | 'all'
}

export function listAuditLogs(filter: AuditLogFilter = {}): AuditLog[] {
  const cat   = filter.category ?? 'all'
  const venue = filter.venue    ?? 'all'
  return getAuditLogs().filter(l => {
    if (cat === 'captain') {
      // 主揪類：actorType='captain' 或 action 在 CAPTAIN_ACTIONS
      const isCaptain = l.actorType === 'captain' || CAPTAIN_ACTIONS.has(l.action)
      if (!isCaptain) return false
    }
    if (cat === 'admin') {
      const isAdmin = l.actorType !== 'captain' && ADMIN_ACTIONS.has(l.action)
      if (!isAdmin) return false
    }
    if (venue !== 'all' && l.venue !== venue) return false
    return true
  })
}


// ── 7.7 Current user（最小版「假登入」）──────────────────────

export function getCurrentUser(): User | null {
  const uid = getCurrentUserId()
  return GENERATED.users.find(u => u.id === uid) ?? null
}

/** 切換登入身份（給 sidebar dropdown 用）*/
export function switchCurrentUser(userId: string): void {
  storeSetCurrentUserId(userId)
}

/** 列出所有 user — sidebar dropdown 用 */
export function listAllUsers(): User[] {
  return GENERATED.users
}


// ============================================================
// 八、Permissions（階段 3.5 權限 runtime）
// ============================================================
// 此 section 是「角色 → 頁面 → 資料」的對外查詢介面。
// 規則本身在 data/permissions.ts，這裡只是 wire 起來 + 結合
// 「目前登入 user」狀態。
//
// 設計重點：
//   - listUserVenueRoles 從 permissions.ts 常數讀（generator 凍結，種子放那）
//   - getEffectiveRole 結合 globalRole + venueRoles 推算
//   - getVisibleVenueIds：owner='all'，manager/staff = 自己綁的 venue
//     資料過濾用：list 函式可選擇接受此參數做 filter
//   - isImpersonating：currentUserId !== REAL_USER_ID（u1）
// ============================================================

import {
  PAGE_ACCESS_MATRIX, REAL_USER_ID, USER_VENUE_ROLES_SEED,
  composeRoleLabel, deriveEffectiveRole, lookupPageAccess,
  type EffectiveRole, type PageAccess, type PageKey,
} from './permissions'
import type { UserVenueRole } from '@/types'


// ── 8.1 UserVenueRole 查詢 ─────────────────────────────────────

/**
 * 列出某 user 在所有球館的角色。
 * @returns 找不到回空陣列（例如 owner 不綁館，回 []）
 */
export function listUserVenueRoles(userId: string): UserVenueRole[] {
  return USER_VENUE_ROLES_SEED.filter(r => r.userId === userId)
}

/** 某球館有哪些 user 任職 */
export function listVenueStaff(venueId: string): UserVenueRole[] {
  return USER_VENUE_ROLES_SEED.filter(r => r.venueId === venueId)
}


// ── 8.2 Effective role / page access ──────────────────────────

/**
 * 取得 user 的實際角色（owner / manager / staff / none）。
 * 純函數推算，不快取（user 切視角時要立即重算）。
 */
export function getEffectiveRole(userId: string): EffectiveRole {
  const user = GENERATED.users.find(u => u.id === userId)
  if (!user) return 'none'
  const venueRoles = listUserVenueRoles(userId)
  return deriveEffectiveRole(user.globalRole, venueRoles)
}

/** 目前登入 user 的 effective role */
export function getCurrentEffectiveRole(): EffectiveRole {
  return getEffectiveRole(getCurrentUserId())
}

/** user 對某 page 的存取等級 */
export function getPageAccess(userId: string, page: PageKey): PageAccess {
  return lookupPageAccess(page, getEffectiveRole(userId))
}

/** 簡化 boolean 版（true = 可看，false = 被擋） */
export function canAccessPage(userId: string, page: PageKey): boolean {
  return getPageAccess(userId, page) !== 'denied'
}


// ── 8.3 Visible venues（資料過濾用） ──────────────────────────

/**
 * 取得 user 可看到的 venue id 集合。
 * @returns 'all' = owner（看全部）；string[] = 自己館的 id list
 *
 * 用法：list 函式如 listSeasonRentalsForAdmin 接受 venueFilter
 * 參數，傳入 getVisibleVenueIds(currentUserId)
 * 即可一鍵套用「館長只看自己館」。
 */
export function getVisibleVenueIds(userId: string): string[] | 'all' {
  const role = getEffectiveRole(userId)
  if (role === 'owner') return 'all'
  if (role === 'none')  return []
  const venueIds = listUserVenueRoles(userId).map(r => r.venueId)
  // 去重
  return Array.from(new Set(venueIds))
}

/** 目前登入 user 的可見 venue id 集合 */
export function getCurrentVisibleVenueIds(): string[] | 'all' {
  return getVisibleVenueIds(getCurrentUserId())
}

/** 資料過濾 helper — venueId 是否在 visible 集合內 */
export function isVenueVisible(venueId: string, visible: string[] | 'all'): boolean {
  if (visible === 'all') return true
  return visible.includes(venueId)
}


// ── 8.4 Impersonation（owner 切視角） ─────────────────────────

/**
 * 是否在「切視角」模式 — currentUserId !== REAL_USER_ID。
 *
 * Demo 環境固定 REAL_USER_ID='u1'（陳老闆 owner）。
 * 未來接真登入時，把 permissions.ts 的 REAL_USER_ID 改成讀 session。
 */
export function isImpersonating(): boolean {
  return getCurrentUserId() !== REAL_USER_ID
}

/** 真實登入帳號（demo 永遠 u1） */
export function getRealUserId(): string {
  return REAL_USER_ID
}

/** 真實登入 user 物件 */
export function getRealUser(): User | null {
  return GENERATED.users.find(u => u.id === REAL_USER_ID) ?? null
}

/** 一鍵回到 owner 視角 */
export function returnToRealUser(): void {
  storeSetCurrentUserId(REAL_USER_ID)
}


// ── 8.5 Role label（Sidebar 顯示用） ──────────────────────────

/**
 * 組出某 user 的角色 label：
 *   - owner            → 「最高權限」
 *   - manager + 1 venue → 「館長 · 飛翼」
 *   - manager + N venue → 「館長 · 飛翼+1」
 *   - staff + 1 venue   → 「工讀生 · 飛翼」
 *   - none              → 「無權限」
 */
export function getUserRoleLabel(userId: string): string {
  const role = getEffectiveRole(userId)
  const venueRoles = listUserVenueRoles(userId)
  const venueNames = venueRoles
    .map(vr => GENERATED.venues.find(v => v.id === vr.venueId)?.name)
    .filter((n): n is string => !!n)
  return composeRoleLabel(role, venueNames)
}


// ── 8.6 Nav 過濾 helper（Sidebar 用） ─────────────────────────

/** 一次取「目前 user 可看的 page key 集合」— sidebar nav 用 */
export function listAccessiblePages(userId: string): PageKey[] {
  return (Object.keys(PAGE_ACCESS_MATRIX) as PageKey[])
    .filter(p => canAccessPage(userId, p))
}

/**
 * 工讀生額外規則：可看欠款，但獎金 / 全館營收欄位遮蔽。
 * 對外簡化成 boolean — 給 UI 元件判斷是否顯示獎金 column / 全館加總。
 */
export function canSeeBonusAndTotals(userId: string): boolean {
  const role = getEffectiveRole(userId)
  return role === 'owner' || role === 'manager'
}


// ── 8.7 Dashboard 過濾（manager 視角專用）─────────────────────

/**
 * 對 DashboardData 套用「只看自己館」過濾。
 *   - owner（visible='all'）：原樣回傳
 *   - manager（visible=string[]）：venues / alerts / unpaidRegistrations
 *     都按 venueId 過濾，加總數字重新計算
 *   - staff：理論上不會打到此函式（page guard 已擋）— 保底回空
 */
export function getFilteredDashboard(visible: string[] | 'all'): DashboardData {
  const full = GENERATED.dashboard
  if (visible === 'all') return full
  const ids = new Set(visible)

  const venues              = full.venues.filter(v => ids.has(v.venueId))
  const alerts              = full.alerts.filter(a => ids.has(a.venueId))
  const unpaidRegistrations = full.unpaidRegistrations.filter(r => ids.has(r.venueId))

  return {
    ...full,
    venues,
    alerts,
    unpaidRegistrations,
    totalRevenue:  venues.reduce((s, v) => s + v.totalRevenue,  0),
    totalPlayers:  venues.reduce((s, v) => s + v.totalPlayers,  0),
    totalSessions: venues.reduce((s, v) => s + v.totalSessions, 0),
    totalUnpaid:   venues.reduce((s, v) => s + v.unpaidCount,   0),
  }
}

/** Dashboard stats 的過濾版（sync — client component 用）*/
export function getFilteredDashboardStats(visible: string[] | 'all', date?: string): DashboardStats {
  const dateStr = date ?? TODAY_STR
  const all = listVenueSummaries(dateStr)
  const summaries = visible === 'all' ? all : all.filter(v => visible.includes(v.venueId))
  return {
    totalRevenue:      summaries.reduce((s, v) => s + v.totalRevenue,  0),
    totalPlayers:      summaries.reduce((s, v) => s + v.totalPlayers,  0),
    totalSessions:     summaries.reduce((s, v) => s + v.totalSessions, 0),
    totalUnpaid:       summaries.reduce((s, v) => s + v.unpaidCount,   0),
    totalUnpaidAmount: summaries.reduce((s, v) => s + v.unpaidAmount,  0),
    revenueDelta:      getRevenueDelta(dateStr),
    fillRate:          getCapacityFillRate(dateStr),
    activeVenueCount:  visible === 'all' ? getActiveVenueCount() : summaries.length,
  }
}


// ── 8.8 Reconciliation overview 過濾版 ─────────────────────────

/**
 * 對 ReconciliationOverview 套用視角過濾。
 *
 * 不修改既有 getReconciliationOverview（凍結），這邊重新組合
 * 已過濾的子查詢結果。
 */
export function getFilteredReconciliationOverview(visible: string[] | 'all'): ReconciliationOverview {
  const weekSessions  = getSessionReconciliation({ period: 'week' })
    .filter(s => visible === 'all' || visible.includes(s.venueId))
  const monthRecon    = getMonthlyReconciliation('month')
  const monthRows     = visible === 'all'
    ? monthRecon.rows
    : monthRecon.rows.filter(r => visible.includes(r.venueId))
  const monthTotals = visible === 'all' ? monthRecon.totals : {
    sessionExpected:  monthRows.reduce((s, r) => s + r.sessionExpected,  0),
    sessionActual:    monthRows.reduce((s, r) => s + r.sessionActual,    0),
    rentalAllocated:  monthRows.reduce((s, r) => s + r.rentalAllocated,  0),
    rentalActualPaid: monthRows.reduce((s, r) => s + r.rentalActualPaid, 0),
    productRevenue:   monthRows.reduce((s, r) => s + r.productRevenue,   0),
    productGiftValue: monthRows.reduce((s, r) => s + r.productGiftValue, 0),
    totalExpected:    monthRows.reduce((s, r) => s + r.totalExpected,    0),
    totalActual:      monthRows.reduce((s, r) => s + r.totalActual,      0),
    totalGap:         monthRows.reduce((s, r) => s + r.totalGap,         0),
  }
  const rentalRecon = getSeasonRentalReconciliation()
    .filter(r => visible === 'all' || (r.venueName && _isVisibleByName(r.venueName, visible)))
  const productRecon = getProductReconciliation()
    .filter(p => visible === 'all' || p.byVenue.some(b => visible.includes(b.venueId)))
  const anomalies = getReconciliationAnomalies()
    .filter(a => visible === 'all' || visible.includes(a.venueId))

  const weekExpected = weekSessions.reduce((sum, s) => sum + s.expectedRevenue, 0)
  const weekActual   = weekSessions.reduce((sum, s) => sum + s.actualRevenue,   0)

  const sessionShortfall = weekSessions.filter(s => s.gap > 0)
  const rentalUnpaid     = rentalRecon.filter(r => r.gap > 0)
  const productAnomaly   = productRecon.filter(p => p.hasGiftAnomaly)

  const venueGaps = monthRows.filter(r => r.totalGap > 0)
  const monthlyMaxGap = venueGaps.length > 0
    ? venueGaps.reduce((max, r) => r.totalGap > max.totalGap ? r : max)
    : null

  return {
    week: {
      expected:     weekExpected,
      actual:       weekActual,
      gap:          weekExpected - weekActual,
      sessionCount: weekSessions.length,
    },
    month: {
      expected:     monthTotals.totalExpected,
      actual:       monthTotals.totalActual,
      gap:          monthTotals.totalGap,
    },
    summary: {
      sessionShortfallCount:  sessionShortfall.length,
      sessionShortfallAmount: sessionShortfall.reduce((sum, s) => sum + s.gap, 0),
      rentalUnpaidCount:      rentalUnpaid.length,
      rentalUnpaidAmount:     rentalUnpaid.reduce((sum, r) => sum + r.gap, 0),
      productAnomalyCount:    productAnomaly.length,
      monthlyMaxGap:          monthlyMaxGap
        ? { venueName: monthlyMaxGap.venueName, gap: monthlyMaxGap.totalGap }
        : null,
      anomalyTotalCount:      anomalies.length,
    },
    topAnomalies: anomalies.slice(0, 3),
  }
}

/** 內部 helper：用 venueName 反查是否在 visible 集合 */
function _isVisibleByName(venueName: string, visible: string[]): boolean {
  const v = GENERATED.venues.find(x => x.name === venueName)
  return v ? visible.includes(v.id) : false
}


// ============================================================
// 九、館長績效（階段 4 pitch demo）
// ============================================================
// 此 section 計算「館長獎金」與相關 KPI。
//
// 公式（pitch level）：
//   B (本月獎金) = P × K
//   P = 該館本月已入帳金額 × 5%
//   K = 0.50  保底
//     + 0.20 × Hot Zone 場次率（鼓勵衝熱門時段）
//     + 0.20 × 入帳率（已收/應收，鼓勵收齊錢）
//     + 0.10 × (1 - 贈送比)（抑制過度送票）
//   K ∈ [0.50, 1.00]
//
// 設計重點：
//   - 當月數值來自 GENERATED 真實 session / payment / productTx
//   - 6 個月歷史趨勢用 deterministic synth（generator 只有 ~2 個月）
//   - 季預測（自然季 Q1-Q4）= 已實現 + 預測剩餘月份
//   - manager 視角自動沿用 getCurrentVisibleVenueIds() 過濾
//   - 不修改既有函式，types/index.ts、generator.ts 都不動
// ============================================================

export interface VenuePerformance {
  venueId: string
  venueName: string
  managerUserId: string | null
  managerName: string | null

  // 本月真實數字
  monthRevenue: number          // 已入帳金額
  expectedRevenue: number       // 應收
  collectionRate: number        // 0..1
  hotZoneSessionRate: number    // 0..1
  giftRatio: number             // 0..1

  // 公式拆解
  baseCommission: number        // P = revenue × 5%
  coefBase: number              // 0.50 保底
  coefHotZone: number           // 0.20 × hotZoneRate
  coefCollection: number        // 0.20 × collectionRate
  coefGift: number              // 0.10 × (1 - giftRatio)
  coefficient: number           // K (sum, clamped to [0,1])
  bonus: number                 // B = P × K

  // 6 個月趨勢（trend[0]=最舊，trend[5]=當月）
  trend: { monthLabel: string; bonus: number }[]

  // 本季（自然季）預測
  seasonProjection: {
    quarterLabel: string        // 例「Q2 2026（4-6月）」
    realized: number            // 季內已過月份的獎金合計
    projected: number           // 預測剩餘月份
    total: number               // realized + projected
    monthsRealized: number
    monthsRemaining: number
  }

  // AI 建議文字（模板字串）
  insight: string
}

export interface PerformanceOverview {
  monthLabel: string                            // 例「2026 年 5 月」
  venues: VenuePerformance[]                    // 排行榜（已按 bonus desc 排序）
  bonusPoolTotal: number                        // 總獎金池
  bonusPoolDeltaPct: number                     // 比上月 ±%
  topPerformer: VenuePerformance | null
  worstPerformer: VenuePerformance | null
  averageCoefficient: number                    // 平均 K
  visibleCount: number                          // 視角內幾個館
  isFiltered: boolean                           // true = manager 視角
}


// ── 9.1 公式常數 ──────────────────────────────────────────────

const _BONUS_COMMISSION_RATE  = 0.05
const _COEF_BASE              = 0.50
const _COEF_HOTZONE_MAX       = 0.20
const _COEF_COLLECTION_MAX    = 0.20
const _COEF_GIFT_MAX          = 0.10


// ── 9.2 內部 helper ───────────────────────────────────────────

/** 取得前 N 個月（YYYY-MM list，包含當月，最舊在前） */
function _lastNMonthsYM(today: Date, n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth() - i
    const d = new Date(Date.UTC(y, m, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push(ym)
  }
  return out
}

/** Deterministic pseudo-random 0..1（用於趨勢合成，保證每次 reload 相同）*/
function _seedHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 1000 / 1000
}

function _clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function _formatMonthLabel(yearMonth: string): string {
  // '2026-05' → '5月'
  return `${parseInt(yearMonth.slice(5), 10)}月`
}


// ── 9.3 單一館的當月績效（核心計算）────────────────────────────

export function computeVenuePerformance(venueId: string): VenuePerformance | null {
  const venue = GENERATED.venues.find(v => v.id === venueId)
  if (!venue) return null

  // 找該館的 manager
  const managerRole = USER_VENUE_ROLES_SEED.find(
    r => r.venueId === venueId && r.role === 'manager',
  )
  const managerUserId = managerRole?.userId ?? null
  const managerName = managerUserId
    ? GENERATED.users.find(u => u.id === managerUserId)?.name ?? null
    : null

  // 本月日期 prefix
  const today = new Date(TODAY_STR + 'T00:00:00Z')
  const monthStr = TODAY_STR.slice(0, 7)  // 'YYYY-MM'

  // 本月該館「已完成」 session
  const monthSessions = GENERATED.sessions.filter(
    s => s.venueId === venueId
      && s.sessionDate.startsWith(monthStr)
      && s.status === 'completed',
  )

  // 應收 / 已收
  const expectedRevenue = monthSessions.reduce((sum, s) => sum + (s.expectedRevenue ?? 0), 0)
  const monthRevenue    = monthSessions.reduce((sum, s) => sum + (s.actualRevenue   ?? 0), 0)
  const collectionRate  = expectedRevenue > 0 ? _clamp01(monthRevenue / expectedRevenue) : 0

  // Hot Zone 場次率（用 timeslot.isHotZone；timeslotId 為 null 視為冷門）
  const hotZoneCount = monthSessions.filter(s => {
    if (!s.timeslotId) return false
    const ts = GENERATED.timeslots.find(t => t.id === s.timeslotId)
    return ts?.isHotZone ?? false
  }).length
  const hotZoneSessionRate = monthSessions.length > 0
    ? hotZoneCount / monthSessions.length
    : 0

  // 贈送比 — 本月該館的 product transactions（gift / (gift + sale)）
  const monthTxs = GENERATED.productTransactions.filter(
    t => t.venueId === venueId && t.operatedAt.startsWith(monthStr),
  )
  const giftCount = monthTxs.filter(t => t.type === 'gift').length
  const saleCount = monthTxs.filter(t => t.type === 'sale').length
  const totalCount = giftCount + saleCount
  const giftRatio = totalCount > 0 ? giftCount / totalCount : 0

  // 公式拆解
  const baseCommission  = monthRevenue * _BONUS_COMMISSION_RATE
  const coefBase        = _COEF_BASE
  const coefHotZone     = _COEF_HOTZONE_MAX    * hotZoneSessionRate
  const coefCollection  = _COEF_COLLECTION_MAX * collectionRate
  const coefGift        = _COEF_GIFT_MAX       * (1 - giftRatio)
  const coefficient     = _clamp01(coefBase + coefHotZone + coefCollection + coefGift)
  const bonus           = baseCommission * coefficient

  // 6 個月趨勢
  const trend = _synthVenueTrend(venue.id, today, bonus)

  // 季預測
  const seasonProjection = _computeSeasonProjection(today, trend)

  // 建議文字
  const insight = _composeInsight(venue.name, {
    hotZoneSessionRate, collectionRate, giftRatio,
    coefHotZone, coefCollection, coefGift, baseCommission,
  })

  return {
    venueId, venueName: venue.name,
    managerUserId, managerName,
    monthRevenue, expectedRevenue,
    collectionRate, hotZoneSessionRate, giftRatio,
    baseCommission,
    coefBase, coefHotZone, coefCollection, coefGift,
    coefficient, bonus,
    trend, seasonProjection, insight,
  }
}


// ── 9.4 6 個月趨勢合成（deterministic）─────────────────────────
//
// generator 只有 -56..+28 天的 session，6 個月歷史 → 合成。
// 各館 trend pattern 連動故事點：
//   v1 球魔方：穩定下滑（最近 -46% 故事點 1）
//   v3 飛翼：高但波動
//   v4 日日：略有季節性
//   其他：穩定 ±8%
//   12 月節假日略低
//
// 當月（index=5）= 真實計算值；過去 5 個月由 currentBonus 反推。

function _synthVenueTrend(
  venueId: string,
  today: Date,
  currentBonus: number,
): VenuePerformance['trend'] {
  const months = _lastNMonthsYM(today, 6)
  const seed = _seedHash(venueId)

  return months.map((monthYM, idx) => {
    const isCurrent = idx === months.length - 1
    if (isCurrent) {
      return { monthLabel: _formatMonthLabel(monthYM), bonus: currentBonus }
    }

    const monthsBack = months.length - 1 - idx
    let factor = 1.0

    if (venueId === 'v1') {
      // 球魔方：愈早愈高（現在最低，往前慢慢上升）
      factor = 1 + 0.18 * monthsBack
    } else if (venueId === 'v3') {
      // 飛翼：高且波動
      factor = 0.85 + 0.3 * ((seed + monthsBack * 0.13) % 1)
    } else if (venueId === 'v4') {
      // 日日：季節性
      factor = 0.92 + 0.15 * Math.sin((monthsBack + seed * 3) * 0.8)
    } else {
      // 其他：穩定
      factor = 0.96 + 0.16 * ((seed + monthsBack * 0.21) % 1)
    }

    // 12 月節假日略低、1 月年初也低
    const monthNum = parseInt(monthYM.slice(5), 10)
    if (monthNum === 12) factor *= 0.85
    if (monthNum === 1)  factor *= 0.92

    // 確保歷史月份至少有一個合理底（避免當月為 0 時整條 trend 都 0）
    const synthValue = Math.max(currentBonus * factor, 1500 * factor * (0.7 + seed))

    return {
      monthLabel: _formatMonthLabel(monthYM),
      bonus: synthValue,
    }
  })
}


// ── 9.5 季預測 ────────────────────────────────────────────────

function _computeSeasonProjection(
  today: Date,
  trend: VenuePerformance['trend'],
): VenuePerformance['seasonProjection'] {
  const month = today.getUTCMonth() + 1      // 1..12
  const year  = today.getUTCFullYear()
  const quarter = Math.floor((month - 1) / 3) + 1
  const qStartMonth = (quarter - 1) * 3 + 1
  const qEndMonth   = qStartMonth + 2

  const monthsRealized  = month - qStartMonth + 1   // 含當月
  const monthsRemaining = qEndMonth - month

  // trend 最後 monthsRealized 個就是本季已過月份
  const realizedBonuses = trend.slice(-monthsRealized).map(t => t.bonus)
  const realized = realizedBonuses.reduce((s, x) => s + x, 0)
  const avgPerMonth = realizedBonuses.length > 0 ? realized / realizedBonuses.length : 0
  const projected = avgPerMonth * monthsRemaining
  const total = realized + projected

  return {
    quarterLabel: `Q${quarter} ${year}（${qStartMonth}-${qEndMonth}月）`,
    realized, projected, total,
    monthsRealized, monthsRemaining,
  }
}


// ── 9.6 AI 建議文字（模板）────────────────────────────────────

interface _InsightContext {
  hotZoneSessionRate: number
  collectionRate: number
  giftRatio: number
  coefHotZone: number
  coefCollection: number
  coefGift: number
  baseCommission: number
}

function _composeInsight(venueName: string, ctx: _InsightContext): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const dollar = (x: number) => `$${Math.round(x).toLocaleString()}`

  // 找最弱（缺口最大）的一項給建議
  const items = [
    { name: 'hotZone',    deficit: _COEF_HOTZONE_MAX    - ctx.coefHotZone },
    { name: 'collection', deficit: _COEF_COLLECTION_MAX - ctx.coefCollection },
    { name: 'gift',       deficit: _COEF_GIFT_MAX       - ctx.coefGift },
  ]
  items.sort((a, b) => b.deficit - a.deficit)
  const weakest = items[0]

  // 假設該項追到一半進步可多領多少
  const halfwayDelta = weakest.deficit / 2 * ctx.baseCommission

  if (weakest.name === 'hotZone') {
    const targetRate = Math.min(1, ctx.hotZoneSessionRate + (1 - ctx.hotZoneSessionRate) / 2)
    return `${venueName} 熱門時段場次率僅 ${pct(ctx.hotZoneSessionRate)}；若提升至 ${pct(targetRate)}，本月可額外多領約 ${dollar(halfwayDelta)}。`
  }
  if (weakest.name === 'collection') {
    const targetRate = Math.min(1, ctx.collectionRate + (1 - ctx.collectionRate) / 2)
    return `${venueName} 入帳率 ${pct(ctx.collectionRate)}，若提升至 ${pct(targetRate)}（追討未收款），本月可額外多領約 ${dollar(halfwayDelta)}。`
  }
  if (weakest.name === 'gift') {
    const targetRate = Math.max(0, ctx.giftRatio / 2)
    return `${venueName} 贈送比 ${pct(ctx.giftRatio)} 偏高拖累 K 係數；若降至 ${pct(targetRate)}，本月可額外多領約 ${dollar(halfwayDelta)}。`
  }
  return `${venueName} 各項指標表現均衡，繼續維持。`
}


// ── 9.7 過濾後的 Overview（manager 視角自動套）─────────────────

export function getPerformanceOverview(visible: string[] | 'all'): PerformanceOverview {
  const today = new Date(TODAY_STR + 'T00:00:00Z')
  const monthLabel = `${today.getUTCFullYear()} 年 ${today.getUTCMonth() + 1} 月`

  const allVenueIds = GENERATED.venues.map(v => v.id)
  const visibleIds = visible === 'all'
    ? allVenueIds
    : allVenueIds.filter(id => visible.includes(id))

  const venues = visibleIds
    .map(id => computeVenuePerformance(id))
    .filter((p): p is VenuePerformance => p !== null)
    .sort((a, b) => b.bonus - a.bonus)

  const bonusPoolTotal = venues.reduce((s, v) => s + v.bonus, 0)

  // 比上月：trend 倒數第二格 vs 當月
  const prevPool = venues.reduce(
    (s, v) => s + (v.trend[v.trend.length - 2]?.bonus ?? 0),
    0,
  )
  const bonusPoolDeltaPct = prevPool > 0
    ? (bonusPoolTotal - prevPool) / prevPool
    : 0

  const topPerformer   = venues.length > 0 ? venues[0]                   : null
  const worstPerformer = venues.length > 0 ? venues[venues.length - 1]   : null
  const averageCoefficient = venues.length > 0
    ? venues.reduce((s, v) => s + v.coefficient, 0) / venues.length
    : 0

  return {
    monthLabel,
    venues,
    bonusPoolTotal,
    bonusPoolDeltaPct,
    topPerformer,
    worstPerformer,
    averageCoefficient,
    visibleCount: venues.length,
    isFiltered: visible !== 'all',
  }
}

