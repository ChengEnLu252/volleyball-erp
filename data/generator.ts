// ============================================================
// 資料生成器 — Mock Data Generator
// ============================================================
// 此檔根據新的型別系統，產生「看起來像真的」的 mock 資料，
// 讓 Dashboard、報表、對帳等功能不再依賴寫死的數字。
//
// 設計原則：
//   1. 確定性 (Deterministic) — 同一天內每次重新整理頁面，
//      資料保持一致（用 mulberry32 seeded random）
//   2. 時間相對 — 所有日期相對於「今天」計算，每天 demo 都新鮮
//   3. 故意的異常 — 為 pitch 故事，刻意在某些館植入特定狀況：
//        - 飛翼  v3：贈送比例偏高（觸發 gift_ratio 異常）
//        - 球魔方 v1：冷門場次最近少開（觸發 revenue_drop）
//        - 日日   v4：運動飲料低庫存（觸發 low_stock）
//        - Playone v5：有主揪欠款（status=pending、paidAmount<totalAmount）
//
// 使用方式（內部）：
//   import { GENERATED } from '@/data/generator'
//   GENERATED.venues, GENERATED.sessions, ...
//
// 但外部頁面應從 @/data/mock 讀，那邊會做對外 API 包裝。
// ============================================================

import type {
  Venue, User, Customer, Timeslot, Season, SeasonRental,
  Session, Registration, Payment, Product, ProductTransaction,
  VenueDailySummary, DashboardData, AnomalyAlert, UnpaidRegistration,
  NetHeight, SkillLevel, SessionType, SessionStatus,
  RegistrationStatus, RegistrationType, RegistrationSource,
  PaymentMethod, PaymentStatus, ProductTransactionType, SeasonRentalStatus,
} from '@/types'


// ── 1. Seeded random（Mulberry32）─────────────────────────────

function mulberry32(seed: number): () => number {
  let state = seed
  return function () {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(42)

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(random() * arr.length)]
const randInt = (min: number, max: number): number => Math.floor(random() * (max - min + 1)) + min
const chance = (p: number): boolean => random() < p

function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0])
  }
  return out
}


// ── 2. Date helpers ─────────────────────────────────────────

const NOW = new Date()
NOW.setHours(0, 0, 0, 0)
const TODAY_STR = NOW.toISOString().split('T')[0]

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function daysAgoStr(n: number): string  { return dateAddDays(TODAY_STR, -n) }
function daysFutureStr(n: number): string { return dateAddDays(TODAY_STR,  n) }

function getDayOfWeek(dateStr: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

function isoAt(dateStr: string, h = 12, m = 0): string {
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${dateStr}T${hh}:${mm}:00Z`
}

const NOW_ISO = NOW.toISOString()


// ── 3. Static seed data ──────────────────────────────────────

const SURNAMES = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊',
  '許', '鄭', '謝', '郭', '洪', '邱', '曾', '廖', '賴', '周',
] as const

const GIVEN_NAMES = [
  '小明', '美玲', '大偉', '志豪', '雅婷', '建宏', '淑芬', '明哲',
  '依玲', '志明', '怡君', '政賢', '佳穎', '俊傑', '雅雯', '宗翰',
  '育誠', '佳儀', '柏翰', '思穎', '冠宇', '倩如', '俊宏', '惠雯',
  '志強', '雅琪', '凱翔', '婉婷', '家豪', '雅萍', '宗憲', '美君',
  '彥伶', '哲瑋', '靜怡', '昱廷', '心瑜', '宇翔', '怡萱', '俊豪',
  '盈君', '建志', '雅芳', '誌軒', '芳瑜', '冠廷', '思妤', '柏宇',
] as const

const PHONE_PREFIXES = ['0911', '0912', '0913', '0921', '0922', '0931', '0935'] as const

function randomPhone(): string {
  const p = pick(PHONE_PREFIXES)
  return `${p}-${String(randInt(100, 999))}-${String(randInt(100, 999))}`
}

// 程度分布加權（多數球友落在 B/B+/A）
const SKILL_POOL: SkillLevel[] = [
  'E', 'D',
  'C', 'C',
  'B', 'B', 'B', 'B', 'B', 'B',
  'B+', 'B+', 'B+', 'B+',
  'A', 'A', 'A',
  'A+', 'A+',
  'S',
  'S*',
]

function randomToken(): string {
  // 簡單長字串作為一次性連結 token 使用
  let t = ''
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  for (let i = 0; i < 24; i++) t += chars[Math.floor(random() * chars.length)]
  return t
}


// ── 4. Venues（保留原始 v1-v6 ID，shape 不變） ──────────────────

const VENUES: Venue[] = [
  { id: 'v1', name: '球魔方',  address: '台北市大安區復興南路一段', phone: '02-2701-xxxx', isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'v2', name: 'Ace',     address: '台北市信義區松仁路',       phone: '02-2345-xxxx', isActive: true, createdAt: '2022-03-01T00:00:00Z' },
  { id: 'v3', name: '飛翼',    address: '新北市板橋區文化路',       phone: '02-2956-xxxx', isActive: true, createdAt: '2022-06-01T00:00:00Z' },
  { id: 'v4', name: '日日',    address: '台北市中山區中山北路',     phone: '02-2521-xxxx', isActive: true, createdAt: '2023-01-01T00:00:00Z' },
  { id: 'v5', name: 'Playone', address: '台北市松山區八德路',       phone: '02-2748-xxxx', isActive: true, createdAt: '2023-06-01T00:00:00Z' },
  { id: 'v6', name: '就醬瘋',  address: '新北市新莊區新莊路',       phone: '02-2201-xxxx', isActive: true, createdAt: '2024-06-01T00:00:00Z' },
]

const VENUE_NAME_BY_ID: Record<string, string> =
  Object.fromEntries(VENUES.map(v => [v.id, v.name]))


// ── 5. Users（保留原始 u1-u4 ID） ────────────────────────────

const USERS: User[] = [
  { id: 'u1', name: '陳老闆',    email: 'boss@volleyball.tw', phone: '0912-xxx-001', globalRole: 'owner', isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'u2', name: '王館主',    email: 'wang@volleyball.tw', phone: '0912-xxx-002', globalRole: 'staff', isActive: true, createdAt: '2022-01-15T00:00:00Z' },
  { id: 'u3', name: '李小芳',    email: 'fang@volleyball.tw', phone: '0912-xxx-003', globalRole: 'staff', isActive: true, createdAt: '2022-02-01T00:00:00Z' },
  { id: 'u4', name: '工讀生小明', email: 'ming@volleyball.tw', phone: '0912-xxx-004', globalRole: 'staff', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
]

const USER_NAME_BY_ID: Record<string, string> =
  Object.fromEntries(USERS.map(u => [u.id, u.name]))


// ── 6. Customers（保留 c1-c10，加 c11..c50） ─────────────────

const ORIGINAL_CUSTOMERS: Customer[] = [
  { id: 'c1',  name: '林小明', phone: '0911-111-001', email: null,           skillLevel: 'B',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-06-01T00:00:00Z' },
  { id: 'c2',  name: '陳美玲', phone: '0911-111-002', email: 'ml@gmail.com', skillLevel: 'E',  preferredNetHeight: 'female',     notes: '態度好', isBanned: false, createdAt: '2023-01-15T00:00:00Z' },
  { id: 'c3',  name: '王大偉', phone: '0911-111-003', email: null,           skillLevel: 'A',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-08-20T00:00:00Z' },
  { id: 'c4',  name: '張志豪', phone: '0911-111-004', email: null,           skillLevel: 'D',  preferredNetHeight: 'adjustable', notes: null,     isBanned: false, createdAt: '2023-03-10T00:00:00Z' },
  { id: 'c5',  name: '劉雅婷', phone: '0911-111-005', email: 'yt@gmail.com', skillLevel: 'B+', preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2022-11-01T00:00:00Z' },
  { id: 'c6',  name: '吳建宏', phone: '0911-111-006', email: null,           skillLevel: 'S',  preferredNetHeight: 'male',       notes: null,     isBanned: false, createdAt: '2022-05-15T00:00:00Z' },
  { id: 'c7',  name: '黃淑芬', phone: '0911-111-007', email: 'sf@gmail.com', skillLevel: 'B',  preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2023-06-01T00:00:00Z' },
  { id: 'c8',  name: '楊明哲', phone: '0911-111-008', email: null,           skillLevel: 'A',  preferredNetHeight: 'male',       notes: '前國手', isBanned: false, createdAt: '2022-04-01T00:00:00Z' },
  { id: 'c9',  name: '蔡依玲', phone: '0911-111-009', email: null,           skillLevel: 'E',  preferredNetHeight: 'female',     notes: null,     isBanned: false, createdAt: '2024-01-10T00:00:00Z' },
  { id: 'c10', name: '鄭志明', phone: '0911-111-010', email: 'zm@gmail.com', skillLevel: 'B',  preferredNetHeight: 'adjustable', notes: null,     isBanned: false, createdAt: '2023-09-01T00:00:00Z' },
]

function generateExtraCustomers(start: number, count: number): Customer[] {
  const out: Customer[] = []
  const usedNames = new Set(ORIGINAL_CUSTOMERS.map(c => c.name))
  for (let i = 0; i < count; i++) {
    let name = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = pick(SURNAMES) + pick(GIVEN_NAMES).slice(-2)
      if (!usedNames.has(candidate)) { name = candidate; break }
    }
    if (!name) name = `${pick(SURNAMES)}${pick(GIVEN_NAMES)}${i}`
    usedNames.add(name)
    const id = `c${start + i}`
    const skill: SkillLevel = pick(SKILL_POOL)
    const netPref: NetHeight = chance(0.5) ? 'male' : chance(0.6) ? 'female' : 'adjustable'
    out.push({
      id, name,
      phone: randomPhone(),
      email: chance(0.4) ? `${id}@gmail.com` : null,
      skillLevel: skill,
      preferredNetHeight: netPref,
      notes: null,
      isBanned: false,
      createdAt: isoAt(daysAgoStr(randInt(30, 720)), randInt(8, 22)),
    })
  }
  return out
}

const CUSTOMERS: Customer[] = [
  ...ORIGINAL_CUSTOMERS,
  ...generateExtraCustomers(11, 40),  // c11..c50
]

const CUSTOMER_BY_ID: Record<string, Customer> =
  Object.fromEntries(CUSTOMERS.map(c => [c.id, c]))


// ── 7. Seasons（過去一季 + 當前一季） ────────────────────────

// 「當前一季」的中間是「今天」 ─ 這樣既有歷史也有未來
const CURRENT_SEASON_START = daysAgoStr(56)   // 8 週前
const CURRENT_SEASON_END   = daysFutureStr(28) // 4 週後（總長 12 週）
const PAST_SEASON_END      = daysAgoStr(57)
const PAST_SEASON_START    = dateAddDays(PAST_SEASON_END, -83)

const SEASONS: Season[] = [
  { id: 'sn-prev',    name: '上一季',  startDate: PAST_SEASON_START,    endDate: PAST_SEASON_END,    numWeeks: 12, isActive: false, createdAt: isoAt(PAST_SEASON_START) },
  { id: 'sn-current', name: '當前季',  startDate: CURRENT_SEASON_START, endDate: CURRENT_SEASON_END, numWeeks: 12, isActive: true,  createdAt: isoAt(CURRENT_SEASON_START) },
]


// ── 8. Timeslots（每館定義時段） ─────────────────────────────

/**
 * 內部 helper 型別 — 用來描述「每館要建立哪些時段」。
 * 比 hardcode 24 個 Timeslot object 簡潔很多。
 */
type TimeslotSpec = {
  venueId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  endTime: string
  court: string | null
  isHotZone: boolean
  defaultCourtFee: number
  defaultSessionType: SessionType
  defaultNetHeight: NetHeight
  defaultMinSkillRequired: SkillLevel | null
  defaultMaxSkillAllowed: SkillLevel | null
  label: string | null
}

const TIMESLOT_SPECS: TimeslotSpec[] = [
  // 飛翼 (v3) — 大型旗艦館，6 時段
  { venueId: 'v3', dayOfWeek: 4, startTime: '19:00', endTime: '22:00', court: 'A 場', isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週四黃金場' },
  { venueId: 'v3', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', court: 'A 場', isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週六晨光場' },
  { venueId: 'v3', dayOfWeek: 0, startTime: '14:00', endTime: '17:00', court: 'B 場', isHotZone: true,  defaultCourtFee: 300, defaultSessionType: 'male_position', defaultNetHeight: 'male',   defaultMinSkillRequired: 'A',  defaultMaxSkillAllowed: null, label: '週日進階場' },
  { venueId: 'v3', dayOfWeek: 5, startTime: '19:00', endTime: '22:00', court: 'A 場', isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_only',     defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週五純男場' },
  { venueId: 'v3', dayOfWeek: 2, startTime: '10:00', endTime: '13:00', court: 'B 場', isHotZone: false, defaultCourtFee: 220, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週二早場' },
  { venueId: 'v3', dayOfWeek: 3, startTime: '14:00', endTime: '17:00', court: 'B 場', isHotZone: false, defaultCourtFee: 220, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: 'B',  label: '週三女網場' },

  // Ace (v2) — 健康基準館，4 時段
  { venueId: 'v2', dayOfWeek: 5, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 300, defaultSessionType: 'male_only',     defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: 'A',  label: '週五黃金場' },
  { venueId: 'v2', dayOfWeek: 6, startTime: '14:00', endTime: '17:00', court: null,   isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週六午場' },
  { venueId: 'v2', dayOfWeek: 3, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週三晚場' },
  { venueId: 'v2', dayOfWeek: 1, startTime: '10:00', endTime: '13:00', court: null,   isHotZone: false, defaultCourtFee: 200, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週一早場' },

  // 球魔方 (v1) — 冷門場次少開故事館
  { venueId: 'v1', dayOfWeek: 6, startTime: '19:00', endTime: '22:00', court: 'A 場', isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_only',     defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週六晚黃金' },
  { venueId: 'v1', dayOfWeek: 0, startTime: '09:00', endTime: '12:00', court: 'A 場', isHotZone: true,  defaultCourtFee: 250, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週日晨場' },
  { venueId: 'v1', dayOfWeek: 4, startTime: '14:00', endTime: '17:00', court: 'A 場', isHotZone: false, defaultCourtFee: 200, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: 'B+', label: '週四冷門場' },
  { venueId: 'v1', dayOfWeek: 2, startTime: '14:00', endTime: '17:00', court: 'A 場', isHotZone: false, defaultCourtFee: 200, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週二午場' },

  // 日日 (v4) — 含一個無人場次、低庫存故事館
  { venueId: 'v4', dayOfWeek: 0, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 250, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週日晚黃金' },
  { venueId: 'v4', dayOfWeek: 4, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 250, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週四晚場' },
  { venueId: 'v4', dayOfWeek: 1, startTime: '14:00', endTime: '17:00', court: null,   isHotZone: false, defaultCourtFee: 180, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週一無人場' },

  // Playone (v5) — 主揪欠款故事館
  { venueId: 'v5', dayOfWeek: 0, startTime: '14:00', endTime: '17:00', court: null,   isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_position', defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週日午場（主揪場）' },
  { venueId: 'v5', dayOfWeek: 6, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 280, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: 'B',  defaultMaxSkillAllowed: null, label: '週六晚場' },
  { venueId: 'v5', dayOfWeek: 5, startTime: '14:00', endTime: '17:00', court: null,   isHotZone: false, defaultCourtFee: 200, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週五午場' },
  { venueId: 'v5', dayOfWeek: 2, startTime: '09:00', endTime: '12:00', court: null,   isHotZone: false, defaultCourtFee: 180, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週二早場' },

  // 就醬瘋 (v6) — 最小最新館
  { venueId: 'v6', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', court: null,   isHotZone: true,  defaultCourtFee: 250, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週六晨場' },
  { venueId: 'v6', dayOfWeek: 0, startTime: '19:00', endTime: '22:00', court: null,   isHotZone: true,  defaultCourtFee: 250, defaultSessionType: 'male_mixed',    defaultNetHeight: 'male',   defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週日晚場' },
  { venueId: 'v6', dayOfWeek: 3, startTime: '14:00', endTime: '17:00', court: null,   isHotZone: false, defaultCourtFee: 180, defaultSessionType: 'female_mixed',  defaultNetHeight: 'female', defaultMinSkillRequired: null, defaultMaxSkillAllowed: null, label: '週三午場' },
]

const TIMESLOTS: Timeslot[] = TIMESLOT_SPECS.map((spec, idx) => ({
  id: `ts${idx + 1}`,
  venueId: spec.venueId,
  label: spec.label,
  dayOfWeek: spec.dayOfWeek,
  startTime: spec.startTime,
  endTime: spec.endTime,
  court: spec.court,
  defaultNetHeight: spec.defaultNetHeight,
  defaultSessionType: spec.defaultSessionType,
  defaultMinSkillRequired: spec.defaultMinSkillRequired,
  defaultMaxSkillAllowed: spec.defaultMaxSkillAllowed,
  defaultMaxCapacity: 18,
  defaultCourtFee: spec.defaultCourtFee,
  isHotZone: spec.isHotZone,
  isActive: true,
  createdAt: isoAt(PAST_SEASON_START, 9),
  updatedAt: isoAt(PAST_SEASON_START, 9),
}))

const TIMESLOT_BY_ID: Record<string, Timeslot> =
  Object.fromEntries(TIMESLOTS.map(t => [t.id, t]))


// ── 9. SeasonRentals（5 張，1 張欠款） ───────────────────────

/** 內部 helper：哪些時段有主揪 */
const RENTAL_SPECS: { timeslotId: string; captainId: string; status: SeasonRentalStatus; paidRatio: number }[] = [
  { timeslotId: 'ts1',  captainId: 'c8',  status: 'active', paidRatio: 1.0 },  // 飛翼週四晚 — 主揪楊明哲（前國手）
  { timeslotId: 'ts2',  captainId: 'c3',  status: 'active', paidRatio: 1.0 },  // 飛翼週六晨 — 主揪王大偉
  { timeslotId: 'ts7',  captainId: 'c6',  status: 'active', paidRatio: 1.0 },  // Ace 週五晚 — 主揪吳建宏（S 程度）
  { timeslotId: 'ts11', captainId: 'c10', status: 'active', paidRatio: 1.0 },  // 球魔方週六晚 — 主揪鄭志明
  { timeslotId: 'ts18', captainId: 'c1',  status: 'pending', paidRatio: 0.5 }, // Playone 週日午 — 主揪林小明（欠款）
]

const SEASON_RENTALS: SeasonRental[] = RENTAL_SPECS.map((spec, idx) => {
  const timeslot = TIMESLOT_BY_ID[spec.timeslotId]
  const captain  = CUSTOMER_BY_ID[spec.captainId]
  const venueName = VENUE_NAME_BY_ID[timeslot.venueId]
  const pricePerSession = timeslot.defaultCourtFee * 18
  const totalAmount = pricePerSession * 12
  const paidAmount = Math.round(totalAmount * spec.paidRatio)
  return {
    id: `sr${idx + 1}`,
    timeslotId: spec.timeslotId,
    seasonId: 'sn-current',
    captainId: spec.captainId,
    pricePerSession,
    totalAmount,
    paidAmount,
    accessToken: randomToken(),
    accessTokenExpiresAt: isoAt(CURRENT_SEASON_END, 23, 59),
    status: spec.status,
    notes: null,
    createdAt: isoAt(CURRENT_SEASON_START, 10),
    updatedAt: isoAt(CURRENT_SEASON_START, 10),
    captainName: captain.name,
    captainPhone: captain.phone ?? '',
    venueName,
    seasonName: '當前季',
    timeslotLabel: timeslot.label ?? `${timeslot.startTime}-${timeslot.endTime}`,
  }
})

const RENTAL_BY_TIMESLOT: Record<string, SeasonRental> =
  Object.fromEntries(SEASON_RENTALS.map(r => [r.timeslotId, r]))


// ── 10. Sessions（過去 8 週 + 未來 4 週 × 24 時段） ──────────

/** 找出某個 dateStr 屬於哪個 Season，回傳 seasonId */
function seasonFor(dateStr: string): string | null {
  for (const s of SEASONS) {
    if (dateStr >= s.startDate && dateStr <= s.endDate) return s.id
  }
  return null
}

const SESSIONS: Session[] = []

for (let dayOffset = -56; dayOffset <= 28; dayOffset++) {
  const dateStr = dateAddDays(TODAY_STR, dayOffset)
  const dow = getDayOfWeek(dateStr)

  for (const ts of TIMESLOTS) {
    if (ts.dayOfWeek !== dow) continue

    // 球魔方 v1 故事：最近 7 天的「冷門時段」改成 cancelled，營收驟降
    const isMagicblockColdRecent = ts.venueId === 'v1' && !ts.isHotZone && dayOffset >= -7 && dayOffset <= 0
    if (isMagicblockColdRecent && chance(0.85)) continue  // 85% 機率乾脆不開

    // 一般情況下每週 ~92% 會開（偶爾停場）
    if (!isMagicblockColdRecent && chance(0.08)) continue

    const isPastOrToday = dayOffset <= 0
    const status: SessionStatus =
      dayOffset < 0  ? 'completed'
      : dayOffset === 0 ? (chance(0.6) ? 'completed' : 'open')
      : 'open'

    // 是否被季租履行：只有 active 狀態的 SeasonRental，且 dateStr 在當前季內
    const rental = RENTAL_BY_TIMESLOT[ts.id]
    const isSeasonRented =
      rental !== undefined &&
      rental.status === 'active' &&
      dateStr >= CURRENT_SEASON_START &&
      dateStr <= CURRENT_SEASON_END

    // 冷氣費：模擬「夏天才開」— 我們以「現在離夏季多遠」當機率近似（簡化版）
    // 為了 demo 直接用機率：50% 場次有設定冷氣費，30% 實際開冷氣
    const hasAcFee = chance(0.5)
    const acFee = hasAcFee ? randInt(20, 30) : 0
    const acEnabled = hasAcFee && chance(0.6)

    // 日日 v4 週一：固定為無人場次
    const isUnattended = ts.venueId === 'v4' && ts.dayOfWeek === 1

    SESSIONS.push({
      id: `s-${ts.id}-${dateStr}`,
      venueId: ts.venueId,
      timeslotId: ts.id,
      seasonRentalId: isSeasonRented ? rental.id : null,
      createdBy: 'u2',
      sessionDate: dateStr,
      startTime: ts.startTime,
      endTime: ts.endTime,
      court: ts.court,
      netHeight: ts.defaultNetHeight,
      sessionType: ts.defaultSessionType,
      courtFee: ts.defaultCourtFee,
      acFee,
      acEnabled,
      maxCapacity: ts.defaultMaxCapacity,
      minSkillRequired: ts.defaultMinSkillRequired,
      maxSkillAllowed: ts.defaultMaxSkillAllowed,
      status,
      isUnattended,
      notes: null,
      createdAt: isoAt(dateAddDays(dateStr, -3), 10),
      updatedAt: isoAt(dateStr, 8),
      venueName: VENUE_NAME_BY_ID[ts.venueId],
    })
  }
}


// ── 11. Registrations + Payments ─────────────────────────────

const REGISTRATIONS: Registration[] = []
const PAYMENTS: Payment[] = []

let regSeq = 0
let paySeq = 0

/** 飛翼故事：贈送比例偏高，用來標記哪些 customer 在飛翼曾「免費」 */
const flywingFreeloaders = pickN(CUSTOMERS, 12).map(c => c.id)

for (const session of SESSIONS) {
  const rental = session.seasonRentalId
    ? SEASON_RENTALS.find(r => r.id === session.seasonRentalId) ?? null
    : null

  // 出席率規則：
  //  - 熱門 + 季租：固定 18 個季打人員（其中可能有 1-2 請假找補位）
  //  - 熱門無季租：80-100% 滿場
  //  - 冷門：40-70%
  const ts = session.timeslotId ? TIMESLOT_BY_ID[session.timeslotId] : null
  const isHot = ts?.isHotZone ?? true

  let regsToAdd: { customerId: string; type: RegistrationType }[] = []

  if (rental) {
    // 季打 18 人 — 隨機挑 18 個 Customer 作為這個 captain 的「常客團」
    // 為了一致性，我們用 captainId + timeslotId 的雜湊風格挑出固定 17 + captain
    const teamSize = 18
    const teamCustomers = pickN(CUSTOMERS.filter(c => c.id !== rental.captainId), teamSize - 1)
    const team = [rental.captainId, ...teamCustomers.map(c => c.id)]

    // 1-2 人請假
    const absentCount = chance(0.6) ? randInt(0, 2) : 0
    const absentIds = pickN(team, absentCount).map(String)

    // 季打到場
    for (const cid of team) {
      if (absentIds.includes(cid)) continue
      regsToAdd.push({ customerId: cid, type: 'season_player' })
    }

    // 補位
    const subPool = CUSTOMERS.filter(c => !team.includes(c.id))
    for (let i = 0; i < absentCount && subPool.length > 0; i++) {
      const sub = pickN(subPool, 1)[0]
      regsToAdd.push({ customerId: sub.id, type: 'season_substitute' })
    }
  } else {
    // 純臨打場
    const fillRate = isHot ? 0.85 : 0.55
    const baseCount = Math.round(session.maxCapacity * fillRate)
    const jitter = randInt(-2, 2)
    const count = Math.max(4, Math.min(session.maxCapacity, baseCount + jitter))
    const selected = pickN(CUSTOMERS, count)
    for (const c of selected) {
      regsToAdd.push({ customerId: c.id, type: 'walk_in' })
    }
  }

  // 寫入 Registration + Payment
  for (const r of regsToAdd) {
    regSeq++
    const isPaid = r.type === 'season_player'
      ? true  // 季打不另外付款，視為已付
      : chance(session.isUnattended ? 0.75 : 0.85)  // 無人場次自助付款率略低
    const isUnpaidWalkInWaiting = !isPaid && session.status !== 'completed'

    const regStatus: RegistrationStatus =
      session.status === 'completed' ? 'attended' :
      session.status === 'cancelled' ? 'cancelled' :
      'registered'

    const source: RegistrationSource =
      r.type === 'season_player' || r.type === 'season_substitute'
        ? (rental ? 'captain' : 'self')
        : (session.isUnattended ? 'self' : 'staff')

    const registeredBy = source === 'staff' ? pick(['u2', 'u3', 'u4']) : null

    const regId = `r${regSeq}`
    const expectedAmount =
      r.type === 'season_player'
        ? 0
        : session.courtFee + (session.acEnabled ? session.acFee : 0)

    // 自助回報（無人場次）
    let selfReportedPaid = false
    let selfPaymentMethod: PaymentMethod | null = null
    let selfPaymentEvidence: string | null = null
    let selfReportedAt: string | null = null
    if (session.isUnattended && r.type !== 'season_player') {
      selfReportedPaid = isPaid
      if (isPaid) {
        selfPaymentMethod = pick(['cash', 'transfer', 'online'] as PaymentMethod[])
        selfPaymentEvidence = selfPaymentMethod === 'transfer' ? `transfer_${regId}.jpg` : null
        selfReportedAt = isoAt(session.sessionDate, randInt(8, 22), randInt(0, 59))
      }
    }

    REGISTRATIONS.push({
      id: regId,
      sessionId: session.id,
      customerId: r.customerId,
      type: r.type,
      registeredBy,
      registeredBySource: source,
      status: regStatus,
      notes: null,
      registeredAt: isoAt(dateAddDays(session.sessionDate, -randInt(1, 7)), randInt(8, 22)),
      selfReportedPaid,
      selfPaymentMethod,
      selfPaymentEvidence,
      selfReportedAt,
      customerName: CUSTOMER_BY_ID[r.customerId]?.name,
      customerPhone: CUSTOMER_BY_ID[r.customerId]?.phone ?? undefined,
      customerSkillLevel: CUSTOMER_BY_ID[r.customerId]?.skillLevel ?? undefined,
      paymentStatus: isPaid ? 'paid' : (isUnpaidWalkInWaiting ? 'unpaid' : 'unpaid'),
      paymentMethod: undefined,  // 視 Payment 記錄填入
      paidAmount: isPaid && r.type !== 'season_player' ? expectedAmount : 0,
      expectedAmount,
    })

    // 產生 Payment 記錄（季打人員不另外產生 Payment）
    if (isPaid && r.type !== 'season_player') {
      paySeq++
      const method: PaymentMethod = session.isUnattended
        ? (selfPaymentMethod ?? 'cash')
        : pick(['cash', 'cash', 'cash', 'transfer', 'online'] as PaymentMethod[])
      PAYMENTS.push({
        id: `pay${paySeq}`,
        registrationId: regId,
        recordedBy: registeredBy ?? 'u2',
        amount: expectedAmount,
        method,
        status: 'paid',
        notes: null,
        paidAt: isoAt(session.sessionDate, randInt(9, 22), randInt(0, 59)),
      })
      // 補上 reg 的 paymentMethod 衍生
      REGISTRATIONS[REGISTRATIONS.length - 1].paymentMethod = method
    }
  }

  // 衍生 currentCount + expectedRevenue + actualRevenue 寫回 session
  const sessionRegs = REGISTRATIONS.filter(reg => reg.sessionId === session.id && reg.status !== 'cancelled')
  session.currentCount = sessionRegs.length
  session.expectedRevenue = sessionRegs.reduce((sum, r) => sum + (r.expectedAmount ?? 0), 0)
  session.actualRevenue = sessionRegs.reduce((sum, r) => sum + (r.paidAmount ?? 0), 0)
}


// ── 12. Products & ProductTransactions ───────────────────────

const PRODUCTS: Product[] = [
  { id: 'p1', venueId: null, name: '運動飲料', sku: 'DRK-001', unitPrice: 35,  currentStock: 35, lowStockThreshold: 5,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p2', venueId: null, name: '護膝',     sku: 'EQP-001', unitPrice: 280, currentStock: 22, lowStockThreshold: 5,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p3', venueId: null, name: '排球',     sku: 'EQP-002', unitPrice: 850, currentStock: 16, lowStockThreshold: 3,  isActive: true, createdAt: '2022-01-01T00:00:00Z' },
  { id: 'p4', venueId: 'v1', name: '球魔方帽', sku: 'MRK-001', unitPrice: 250, currentStock: 24, lowStockThreshold: 10, isActive: true, createdAt: '2023-06-01T00:00:00Z' },
]

const PRODUCT_TRANSACTIONS: ProductTransaction[] = []
let txSeq = 0

// 過去 30 天的商品交易
for (let dayOffset = -30; dayOffset <= 0; dayOffset++) {
  const dateStr = dateAddDays(TODAY_STR, dayOffset)

  for (const venue of VENUES) {
    // 飛翼故事：此館贈送特別多（gift_ratio 異常）
    const isFlywingExtraGifts = venue.id === 'v3' && dayOffset >= -7

    const dailyTxCount = randInt(2, 6) + (isFlywingExtraGifts ? randInt(2, 4) : 0)

    for (let i = 0; i < dailyTxCount; i++) {
      const product = pick(PRODUCTS)
      const isGift = isFlywingExtraGifts ? chance(0.6) : chance(0.12)
      const txType: ProductTransactionType = isGift ? 'gift' : 'sale'

      txSeq++
      const customerId = chance(0.7) ? pick(CUSTOMERS).id : null
      const operator = pick(['u4', 'u4', 'u3', 'u2'] as const)
      const qty = -1
      const unitPrice = txType === 'sale' ? product.unitPrice : null
      const totalAmount = txType === 'sale' ? product.unitPrice : null

      PRODUCT_TRANSACTIONS.push({
        id: `pt${txSeq}`,
        productId: product.id,
        venueId: venue.id,
        operatedBy: operator,
        type: txType,
        quantity: qty,
        unitPrice,
        totalAmount,
        customerId,
        sessionId: null,
        notes: txType === 'gift' ? (isFlywingExtraGifts ? '教練贈送' : '回饋') : null,
        operatedAt: isoAt(dateStr, randInt(9, 22), randInt(0, 59)),
        productName: product.name,
        operatorName: USER_NAME_BY_ID[operator],
        customerName: customerId ? CUSTOMER_BY_ID[customerId]?.name : undefined,
      })
    }
  }
}


// ── 13. 各館每館商品（供 products page 使用，shape 不變） ────

type VenueProductShape = {
  venueId: string
  venueName: string
  products: { id: string; name: string; unitPrice: number; currentStock: number; lowStockThreshold: number; isShared: boolean }[]
}

const VENUE_PRODUCTS: VenueProductShape[] = [
  {
    venueId: 'v1', venueName: '球魔方',
    products: [
      { id: 'v1p1', name: '運動飲料', unitPrice: 35,  currentStock: 18, lowStockThreshold: 5,  isShared: true },
      { id: 'v1p2', name: '護膝',     unitPrice: 280, currentStock: 8,  lowStockThreshold: 3,  isShared: true },
      { id: 'v1p3', name: '球魔方帽', unitPrice: 250, currentStock: 24, lowStockThreshold: 10, isShared: false },
      { id: 'v1p4', name: '運動襪',   unitPrice: 80,  currentStock: 30, lowStockThreshold: 10, isShared: false },
    ],
  },
  {
    venueId: 'v2', venueName: 'Ace',
    products: [
      { id: 'v2p1', name: '運動飲料', unitPrice: 35,  currentStock: 12, lowStockThreshold: 5, isShared: true },
      { id: 'v2p2', name: '護膝',     unitPrice: 280, currentStock: 4,  lowStockThreshold: 3, isShared: true },
      { id: 'v2p3', name: '護踝',     unitPrice: 180, currentStock: 6,  lowStockThreshold: 3, isShared: false },
    ],
  },
  {
    // 飛翼：故事 — 運動飲料庫存接近警戒
    venueId: 'v3', venueName: '飛翼',
    products: [
      { id: 'v3p1', name: '運動飲料', unitPrice: 35,  currentStock: 3,  lowStockThreshold: 5, isShared: true },
      { id: 'v3p2', name: '護膝',     unitPrice: 280, currentStock: 10, lowStockThreshold: 3, isShared: true },
      { id: 'v3p3', name: '排球',     unitPrice: 850, currentStock: 5,  lowStockThreshold: 2, isShared: false },
      { id: 'v3p4', name: '運動毛巾', unitPrice: 120, currentStock: 15, lowStockThreshold: 5, isShared: false },
    ],
  },
  {
    // 日日：故事 — 運動飲料 stock=2 觸發低庫存警告
    venueId: 'v4', venueName: '日日',
    products: [
      { id: 'v4p1', name: '運動飲料', unitPrice: 35,  currentStock: 2,  lowStockThreshold: 5,  isShared: true },
      { id: 'v4p2', name: '護膝',     unitPrice: 280, currentStock: 6,  lowStockThreshold: 3,  isShared: true },
      { id: 'v4p3', name: '運動襪',   unitPrice: 80,  currentStock: 45, lowStockThreshold: 10, isShared: false },
    ],
  },
  {
    venueId: 'v5', venueName: 'Playone',
    products: [
      { id: 'v5p1', name: '運動飲料', unitPrice: 35,  currentStock: 20, lowStockThreshold: 5, isShared: true },
      { id: 'v5p2', name: '護膝',     unitPrice: 280, currentStock: 2,  lowStockThreshold: 3, isShared: true },
      { id: 'v5p3', name: '排球',     unitPrice: 850, currentStock: 3,  lowStockThreshold: 2, isShared: false },
      { id: 'v5p4', name: '護踝',     unitPrice: 180, currentStock: 8,  lowStockThreshold: 3, isShared: false },
      { id: 'v5p5', name: '運動毛巾', unitPrice: 120, currentStock: 0,  lowStockThreshold: 5, isShared: false },
    ],
  },
]


// ── 14. 衍生彙總（VenueDailySummary、Dashboard 等） ──────────

function computeVenueDailySummary(venueId: string, dateStr: string): VenueDailySummary {
  const venueName = VENUE_NAME_BY_ID[venueId]
  const todaySessions = SESSIONS.filter(s => s.venueId === venueId && s.sessionDate === dateStr)
  const todayRegs = REGISTRATIONS.filter(r =>
    todaySessions.some(s => s.id === r.sessionId) && r.status !== 'cancelled'
  )
  const todayTx = PRODUCT_TRANSACTIONS.filter(t =>
    t.venueId === venueId && t.operatedAt.startsWith(dateStr)
  )

  const sessionRev    = todaySessions.reduce((sum, s) => sum + (s.actualRevenue ?? 0), 0)
  const productRev    = todayTx.filter(t => t.type === 'sale').reduce((sum, t) => sum + (t.totalAmount ?? 0), 0)
  const totalRevenue  = sessionRev + productRev

  const giftCount = todayTx.filter(t => t.type === 'gift').length
  const saleCount = todayTx.filter(t => t.type === 'sale').length
  const giftRatio = saleCount + giftCount > 0
    ? Math.round((giftCount / (saleCount + giftCount)) * 100)
    : 0

  const unpaidRegs = todayRegs.filter(r => (r.expectedAmount ?? 0) > 0 && (r.paidAmount ?? 0) === 0)
  const unpaidAmount = unpaidRegs.reduce((sum, r) => sum + (r.expectedAmount ?? 0), 0)

  const venueProducts = VENUE_PRODUCTS.find(v => v.venueId === venueId)?.products ?? []
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

const VENUE_SUMMARIES_TODAY: VenueDailySummary[] =
  VENUES.map(v => computeVenueDailySummary(v.id, TODAY_STR))

/** 計算近 7 日 vs 前 7 日的營收變化（用於 revenue_drop 警示） */
function venueRevenueDelta(venueId: string): number {
  const last7 = Array.from({ length: 7 }, (_, i) => daysAgoStr(i)).reduce((sum, d) =>
    sum + computeVenueDailySummary(venueId, d).totalRevenue, 0)
  const prev7 = Array.from({ length: 7 }, (_, i) => daysAgoStr(7 + i)).reduce((sum, d) =>
    sum + computeVenueDailySummary(venueId, d).totalRevenue, 0)
  if (prev7 === 0) return 0
  return Math.round(((last7 - prev7) / prev7) * 100)
}

const ALERTS: AnomalyAlert[] = []
let alertSeq = 0

for (const v of VENUES) {
  const summary = VENUE_SUMMARIES_TODAY.find(s => s.venueId === v.id)
  if (!summary) continue

  if (summary.giftRatio > 30) {
    alertSeq++
    ALERTS.push({
      id: `a${alertSeq}`,
      type: 'gift_ratio',
      severity: 'warning',
      venueId: v.id,
      venueName: v.name,
      message: `今日贈送商品比例 ${summary.giftRatio}%，超過標準值 20%`,
      createdAt: isoAt(TODAY_STR, randInt(10, 16), randInt(0, 59)),
      isRead: false,
    })
  }

  if (summary.stockAlerts > 0) {
    const lowStockProduct = VENUE_PRODUCTS.find(vp => vp.venueId === v.id)
      ?.products.find(p => p.currentStock <= p.lowStockThreshold)
    if (lowStockProduct) {
      alertSeq++
      ALERTS.push({
        id: `a${alertSeq}`,
        type: 'low_stock',
        severity: 'warning',
        venueId: v.id,
        venueName: v.name,
        message: `${lowStockProduct.name}庫存剩 ${lowStockProduct.currentStock} 個，低於安全水位 ${lowStockProduct.lowStockThreshold} 個`,
        createdAt: isoAt(TODAY_STR, randInt(8, 14), randInt(0, 59)),
        isRead: false,
      })
    }
  }

  const delta = venueRevenueDelta(v.id)
  if (delta < -10) {
    alertSeq++
    ALERTS.push({
      id: `a${alertSeq}`,
      type: 'revenue_drop',
      severity: delta < -25 ? 'critical' : 'warning',
      venueId: v.id,
      venueName: v.name,
      message: `本週收入較上週同期下降 ${Math.abs(delta)}%`,
      createdAt: isoAt(TODAY_STR, 9, 0),
      isRead: false,
    })
  }
}


// ── 15. 未付款名單 ──────────────────────────────────────────

const UNPAID: UnpaidRegistration[] = REGISTRATIONS
  .filter(r =>
    r.status !== 'cancelled' &&
    (r.expectedAmount ?? 0) > 0 &&
    (r.paidAmount ?? 0) === 0
  )
  .map(r => {
    const session = SESSIONS.find(s => s.id === r.sessionId)
    if (!session) return null
    if (session.sessionDate !== TODAY_STR) return null
    const sessionDateStr = session.sessionDate
    const sessionStartIso = isoAt(sessionDateStr, parseInt(session.startTime.slice(0, 2), 10), parseInt(session.startTime.slice(3, 5), 10))
    const waitedMs = NOW.getTime() - new Date(sessionStartIso).getTime()
    const waitedMinutes = Math.max(0, Math.floor(waitedMs / 60000))
    return {
      registrationId: r.id,
      customerName: r.customerName ?? '—',
      venueId: session.venueId,
      venueName: VENUE_NAME_BY_ID[session.venueId],
      sessionDate: session.sessionDate,
      sessionTime: session.startTime,
      sessionType: session.sessionType,
      amount: r.expectedAmount ?? 0,
      method: 'cash' as PaymentMethod,
      waitedMinutes,
    }
  })
  .filter((x): x is UnpaidRegistration => x !== null)
  .slice(0, 8)


// ── 16. Dashboard 彙總 ──────────────────────────────────────

const DASHBOARD: DashboardData = {
  date: TODAY_STR,
  venues: VENUE_SUMMARIES_TODAY,
  totalRevenue: VENUE_SUMMARIES_TODAY.reduce((s, v) => s + v.totalRevenue, 0),
  totalPlayers: VENUE_SUMMARIES_TODAY.reduce((s, v) => s + v.totalPlayers, 0),
  totalSessions: VENUE_SUMMARIES_TODAY.reduce((s, v) => s + v.totalSessions, 0),
  totalUnpaid: VENUE_SUMMARIES_TODAY.reduce((s, v) => s + v.unpaidCount, 0),
  alerts: ALERTS,
  unpaidRegistrations: UNPAID,
}


// ── 17. Export ──────────────────────────────────────────────

export const GENERATED = {
  venues: VENUES,
  users: USERS,
  customers: CUSTOMERS,
  seasons: SEASONS,
  timeslots: TIMESLOTS,
  seasonRentals: SEASON_RENTALS,
  sessions: SESSIONS,
  registrations: REGISTRATIONS,
  payments: PAYMENTS,
  products: PRODUCTS,
  productTransactions: PRODUCT_TRANSACTIONS,
  venueProducts: VENUE_PRODUCTS,
  venueSummaries: VENUE_SUMMARIES_TODAY,
  alerts: ALERTS,
  unpaid: UNPAID,
  dashboard: DASHBOARD,
} as const