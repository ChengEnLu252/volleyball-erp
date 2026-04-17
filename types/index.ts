// ============================================================
// 排球場館 ERP — 核心型別定義
// 這份檔案是整個系統的「語言」，前後端共用
// ============================================================

// ── 通用 ────────────────────────────────────────────────────

export type UUID = string

export type Timestamp = string // ISO 8601

// ── 角色與權限 ───────────────────────────────────────────────

/** 系統全域角色 */
export type GlobalRole = 'owner' | 'staff'

/** 球館內角色（staff 才需要） */
export type VenueRole = 'manager' | 'staff'

// ── 球館 ─────────────────────────────────────────────────────

export interface Venue {
  id: UUID
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: Timestamp
}

// ── 使用者（操作系統的人） ────────────────────────────────────

export interface User {
  id: UUID
  name: string
  email: string
  phone: string | null
  globalRole: GlobalRole
  isActive: boolean
  createdAt: Timestamp
}

export interface UserVenueRole {
  userId: UUID
  venueId: UUID
  role: VenueRole
}

// ── 客戶（打球的人） ─────────────────────────────────────────

/** 程度標籤（由低到高） */
export type SkillLevel = 'E' | 'D' | 'C' | 'B' | 'B+' | 'A' | 'A+' | 'S' | 'S*'

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  'E':  'E｜新手',
  'D':  'D｜新手',
  'C':  'C｜新手',
  'B':  'B｜普通系隊',
  'B+': 'B+｜普通系隊',
  'A':  'A｜一般組校隊',
  'A+': 'A+｜一般組校隊',
  'S':  'S｜公開組以上',
  'S*': 'S*｜公開組以上',
}

export const SKILL_LEVEL_DESC: Record<SkillLevel, string> = {
  'E':  '能跳起來擊中球，不知道任何排球技巧',
  'D':  '知道攻擊步和揮臂動作，還難以完整實行在擊球上',
  'C':  '能做出連貫的攻擊動作，能固定姿勢擊球，仍難以控制球品質',
  'B':  '熟練攻擊步和揮臂，能著實擊中好的舉球並打進界內',
  'B+': '能夠將好的舉球打出有威力的攻擊，並能打進網網修正球',
  'A':  '能辨認攔網，對好的舉球可以閃手做出變線攻擊並打進界內',
  'A+': '能對開網球（1.5m+）打出有威力的攻擊，且有一定的後排進攻能力',
  'S':  '80% 以上的舉球能打出有威脅性的攻擊，有好的舉球時能突破得分',
  'S*': '80% 以上的舉球打出強力攻擊，後排攻擊能突破得分',
}

/** 網高選項 */
export type NetHeight = 'female' | 'male' | 'adjustable'

export const NET_HEIGHT_LABEL: Record<NetHeight, string> = {
  female:     '女網 (2.24m)',
  male:       '男網 (2.43m)',
  adjustable: '可調',
}

export interface Customer {
  id: UUID
  name: string
  phone: string | null  // 唯一，作為主要識別
  email: string | null
  skillLevel: SkillLevel | null
  preferredNetHeight: NetHeight | null
  notes: string | null
  isBanned: boolean
  createdAt: Timestamp
}

// ── 場次 ─────────────────────────────────────────────────────

export type SessionType = 'male_only' | 'male_mixed' | 'male_position' | 'female_only' | 'female_mixed' | 'female_position' | 'rental'

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  male_only:       '男網純男',
  male_mixed:      '男網混排',
  male_position:   '男網專位',
  female_only:     '女網純女',
  female_mixed:    '女網混排',
  female_position: '女網專位',
  rental:          '包場',
}

export type SessionStatus = 'open' | 'full' | 'cancelled' | 'completed'

export interface Session {
  id: UUID
  venueId: UUID
  createdBy: UUID
  sessionDate: string        // YYYY-MM-DD
  startTime: string          // HH:mm
  endTime: string            // HH:mm
  court: string | null       // 場地編號
  netHeight: NetHeight
  sessionType: SessionType
  price: number              // 元（整數）
  maxCapacity: number
  minSkillRequired: SkillLevel | null  // null = 無限制
  maxSkillAllowed: SkillLevel | null
  status: SessionStatus
  notes: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  // 衍生欄位（查詢時 join）
  venueName?: string
  currentCount?: number      // 目前報名人數
}

// ── 報名 ─────────────────────────────────────────────────────

export type RegistrationStatus = 'registered' | 'waitlist' | 'cancelled' | 'attended'

export interface Registration {
  id: UUID
  sessionId: UUID
  customerId: UUID
  registeredBy: UUID
  status: RegistrationStatus
  notes: string | null
  registeredAt: Timestamp
  // 衍生欄位
  customerName?: string
  customerPhone?: string
  customerSkillLevel?: SkillLevel
  paymentStatus?: PaymentStatus   // join from payments
  paymentMethod?: PaymentMethod
  paidAmount?: number
}

// ── 付款 ─────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'transfer' | 'online'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:     '現金',
  transfer: '轉帳',
  online:   '線上',
}

export type PaymentStatus = 'paid' | 'partial' | 'refunded' | 'unpaid'

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid:     '已付清',
  partial:  '部分付款',
  refunded: '已退款',
  unpaid:   '未付款',
}

export interface Payment {
  id: UUID
  registrationId: UUID
  recordedBy: UUID
  amount: number             // 元
  method: PaymentMethod
  status: PaymentStatus
  notes: string | null
  paidAt: Timestamp
}

// ── 商品 ─────────────────────────────────────────────────────

export interface Product {
  id: UUID
  venueId: UUID | null       // null = 跨館共用商品
  name: string
  sku: string | null
  unitPrice: number          // 元
  currentStock: number
  lowStockThreshold: number  // 低庫存警告閾值
  isActive: boolean
  createdAt: Timestamp
}

export type ProductTransactionType = 'purchase_in' | 'sale' | 'gift' | 'adjustment'

export const PRODUCT_TX_LABEL: Record<ProductTransactionType, string> = {
  purchase_in: '進貨',
  sale:        '販售',
  gift:        '贈送',
  adjustment:  '盤點調整',
}

export interface ProductTransaction {
  id: UUID
  productId: UUID
  venueId: UUID
  operatedBy: UUID
  type: ProductTransactionType
  quantity: number           // 正數增加，負數減少
  unitPrice: number | null   // 販售時的售價
  totalAmount: number | null // 此筆金額（僅 sale）
  customerId: UUID | null
  sessionId: UUID | null
  notes: string | null
  operatedAt: Timestamp
  // 衍生欄位
  productName?: string
  operatorName?: string
  customerName?: string
}

// ── Audit Log ─────────────────────────────────────────────────

export type AuditAction =
  | 'CREATE_REGISTRATION'
  | 'CANCEL_REGISTRATION'
  | 'UPDATE_PAYMENT'
  | 'ADD_PAYMENT'
  | 'ADD_PRODUCT_SALE'
  | 'ADD_PRODUCT_GIFT'
  | 'ADJUST_STOCK'
  | 'UPDATE_SESSION'
  | 'CANCEL_SESSION'

export interface AuditLog {
  id: UUID
  userId: UUID
  action: AuditAction
  entityType: string
  entityId: UUID
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: Timestamp
  // 衍生欄位
  userName?: string
}

// ── Dashboard 彙總型別（查詢用）────────────────────────────────

export interface VenueDailySummary {
  venueId: UUID
  venueName: string
  date: string               // YYYY-MM-DD
  totalRevenue: number
  totalPlayers: number
  totalSessions: number
  unpaidCount: number
  unpaidAmount: number
  giftRatio: number          // 贈送佔比 %
  stockAlerts: number        // 低庫存商品數量
}

export interface DashboardData {
  date: string
  venues: VenueDailySummary[]
  totalRevenue: number
  totalPlayers: number
  totalSessions: number
  totalUnpaid: number
  alerts: AnomalyAlert[]
  unpaidRegistrations: UnpaidRegistration[]
}

export interface AnomalyAlert {
  id: string
  type: 'gift_ratio' | 'low_stock' | 'revenue_drop' | 'unpaid_excess' | 'signup_drop'
  severity: 'warning' | 'critical'
  venueId: UUID
  venueName: string
  message: string
  createdAt: Timestamp
  isRead: boolean
}

export interface UnpaidRegistration {
  registrationId: UUID
  customerName: string
  venueId: UUID
  venueName: string
  sessionDate: string
  sessionTime: string
  sessionType: SessionType
  amount: number
  method: PaymentMethod
  waitedMinutes: number
}

// ── API Response 包裝 ──────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ── 報名系統（客人端）────────────────────────────────────────

/** 四項技能程度（客人自評） */
export type SkillScore = 'E' | 'D' | 'C' | 'B' | 'B+' | 'A' | 'A+' | 'S' | 'S*'

export interface SkillSelfAssessment {
  attack:  SkillScore   // 攻擊
  defense: SkillScore   // 防守
  setting: SkillScore   // 舉球
  block:   SkillScore   // 攔網
}

/** 公開報名（客人填的） */
export interface PublicRegistration {
  id:             UUID
  sessionId:      UUID
  leadName:       string        // 代表人姓名
  leadPhone:      string        // 代表人電話
  leadNickname:   string | null // 代表人外號
  players: {
    name:         string
    phone:        string
    nickname:     string | null
    skillSelf:    SkillSelfAssessment
    skillVerified: SkillScore | null  // 館長核定程度
  }[]
  status:         'confirmed' | 'waitlist' | 'cancelled' | 'blacklisted'
  cancelNote:     string | null // 取消原因
  replacedBy:     string | null // 找到的替補電話
  registeredAt:   Timestamp
  cancelledAt:    Timestamp | null
}

/** 包場資訊 */
export interface RentalSlot {
  id:           UUID
  venueId:      UUID
  venueName:    string
  date:         string
  startTime:    string
  endTime:      string
  pricePerHour: number
  totalHours:   number
  totalPrice:   number
  status:       'available' | 'pending' | 'booked'
  notes:        string | null
}
