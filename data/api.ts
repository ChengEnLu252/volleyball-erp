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
  Venue, User, Customer, Session, SessionStatus, SessionType, NetHeight, Registration,
  Payment, Product, ProductTransaction, Timeslot, Season, SeasonRental,
  SeasonRentalStatus, AnomalyAlert, UnpaidRegistration,
  VenueDailySummary, DashboardData, SkillLevel,
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

/** 階段 12 新增：依 id 查 timeslot（給新增場次頁帶入預設值用） */
export function getTimeslot(id: string): Timeslot | null {
  return GENERATED.timeslots.find(t => t.id === id) ?? null
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

/**
 * VENUE_BY_SLUG_RAW — 客戶端報名頁的「公開球館資料」對照。
 *
 * 階段 12 擴充：加 `lineOfficialUrl` 與 `brandSubtitle`。
 * 七個 LINE 官方帳號連結為館主提供的真實連結。
 *
 * slug 設計：未來 prod 子網域化只要把 host (`ace2.0.volleyops.tw`) 
 * 在 middleware 反查回 slug 即可，頁面層完全不動。
 */
const VENUE_BY_SLUG_RAW: Record<string, {
  id: string
  name: string
  brandSubtitle: string
  address: string
  phone: string
  transferInfo: string
  lineOfficialUrl: string
}> = {
  flywing:    { id: 'v3', name: '飛翼排球館',       brandSubtitle: 'Flywing Volleyball',  address: '新北市新莊區新北大道四段182-2號',       phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx 飛翼體育',   lineOfficialUrl: 'https://lin.ee/OUyU1V8' },
  'ace2.0':   { id: 'v2', name: 'Ace 2.0 排球館',   brandSubtitle: 'Ace 2.0 Linkou',      address: '新北市林口區中北二街2-1號',             phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx Ace 體育',   lineOfficialUrl: 'https://lin.ee/WoQsNoH' },
  'ace3.0':   { id: 'v7', name: 'Ace 3.0 排球館',   brandSubtitle: 'Ace 3.0 Zhonghe',     address: '新北市中和區莒光路211-33號',           phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx Ace 體育',   lineOfficialUrl: 'https://line.me/R/ti/p/@347cbbmr' },
  magicblock: { id: 'v1', name: '球魔方 2.0 排球館', brandSubtitle: 'MagicBlock 2.0',      address: '新北市五股區更寮里中興路二段37巷13號', phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx 球魔方',     lineOfficialUrl: 'https://lin.ee/Z6p1ypq3' },
  hibi:       { id: 'v4', name: 'Hibi 日日排球館',  brandSubtitle: 'Hibi · Everyday',     address: '桃園市中壢區忠孝路420號',               phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx 日日體育',   lineOfficialUrl: 'https://lin.ee/Haahm4QM' },
  playone:    { id: 'v5', name: 'play one 排球館',  brandSubtitle: 'play one',            address: '桃園市八德區巧克力街16-1號',             phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx play one',   lineOfficialUrl: 'https://lin.ee/7ZXoZoP6' },
  smash:      { id: 'v6', name: '就醬瘋排球館',     brandSubtitle: 'Smash & Crazy',       address: '新竹市東區科園里園區二路221-2號',       phone: '', transferInfo: '玉山銀行 808-xxxx-xxxxxx 就醬瘋',     lineOfficialUrl: 'https://lin.ee/I9ghtiC' },
}

export type PublicVenueInfo = typeof VENUE_BY_SLUG_RAW[string]

/** 取所有公開館（給後台「報名管理」用館切換器消費） */
export function listPublicVenues(): Array<PublicVenueInfo & { slug: string }> {
  return Object.entries(VENUE_BY_SLUG_RAW).map(([slug, info]) => ({ slug, ...info }))
}

/** 反查 slug from venueId（後台「點開報名頁」連結用） */
export function getSlugByVenueId(venueId: string): string | null {
  const entry = Object.entries(VENUE_BY_SLUG_RAW).find(([, info]) => info.id === venueId)
  return entry ? entry[0] : null
}

export function getVenueBySlug(slug: string): PublicVenueInfo | null {
  return VENUE_BY_SLUG_RAW[slug] ?? null
}

// ----------------------------------------------------------------
// 階段 12 重寫：PublicSession 改從 GENERATED.sessions 動態推導
// ----------------------------------------------------------------
// 階段 10 之前是 5 筆 PUBLIC_SESSIONS_RAW 寫死。
// 階段 12 報名頁要顯示「未來 60 天 × 7 館 ~1500 場」，寫死不可能；
// 改用 derive 函式：拿底層 Session、過濾未來/open/非主揪、附 currentCount。
//
// 設計選擇：
//   1. price 拆成 courtFee + acFee 兩個欄位，UI 自己決定顯示「$280 + $50 冷氣」
//      (依館主指示)，不再給單一 price 欄。
//   2. hasAircon = 「這場有設冷氣可開」（acFee > 0），
//      acEnabled = 「這場館長已決定要開」(底層 Session.acEnabled)。
//   3. currentCount 即時從 registrations 算（filter status !== 'cancelled'）。
//   4. status 由底層 Session.status + 容量比對推導：
//      - 底層 cancelled → 'cancelled'
//      - 容量已滿 → 'full'
//      - 否則 → 'open'
//   5. 不過濾「歷史日期」— 那個交給呼叫端 (listSessionsByVenueAndDate)。

export interface PublicSession {
  id: string
  venueId: string
  sessionDate: string
  startTime: string
  endTime: string
  sessionType: string
  netHeight: string
  /** 球費（基本場費，不含冷氣） */
  courtFee: number
  /** 冷氣費（每人加收；0 = 此場沒設冷氣） */
  acFee: number
  /** 這場館長是否已決定開冷氣 */
  acEnabled: boolean
  /** 這場「有冷氣可開」（acFee > 0） */
  hasAircon: boolean
  maxCapacity: number
  currentCount: number
  minSkillRequired: string | null
  maxSkillAllowed: string | null
  status: 'open' | 'full' | 'cancelled'
  notes: string | null
  /** 場地（旗艦館「A 場 / B 場」、其他館為 null） */
  court: string | null
}

/** 內部 helper：把底層 Session 轉為 PublicSession shape */
function toPublicSession(session: typeof GENERATED.sessions[number]): PublicSession {
  const currentCount = GENERATED.registrations.filter(
    r => r.sessionId === session.id && r.status !== 'cancelled'
  ).length
  let status: PublicSession['status']
  if (session.status === 'cancelled') status = 'cancelled'
  else if (currentCount >= session.maxCapacity) status = 'full'
  else status = 'open'
  return {
    id: session.id,
    venueId: session.venueId,
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    sessionType: session.sessionType,
    netHeight: session.netHeight,
    courtFee: session.courtFee,
    acFee: session.acFee,
    acEnabled: session.acEnabled,
    hasAircon: session.acFee > 0,
    maxCapacity: session.maxCapacity,
    currentCount,
    minSkillRequired: session.minSkillRequired,
    maxSkillAllowed: session.maxSkillAllowed,
    status,
    notes: session.notes,
    court: session.court,
  }
}

/**
 * 全館（或指定館）的公開場次清單。
 * 預設僅取「今日起未來 60 天」+「非主揪場」+「非取消」。
 */
export function listPublicSessions(venueId?: string): PublicSession[] {
  const today = TODAY_STR
  const horizon = dateAddDays(today, 60)
  return GENERATED.sessions
    .filter(s => (venueId ? s.venueId === venueId : true))
    .filter(s => s.sessionDate >= today && s.sessionDate <= horizon)
    .filter(s => s.seasonRentalId === null)        // 主揪場不在公開報名
    .filter(s => s.status !== 'cancelled')
    .map(toPublicSession)
    .sort((a, b) => (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime))
}

export function getPublicSession(id: string): PublicSession | null {
  const session = GENERATED.sessions.find(s => s.id === id)
  return session ? toPublicSession(session) : null
}

/**
 * 指定館 + 指定日期的場次（報名頁「選日期 → 看當日場次」用）。
 * 不過濾主揪場吗？— 過濾。客人看不到主揪場。
 */
export function listSessionsByVenueAndDate(venueId: string, date: string): PublicSession[] {
  return GENERATED.sessions
    .filter(s => s.venueId === venueId && s.sessionDate === date)
    .filter(s => s.seasonRentalId === null)
    .filter(s => s.status !== 'cancelled')
    .map(toPublicSession)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/**
 * 指定館「未來 N 天內有場次的日期」+ 該日場次數 / 缺額總數。
 * 給月曆「哪天有場次、還剩多少缺額」用。
 */
export function listBookingDatesWithSessions(
  venueId: string,
  fromDate: string,
  days: number,
): Array<{ date: string; sessionCount: number; openSessionCount: number; remainingSeats: number }> {
  const toDate = dateAddDays(fromDate, days)
  const byDate = new Map<string, { sessionCount: number; openSessionCount: number; remainingSeats: number }>()
  for (const s of GENERATED.sessions) {
    if (s.venueId !== venueId) continue
    if (s.sessionDate < fromDate || s.sessionDate > toDate) continue
    if (s.seasonRentalId !== null) continue
    if (s.status === 'cancelled') continue
    const currentCount = GENERATED.registrations.filter(
      r => r.sessionId === s.id && r.status !== 'cancelled'
    ).length
    const remaining = Math.max(0, s.maxCapacity - currentCount)
    const entry = byDate.get(s.sessionDate) ?? { sessionCount: 0, openSessionCount: 0, remainingSeats: 0 }
    entry.sessionCount += 1
    if (remaining > 0) entry.openSessionCount += 1
    entry.remainingSeats += remaining
    byDate.set(s.sessionDate, entry)
  }
  return Array.from(byDate.entries())
    .map(([date, info]) => ({ date, ...info }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 後台「報名管理」用：給定館，未來 N 天的「按日 × 場次」彙整。
 */
export function getVenueBookingOverview(venueId: string, days: number = 14): {
  totalSessions: number
  totalRegistrations: number
  totalRemainingSeats: number
  totalCapacity: number
  byDate: Array<{ date: string; sessions: PublicSession[] }>
} {
  const today = TODAY_STR
  const toDate = dateAddDays(today, days)
  const sessions = GENERATED.sessions
    .filter(s => s.venueId === venueId)
    .filter(s => s.sessionDate >= today && s.sessionDate <= toDate)
    .filter(s => s.seasonRentalId === null)
    .filter(s => s.status !== 'cancelled')
    .map(toPublicSession)
    .sort((a, b) => (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime))
  let totalRegistrations = 0
  let totalCapacity = 0
  const byDateMap = new Map<string, PublicSession[]>()
  for (const s of sessions) {
    totalRegistrations += s.currentCount
    totalCapacity += s.maxCapacity
    const arr = byDateMap.get(s.sessionDate) ?? []
    arr.push(s)
    byDateMap.set(s.sessionDate, arr)
  }
  return {
    totalSessions: sessions.length,
    totalRegistrations,
    totalRemainingSeats: Math.max(0, totalCapacity - totalRegistrations),
    totalCapacity,
    byDate: Array.from(byDateMap.entries()).map(([date, list]) => ({ date, sessions: list })),
  }
}

// 包場時段預覽（給未來有 v3 飛翼包場展示用，與報名場無關）
const _NEXT_WEEK_R = dateAddDays(TODAY_STR, 7)
const _TWO_WEEKS_R = dateAddDays(TODAY_STR, 14)

const RENTAL_SLOTS_RAW = [
  { id: 'r1', venueId: 'v3', venueName: '飛翼排球館', date: _NEXT_WEEK_R, startTime: '09:00', endTime: '12:00', pricePerHour: 1200, totalHours: 3, totalPrice: 3600, status: 'available', notes: '可協商延長' },
  { id: 'r2', venueId: 'v3', venueName: '飛翼排球館', date: _NEXT_WEEK_R, startTime: '19:00', endTime: '22:00', pricePerHour: 1500, totalHours: 3, totalPrice: 4500, status: 'available', notes: '晚場，假日加收 $200' },
  { id: 'r3', venueId: 'v3', venueName: '飛翼排球館', date: _TWO_WEEKS_R, startTime: '09:00', endTime: '12:00', pricePerHour: 1200, totalHours: 3, totalPrice: 3600, status: 'pending',   notes: '洽談中' },
  { id: 'r4', venueId: 'v3', venueName: '飛翼排球館', date: _TWO_WEEKS_R, startTime: '15:40', endTime: '18:40', pricePerHour: 1500, totalHours: 3, totalPrice: 4500, status: 'available', notes: '假日下午場' },
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
  // 階段 12：新增場次
  addSession as storeAddSession,
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
 *
 * 階段 9：可選 `baseUpdatedAt` 樂觀鎖保護（雙開分頁、主揪 + 員工同時操作時）。
 */
export function captainMarkLeave(args: {
  rentalId: string
  registrationId: string
  baseUpdatedAt?: string
}): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.status === 'cancelled') return { ok: false, reason: '已是請假狀態' }

  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const session  = GENERATED.sessions.find(s => s.id === reg.sessionId)
  const venue    = session ? GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null : null

  // 階段 9：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(reg, args.baseUpdatedAt, {
    entityType: 'Registration',
    entityId: args.registrationId,
    actor: getCaptainActor(args.rentalId),
    venue,
    targetLabel: customer?.name ?? '?',
    attemptedPatch: { status: 'cancelled' },
  })
  if (conflict) return conflict

  const now = new Date().toISOString()
  patchRegistrationStatus(args.registrationId, 'cancelled', now)
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

/** 主揪取消請假（'cancelled' → 'registered'）
 *
 * 階段 9：可選 `baseUpdatedAt` 樂觀鎖保護。
 */
export function captainUnmarkLeave(args: {
  rentalId: string
  registrationId: string
  baseUpdatedAt?: string
}): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.status !== 'cancelled') return { ok: false, reason: '不在請假狀態' }

  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const session  = GENERATED.sessions.find(s => s.id === reg.sessionId)
  const venue    = session ? GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null : null

  // 階段 9：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(reg, args.baseUpdatedAt, {
    entityType: 'Registration',
    entityId: args.registrationId,
    actor: getCaptainActor(args.rentalId),
    venue,
    targetLabel: customer?.name ?? '?',
    attemptedPatch: { status: 'registered' },
  })
  if (conflict) return conflict

  const now = new Date().toISOString()
  patchRegistrationStatus(args.registrationId, 'registered', now)
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
  const registeredAt = new Date().toISOString()
  const newReg: Registration = {
    id: genId('reg'),
    sessionId: args.sessionId,
    customerId: newCustomer.id,
    type: regType,
    registeredBy: null,            // 主揪建立的，不對應 User
    registeredBySource: 'captain',
    status: 'registered',
    notes: null,
    registeredAt,
    updatedAt: registeredAt, // 階段 9
    selfReportedPaid: false,
    selfPaymentMethod: null,
    selfPaymentEvidence: null,
    selfReportedAt: null,
    refundDecision: null, // 階段 10：新建時無退費議題
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
export function adminRegenerateToken(
  rentalId: string,
  opts: { baseUpdatedAt?: string } = {},
): { ok: true; newToken: string } | { ok: false; reason: string } | ConflictResult {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  if (!r) return { ok: false, reason: '找不到季租單' }

  const newToken = genToken()
  // expiresAt：用 rental 對應 season 的 endDate，若找不到就延長 30 天
  const season = GENERATED.seasons.find(s => s.id === r.seasonId)
  const newExpiresAt = season
    ? `${season.endDate}T23:59:59`
    : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

  // 階段 8：樂觀鎖檢查（caller 傳 baseUpdatedAt 才啟用；不傳=強制覆蓋向後相容）
  const conflict = checkBaseUpdatedAt(r, opts.baseUpdatedAt, {
    entityType: 'SeasonRental',
    entityId: rentalId,
    actor: getAdminActor(),
    venue: r.venueName ?? null,
    targetLabel: r.captainName ?? '主揪',
    attemptedPatch: { accessToken: newToken, accessTokenExpiresAt: newExpiresAt },
  })
  if (conflict) return conflict

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
export function adminDeactivateRental(
  rentalId: string,
  opts: { baseUpdatedAt?: string } = {},
): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const r = GENERATED.seasonRentals.find(x => x.id === rentalId)
  if (!r) return { ok: false, reason: '找不到季租單' }
  if (r.status === 'cancelled') return { ok: false, reason: '此季租單已停用' }

  // 階段 8：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(r, opts.baseUpdatedAt, {
    entityType: 'SeasonRental',
    entityId: rentalId,
    actor: getAdminActor(),
    venue: r.venueName ?? null,
    targetLabel: r.captainName ?? '主揪',
    attemptedPatch: { status: 'cancelled' },
  })
  if (conflict) return conflict

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
  // 階段 7：跨館調貨 4 個 phase 都是館長動作
  // （階段 6 的 'PRODUCT_TRANSFER' 漏加進這個 Set，導致 audit page 「館長動作」
  //   filter 不會包含跨館調貨；階段 7 拆 union 時順手補上）
  'PRODUCT_TRANSFER_CREATED',
  'PRODUCT_TRANSFER_SHIPPED',
  'PRODUCT_TRANSFER_RECEIVED',
  'PRODUCT_TRANSFER_CANCELLED',
  // 階段 7 順手補：發回報提醒也是館長動作（階段 6 漏加）
  'SEND_SELF_REPORT_REMINDER',
  // 階段 8：上傳憑證 + 刪除憑證 + 衝突偵測
  // 註：'UPLOAD_EVIDENCE' 可由 captain 觸發（自助回報上傳）；
  //     此情況因 actorType='captain'，audit category 'captain' 分支會先匹配。
  //     此處列入 ADMIN_ACTIONS 是為了當 admin 用 admin 身份上傳時也可被歸類。
  'UPLOAD_EVIDENCE',
  'DELETE_EVIDENCE',
  'CONFLICT_DETECTED',
  // 階段 10：退費鏈 — 開退費 / 放棄退費，皆為 admin 動作
  // captain 端不會觸發退費；customer 端只是被告知
  'ISSUE_REFUND',
  'WAIVE_REFUND',
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
 * Demo 環境固定 REAL_USER_ID='u1'（王家凱 owner）。
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



// ════════════════════════════════════════════════════════════
// 十、無人場次自助回報（階段 5 Block A）
// ════════════════════════════════════════════════════════════
// 故事點 5（日日 v4 週一）：場次 isUnattended === true，
// 客戶在現場按「我已付款」（Registration.selfReportedPaid），
// 老闆對照「自助回報數 vs 實付筆數 vs 應到人數」抓不誠實。
// 可疑名單：在最近 60 天無人場次裡，未自助回報的次數 ≥ 3。
// ────────────────────────────────────────────────────────────

import type { PaymentMethod } from '@/types'
import {
  patchRegistrationSelfReport,
  addProductTransaction,
  addProductTransfer,
  patchProductTransfer,
  getAllTransfers,
} from './store'
// 階段 9：型別直接從 '@/types' import（不再經 store.ts re-export）
import {
  PRODUCT_TRANSFER_STATUS_LABEL,
  type ProductTransfer,
  type ProductTransferStatus,
} from '@/types'

// ── 10.1 常數 ────────────────────────────────────────────────

/** 最近多少天的場次納入統計（可疑名單也用此範圍） */
const _UNATTENDED_LOOKBACK_DAYS = 60

/** 多少次未自助回報才算「可疑客戶」（凍結，使用者決議 3）*/
const _SUSPICIOUS_UNREPORTED_THRESHOLD = 3

// ── 10.2 Interfaces ──────────────────────────────────────────

/** 一個無人場次的對照摘要 */
export interface UnattendedSessionSummary {
  sessionId: string
  venueId: string
  venueName: string
  sessionDate: string
  startTime: string
  endTime: string
  status: SessionStatus
  /** 應收（含季打 0、臨打/補位 courtFee+acFee） */
  expectedRevenue: number
  /** 實收（Payment 加總）*/
  actualRevenue: number
  /** 報名人數（不含請假） */
  registeredCount: number
  /** 季打人數（不算應付）*/
  seasonPlayerCount: number
  /** 應付人數（registered 中扣掉季打） */
  payableCount: number
  /** 已自助回報已付款的人數 */
  selfReportedCount: number
  /** 系統有實際 Payment 紀錄的人數（非季打） */
  actualPaidCount: number
  /** 自助說已付但系統無 Payment 紀錄 — 信任落差，注意 */
  reportedButNoPayCount: number
  /** 系統有 Payment 但未自助回報 — 例如館長補入帳 */
  paidButNotReportedCount: number
  /** 缺口金額 = expectedRevenue − actualRevenue */
  discrepancyAmount: number
  /** 自助回報率：selfReportedCount / payableCount */
  selfReportRate: number
}

/** Drill-down：一場無人場次的所有 Registration（含付款狀況） */
export interface UnattendedRegistrationRow {
  registrationId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  registrationType: 'season_player' | 'season_substitute' | 'walk_in'
  isPayable: boolean
  expectedAmount: number
  selfReportedPaid: boolean
  selfPaymentMethod: PaymentMethod | null
  selfPaymentEvidence: string | null
  selfReportedAt: string | null
  hasActualPayment: boolean
  actualPaidAmount: number
  /** 信任落差 flag：自助說付但實際無 Payment */
  reportedNoPay: boolean
  /** 已付但未回報：館長 / 工讀生補登 */
  paidNotReported: boolean
}

/** 可疑客戶（在最近無人場次未回報 ≥ 3 次） */
export interface SuspiciousCustomer {
  customerId: string
  customerName: string
  customerPhone: string | null
  /** 在 lookback 期間出席的無人場次數（不含請假，扣掉季打）*/
  unattendedRegistrationsCount: number
  /** 自助回報過幾次 */
  selfReportedCount: number
  /** 未自助回報的次數（核心指標）*/
  unreportedCount: number
  /** 累積應付未自助回報的金額 */
  totalOwedFromUnreported: number
  /** 最近未回報的場次日期（最多 5）*/
  recentUnreportedDates: string[]
  /** 主要去的館 venueId（影響 manager 視角過濾） */
  primaryVenueId: string
  primaryVenueName: string
}

/** /reconciliation/unattended 主頁 overview */
export interface UnattendedReportOverview {
  /** 已 hook 進 visible 過濾後的場次列表 */
  sessions: UnattendedSessionSummary[]
  /** lookback 內所有場次的應收總額 */
  totalExpected: number
  /** lookback 內所有場次的實收總額 */
  totalActual: number
  /** 總缺口 */
  totalDiscrepancy: number
  /** 自助回報整體比例 */
  overallSelfReportRate: number
  /** 信任落差總人次（自助說付但系統無 Payment） */
  trustGapCount: number
  /** 可疑客戶列表（已按 visible 過濾） */
  suspiciousCustomers: SuspiciousCustomer[]
  /** lookback 天數 */
  lookbackDays: number
  /** 可疑門檻次數 */
  suspiciousThreshold: number
  /** 是否被 visible 過濾 */
  isFiltered: boolean
}

// ── 10.3 內部 helper ─────────────────────────────────────────

function _isUnattendedPayable(reg: Registration): boolean {
  return reg.type !== 'season_player' && reg.status !== 'cancelled'
}

function _withinLookback(sessionDate: string): boolean {
  const cutoff = dateAddDays(TODAY_STR, -_UNATTENDED_LOOKBACK_DAYS)
  return sessionDate >= cutoff && sessionDate <= TODAY_STR
}

function _buildUnattendedSessionSummary(session: Session): UnattendedSessionSummary {
  const venue = GENERATED.venues.find(v => v.id === session.venueId)
  const regs = GENERATED.registrations.filter(r => r.sessionId === session.id && r.status !== 'cancelled')
  const payableRegs = regs.filter(r => r.type !== 'season_player')
  const seasonRegs  = regs.filter(r => r.type === 'season_player')

  let actualRevenue = 0
  let actualPaidCount = 0
  let reportedButNoPayCount = 0
  let paidButNotReportedCount = 0
  for (const r of payableRegs) {
    const pays = GENERATED.payments.filter(p => p.registrationId === r.id && p.status === 'paid')
    const paidAmount = pays.reduce((s, p) => s + p.amount, 0)
    const hasPay = pays.length > 0
    actualRevenue += paidAmount
    if (hasPay) actualPaidCount++
    if (r.selfReportedPaid && !hasPay) reportedButNoPayCount++
    if (!r.selfReportedPaid && hasPay) paidButNotReportedCount++
  }

  const expectedRevenue = payableRegs.reduce((s, r) => s + (r.expectedAmount ?? 0), 0)
  const selfReportedCount = payableRegs.filter(r => r.selfReportedPaid).length
  const selfReportRate = payableRegs.length > 0 ? selfReportedCount / payableRegs.length : 0

  return {
    sessionId: session.id,
    venueId: session.venueId,
    venueName: venue?.name ?? '?',
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    expectedRevenue,
    actualRevenue,
    registeredCount: regs.length,
    seasonPlayerCount: seasonRegs.length,
    payableCount: payableRegs.length,
    selfReportedCount,
    actualPaidCount,
    reportedButNoPayCount,
    paidButNotReportedCount,
    discrepancyAmount: expectedRevenue - actualRevenue,
    selfReportRate,
  }
}

// ── 10.4 公開查詢 ────────────────────────────────────────────

/** 列出 lookback 內所有無人場次（依日期新→舊），可選 visible 過濾 */
export function listUnattendedSessionSummaries(
  visible: string[] | 'all' = 'all',
): UnattendedSessionSummary[] {
  const ids = visible === 'all' ? null : new Set(visible)
  return GENERATED.sessions
    .filter(s => s.isUnattended)
    .filter(s => _withinLookback(s.sessionDate))
    .filter(s => !ids || ids.has(s.venueId))
    .map(_buildUnattendedSessionSummary)
    .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : a.sessionDate > b.sessionDate ? -1 : a.startTime < b.startTime ? 1 : -1))
}

/** Drill-down：取得一場無人場次的所有 Registration 行（含對照） */
export function getUnattendedSessionDetail(sessionId: string): {
  summary: UnattendedSessionSummary
  rows: UnattendedRegistrationRow[]
} | null {
  const session = GENERATED.sessions.find(s => s.id === sessionId)
  if (!session || !session.isUnattended) return null

  const summary = _buildUnattendedSessionSummary(session)
  const regs = GENERATED.registrations.filter(r => r.sessionId === sessionId && r.status !== 'cancelled')

  const rows: UnattendedRegistrationRow[] = regs.map(r => {
    const cust = GENERATED.customers.find(c => c.id === r.customerId)
    const isPayable = r.type !== 'season_player'
    const pays = isPayable
      ? GENERATED.payments.filter(p => p.registrationId === r.id && p.status === 'paid')
      : []
    const hasActualPayment = pays.length > 0
    const actualPaidAmount = pays.reduce((s, p) => s + p.amount, 0)
    return {
      registrationId: r.id,
      customerId: r.customerId,
      customerName: cust?.name ?? '?',
      customerPhone: cust?.phone ?? null,
      registrationType: r.type as 'season_player' | 'season_substitute' | 'walk_in',
      isPayable,
      expectedAmount: r.expectedAmount ?? 0,
      selfReportedPaid: r.selfReportedPaid,
      selfPaymentMethod: r.selfPaymentMethod,
      selfPaymentEvidence: r.selfPaymentEvidence,
      selfReportedAt: r.selfReportedAt,
      hasActualPayment,
      actualPaidAmount,
      reportedNoPay: r.selfReportedPaid && !hasActualPayment && isPayable,
      paidNotReported: !r.selfReportedPaid && hasActualPayment && isPayable,
    }
  })

  // 把實付者排前面，未付者排後面便於老闆掃描
  rows.sort((a, b) => {
    if (a.hasActualPayment !== b.hasActualPayment) return a.hasActualPayment ? -1 : 1
    if (a.selfReportedPaid !== b.selfReportedPaid) return a.selfReportedPaid ? -1 : 1
    return a.customerName.localeCompare(b.customerName, 'zh-Hant')
  })

  return { summary, rows }
}

/** 列出可疑客戶（依 visible 過濾） */
export function listSuspiciousCustomers(
  visible: string[] | 'all' = 'all',
): SuspiciousCustomer[] {
  const ids = visible === 'all' ? null : new Set(visible)

  // 找出 lookback 期間所有「應付且無人場次的報名」
  const unattendedSessionIds = new Set(
    GENERATED.sessions
      .filter(s => s.isUnattended && _withinLookback(s.sessionDate))
      .filter(s => !ids || ids.has(s.venueId))
      .map(s => s.id),
  )

  // 按客戶 group
  const byCustomer: Record<string, {
    customerId: string
    rows: { reg: Registration; session: Session }[]
  }> = {}

  for (const r of GENERATED.registrations) {
    if (!unattendedSessionIds.has(r.sessionId)) continue
    if (!_isUnattendedPayable(r)) continue
    const session = GENERATED.sessions.find(s => s.id === r.sessionId)
    if (!session) continue
    if (!byCustomer[r.customerId]) {
      byCustomer[r.customerId] = { customerId: r.customerId, rows: [] }
    }
    byCustomer[r.customerId].rows.push({ reg: r, session })
  }

  const result: SuspiciousCustomer[] = []

  for (const { customerId, rows } of Object.values(byCustomer)) {
    const unreported = rows.filter(x => !x.reg.selfReportedPaid)
    if (unreported.length < _SUSPICIOUS_UNREPORTED_THRESHOLD) continue

    const cust = GENERATED.customers.find(c => c.id === customerId)
    if (!cust) continue

    // 推主要去的館（出現最多次的 venue）
    const venueCount: Record<string, number> = {}
    for (const { session } of rows) {
      venueCount[session.venueId] = (venueCount[session.venueId] ?? 0) + 1
    }
    const primaryVenueId = Object.entries(venueCount).sort((a, b) => b[1] - a[1])[0][0]
    const primaryVenue = GENERATED.venues.find(v => v.id === primaryVenueId)

    const totalOwed = unreported.reduce((s, x) => s + (x.reg.expectedAmount ?? 0), 0)
    const recentDates = unreported
      .map(x => x.session.sessionDate)
      .sort()
      .reverse()
      .slice(0, 5)

    result.push({
      customerId,
      customerName: cust.name,
      customerPhone: cust.phone,
      unattendedRegistrationsCount: rows.length,
      selfReportedCount: rows.length - unreported.length,
      unreportedCount: unreported.length,
      totalOwedFromUnreported: totalOwed,
      recentUnreportedDates: recentDates,
      primaryVenueId,
      primaryVenueName: primaryVenue?.name ?? '?',
    })
  }

  return result.sort((a, b) =>
    b.unreportedCount - a.unreportedCount
    || b.totalOwedFromUnreported - a.totalOwedFromUnreported,
  )
}

/** 取得整個 /reconciliation/unattended 頁所需的 overview */
export function getUnattendedReportOverview(
  visible: string[] | 'all' = 'all',
): UnattendedReportOverview {
  const sessions = listUnattendedSessionSummaries(visible)
  const totalExpected = sessions.reduce((s, x) => s + x.expectedRevenue, 0)
  const totalActual   = sessions.reduce((s, x) => s + x.actualRevenue,   0)
  const totalPayable  = sessions.reduce((s, x) => s + x.payableCount, 0)
  const totalReported = sessions.reduce((s, x) => s + x.selfReportedCount, 0)
  const trustGapCount = sessions.reduce((s, x) => s + x.reportedButNoPayCount, 0)
  const suspicious = listSuspiciousCustomers(visible)

  return {
    sessions,
    totalExpected,
    totalActual,
    totalDiscrepancy: totalExpected - totalActual,
    overallSelfReportRate: totalPayable > 0 ? totalReported / totalPayable : 0,
    trustGapCount,
    suspiciousCustomers: suspicious,
    lookbackDays: _UNATTENDED_LOOKBACK_DAYS,
    suspiciousThreshold: _SUSPICIOUS_UNREPORTED_THRESHOLD,
    isFiltered: visible !== 'all',
  }
}

// ── 10.5 Mutations ───────────────────────────────────────────

/**
 * 客戶在無人場次按「我已付款」。
 *
 * 入口設計：QR code → `/self-checkin/[sessionId]` 公開頁，
 *   無需登入、無需 token（demo 階段；production 應加電話末 4 碼驗證）。
 *
 * 寫入：
 *   - Registration.selfReportedPaid = true
 *   - Registration.selfPaymentMethod = method
 *   - Registration.selfPaymentEvidence = evidence ?? null
 *   - Registration.selfReportedAt = now
 *   - AuditLog: action='SELF_PAYMENT_REPORT', actorType='captain', actor.name=客戶姓名
 *
 * **不**自動產生 Payment — 「自助回報」≠「實收」，
 * 老闆對照頁要看的就是兩者差距（信任落差）。
 */
export function customerReportSelfPayment(args: {
  sessionId: string
  registrationId: string
  method: PaymentMethod
  evidence?: string | null
  /** 階段 9：樂觀鎖 baseUpdatedAt（caller 在頁面載入 Registration 時記下的 reg.updatedAt） */
  baseUpdatedAt?: string
}): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }
  if (reg.sessionId !== args.sessionId) return { ok: false, reason: '報名與場次不符' }
  if (reg.status === 'cancelled') return { ok: false, reason: '此報名已請假，無需付款' }
  if (reg.type === 'season_player') return { ok: false, reason: '季打人員無需另外付款' }
  if (reg.selfReportedPaid) return { ok: false, reason: '已回報過' }

  const session = GENERATED.sessions.find(s => s.id === args.sessionId)
  if (!session) return { ok: false, reason: '找不到場次' }
  if (!session.isUnattended) return { ok: false, reason: '此場非無人場次' }

  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const venueName = GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null

  // 階段 9：樂觀鎖檢查（self-checkin 雙開、館長同步補入帳等場景）
  // actor 用 captain（與本 mutation 主路徑一致）
  const captainActor: AuditActor = {
    type: 'captain',
    id: reg.id,
    name: customer?.name ?? '客戶自助',
  }
  const conflict = checkBaseUpdatedAt(reg, args.baseUpdatedAt, {
    entityType: 'Registration',
    entityId: args.registrationId,
    actor: captainActor,
    venue: venueName,
    targetLabel: customer?.name ?? '?',
    attemptedPatch: {
      selfReportedPaid: true,
      selfPaymentMethod: args.method,
      selfPaymentEvidence: args.evidence ?? null,
    },
  })
  if (conflict) return conflict

  const reportedAt = new Date().toISOString()

  patchRegistrationSelfReport(args.registrationId, {
    selfReportedPaid: true,
    selfPaymentMethod: args.method,
    selfPaymentEvidence: args.evidence ?? null,
    selfReportedAt: reportedAt,
    // 階段 9：bump updatedAt（reportedAt 即 mutation 時序）
    updatedAt: reportedAt,
  })

  // actorType='captain' 是已存在的 AuditActorType union 之一，
  // 涵蓋「對外端非登入身份」(主揪 + 客戶自助 + 自助訂場等)。
  // entity id 用 registration id 保證可定位回該客戶該場次。
  writeAudit({
    actor: captainActor,
    venue: venueName,
    action: 'SELF_PAYMENT_REPORT',
    entityType: 'Registration',
    entityId: args.registrationId,
    targetLabel: customer?.name ?? '?',
    detail: `${session.sessionDate} ${session.startTime} 自助回報已付款（${args.method}）`,
    newValues: {
      selfReportedPaid: true,
      selfPaymentMethod: args.method,
      selfPaymentEvidence: args.evidence ?? null,
    },
  })

  return { ok: true }
}

/**
 * 取得 self-checkin 公開頁所需的資料。
 *
 * Public — 無需登入、無需 token。
 * 回傳該無人場次的所有應付 Registration（不顯示季打人員）。
 */
export interface SelfCheckinSessionData {
  sessionId: string
  venueId: string
  venueName: string
  sessionDate: string
  startTime: string
  endTime: string
  courtFee: number
  acFee: number
  acEnabled: boolean
  totalAmount: number
  status: SessionStatus
  /** 一行 = 一個應付客戶；季打人員不出現在此 */
  payableRegistrations: {
    registrationId: string
    customerId: string
    customerName: string
    customerPhoneMasked: string  // 0911-***-789 隱私
    expectedAmount: number
    selfReportedPaid: boolean
    selfPaymentMethod: PaymentMethod | null
    selfReportedAt: string | null
    /** 階段 9：用於樂觀鎖 baseUpdatedAt 的 snapshot */
    updatedAt: string
  }[]
}

export function getSelfCheckinSessionData(sessionId: string): SelfCheckinSessionData | null {
  const session = GENERATED.sessions.find(s => s.id === sessionId)
  if (!session) return null
  if (!session.isUnattended) return null

  const venue = GENERATED.venues.find(v => v.id === session.venueId)
  const regs = GENERATED.registrations.filter(
    r => r.sessionId === sessionId && r.status !== 'cancelled' && r.type !== 'season_player',
  )

  return {
    sessionId: session.id,
    venueId: session.venueId,
    venueName: venue?.name ?? '?',
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    courtFee: session.courtFee,
    acFee: session.acFee,
    acEnabled: session.acEnabled,
    totalAmount: session.courtFee + (session.acEnabled ? session.acFee : 0),
    status: session.status,
    payableRegistrations: regs.map(r => {
      const cust = GENERATED.customers.find(c => c.id === r.customerId)
      const phone = cust?.phone ?? ''
      const masked = phone
        ? phone.slice(0, 4) + '-***-' + phone.slice(-3)
        : '（未提供）'
      return {
        registrationId: r.id,
        customerId: r.customerId,
        customerName: cust?.name ?? '?',
        customerPhoneMasked: masked,
        expectedAmount: r.expectedAmount ?? 0,
        selfReportedPaid: r.selfReportedPaid,
        selfPaymentMethod: r.selfPaymentMethod,
        selfReportedAt: r.selfReportedAt,
        updatedAt: r.updatedAt, // 階段 9
      }
    }),
  }
}

/**
 * 找到最近一場日日 v4 的無人場次 — 給老闆 demo 跳轉用。
 *
 * 老闆切到 /reconciliation/unattended 看到「Hibi 日日 5/11 12:20」缺口 → 
 *   點該場 → 取得該 sessionId → 在新分頁開 /self-checkin/<sessionId> 模擬客戶
 *   → 按下「我已付款」 → 回管理頁看信任落差 +1
 *
 * 偏好「最近過去」場次（在 lookback 內），這樣自助回報會立即出現在統計裡。
 * 沒過去場次時退到最近未來場次。
 */
export function getLatestUnattendedSessionForDemo(venueId?: string): string | null {
  const all = GENERATED.sessions
    .filter(s => s.isUnattended)
    .filter(s => !venueId || s.venueId === venueId)

  // 優先：在 lookback 內、未來找最近的「過去場次」
  const inLookback = all
    .filter(s => _withinLookback(s.sessionDate))
    .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : a.sessionDate > b.sessionDate ? -1 : 0))
  if (inLookback.length > 0) return inLookback[0].id

  // 沒過去場次：退回找最近未來場次
  const future = all
    .filter(s => s.sessionDate > TODAY_STR)
    .sort((a, b) => (a.sessionDate < b.sessionDate ? -1 : 1))
  return future[0]?.id ?? all[0]?.id ?? null
}

/**
 * 老闆 / 館長：對某可疑客戶「一鍵發備註提醒」。
 *
 * Demo 用：不真的發簡訊，只寫一筆 AuditLog 紀錄「曾提醒過」。
 * 同一客戶反覆呼叫會疊多筆 — 老闆要自己控管。
 *
 * Audit action 用字串 'SEND_SELF_REPORT_REMINDER' cast 進 AuditAction
 *   （types/index.ts 凍結，無法在 union 加新 literal）。
 *   未來解凍 types 時應補進 AuditAction union。
 */
export function sendSelfReportReminder(args: {
  customerId: string
  /** 場次 id（可選）— 提醒涉及哪一場 */
  sessionId?: string
  /** 提醒文字（demo 顯示用） */
  message?: string
}): { ok: true; logId: string } | { ok: false; reason: string } {
  const customer = GENERATED.customers.find(c => c.id === args.customerId)
  if (!customer) return { ok: false, reason: '找不到客戶' }

  const session = args.sessionId
    ? GENERATED.sessions.find(s => s.id === args.sessionId)
    : null
  const venueName = session
    ? GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null
    : null

  const detail = args.message
    ?? (session
      ? `傳送自助回報提醒給 ${customer.name}（${session.sessionDate}）`
      : `傳送自助回報提醒給 ${customer.name}`)

  // 取出最近一筆 audit id 之前先記憶當前 length（簡化：自己 gen）
  const logId = genId('audit')
  appendAuditLog({
    id: logId,
    userId: getCurrentUserId(),
    action: 'SEND_SELF_REPORT_REMINDER',
    entityType: 'Customer',
    entityId: args.customerId,
    oldValues: null,
    newValues: { sessionId: args.sessionId ?? null, customerPhone: customer.phone },
    ipAddress: null,
    createdAt: new Date().toISOString(),
    userName: getAdminActor().name,
    actorType: 'user' as AuditActorType,
    actorName: getAdminActor().name,
    venue: venueName,
    targetLabel: customer.name,
    detail,
  })

  return { ok: true, logId }
}

// ── 10.6 Re-export for Block B/C ─────────────────────────────
// 階段 6 起讓 page 只 import @/data/api 即可拿到 transfer 相關工具。
// 階段 9 清理：移除 _s5 別名與 _stage5InternalRefs placeholder；型別直接從
// '@/types' import 並 re-export（pages 仍透過 '@/data/api' 拿）。

export type { ProductTransfer, ProductTransferStatus } from '@/types'
export { PRODUCT_TRANSFER_STATUS_LABEL } from '@/types'



// ════════════════════════════════════════════════════════════
// 十一、誠實商店投錢箱對帳（階段 5 Block B）
// ════════════════════════════════════════════════════════════
// 故事點 5 延伸：誠實商店 = 客戶自助拿商品、自助投錢。
// 偵測：（1）盤點缺口（manual 觸發）（2）匿名銷售比例（自動）
//      （3）庫存 vs 銷售一致性（自動）
//
// 識別誠實商店商品：透過 Product.isHonestShop 欄位（階段 6 解凍 types 後新增），
// 全館適用。目前包含：p1 運動飲料 ($35) — 各館入口投錢箱皆有。
// ────────────────────────────────────────────────────────────

import {
  addBoxAudit,
  getAllBoxAudits,
} from './store'
import type { BoxAuditRecord } from '@/types'

// ── 11.1 常數 / Helpers ──────────────────────────────────────

/**
 * 取得「誠實商店」商品 id 集合 — 從 GENERATED.products 動態篩 isHonestShop=true。
 *
 * 階段 6 之前：寫死 `new Set(['p1'])`（types 凍結，Product 沒 isHonestShop 欄位）。
 * 階段 6 解凍 types 後：直接由欄位決定，未來 generator 加新 honest-shop 商品自動納入。
 *
 * 注意：每次呼叫都會重新走一遍 products 陣列。如有性能疑慮，
 *      caller 端可快取結果（products 陣列在 demo 期間不會新增 / 刪除）。
 */
export function getHonestShopProductIds(): Set<string> {
  return new Set(
    GENERATED.products
      .filter(p => p.isHonestShop === true)
      .map(p => p.id),
  )
}

/** 單一商品是否為誠實商店商品 */
export function isHonestShopProduct(productId: string): boolean {
  const p = GENERATED.products.find(p => p.id === productId)
  return p?.isHonestShop === true
}

/** 最近多少天的銷售納入帳面計算 */
const _HONEST_SHOP_LOOKBACK_DAYS = 30

/** 匿名銷售比例多少以上視為可疑（缺乏問責追蹤） */
const _HIGH_ANONYMOUS_RATIO_THRESHOLD = 0.6

/** 盤點缺口超過多少元視為顯著差異（顯示紅標） */
const _SIGNIFICANT_DISCREPANCY_AMOUNT = 100

// ── 11.2 Interfaces ──────────────────────────────────────────

/** 某 venue × honest product 的對帳概況 */
export interface HonestShopVenueProductSummary {
  venueId: string
  venueName: string
  productId: string
  productName: string
  unitPrice: number
  /** 當前庫存 */
  currentStock: number
  /** 低庫存門檻 */
  lowStockThreshold: number
  /** 期間內 sale 筆數 */
  saleCount: number
  /** 期間內銷售總量（罐數） */
  totalSoldQty: number
  /** 期間內帳面銷售總額 */
  totalRevenue: number
  /** 期間內贈送量 */
  giftedQty: number
  /** 期間內匿名銷售筆數（customerId = null） */
  anonymousSaleCount: number
  /** 匿名比例 */
  anonymousRatio: number
  /** 最近一次盤點記錄（無則 null） */
  lastAudit: BoxAuditRecord | null
  /** 此 venue × product 累積發現缺口（歷次 audit 加總） */
  cumulativeDiscrepancy: number
  /** 是否異常（匿名過高 或 累積缺口顯著） */
  isFlagged: boolean
}

/** 投錢箱盤點記錄（階段 9：直接從 '@/types' re-export，不再走 _s5 alias）*/
export type { BoxAuditRecord } from '@/types'

/** /reconciliation/honest-shop 主頁 overview */
export interface HonestShopOverview {
  /** 各 venue × honest product 概況 */
  rows: HonestShopVenueProductSummary[]
  /** 期間帳面銷售總額 */
  totalRevenue: number
  /** 累積發現缺口（歷次盤點加總） */
  totalDiscrepancy: number
  /** 已盤點次數 */
  auditCount: number
  /** 平均誠實率（sum counted / sum expected, 僅算有盤點記錄者） */
  averageHonestyRate: number
  /** 異常旗標數 */
  flaggedCount: number
  /** lookback 天數 */
  lookbackDays: number
  /** 匿名比例門檻 */
  anonymousRatioThreshold: number
  /** 是否被 visible 過濾 */
  isFiltered: boolean
}

// ── 11.3 內部 helper ─────────────────────────────────────────

function _honestShopLookbackStart(): string {
  return dateAddDays(TODAY_STR, -_HONEST_SHOP_LOOKBACK_DAYS)
}

function _buildVenueProductSummary(
  venueId: string,
  productId: string,
): HonestShopVenueProductSummary {
  const venue   = GENERATED.venues.find(v => v.id === venueId)
  const product = GENERATED.products.find(p => p.id === productId)
  const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === venueId)
  const vp      = vpEntry?.products.find(p => p.name === product?.name)

  const lookbackStartIso = _honestShopLookbackStart() + 'T00:00:00Z'
  const txs = GENERATED.productTransactions.filter(t =>
    t.venueId === venueId
    && t.productId === productId
    && t.operatedAt >= lookbackStartIso,
  )
  const sales = txs.filter(t => t.type === 'sale')
  const gifts = txs.filter(t => t.type === 'gift')

  const totalSoldQty   = sales.reduce((s, t) => s + Math.abs(t.quantity), 0)
  const totalRevenue   = sales.reduce((s, t) => s + (t.totalAmount ?? 0), 0)
  const giftedQty      = gifts.reduce((s, t) => s + Math.abs(t.quantity), 0)
  const anonymousSaleCount = sales.filter(t => !t.customerId).length
  const anonymousRatio = sales.length > 0 ? anonymousSaleCount / sales.length : 0

  const audits = getAllBoxAudits().filter(a =>
    a.venueId === venueId && a.productId === productId,
  )
  const lastAudit = audits.length > 0
    ? audits.slice().sort((a, b) => a.auditedAt < b.auditedAt ? 1 : -1)[0]
    : null
  const cumulativeDiscrepancy = audits.reduce((s, a) => s + a.cashDiscrepancy, 0)

  const isFlagged =
    anonymousRatio >= _HIGH_ANONYMOUS_RATIO_THRESHOLD
    || cumulativeDiscrepancy >= _SIGNIFICANT_DISCREPANCY_AMOUNT

  return {
    venueId,
    venueName: venue?.name ?? '?',
    productId,
    productName: product?.name ?? '?',
    unitPrice: vp?.unitPrice ?? product?.unitPrice ?? 0,
    currentStock: vp?.currentStock ?? 0,
    lowStockThreshold: vp?.lowStockThreshold ?? 5,
    saleCount: sales.length,
    totalSoldQty,
    totalRevenue,
    giftedQty,
    anonymousSaleCount,
    anonymousRatio,
    lastAudit,
    cumulativeDiscrepancy,
    isFlagged,
  }
}

// ── 11.4 公開查詢 ────────────────────────────────────────────

/** 取得 /reconciliation/honest-shop 頁所需的 overview */
export function getHonestShopOverview(
  visible: string[] | 'all' = 'all',
): HonestShopOverview {
  const ids = visible === 'all' ? null : new Set(visible)
  const activeVenues = GENERATED.venues.filter(v =>
    v.isActive && (!ids || ids.has(v.id)),
  )

  const rows: HonestShopVenueProductSummary[] = []
  const honestShopProductIds = getHonestShopProductIds()
  for (const v of activeVenues) {
    for (const pid of honestShopProductIds) {
      // 確認該館有上架此商品
      const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === v.id)
      const productName = GENERATED.products.find(p => p.id === pid)?.name
      const hasProduct = vpEntry?.products.some(p => p.name === productName)
      if (!hasProduct) continue
      rows.push(_buildVenueProductSummary(v.id, pid))
    }
  }

  rows.sort((a, b) =>
    Number(b.isFlagged) - Number(a.isFlagged)
    || b.anonymousRatio - a.anonymousRatio,
  )

  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0)
  const totalDiscrepancy = rows.reduce((s, r) => s + r.cumulativeDiscrepancy, 0)
  const allAudits = getAllBoxAudits().filter(a => !ids || ids.has(a.venueId))
  const auditCount = allAudits.length
  const sumExpected = allAudits.reduce((s, a) => s + a.expectedRevenue, 0)
  const sumCounted  = allAudits.reduce((s, a) => s + a.countedCash, 0)
  const averageHonestyRate = sumExpected > 0 ? sumCounted / sumExpected : 1

  return {
    rows,
    totalRevenue,
    totalDiscrepancy,
    auditCount,
    averageHonestyRate,
    flaggedCount: rows.filter(r => r.isFlagged).length,
    lookbackDays: _HONEST_SHOP_LOOKBACK_DAYS,
    anonymousRatioThreshold: _HIGH_ANONYMOUS_RATIO_THRESHOLD,
    isFiltered: visible !== 'all',
  }
}

/** 列出某 venue × product 的盤點歷史（時間新→舊） */
export function listBoxAudits(
  venueId?: string,
  productId?: string,
  visible: string[] | 'all' = 'all',
): BoxAuditRecord[] {
  const ids = visible === 'all' ? null : new Set(visible)
  return getAllBoxAudits()
    .filter(a => !venueId || a.venueId === venueId)
    .filter(a => !productId || a.productId === productId)
    .filter(a => !ids || ids.has(a.venueId))
    .sort((a, b) => a.auditedAt < b.auditedAt ? 1 : -1)
}

/** 預覽盤點：計算「假如老闆現在輸入 $X」會看到的對帳結果（不寫入） */
export function previewBoxAudit(args: {
  venueId: string
  productId: string
  /** 盤點期間（不含當天）— 預設 = 上次盤點之後 / 沒上次則 lookback 起點 */
  periodStart?: string
  periodEnd?: string
}): {
  periodStart: string
  periodEnd: string
  expectedRevenue: number
  expectedQuantitySold: number
  currentStock: number
  anonymousCount: number
  saleCount: number
} {
  const lastAudit = getAllBoxAudits()
    .filter(a => a.venueId === args.venueId && a.productId === args.productId)
    .sort((a, b) => a.auditedAt < b.auditedAt ? 1 : -1)[0]

  const periodStart = args.periodStart
    ?? (lastAudit?.periodEnd ?? _honestShopLookbackStart())
  const periodEnd = args.periodEnd ?? TODAY_STR

  const startIso = periodStart + 'T00:00:00Z'
  const endIso   = periodEnd + 'T23:59:59Z'

  const sales = GENERATED.productTransactions.filter(t =>
    t.venueId === args.venueId
    && t.productId === args.productId
    && t.type === 'sale'
    && t.operatedAt >= startIso
    && t.operatedAt <= endIso,
  )

  const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === args.venueId)
  const productName = GENERATED.products.find(p => p.id === args.productId)?.name
  const vp = vpEntry?.products.find(p => p.name === productName)

  return {
    periodStart,
    periodEnd,
    expectedRevenue: sales.reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    expectedQuantitySold: sales.reduce((s, t) => s + Math.abs(t.quantity), 0),
    currentStock: vp?.currentStock ?? 0,
    anonymousCount: sales.filter(t => !t.customerId).length,
    saleCount: sales.length,
  }
}

// ── 11.5 Mutations ───────────────────────────────────────────

/**
 * 老闆 / 館長執行「投錢箱盤點」。
 *
 * 流程：
 *   1. 系統算「帳面銷售」expectedRevenue（從上次盤點 / lookback 起點到今天）
 *   2. 老闆輸入：投錢箱實收 countedCash + 庫存實際剩 countedStock
 *   3. 系統算缺口 = expectedRevenue − countedCash
 *   4. 寫入：
 *      - BoxAuditRecord（盤點歷史）
 *      - ProductTransaction(type='adjustment')（庫存校正，若 countedStock ≠ expectedStock）
 *      - AuditLog（行為紀錄）
 */
export function recordBoxAudit(args: {
  venueId: string
  productId: string
  countedCash: number
  countedStock: number
  notes?: string | null
  /** 自訂期間，預設為「上次盤點後到今天」 */
  periodStart?: string
  periodEnd?: string
}): { ok: true; auditId: string; cashDiscrepancy: number; stockDiscrepancy: number } | { ok: false; reason: string } {
  if (args.countedCash < 0) return { ok: false, reason: '實收金額不可為負' }
  if (args.countedStock < 0) return { ok: false, reason: '庫存不可為負' }
  if (!isHonestShopProduct(args.productId)) {
    return { ok: false, reason: '此商品非誠實商店商品' }
  }

  const venue = GENERATED.venues.find(v => v.id === args.venueId)
  if (!venue) return { ok: false, reason: '找不到球館' }

  const product = GENERATED.products.find(p => p.id === args.productId)
  if (!product) return { ok: false, reason: '找不到商品' }

  // 1. 算帳面
  const preview = previewBoxAudit({
    venueId: args.venueId,
    productId: args.productId,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  })

  const cashDiscrepancy  = preview.expectedRevenue - args.countedCash
  const stockDiscrepancy = preview.currentStock - args.countedStock // 正數 = 帳面比實際多（損耗）
  const auditedAt = new Date().toISOString()
  const auditId = genId('boxaudit')

  // 2. 寫盤點記錄
  addBoxAudit({
    id: auditId,
    venueId: args.venueId,
    productId: args.productId,
    auditedAt,
    updatedAt: auditedAt, // 階段 9：新建即等於 auditedAt
    periodStart: preview.periodStart,
    periodEnd: preview.periodEnd,
    expectedRevenue: preview.expectedRevenue,
    expectedQuantitySold: preview.expectedQuantitySold,
    countedCash: args.countedCash,
    countedStock: args.countedStock,
    cashDiscrepancy,
    auditedBy: getCurrentUserId(),
    notes: args.notes ?? null,
  })

  // 3. 若庫存有差異，寫一筆 adjustment ProductTransaction 校正
  if (stockDiscrepancy !== 0) {
    // 直接 mutate VenueProduct.currentStock 把帳面庫存對齊實際盤點數
    // 同時記錄 type='adjustment' Tx（負數 = 損耗）
    const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === args.venueId)
    const vp = vpEntry?.products.find(p => p.name === product.name)
    if (vp) {
      // mutate currentStock
      ;(vp as unknown as { currentStock: number }).currentStock = args.countedStock
    }
    addProductTransaction({
      id: genId('pt'),
      productId: args.productId,
      venueId: args.venueId,
      operatedBy: getCurrentUserId(),
      type: 'adjustment',
      quantity: -stockDiscrepancy, // stockDiscrepancy 正 = 損耗 → 庫存再扣（負數 qty 表示減少）
      unitPrice: null,
      totalAmount: null,
      customerId: null,
      sessionId: null,
      notes: stockDiscrepancy > 0
        ? `盤點發現損耗 ${stockDiscrepancy} 件`
        : `盤點發現多 ${-stockDiscrepancy} 件（補貨未登？）`,
      operatedAt: auditedAt,
      productName: product.name,
      operatorName: getAdminActor().name,
      customerName: undefined,
    })
  }

  // 4. audit log（用既有 ADJUST_STOCK action — 已存在 union 中）
  writeAudit({
    actor: getAdminActor(),
    venue: venue.name,
    action: 'ADJUST_STOCK',
    entityType: 'BoxAudit',
    entityId: auditId,
    targetLabel: `${venue.name} · ${product.name}`,
    detail: cashDiscrepancy > 0
      ? `投錢箱盤點：帳面 $${preview.expectedRevenue}、實收 $${args.countedCash}、缺口 $${cashDiscrepancy}`
      : cashDiscrepancy < 0
      ? `投錢箱盤點：帳面 $${preview.expectedRevenue}、實收 $${args.countedCash}、多收 $${-cashDiscrepancy}`
      : `投錢箱盤點：帳面 $${preview.expectedRevenue} 與實收一致`,
    newValues: {
      expectedRevenue: preview.expectedRevenue,
      countedCash: args.countedCash,
      cashDiscrepancy,
      stockDiscrepancy,
    },
  })

  return { ok: true, auditId, cashDiscrepancy, stockDiscrepancy }
}



// ════════════════════════════════════════════════════════════
// 十二、跨館商品調貨（階段 5 Block C）
// ════════════════════════════════════════════════════════════
// 場景：飛翼 v3 運動飲料剩 3 罐，球魔方 v1 有 18 罐 → 飛翼館長申請調貨。
//
// 三階段流程：
//   1. pending  — 入貨館申請，等出貨館同意
//   2. in_transit — 出貨館確認出貨（扣其庫存 + adjustment Tx）
//   3. completed — 入貨館收到（加其庫存 + adjustment Tx）
// 任何階段可 cancelled（不退已扣的庫存 — 出貨館要自己再開逆向調貨補回）
//
// 階段 6 更新（types 已解凍）：
//   - ProductTransfer 型別已搬入 types/index.ts；store.ts 只留 in-memory 陣列。
//   - audit action 'PRODUCT_TRANSFER' 已正式加入 AuditAction union（不再 cast）。
//     created / shipped / received / cancelled 4 個 phase 都用同一個 action，
//     具體 phase 從 audit.newValues.phase 判斷。
//
// 階段 7 更新：
//   - 'PRODUCT_TRANSFER' 已拆為 4 個 union member：
//     PRODUCT_TRANSFER_CREATED / _SHIPPED / _RECEIVED / _CANCELLED
//     audit filter 可單獨篩選每個 phase（例如「只看取消」）。
//     newValues.step 仍保留（向後相容 + 額外資訊），但已不再是區分依據。
//   - 4 個新 action 已加入 ADMIN_ACTIONS Set（修階段 6 漏的 bug）。
//   - hydrate 時會 migrate 舊 'PRODUCT_TRANSFER' audit log 到對應新 action
//     （見 store.ts hydrate）。
// ────────────────────────────────────────────────────────────

// ── 12.1 Interfaces ──────────────────────────────────────────

/** 調貨單摘要（含 join 出來的顯示欄位） */
export interface ProductTransferRow {
  id: string
  productId: string
  productName: string
  unitPrice: number
  fromVenueId: string
  fromVenueName: string
  toVenueId: string
  toVenueName: string
  quantity: number
  status: ProductTransferStatus
  statusLabel: string
  requestedBy: string
  requestedByName: string
  requestedAt: string
  /** 階段 9：用於樂觀鎖 baseUpdatedAt 的 snapshot */
  updatedAt: string
  completedAt: string | null
  notes: string | null
  /** 目前各館庫存（顯示用） */
  fromVenueCurrentStock: number
  toVenueCurrentStock: number
}

/** 智能建議：低庫存館應該從高庫存館調貨 */
export interface TransferSuggestion {
  productId: string
  productName: string
  unitPrice: number
  fromVenueId: string
  fromVenueName: string
  fromStock: number
  toVenueId: string
  toVenueName: string
  toStock: number
  toLowStockThreshold: number
  /** 建議調撥量 = 補到 toLowStockThreshold × 2，但不超過 from 的 50% */
  suggestedQty: number
  /** 缺貨嚴重程度 */
  severity: 'high' | 'medium' | 'low'
}

/** /products/transfers 頁所需 overview */
export interface ProductTransferOverview {
  transfers: ProductTransferRow[]
  pendingCount: number
  inTransitCount: number
  completedThisMonthCount: number
  cancelledCount: number
  totalQuantityCompleted: number
  suggestions: TransferSuggestion[]
  isFiltered: boolean
}

// ── 12.2 內部 helper ─────────────────────────────────────────

function _buildTransferRow(t: ProductTransfer): ProductTransferRow {
  const product = GENERATED.products.find(p => p.id === t.productId)
  const fromVenue = GENERATED.venues.find(v => v.id === t.fromVenueId)
  const toVenue = GENERATED.venues.find(v => v.id === t.toVenueId)
  const requester = GENERATED.users.find(u => u.id === t.requestedBy)

  const fromVp = GENERATED.venueProducts.find(vp => vp.venueId === t.fromVenueId)
  const toVp = GENERATED.venueProducts.find(vp => vp.venueId === t.toVenueId)
  const fromProduct = fromVp?.products.find(p => p.name === product?.name)
  const toProduct = toVp?.products.find(p => p.name === product?.name)

  return {
    id: t.id,
    productId: t.productId,
    productName: product?.name ?? '?',
    unitPrice: fromProduct?.unitPrice ?? product?.unitPrice ?? 0,
    fromVenueId: t.fromVenueId,
    fromVenueName: fromVenue?.name ?? '?',
    toVenueId: t.toVenueId,
    toVenueName: toVenue?.name ?? '?',
    quantity: t.quantity,
    status: t.status,
    statusLabel: PRODUCT_TRANSFER_STATUS_LABEL[t.status],
    requestedBy: t.requestedBy,
    requestedByName: requester?.name ?? '系統',
    requestedAt: t.requestedAt,
    updatedAt: t.updatedAt, // 階段 9
    completedAt: t.completedAt,
    notes: t.notes,
    fromVenueCurrentStock: fromProduct?.currentStock ?? 0,
    toVenueCurrentStock: toProduct?.currentStock ?? 0,
  }
}

// ── 12.3 公開查詢 ────────────────────────────────────────────

/** 列出所有調貨單（按狀態 + 申請時間排序，pending/in_transit 在前） */
export function listProductTransfers(
  visible: string[] | 'all' = 'all',
): ProductTransferRow[] {
  const ids = visible === 'all' ? null : new Set(visible)
  const STATUS_ORDER: Record<ProductTransferStatus, number> = {
    pending: 0, in_transit: 1, completed: 2, cancelled: 3,
  }
  return getAllTransfers()
    .filter(t => !ids || ids.has(t.fromVenueId) || ids.has(t.toVenueId))
    .map(_buildTransferRow)
    .sort((a, b) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (so !== 0) return so
      return a.requestedAt < b.requestedAt ? 1 : -1
    })
}

/** 計算「智能建議：低庫存館從高庫存館調貨」 */
export function suggestProductTransfers(
  visible: string[] | 'all' = 'all',
): TransferSuggestion[] {
  const ids = visible === 'all' ? null : new Set(visible)
  const venues = GENERATED.venues.filter(v => v.isActive && (!ids || ids.has(v.id)))
  const suggestions: TransferSuggestion[] = []

  // 拿目前所有 pending/in_transit 的「即將補貨」，避免重複建議
  const pendingTransfers = getAllTransfers().filter(
    t => t.status === 'pending' || t.status === 'in_transit',
  )

  for (const product of GENERATED.products) {
    // 找該產品在每個館的庫存
    const inventory: { venueId: string; venueName: string; stock: number; threshold: number }[] = []
    for (const v of venues) {
      const vpEntry = GENERATED.venueProducts.find(vp => vp.venueId === v.id)
      const vp = vpEntry?.products.find(p => p.name === product.name)
      if (!vp) continue
      inventory.push({
        venueId: v.id,
        venueName: v.name,
        stock: vp.currentStock,
        threshold: vp.lowStockThreshold,
      })
    }

    // 排序：低庫存館優先當「收貨方」、高庫存館當「出貨方」
    const lowStockVenues = inventory
      .filter(i => i.stock <= i.threshold)
      .sort((a, b) => a.stock - b.stock)
    const highStockVenues = inventory
      .filter(i => i.stock > i.threshold * 3)
      .sort((a, b) => b.stock - a.stock)

    for (const low of lowStockVenues) {
      // 已有 pending/in_transit 補貨給這個館 = skip
      const alreadyPending = pendingTransfers.some(
        t => t.toVenueId === low.venueId && t.productId === product.id,
      )
      if (alreadyPending) continue

      const source = highStockVenues.find(h => h.venueId !== low.venueId)
      if (!source) continue

      const targetReplenish = Math.max(low.threshold * 2 - low.stock, 1)
      const sourceLimit = Math.floor(source.stock * 0.5)
      const suggestedQty = Math.max(1, Math.min(targetReplenish, sourceLimit))

      const severity: TransferSuggestion['severity'] =
        low.stock === 0 ? 'high' :
        low.stock <= low.threshold * 0.5 ? 'medium' : 'low'

      suggestions.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice ?? 0,
        fromVenueId: source.venueId,
        fromVenueName: source.venueName,
        fromStock: source.stock,
        toVenueId: low.venueId,
        toVenueName: low.venueName,
        toStock: low.stock,
        toLowStockThreshold: low.threshold,
        suggestedQty,
        severity,
      })
    }
  }

  const SEVERITY_ORDER: Record<TransferSuggestion['severity'], number> = {
    high: 0, medium: 1, low: 2,
  }
  return suggestions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

export function getProductTransferOverview(
  visible: string[] | 'all' = 'all',
): ProductTransferOverview {
  const transfers = listProductTransfers(visible)
  const thisMonth = TODAY_STR.slice(0, 7) // YYYY-MM
  return {
    transfers,
    pendingCount:            transfers.filter(t => t.status === 'pending').length,
    inTransitCount:          transfers.filter(t => t.status === 'in_transit').length,
    completedThisMonthCount: transfers.filter(t =>
      t.status === 'completed' && t.completedAt?.slice(0, 7) === thisMonth,
    ).length,
    cancelledCount:          transfers.filter(t => t.status === 'cancelled').length,
    totalQuantityCompleted:  transfers
      .filter(t => t.status === 'completed')
      .reduce((s, t) => s + t.quantity, 0),
    suggestions: suggestProductTransfers(visible),
    isFiltered: visible !== 'all',
  }
}

// ── 12.4 Mutations ───────────────────────────────────────────

/**
 * 建立調貨單（pending 狀態）。
 * 由入貨館（toVenueId）或老闆發起。
 */
export function createProductTransfer(args: {
  productId: string
  fromVenueId: string
  toVenueId: string
  quantity: number
  notes?: string | null
}): { ok: true; transferId: string } | { ok: false; reason: string } {
  if (args.fromVenueId === args.toVenueId) return { ok: false, reason: '出貨/入貨館不可相同' }
  if (args.quantity <= 0) return { ok: false, reason: '調貨數量必須大於 0' }

  const product = GENERATED.products.find(p => p.id === args.productId)
  if (!product) return { ok: false, reason: '找不到商品' }

  const fromVenue = GENERATED.venues.find(v => v.id === args.fromVenueId)
  const toVenue   = GENERATED.venues.find(v => v.id === args.toVenueId)
  if (!fromVenue || !toVenue) return { ok: false, reason: '球館不存在' }

  // 檢查出貨館確實有此商品庫存
  const fromVp = GENERATED.venueProducts.find(vp => vp.venueId === args.fromVenueId)
  const fromProduct = fromVp?.products.find(p => p.name === product.name)
  if (!fromProduct) return { ok: false, reason: `${fromVenue.name} 未上架此商品` }
  if (fromProduct.currentStock < args.quantity) {
    return { ok: false, reason: `${fromVenue.name} 庫存不足（剩 ${fromProduct.currentStock}）` }
  }

  const transferId = genId('xfer')
  const requestedAt = new Date().toISOString()
  addProductTransfer({
    id: transferId,
    productId: args.productId,
    fromVenueId: args.fromVenueId,
    toVenueId: args.toVenueId,
    quantity: args.quantity,
    requestedBy: getCurrentUserId(),
    status: 'pending',
    requestedAt,
    updatedAt: requestedAt, // 階段 9
    completedAt: null,
    notes: args.notes ?? null,
  })

  writeAudit({
    actor: getAdminActor(),
    venue: `${fromVenue.name} → ${toVenue.name}`,
    action: 'PRODUCT_TRANSFER_CREATED',
    entityType: 'ProductTransfer',
    entityId: transferId,
    targetLabel: product.name,
    detail: `申請：${fromVenue.name} → ${toVenue.name}，${product.name} × ${args.quantity}${args.notes ? ` (${args.notes})` : ''}`,
    newValues: {
      step: 'created',
      productId: args.productId,
      fromVenueId: args.fromVenueId,
      toVenueId: args.toVenueId,
      quantity: args.quantity,
    },
  })

  return { ok: true, transferId }
}

/** 出貨確認：pending → in_transit。扣 from 館庫存 + 寫 adjustment Tx。
 *
 * 階段 9：可選 `baseUpdatedAt` 樂觀鎖保護（多個員工同時管出貨）。
 */
export function shipProductTransfer(
  transferId: string,
  opts: { baseUpdatedAt?: string } = {},
): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const t = getAllTransfers().find(x => x.id === transferId)
  if (!t) return { ok: false, reason: '找不到調貨單' }
  if (t.status !== 'pending') return { ok: false, reason: `當前狀態為 ${PRODUCT_TRANSFER_STATUS_LABEL[t.status]}` }

  const product = GENERATED.products.find(p => p.id === t.productId)
  const fromVenue = GENERATED.venues.find(v => v.id === t.fromVenueId)
  const toVenue = GENERATED.venues.find(v => v.id === t.toVenueId)
  if (!product || !fromVenue || !toVenue) return { ok: false, reason: '資料不完整' }

  // 階段 9：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(t, opts.baseUpdatedAt, {
    entityType: 'ProductTransfer',
    entityId: transferId,
    actor: getAdminActor(),
    venue: `${fromVenue.name} → ${toVenue.name}`,
    targetLabel: product.name,
    attemptedPatch: { status: 'in_transit' },
  })
  if (conflict) return conflict

  // 出貨：扣 from 庫存
  const fromVp = GENERATED.venueProducts.find(vp => vp.venueId === t.fromVenueId)
  const fromProduct = fromVp?.products.find(p => p.name === product.name)
  if (!fromProduct) return { ok: false, reason: `${fromVenue.name} 未上架此商品` }
  if (fromProduct.currentStock < t.quantity) {
    return { ok: false, reason: `${fromVenue.name} 庫存不足（剩 ${fromProduct.currentStock}）` }
  }
  ;(fromProduct as unknown as { currentStock: number }).currentStock = fromProduct.currentStock - t.quantity

  // 寫 adjustment Tx
  addProductTransaction({
    id: genId('pt'),
    productId: t.productId,
    venueId: t.fromVenueId,
    operatedBy: getCurrentUserId(),
    type: 'adjustment',
    quantity: -t.quantity,
    unitPrice: null,
    totalAmount: null,
    customerId: null,
    sessionId: null,
    notes: `調貨出庫 → ${toVenue.name}`,
    operatedAt: new Date().toISOString(),
    productName: product.name,
    operatorName: getAdminActor().name,
    customerName: undefined,
  })

  // 更新 transfer 狀態 + bump updatedAt
  const now = new Date().toISOString()
  patchProductTransfer(transferId, { status: 'in_transit', updatedAt: now })

  writeAudit({
    actor: getAdminActor(),
    venue: fromVenue.name,
    action: 'PRODUCT_TRANSFER_SHIPPED',
    entityType: 'ProductTransfer',
    entityId: transferId,
    targetLabel: product.name,
    detail: `出貨：${fromVenue.name} 扣庫存 ${t.quantity}，運送中`,
    oldValues: { status: 'pending' },
    newValues: { status: 'in_transit', step: 'shipped' },
  })

  return { ok: true }
}

/** 收貨確認：in_transit → completed。加 to 館庫存 + 寫 adjustment Tx。
 *
 * 階段 9：可選 `baseUpdatedAt` 樂觀鎖保護。
 */
export function receiveProductTransfer(
  transferId: string,
  opts: { baseUpdatedAt?: string } = {},
): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const t = getAllTransfers().find(x => x.id === transferId)
  if (!t) return { ok: false, reason: '找不到調貨單' }
  if (t.status !== 'in_transit') return { ok: false, reason: `當前狀態為 ${PRODUCT_TRANSFER_STATUS_LABEL[t.status]}` }

  const product = GENERATED.products.find(p => p.id === t.productId)
  const fromVenue = GENERATED.venues.find(v => v.id === t.fromVenueId)
  const toVenue = GENERATED.venues.find(v => v.id === t.toVenueId)
  if (!product || !fromVenue || !toVenue) return { ok: false, reason: '資料不完整' }

  // 階段 9：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(t, opts.baseUpdatedAt, {
    entityType: 'ProductTransfer',
    entityId: transferId,
    actor: getAdminActor(),
    venue: `${fromVenue.name} → ${toVenue.name}`,
    targetLabel: product.name,
    attemptedPatch: { status: 'completed' },
  })
  if (conflict) return conflict

  // 收貨：加 to 庫存
  const toVp = GENERATED.venueProducts.find(vp => vp.venueId === t.toVenueId)
  const toProduct = toVp?.products.find(p => p.name === product.name)
  if (!toProduct) return { ok: false, reason: `${toVenue.name} 未上架此商品` }
  ;(toProduct as unknown as { currentStock: number }).currentStock = toProduct.currentStock + t.quantity

  // 寫 adjustment Tx（入庫）
  addProductTransaction({
    id: genId('pt'),
    productId: t.productId,
    venueId: t.toVenueId,
    operatedBy: getCurrentUserId(),
    type: 'adjustment',
    quantity: t.quantity,
    unitPrice: null,
    totalAmount: null,
    customerId: null,
    sessionId: null,
    notes: `調貨入庫 ← ${fromVenue.name}`,
    operatedAt: new Date().toISOString(),
    productName: product.name,
    operatorName: getAdminActor().name,
    customerName: undefined,
  })

  // 更新 transfer 狀態 + bump updatedAt
  const completedAt = new Date().toISOString()
  patchProductTransfer(transferId, { status: 'completed', completedAt, updatedAt: completedAt })

  writeAudit({
    actor: getAdminActor(),
    venue: toVenue.name,
    action: 'PRODUCT_TRANSFER_RECEIVED',
    entityType: 'ProductTransfer',
    entityId: transferId,
    targetLabel: product.name,
    detail: `收貨：${toVenue.name} 加庫存 ${t.quantity}，調貨完成`,
    oldValues: { status: 'in_transit' },
    newValues: { status: 'completed', step: 'received', completedAt },
  })

  return { ok: true }
}

/** 取消調貨：任何狀態 → cancelled。注意：若已 in_transit，from 館庫存不會自動退回。
 *
 * 階段 9：可選 `baseUpdatedAt` 樂觀鎖保護。
 */
export function cancelProductTransfer(
  transferId: string,
  reason?: string,
  opts: { baseUpdatedAt?: string } = {},
): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const t = getAllTransfers().find(x => x.id === transferId)
  if (!t) return { ok: false, reason: '找不到調貨單' }
  if (t.status === 'completed') return { ok: false, reason: '已完成的調貨無法取消，請開新的逆向調貨' }
  if (t.status === 'cancelled') return { ok: false, reason: '已取消' }

  const product = GENERATED.products.find(p => p.id === t.productId)
  const fromVenue = GENERATED.venues.find(v => v.id === t.fromVenueId)
  const toVenue = GENERATED.venues.find(v => v.id === t.toVenueId)
  const prevStatus = t.status

  // 階段 9：樂觀鎖檢查
  const conflict = checkBaseUpdatedAt(t, opts.baseUpdatedAt, {
    entityType: 'ProductTransfer',
    entityId: transferId,
    actor: getAdminActor(),
    venue: fromVenue && toVenue ? `${fromVenue.name} → ${toVenue.name}` : null,
    targetLabel: product?.name ?? '?',
    attemptedPatch: { status: 'cancelled', reason: reason ?? null },
  })
  if (conflict) return conflict

  const now = new Date().toISOString()
  patchProductTransfer(transferId, { status: 'cancelled', updatedAt: now })

  writeAudit({
    actor: getAdminActor(),
    venue: fromVenue && toVenue ? `${fromVenue.name} → ${toVenue.name}` : null,
    action: 'PRODUCT_TRANSFER_CANCELLED',
    entityType: 'ProductTransfer',
    entityId: transferId,
    targetLabel: product?.name ?? '?',
    detail: prevStatus === 'in_transit'
      ? `取消（運送中取消，${fromVenue?.name} 已扣的庫存需另開逆向調貨補回）${reason ? `：${reason}` : ''}`
      : `取消${reason ? `：${reason}` : ''}`,
    oldValues: { status: prevStatus },
    newValues: { status: 'cancelled', step: 'cancelled', reason: reason ?? null },
  })

  return { ok: true }
}


// ============================================================
// 十三、上傳憑證 store（階段 8 Part A）
// ============================================================
// 自助回報「轉帳截圖」階段 5 只存字串檔名（self-checkin 頁第 338 行
// 還寫著「demo 用：實際 production 應上傳檔案到對象存儲」）。
// 階段 8 把它換成真實檔案 store：
//
//   - Blob 本體：data/evidence-store.ts 的 IndexedDB
//   - Metadata：PersistedDiff.evidenceMetadata（隨 localStorage 一起 hydrate）
//   - 兩邊用 UploadedEvidence.id 串
//
// 為了向後相容，Registration.selfPaymentEvidence 仍然是 `string | null`，
// 但語意改為「若以 `evd_` 前綴 → IndexedDB blob id；否則為 legacy
// 字串（檔名 / URL）」。Preview 元件偵測前綴決定渲染方式。
// ============================================================

import type { UploadedEvidence, EvidenceSourceType } from '@/types'
import { EVIDENCE_SOURCE_LABEL } from '@/types'
export type { EvidenceSourceType } from '@/types'
export { EVIDENCE_SOURCE_LABEL } from '@/types'
import {
  addEvidenceMeta, getEvidenceMetadata, markEvidenceBlobDeleted,
} from './store'
import {
  putEvidence as _putEvidenceBlob,
  deleteEvidence as _deleteEvidenceBlob,
  getEvidenceObjectUrl as _getEvidenceObjectUrlRaw,
  isEvidenceStoreAvailable,
} from './evidence-store'
export { isEvidenceStoreAvailable } from './evidence-store'

// ── 13.1 helpers ─────────────────────────────────────────────

const EVIDENCE_ID_PREFIX = 'evd'

function genEvidenceId(): string {
  // 與 genId 同形狀，但 prefix 鎖死讓 isEvidenceId 可單純前綴判斷
  const r = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${EVIDENCE_ID_PREFIX}_${Date.now().toString(36)}_${r}`
}

/**
 * 判斷一個字串是否為憑證 id（即「IndexedDB 內有 blob」的形式）。
 *
 * 向後相容：Registration.selfPaymentEvidence 在階段 5-7 是純檔名字串
 * （例：'transfer_0511.jpg'）；階段 8 起新上傳都用 'evd_xxx' id。
 * Preview 元件用此 helper 決定渲染策略：
 *   - true  → 從 IndexedDB 抓 blob 顯示圖片
 *   - false → 純文字 fallback（legacy 字串檔名）
 */
export function isEvidenceId(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.startsWith(`${EVIDENCE_ID_PREFIX}_`)
}

/** 取得單筆 evidence meta；找不到回 null */
export function getEvidenceMeta(id: string): UploadedEvidence | null {
  return getEvidenceMetadata().find(e => e.id === id) ?? null
}

// ── 13.2 Queries ─────────────────────────────────────────────

export interface EvidenceListFilter {
  sourceType?: EvidenceSourceType | 'all'
  /**
   * 階段 9 新增：依 sourceId 過濾。
   * 用途：業務頁面（如 /products/transfers）想看「這張單上傳的憑證」。
   * 不傳則不過濾。
   */
  sourceId?: string
  /** 是否含已刪除（blobAvailable=false）— 預設不含 */
  includeDeleted?: boolean
}

/**
 * Admin 列表：列出所有上傳憑證的 meta。
 *
 * 預設依 uploadedAt **降冪**（最新在前），方便 admin 頁直接渲染。
 */
export function listAllEvidence(filter: EvidenceListFilter = {}): UploadedEvidence[] {
  const src         = filter.sourceType    ?? 'all'
  const srcId       = filter.sourceId
  const incDeleted  = filter.includeDeleted ?? false
  return getEvidenceMetadata()
    .filter(e => (src === 'all' || e.sourceType === src))
    .filter(e => (srcId === undefined || e.sourceId === srcId))
    .filter(e => (incDeleted || e.blobAvailable))
    .slice() // 不污染原陣列
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

/**
 * 取得 blob 的 object URL（用於 <img src=>）。
 *
 * caller **必須** 在 unmount 時呼叫 `URL.revokeObjectURL(url)`
 * 釋放，否則會洩漏記憶體。建議模式：
 *
 *   useEffect(() => {
 *     let url: string | null = null
 *     getEvidenceObjectUrl(id).then(u => { url = u; setSrc(u) })
 *     return () => { if (url) URL.revokeObjectURL(url) }
 *   }, [id])
 */
export async function getEvidenceObjectUrl(id: string): Promise<string | null> {
  if (!isEvidenceStoreAvailable()) return null
  try {
    return await _getEvidenceObjectUrlRaw(id)
  } catch {
    return null
  }
}

// ── 13.3 Mutations ───────────────────────────────────────────

export interface UploadEvidenceArgs {
  blob: Blob
  filename: string
  sourceType: EvidenceSourceType
  sourceId: string
  /** 上傳者顯示名（顧客名 / 員工名）*/
  uploadedByName: string
}

export type UploadEvidenceResult =
  | { ok: true; id: string; meta: UploadedEvidence }
  | { ok: false; reason: string }

/**
 * 上傳一筆憑證：blob → IndexedDB；meta → store；audit log → 'UPLOAD_EVIDENCE'。
 *
 * 寫入順序：先 blob 再 meta（若 blob 失敗，整體 fast-fail 不留 meta）。
 *
 * audit actor：若 sourceType='self_payment'，actor 是 'captain' 類型
 * （客戶端自助上傳，與 customerReportSelfPayment 對齊）。其他來源用
 * admin actor。未來新增 sourceType 時記得 review 這個分流。
 */
export async function uploadEvidence(
  args: UploadEvidenceArgs,
): Promise<UploadEvidenceResult> {
  if (!isEvidenceStoreAvailable()) {
    return { ok: false, reason: '此瀏覽器不支援 IndexedDB（無法存上傳檔）' }
  }
  if (args.blob.size === 0) {
    return { ok: false, reason: '檔案大小為 0' }
  }
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  if (args.blob.size > MAX_SIZE) {
    return { ok: false, reason: `檔案過大（${(args.blob.size / 1024 / 1024).toFixed(1)} MB > 10 MB 上限）` }
  }

  const id = genEvidenceId()
  try {
    await _putEvidenceBlob(id, args.blob)
  } catch (e) {
    return { ok: false, reason: `寫入 IndexedDB 失敗：${(e as Error).message}` }
  }

  const meta: UploadedEvidence = {
    id,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    filename: args.filename,
    mimeType: args.blob.type || 'application/octet-stream',
    size: args.blob.size,
    uploadedByName: args.uploadedByName,
    uploadedAt: new Date().toISOString(),
    blobAvailable: true,
  }
  addEvidenceMeta(meta)

  // audit log
  // 階段 9：sourceType 擴大到 3 種，venue lookup 與 actor 依 sourceType 分流
  const isSelfPayment = args.sourceType === 'self_payment'
  const venue: string | null = (() => {
    switch (args.sourceType) {
      case 'self_payment': {
        // sourceId = Registration.id → 反查場次 → 反查場館
        const reg = GENERATED.registrations.find(r => r.id === args.sourceId)
        if (!reg) return null
        const session = GENERATED.sessions.find(s => s.id === reg.sessionId)
        if (!session) return null
        return GENERATED.venues.find(v => v.id === session.venueId)?.name ?? null
      }
      case 'box_audit': {
        // sourceId = BoxAuditRecord.id → 直接拿 venueId
        const audit = getAllBoxAudits().find(a => a.id === args.sourceId)
        if (!audit) return null
        return GENERATED.venues.find(v => v.id === audit.venueId)?.name ?? null
      }
      case 'transfer': {
        // sourceId = ProductTransfer.id → from → to 的「組合 venue 字串」
        const t = getAllTransfers().find(x => x.id === args.sourceId)
        if (!t) return null
        const from = GENERATED.venues.find(v => v.id === t.fromVenueId)?.name
        const to   = GENERATED.venues.find(v => v.id === t.toVenueId)?.name
        return from && to ? `${from} → ${to}` : (from ?? to ?? null)
      }
      default: {
        // exhaustive — TS 會在新增 sourceType 但沒補此 case 時報錯
        const _exhaustive: never = args.sourceType
        return _exhaustive
      }
    }
  })()
  writeAudit({
    // self_payment 仍是「客戶自助動作」→ captain actor；
    // box_audit / transfer 是員工端動作 → admin actor。
    actor: isSelfPayment
      ? { type: 'captain', id: args.sourceId, name: args.uploadedByName }
      : getAdminActor(),
    venue,
    action: 'UPLOAD_EVIDENCE',
    entityType: 'UploadedEvidence',
    entityId: id,
    targetLabel: args.uploadedByName,
    detail: `${EVIDENCE_SOURCE_LABEL[args.sourceType]} · ${args.filename}（${(args.blob.size / 1024).toFixed(1)} KB · ${meta.mimeType}）`,
    newValues: {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      size: args.blob.size,
      mimeType: meta.mimeType,
    },
  })

  return { ok: true, id, meta }
}

/**
 * Admin 刪除憑證：刪 IndexedDB blob、把 meta 標記為 blobAvailable=false
 * （不真的移除 meta，保留 audit 軌跡）、寫 'DELETE_EVIDENCE' audit log。
 *
 * 找不到 meta → 視為已刪除（idempotent）；不報錯，只回 ok=false 帶 reason。
 */
export async function deleteEvidenceById(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const meta = getEvidenceMeta(id)
  if (!meta) return { ok: false, reason: '找不到此憑證' }
  if (!meta.blobAvailable) return { ok: false, reason: '此憑證已刪除' }

  try {
    await _deleteEvidenceBlob(id)
  } catch (e) {
    return { ok: false, reason: `刪除 IndexedDB blob 失敗：${(e as Error).message}` }
  }
  markEvidenceBlobDeleted(id)

  writeAudit({
    actor: getAdminActor(),
    venue: null,
    action: 'DELETE_EVIDENCE',
    entityType: 'UploadedEvidence',
    entityId: id,
    targetLabel: meta.filename,
    detail: `刪除（${meta.sourceType} / ${(meta.size / 1024).toFixed(1)} KB）`,
    oldValues: { blobAvailable: true, size: meta.size },
    newValues: { blobAvailable: false },
  })
  return { ok: true }
}


// ============================================================
// 十四、衝突偵測 — 樂觀鎖 snapshot 比對（階段 8 Part B）
// ============================================================
// Mutation 接受可選參數 `baseUpdatedAt`（caller 在 UI 載入 entity
// 時記下的 entity.updatedAt）。執行 mutation 前比對當下 entity 的
// updatedAt：
//
//   - 不傳 baseUpdatedAt → 「強制覆蓋」（向後相容；既有呼叫端不變）
//   - 傳了且相符 → 正常執行
//   - 傳了但不符 → 不執行 mutation，return ConflictResult，
//                  並寫一筆 'CONFLICT_DETECTED' audit log
//
// 階段 8 範圍：示範性套用 3 個關鍵 mutation：
//   - adminRegenerateToken
//   - adminDeactivateRental
//   - cancelSession（新增）
//
// 其他 mutation 暫不套用（避免改動爆炸；未來階段可逐步擴大）。
// ============================================================

import type { ConflictResult } from '@/types'

/**
 * Type predicate：判斷 mutation 回傳是否為 ConflictResult。
 *
 * 階段 11：TS 5.x 對 `'conflict' in result && result.conflict` 的
 * narrowing 不會把 `{ ok: true }` / `{ ok: false; reason }` 排除掉，
 * 導致 `setConflict(result)` 型別錯誤。改用此 type predicate，TS 5.x
 * 也能正確 narrow 為 ConflictResult。
 *
 * 用法：
 *   const result = someMutation(...)
 *   if (isConflictResult(result)) {
 *     setConflict(result)  // 已 narrow 為 ConflictResult
 *     return
 *   }
 *   if (!result.ok) { ... }
 */
export function isConflictResult(r: unknown): r is ConflictResult {
  return (
    typeof r === 'object' &&
    r !== null &&
    'conflict' in r &&
    (r as { conflict: unknown }).conflict === true
  )
}

/**
 * snapshot 比對 helper。
 *
 * 用法：
 *   const conflict = checkBaseUpdatedAt(
 *     entity, baseUpdatedAt, { entityType, entityId, actor, targetLabel, attemptedPatch }
 *   )
 *   if (conflict) return conflict
 *   // 通過 → 繼續執行正常 mutation
 *
 * 不符時會自動寫 'CONFLICT_DETECTED' audit log（包含試圖寫入的 patch
 * + 當下 entity 的 updatedAt），方便事後追查衝突。
 */
function checkBaseUpdatedAt(
  entity: { updatedAt: string },
  baseUpdatedAt: string | undefined,
  ctx: {
    entityType: string
    entityId: string
    actor: AuditActor
    venue: string | null
    targetLabel: string
    attemptedPatch: Record<string, unknown>
  },
): ConflictResult | null {
  if (baseUpdatedAt === undefined) return null  // 強制覆蓋
  if (baseUpdatedAt === entity.updatedAt) return null  // 一致，pass

  // 不一致 → 推 audit log + return conflict result
  // 從最近一筆同 entity 的 audit log 推 lastEditedBy（best-effort）
  const lastEdit = getAuditLogs()
    .slice()
    .reverse()
    .find(l => l.entityType === ctx.entityType && l.entityId === ctx.entityId && l.action !== 'CONFLICT_DETECTED')
  const lastEditedBy = lastEdit?.actorName ?? null

  writeAudit({
    actor: ctx.actor,
    venue: ctx.venue,
    action: 'CONFLICT_DETECTED',
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    targetLabel: ctx.targetLabel,
    detail: `樂觀鎖衝突：嘗試以 base=${baseUpdatedAt.slice(11, 19)} 寫入，但目前 entity 為 ${entity.updatedAt.slice(11, 19)}${lastEditedBy ? `（最後修改：${lastEditedBy}）` : ''}`,
    oldValues: { currentUpdatedAt: entity.updatedAt, lastEditedBy },
    newValues: { baseUpdatedAt, attemptedPatch: ctx.attemptedPatch },
  })

  return {
    ok: false,
    conflict: true,
    reason: lastEditedBy
      ? `此資料已被「${lastEditedBy}」修改過，請重新載入後再試`
      : '此資料已被他人修改，請重新載入後再試',
    currentUpdatedAt: entity.updatedAt,
    lastEditedBy,
  }
}

/**
 * 取消場次（階段 8 新增的 mutation）。
 *
 * 與既有 adminRegenerateToken / adminDeactivateRental 同模式：
 *   - status: 'open' / 'full' → 'cancelled'
 *   - 可選 baseUpdatedAt 提供樂觀鎖保護
 *   - 觸發 'CANCEL_SESSION' audit log（這個 action 在 union 內存
 *     在已久但階段 8 前無人寫入）
 *
 * 不處理該場已存在的 Registration（demo 簡化；production 應自動
 * 取消所有 walk_in、退費等）。
 */
export function cancelSession(
  sessionId: string,
  opts: { reason: string; baseUpdatedAt?: string },
): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const s = GENERATED.sessions.find(x => x.id === sessionId)
  if (!s) return { ok: false, reason: '找不到場次' }
  if (s.status === 'cancelled')  return { ok: false, reason: '此場次已取消' }
  if (s.status === 'completed')  return { ok: false, reason: '已完成的場次無法取消' }

  const venueName = GENERATED.venues.find(v => v.id === s.venueId)?.name ?? null
  const actor = getAdminActor()
  const targetLabel = `${s.sessionDate} ${s.startTime} @ ${venueName ?? '?'}`

  const conflict = checkBaseUpdatedAt(s, opts.baseUpdatedAt, {
    entityType: 'Session',
    entityId: sessionId,
    actor,
    venue: venueName,
    targetLabel,
    attemptedPatch: { status: 'cancelled', reason: opts.reason },
  })
  if (conflict) return conflict

  const prevStatus = s.status
  s.status = 'cancelled'
  s.updatedAt = new Date().toISOString()

  writeAudit({
    actor,
    venue: venueName,
    action: 'CANCEL_SESSION',
    entityType: 'Session',
    entityId: sessionId,
    targetLabel,
    detail: `取消場次${opts.reason ? `：${opts.reason}` : ''}`,
    oldValues: { status: prevStatus, updatedAt: s.updatedAt },
    newValues: { status: 'cancelled', reason: opts.reason },
  })

  return { ok: true }
}


// ============================================================
// 十五、退費（階段 10）— cancelSession 後的決策流
// ============================================================
// 設計哲學：與 cancelSession 完全解耦（Fork 2 決策）。
//   - cancelSession 只把 Session.status='cancelled'，不碰任何 Registration
//   - 「待退費清單」純衍生：場次已取消 + 該 reg 有正額 Payment + refundDecision 為 null
//   - admin 在 /finance 「待退費」頁顯式對每筆做決定
//
// 兩個 mutation：
//   - issueRefund — 建一筆 Payment(amount<0, status='refunded') + reg.refundDecision='refunded'
//   - waiveRefund — 純標 reg.refundDecision='waived'，不建 Payment（客戶同意作罷 / 信用券處理）
//
// 樂觀鎖：比對 Registration.updatedAt（不比 Payment）— 因為「退費決策」是對 reg 做的動作。
// ADMIN_ACTIONS 已含 'ISSUE_REFUND' / 'WAIVE_REFUND'（前面 section 7.6 補）。
//
// 退費金額：允許部分（< 淨付額）— 但 refundDecision 同樣記 'refunded'（不細分「部分退」狀態）。
// 重複退費保護：refundDecision 已是 terminal 時兩個 mutation 都拒絕。
// ============================================================

import type { Payment as RefundPayment, PaymentMethod as RefundPaymentMethod, RefundDecision } from '@/types'
import { addPayment, patchRegistrationRefund } from './store'


// ── 15.1 衍生 helper：某 Registration 的淨付額 ────────────────────

/**
 * 淨付額 = sum(all Payment.amount for this Registration)。
 * 正常情況等於該筆 reg 的實收金額；若已部分退過則 < 實收。
 * 全退過後 = 0（也就不會出現在「待退費」list）。
 */
function getRegistrationNetPaid(registrationId: string): number {
  return GENERATED.payments
    .filter(p => p.registrationId === registrationId)
    .reduce((sum, p) => sum + p.amount, 0)
}

/** 該 reg 最近一次 positive Payment 的 method（給 issueRefund modal 預填用）*/
function getRegistrationLastPositiveMethod(registrationId: string): RefundPaymentMethod | null {
  const positive = GENERATED.payments
    .filter(p => p.registrationId === registrationId && p.amount > 0)
  if (positive.length === 0) return null
  // 用最晚的（paidAt 大的）
  const latest = positive.reduce((a, b) => (a.paidAt > b.paidAt ? a : b))
  return latest.method
}


// ── 15.2 「待退費」清單（衍生查詢） ────────────────────────────

/** 待退費 list 一筆顯示資料 */
export interface PendingRefundRow {
  registrationId: string
  registrationUpdatedAt: string  // 用於樂觀鎖 baseUpdatedAt snapshot
  sessionId: string
  sessionDate: string
  sessionStartTime: string
  venueId: string
  venueName: string
  customerId: string
  customerName: string
  customerPhone: string | null
  registrationType: RegistrationType
  /** 淨付額：用 sum(Payment.amount) 算（可能 > 原應收，若客戶先付了多） */
  netPaid: number
  /** 預填用：最近一次正額 Payment 的 method */
  lastPaymentMethod: RefundPaymentMethod | null
  /** 從 audit log 推：最近一筆 CANCEL_SESSION 的時間 */
  sessionCancelledAt: string | null
  /** 從 audit log 推：CANCEL_SESSION 的 detail（含 reason） */
  sessionCancelDetail: string | null
}

/**
 * 待退費清單 — 對「已取消場次的 paid Registration、尚未做退費決策」排序輸出。
 *
 * 排序：場次取消時間 desc（最近取消的先看）；同場次內按客戶名字。
 * 已套用 refundDecision = null filter → 已 refund/waived 的不會出現。
 */
export function getPendingRefunds(): PendingRefundRow[] {
  const auditLogs = getAuditLogs()
  // 場次 id → 最近一筆 CANCEL_SESSION 的 audit log
  const cancelLogByMaster = new Map<string, AuditLog>()
  for (const log of auditLogs) {
    if (log.action !== 'CANCEL_SESSION') continue
    const prev = cancelLogByMaster.get(log.entityId)
    if (!prev || log.createdAt > prev.createdAt) {
      cancelLogByMaster.set(log.entityId, log)
    }
  }

  const rows: PendingRefundRow[] = []

  for (const reg of GENERATED.registrations) {
    if (reg.refundDecision !== null) continue

    const session = GENERATED.sessions.find(s => s.id === reg.sessionId)
    if (!session || session.status !== 'cancelled') continue

    const netPaid = getRegistrationNetPaid(reg.id)
    if (netPaid <= 0) continue

    const venue = GENERATED.venues.find(v => v.id === session.venueId)
    const customer = GENERATED.customers.find(c => c.id === reg.customerId)
    if (!venue || !customer) continue

    const cancelLog = cancelLogByMaster.get(session.id)

    rows.push({
      registrationId: reg.id,
      registrationUpdatedAt: reg.updatedAt,
      sessionId: session.id,
      sessionDate: session.sessionDate,
      sessionStartTime: session.startTime,
      venueId: venue.id,
      venueName: venue.name,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      registrationType: reg.type,
      netPaid,
      lastPaymentMethod: getRegistrationLastPositiveMethod(reg.id),
      sessionCancelledAt: cancelLog?.createdAt ?? null,
      sessionCancelDetail: cancelLog?.detail ?? null,
    })
  }

  return rows.sort((a, b) => {
    // 取消時間 desc
    const at = a.sessionCancelledAt ?? ''
    const bt = b.sessionCancelledAt ?? ''
    if (at !== bt) return bt.localeCompare(at)
    return a.customerName.localeCompare(b.customerName, 'zh-Hant')
  })
}


// ── 15.3 「退費歷史」清單（衍生查詢） ──────────────────────────

/** 退費歷史 list 一筆顯示資料 */
export interface RefundHistoryRow {
  registrationId: string
  decision: RefundDecision
  decidedAt: string | null   // 從 audit log（ISSUE_REFUND / WAIVE_REFUND）取 createdAt
  decidedBy: string | null   // 從 audit log 取 actorName
  // 退款金額（waived 時為 null；refunded 時為負值轉正：abs(negative Payment amount)）
  refundedAmount: number | null
  refundMethod: RefundPaymentMethod | null
  refundNotes: string | null
  // 放棄退費的理由（refunded 時為 null）
  waiveReason: string | null
  // 顯示 context
  sessionId: string
  sessionDate: string
  sessionStartTime: string
  venueId: string
  venueName: string
  customerId: string
  customerName: string
  customerPhone: string | null
}

export interface RefundHistoryFilter {
  decision?: RefundDecision | 'all'
  venueId?: string | 'all'
}

/**
 * 退費歷史 — refundDecision !== null 的 Registration。
 *
 * 排序：decidedAt desc（最近處理的先看）；無 audit log 的（理論不應發生）放最後。
 */
export function getRefundHistory(filter: RefundHistoryFilter = {}): RefundHistoryRow[] {
  const decisionFilter = filter.decision ?? 'all'
  const venueFilter = filter.venueId ?? 'all'

  const auditLogs = getAuditLogs()
  // (registrationId, action) → 最近一筆 audit
  const decisionLogByReg = new Map<string, AuditLog>()
  for (const log of auditLogs) {
    if (log.action !== 'ISSUE_REFUND' && log.action !== 'WAIVE_REFUND') continue
    const prev = decisionLogByReg.get(log.entityId)
    if (!prev || log.createdAt > prev.createdAt) {
      decisionLogByReg.set(log.entityId, log)
    }
  }

  const rows: RefundHistoryRow[] = []

  for (const reg of GENERATED.registrations) {
    if (reg.refundDecision === null) continue
    if (decisionFilter !== 'all' && reg.refundDecision !== decisionFilter) continue

    const session = GENERATED.sessions.find(s => s.id === reg.sessionId)
    if (!session) continue

    const venue = GENERATED.venues.find(v => v.id === session.venueId)
    const customer = GENERATED.customers.find(c => c.id === reg.customerId)
    if (!venue || !customer) continue

    if (venueFilter !== 'all' && venue.id !== venueFilter) continue

    const log = decisionLogByReg.get(reg.id)
    const newVals = (log?.newValues ?? {}) as Record<string, unknown>

    let refundedAmount: number | null = null
    let refundMethod: RefundPaymentMethod | null = null
    let refundNotes: string | null = null
    let waiveReason: string | null = null

    if (reg.refundDecision === 'refunded') {
      // 用 audit log newValues 取，比再 search Payment 簡單
      if (typeof newVals.amount === 'number') refundedAmount = newVals.amount
      if (typeof newVals.method === 'string') refundMethod = newVals.method as RefundPaymentMethod
      if (typeof newVals.notes === 'string') refundNotes = newVals.notes
    } else {
      // waived
      if (typeof newVals.reason === 'string') waiveReason = newVals.reason
    }

    rows.push({
      registrationId: reg.id,
      decision: reg.refundDecision,
      decidedAt: log?.createdAt ?? null,
      decidedBy: log?.actorName ?? null,
      refundedAmount,
      refundMethod,
      refundNotes,
      waiveReason,
      sessionId: session.id,
      sessionDate: session.sessionDate,
      sessionStartTime: session.startTime,
      venueId: venue.id,
      venueName: venue.name,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
    })
  }

  return rows.sort((a, b) => {
    const at = a.decidedAt ?? ''
    const bt = b.decidedAt ?? ''
    if (at !== bt) return bt.localeCompare(at)
    return a.customerName.localeCompare(b.customerName, 'zh-Hant')
  })
}


// ── 15.4 Mutation：開退費（issueRefund）──────────────────────────

/**
 * 開退費：建一筆 Payment(amount<0, status='refunded') + Registration.refundDecision='refunded'。
 *
 * Guards（按順序）：
 *   - 找得到 Registration
 *   - 該 Session 必須是 cancelled 狀態
 *   - refundDecision 必須仍為 null（不可重複處理）
 *   - 淨付額（getRegistrationNetPaid）必須 > 0（要有錢可退）
 *   - amount 範圍：0 < amount ≤ netPaid
 *   - 樂觀鎖 checkBaseUpdatedAt(reg)
 *
 * 成功時：
 *   - 建 Payment(id=新生成, amount=-amount, method, status='refunded', notes, paidAt=now,
 *               registrationId=reg.id, recordedBy=current user)
 *   - patchRegistrationRefund(reg.id, 'refunded', now) — 同時 bump updatedAt
 *   - writeAudit ISSUE_REFUND（oldValues 含 refundDecision:null + updatedAt；
 *                            newValues 含 amount/method/notes/paymentId/refundDecision:'refunded'）
 */
export function issueRefund(args: {
  registrationId: string
  amount: number
  method: RefundPaymentMethod
  notes: string | null
  baseUpdatedAt?: string
}): { ok: true; paymentId: string } | { ok: false; reason: string } | ConflictResult {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }

  const session = GENERATED.sessions.find(s => s.id === reg.sessionId)
  if (!session) return { ok: false, reason: '找不到對應場次' }
  if (session.status !== 'cancelled') {
    return { ok: false, reason: '只能對已取消場次的報名開退費' }
  }

  if (reg.refundDecision !== null) {
    const label = reg.refundDecision === 'refunded' ? '已退款' : '已標記放棄退費'
    return { ok: false, reason: `此報名${label}，無法再處理` }
  }

  const netPaid = getRegistrationNetPaid(args.registrationId)
  if (netPaid <= 0) return { ok: false, reason: '此報名無可退款金額' }

  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    return { ok: false, reason: '退款金額必須大於 0' }
  }
  if (args.amount > netPaid) {
    return { ok: false, reason: `退款金額不能超過淨付額 NTD$ ${netPaid}` }
  }

  const venue = GENERATED.venues.find(v => v.id === session.venueId)
  const venueName = venue?.name ?? null
  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const customerName = customer?.name ?? '?'
  const actor = getAdminActor()
  const targetLabel = `${customerName} · ${session.sessionDate} ${session.startTime}`

  const conflict = checkBaseUpdatedAt(reg, args.baseUpdatedAt, {
    entityType: 'Registration',
    entityId: reg.id,
    actor,
    venue: venueName,
    targetLabel,
    attemptedPatch: {
      action: 'issueRefund',
      amount: args.amount,
      method: args.method,
      notes: args.notes,
    },
  })
  if (conflict) return conflict

  const now = new Date().toISOString()
  const paymentId = genId('pay')
  const payment: RefundPayment = {
    id: paymentId,
    registrationId: reg.id,
    recordedBy: getCurrentUserId(),
    amount: -args.amount,  // 負額表示退款
    method: args.method,
    status: 'refunded',
    notes: args.notes,
    paidAt: now,
  }
  addPayment(payment)

  const prevUpdatedAt = reg.updatedAt
  patchRegistrationRefund(reg.id, 'refunded', now)

  writeAudit({
    actor,
    venue: venueName,
    action: 'ISSUE_REFUND',
    entityType: 'Registration',
    entityId: reg.id,
    targetLabel,
    detail: `退款 NTD$ ${args.amount}（${args.method}）${args.notes ? `：${args.notes}` : ''}`,
    oldValues: {
      refundDecision: null,
      updatedAt: prevUpdatedAt,
      netPaidBefore: netPaid,
    },
    newValues: {
      refundDecision: 'refunded',
      amount: args.amount,
      method: args.method,
      notes: args.notes,
      paymentId,
      updatedAt: now,
    },
  })

  return { ok: true, paymentId }
}


// ── 15.5 Mutation：放棄退費（waiveRefund）──────────────────────

/**
 * 放棄退費：純標 Registration.refundDecision='waived'，不開 Payment。
 *
 * 適用情境：
 *   - 客戶口頭同意改下週、不需退錢
 *   - 用信用券 / 點數等系統外抵償
 *   - 金額太小（< 提款手續費）客戶同意作罷
 *
 * Guards 同 issueRefund，但跳過 amount 檢查。reason 必填。
 */
export function waiveRefund(args: {
  registrationId: string
  reason: string
  baseUpdatedAt?: string
}): { ok: true } | { ok: false; reason: string } | ConflictResult {
  const reg = GENERATED.registrations.find(r => r.id === args.registrationId)
  if (!reg) return { ok: false, reason: '找不到此報名' }

  const session = GENERATED.sessions.find(s => s.id === reg.sessionId)
  if (!session) return { ok: false, reason: '找不到對應場次' }
  if (session.status !== 'cancelled') {
    return { ok: false, reason: '只能對已取消場次的報名放棄退費' }
  }

  if (reg.refundDecision !== null) {
    const label = reg.refundDecision === 'refunded' ? '已退款' : '已標記放棄退費'
    return { ok: false, reason: `此報名${label}，無法再處理` }
  }

  const netPaid = getRegistrationNetPaid(args.registrationId)
  if (netPaid <= 0) return { ok: false, reason: '此報名無付款記錄，無需放棄' }

  const trimmedReason = args.reason.trim()
  if (!trimmedReason) return { ok: false, reason: '請填寫放棄退費的原因' }

  const venue = GENERATED.venues.find(v => v.id === session.venueId)
  const venueName = venue?.name ?? null
  const customer = GENERATED.customers.find(c => c.id === reg.customerId)
  const customerName = customer?.name ?? '?'
  const actor = getAdminActor()
  const targetLabel = `${customerName} · ${session.sessionDate} ${session.startTime}`

  const conflict = checkBaseUpdatedAt(reg, args.baseUpdatedAt, {
    entityType: 'Registration',
    entityId: reg.id,
    actor,
    venue: venueName,
    targetLabel,
    attemptedPatch: { action: 'waiveRefund', reason: trimmedReason },
  })
  if (conflict) return conflict

  const now = new Date().toISOString()
  const prevUpdatedAt = reg.updatedAt
  patchRegistrationRefund(reg.id, 'waived', now)

  writeAudit({
    actor,
    venue: venueName,
    action: 'WAIVE_REFUND',
    entityType: 'Registration',
    entityId: reg.id,
    targetLabel,
    detail: `放棄退費（NTD$ ${netPaid}）：${trimmedReason}`,
    oldValues: {
      refundDecision: null,
      updatedAt: prevUpdatedAt,
      netPaidAtWaive: netPaid,
    },
    newValues: {
      refundDecision: 'waived',
      reason: trimmedReason,
      updatedAt: now,
    },
  })

  return { ok: true }
}


// ── 15.6 Light 衍生：cancel session 提醒「待退費筆數」───────────

/**
 * 對某 session（通常剛取消的）回報「有幾筆 paid Registration 待處理退費」。
 *
 * 給 /sessions 取消對話框成功後 toast 用：
 *   「此場次有 N 筆已付款報名，請至 /finance > 待退費 處理」
 *
 * 純衍生：不變更任何 state。
 */
export function countPendingRefundsForSession(sessionId: string): number {
  let count = 0
  for (const reg of GENERATED.registrations) {
    if (reg.sessionId !== sessionId) continue
    if (reg.refundDecision !== null) continue
    if (getRegistrationNetPaid(reg.id) <= 0) continue
    count++
  }
  return count
}


// ============================================================
// 十六、新增場次 (階段 12) — 範本批量 + 單場手動
// ============================================================
// 兩種建立路徑共用 storeAddSession primitive + writeAudit('CREATE_SESSION')：
//   1. expandTimeslotToSessions — 範本批量：選 timeslot + 週數 → 一次展開 N 筆
//   2. createCustomSession      — 單場手動：完全自訂或 timeslot 帶入後微調
//
// 設計選擇：
//   - 「同 timeslot + 同日期」已存在 Session 時，batch 自動 skip 該日期（不報錯，預覽會標示）
//   - 不做 startTime/endTime 衝突偵測（同 timeslot 已是排好的時段邏輯，跨 timeslot 衝突極少）
//   - Session.createdBy = 當前登入 user.id
//   - 新建場次預設 status='open' / acEnabled=false（除非 form 給 true）/ isUnattended=false
//   - 範本批量不允許跨館（timeslot.venueId 即決定館）
// ============================================================

// Session / SessionType / NetHeight / SkillLevel 已於檔頂 import

/** 把 Date 物件 format 成 YYYY-MM-DD（避免時區飄）*/
function fmtDateYMD(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── 16.1 範本批量：預覽 ──────────────────────────────────────────

/**
 * 預覽：從某 timeslot 出發，往未來 N 週展開出來的「日期清單」。
 * 不寫任何資料；只回報 (date, skip 與否, 原因)。
 *
 * 邏輯：
 *   - 找 fromDate 之後（含當日）第一個符合 timeslot.dayOfWeek 的日期當起點
 *   - 之後每 7 天遞增，共 weeks 個
 *   - 對每個日期 check：GENERATED.sessions 是否已有 (timeslotId, sessionDate) 同組
 *     （含 cancelled — 取消的也算占用，否則 user 看不出來為何 skip）
 *   - 若已存在 → skip=true，reason 註明
 */
export function previewBatchSessionExpansion(args: {
  timeslotId: string
  fromDate: string  // YYYY-MM-DD，通常是今天
  weeks: number     // 2 / 4 / 8 / 12
}): { ok: false; reason: string } | {
  ok: true
  timeslot: Timeslot
  venueName: string
  dates: Array<{ date: string; skip: boolean; reason: string | null }>
  totalNew: number
  totalSkipped: number
} {
  const ts = GENERATED.timeslots.find(t => t.id === args.timeslotId)
  if (!ts) return { ok: false, reason: '找不到此時段範本' }
  if (args.weeks <= 0 || args.weeks > 26) return { ok: false, reason: '週數需介於 1~26' }

  const venueName = GENERATED.venues.find(v => v.id === ts.venueId)?.name ?? '未知球館'

  // 從 fromDate 起，找第一個符合 ts.dayOfWeek 的日期
  const start = new Date(args.fromDate + 'T00:00:00')
  const startDow = start.getDay()
  const offset = (ts.dayOfWeek - startDow + 7) % 7
  start.setDate(start.getDate() + offset)

  const dates: Array<{ date: string; skip: boolean; reason: string | null }> = []
  let totalNew = 0
  let totalSkipped = 0

  for (let i = 0; i < args.weeks; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    const dateStr = fmtDateYMD(d)
    const existing = GENERATED.sessions.find(
      s => s.timeslotId === ts.id && s.sessionDate === dateStr,
    )
    if (existing) {
      const reason = existing.status === 'cancelled'
        ? '此日已有相同範本場次（已取消，保留紀錄）'
        : '此日已有相同範本場次'
      dates.push({ date: dateStr, skip: true, reason })
      totalSkipped++
    } else {
      dates.push({ date: dateStr, skip: false, reason: null })
      totalNew++
    }
  }

  return { ok: true, timeslot: ts, venueName, dates, totalNew, totalSkipped }
}


// ── 16.2 範本批量：實際建立 ─────────────────────────────────────

/**
 * 範本批量建立 sessions。
 *
 * 拿 preview 的結果中 skip=false 的日期，逐筆建 Session：
 *   - id = `s-{timeslotId}-{dateStr}` (與 generator 命名一致)
 *   - 大部分欄位從 timeslot.default* 帶入
 *   - acFee 預設 0、acEnabled 預設 false（由開場員當日決定，不在新增時設定）
 *   - 一律 write 一筆 audit log，記錄此次建了哪些日期
 *
 * 為了減少 audit log 噪音：N 筆 sessions 只寫一筆 audit（newValues 列出所有 sessionIds），
 * 但若中途某筆寫入失敗（不該發生），會 partial commit 已建的不 rollback。
 */
export function expandTimeslotToSessions(args: {
  timeslotId: string
  fromDate: string
  weeks: number
  notes?: string | null
}): { ok: false; reason: string } | {
  ok: true
  createdSessionIds: string[]
  skippedDates: string[]
} {
  const preview = previewBatchSessionExpansion({
    timeslotId: args.timeslotId,
    fromDate: args.fromDate,
    weeks: args.weeks,
  })
  if (!preview.ok) return preview

  const ts = preview.timeslot
  const venueName = preview.venueName
  const actor = getAdminActor()
  const now = new Date().toISOString()
  const uid = getCurrentUserId()

  const createdSessionIds: string[] = []
  const skippedDates: string[] = []

  for (const entry of preview.dates) {
    if (entry.skip) {
      skippedDates.push(entry.date)
      continue
    }
    const id = `s-${ts.id}-${entry.date}`
    const session: Session = {
      id,
      venueId: ts.venueId,
      timeslotId: ts.id,
      seasonRentalId: null,
      createdBy: uid,
      sessionDate: entry.date,
      startTime: ts.startTime,
      endTime: ts.endTime,
      court: ts.court,
      netHeight: ts.defaultNetHeight,
      sessionType: ts.defaultSessionType,
      courtFee: ts.defaultCourtFee,
      acFee: 0,
      acEnabled: false,
      maxCapacity: ts.defaultMaxCapacity,
      minSkillRequired: ts.defaultMinSkillRequired,
      maxSkillAllowed: ts.defaultMaxSkillAllowed,
      status: 'open',
      isUnattended: false,
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
      venueName,
    }
    storeAddSession(session)
    createdSessionIds.push(id)
  }

  // 一筆彙整 audit（避免 N 筆 spam）
  writeAudit({
    actor,
    venue: venueName,
    action: 'CREATE_SESSION',
    entityType: 'Timeslot',
    entityId: ts.id,
    targetLabel: `${venueName} · ${ts.label ?? `${ts.startTime}-${ts.endTime}`}`,
    detail: `範本批量展開 ${createdSessionIds.length} 筆場次${skippedDates.length > 0 ? `（略過 ${skippedDates.length} 筆已存在日期）` : ''}`,
    newValues: {
      source: 'batch',
      timeslotId: ts.id,
      weeks: args.weeks,
      createdSessionIds,
      skippedDates,
    },
  })

  return { ok: true, createdSessionIds, skippedDates }
}


// ── 16.3 單場手動建立 ──────────────────────────────────────────

/**
 * 單場手動建立場次。
 *
 * 用於：
 *   - 臨時加場（無對應週週 timeslot）
 *   - 雖然有 timeslot 但本次 session 設定需與範本不同（手動帶入並調整）
 *
 * timeslotId 可為 null（臨時場次）。
 */
export function createCustomSession(args: {
  venueId: string
  timeslotId?: string | null
  sessionDate: string  // YYYY-MM-DD
  startTime: string    // HH:mm
  endTime: string      // HH:mm
  court?: string | null
  netHeight: NetHeight
  sessionType: SessionType
  courtFee: number
  acFee?: number
  acEnabled?: boolean
  maxCapacity: number
  minSkillRequired?: SkillLevel | null
  maxSkillAllowed?: SkillLevel | null
  notes?: string | null
}): { ok: false; reason: string } | { ok: true; sessionId: string } {
  // 基本驗證
  const venue = GENERATED.venues.find(v => v.id === args.venueId)
  if (!venue) return { ok: false, reason: '找不到此球館' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.sessionDate)) return { ok: false, reason: '日期格式錯誤' }
  if (!/^\d{2}:\d{2}$/.test(args.startTime) || !/^\d{2}:\d{2}$/.test(args.endTime)) {
    return { ok: false, reason: '時間格式錯誤' }
  }
  if (args.startTime >= args.endTime) return { ok: false, reason: '結束時間需晚於開始時間' }
  if (args.courtFee < 0)   return { ok: false, reason: '球費不可為負' }
  if (args.maxCapacity <= 0) return { ok: false, reason: '容量上限需 > 0' }

  const actor = getAdminActor()
  const now = new Date().toISOString()
  const uid = getCurrentUserId()
  const id = `s-custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`

  const session: Session = {
    id,
    venueId: args.venueId,
    timeslotId: args.timeslotId ?? null,
    seasonRentalId: null,
    createdBy: uid,
    sessionDate: args.sessionDate,
    startTime: args.startTime,
    endTime: args.endTime,
    court: args.court ?? null,
    netHeight: args.netHeight,
    sessionType: args.sessionType,
    courtFee: args.courtFee,
    acFee: args.acFee ?? 0,
    acEnabled: args.acEnabled ?? false,
    maxCapacity: args.maxCapacity,
    minSkillRequired: args.minSkillRequired ?? null,
    maxSkillAllowed: args.maxSkillAllowed ?? null,
    status: 'open',
    isUnattended: false,
    notes: args.notes ?? null,
    createdAt: now,
    updatedAt: now,
    venueName: venue.name,
  }

  storeAddSession(session)

  writeAudit({
    actor,
    venue: venue.name,
    action: 'CREATE_SESSION',
    entityType: 'Session',
    entityId: id,
    targetLabel: `${venue.name} · ${args.sessionDate} ${args.startTime}-${args.endTime}`,
    detail: `單場手動新增${args.timeslotId ? '（基於範本）' : '（臨時場次）'}`,
    newValues: {
      source: 'manual',
      timeslotId: args.timeslotId ?? null,
      sessionType: args.sessionType,
      courtFee: args.courtFee,
      maxCapacity: args.maxCapacity,
    },
  })

  return { ok: true, sessionId: id }
}
