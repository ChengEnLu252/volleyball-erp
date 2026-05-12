// ============================================================
// 排球場館 ERP — 核心型別定義
// ============================================================
// 本檔是整個系統的「語言」，前端、後端、Mock data 都依據此檔。
// 任何欄位的調整都會擴散到 UI、API、報表，動之前先想好。
//
// ============================================================
// 階段 1.1 變更（Milestone 1.1）
// ------------------------------------------------------------
// ✨ 新增：
//    - Season              季（12 週週期）
//    - Timeslot            時段（每週重複的場次模板）
//    - SeasonRental        季租單（主揪 × 時段 × 季）
//    - RegistrationType    報名類型（季打 / 補位 / 臨打）
//    - RegistrationSource  報名來源（員工 / 主揪 / 自助）
//
// 🔧 修改：
//    - Session             拆球費 / 冷氣費；加 timeslotId、
//                          seasonRentalId、acEnabled、isUnattended
//    - Registration        加 type、source；加自助回報欄位；
//                          registeredBy 改為 nullable
//    - AuditAction         擴充主揪、自助、季租單相關 action
//
// ➖ 不動：Venue / User / Customer / Payment / Product /
//        ProductTransaction / AuditLog / Dashboard 彙總型 /
//        PublicRegistration / RentalSlot
// ============================================================


// ── 通用 ─────────────────────────────────────────────────────

/** 唯一識別碼（資料庫主鍵） */
export type UUID = string

/** ISO 8601 格式的時間戳記，例：'2026-04-15T14:30:00Z' */
export type Timestamp = string


// ── 角色與權限 ───────────────────────────────────────────────

/**
 * 系統全域角色
 * - owner：老闆（看所有館的所有資料、人事獎金）
 * - staff：館內員工（館長 / 工讀生，搭配 VenueRole 細分）
 *
 * ⚠️ 主揪不在這裡 — 主揪用 SeasonRental.accessToken 登入，
 *    不需要 User 帳號。
 */
export type GlobalRole = 'owner' | 'staff'

/**
 * 球館內角色（globalRole = 'staff' 時才需要）
 * - manager：館長（負責該館營運、收款匯款）
 * - staff：工讀生（前台收款、報到）
 */
export type VenueRole = 'manager' | 'staff'


// ── 球館 ─────────────────────────────────────────────────────

/**
 * 球館本體 — 一間實體場館。
 * 一個老闆可擁有多個球館（連鎖），每個球館有自己的館長。
 */
export interface Venue {
  /** 唯一識別碼 */
  id: UUID
  /** 球館名稱，例：「飛翼」、「Ace」 */
  name: string
  /** 地址，可空 */
  address: string | null
  /** 聯絡電話，可空 */
  phone: string | null
  /** 是否啟用中（停業後設 false） */
  isActive: boolean
  /** 建立時間 */
  createdAt: Timestamp
}


// ── 使用者（操作系統的人） ────────────────────────────────────

/**
 * 系統使用者 — 任何能登入後台的人。
 * 包含老闆、館長、工讀生。不包含主揪（主揪走 token）。
 */
export interface User {
  /** 唯一識別碼 */
  id: UUID
  /** 顯示用姓名 */
  name: string
  /** 登入用 Email（唯一） */
  email: string
  /** 聯絡電話，可空 */
  phone: string | null
  /** 全域角色 */
  globalRole: GlobalRole
  /** 是否啟用中（離職後設 false） */
  isActive: boolean
  /** 建立時間 */
  createdAt: Timestamp
}

/**
 * 使用者在某球館的角色
 * 一個 User 可在多個 Venue 有不同角色（例：王館主同時管理飛翼跟 Ace）。
 */
export interface UserVenueRole {
  /** 對應的使用者 */
  userId: UUID
  /** 對應的球館 */
  venueId: UUID
  /** 在該球館的角色 */
  role: VenueRole
}


// ── 客戶（打球的人） ─────────────────────────────────────────

/** 程度標籤（由低到高，9 階） */
export type SkillLevel = 'E' | 'D' | 'C' | 'B' | 'B+' | 'A' | 'A+' | 'S' | 'S*'

/** 程度的人類可讀標籤 */
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

/** 程度的詳細說明（給客戶自評時看） */
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

/** 網高的人類可讀標籤 */
export const NET_HEIGHT_LABEL: Record<NetHeight, string> = {
  female:     '女網 (2.24m)',
  male:       '男網 (2.43m)',
  adjustable: '可調',
}

/**
 * 客戶 — 來球館打球的人。
 *
 * 主揪也是 Customer！沒有獨立的「Captain」資料表 —
 * 一個 Customer 是不是主揪，看他有沒有 active 的 SeasonRental。
 */
export interface Customer {
  /** 唯一識別碼 */
  id: UUID
  /** 顯示用姓名 */
  name: string
  /** 電話 — 主要識別欄位（系統以電話判定是否為同一人） */
  phone: string | null
  /** Email，可空 */
  email: string | null
  /** 程度標籤（由館長核定） */
  skillLevel: SkillLevel | null
  /** 偏好網高 */
  preferredNetHeight: NetHeight | null
  /** 客戶備註（館長記錄用，例：「態度好」、「常遲到」） */
  notes: string | null
  /** 是否被禁止報名 */
  isBanned: boolean
  /** 建立時間 */
  createdAt: Timestamp
  // ── 衍生欄位（查詢時 join，不存入資料表）───────────
  /** 衍生：此客戶目前是否擁有 active 的 SeasonRental（主揪） */
  isActiveCaptain?: boolean
}


// ── ✨ 季（NEW） ──────────────────────────────────────────────

/**
 * 季 — 排球場館的營運週期單位。
 *
 * 球館以「季」為單位開放季租。預設 12 週為一季，但允許自訂
 * （例：暑假可能拉長到 14 週、有節日可能縮短）。
 *
 * 用途：
 *   1. 限定 SeasonRental 的有效期（一張季租單只屬於一個季）
 *   2. 對帳的最大週期（季結算時看「整季應收 vs 實收」）
 *   3. 主揪 accessToken 的重發週期（每季重發一次）
 */
export interface Season {
  /** 唯一識別碼 */
  id: UUID
  /** 顯示用名稱，例：「2026 春季」、「2026 Q1」 */
  name: string
  /** 季的起始日（含），格式 YYYY-MM-DD */
  startDate: string
  /** 季的結束日（含），格式 YYYY-MM-DD */
  endDate: string
  /** 此季預計的週數（通常 12，可調） */
  numWeeks: number
  /**
   * 是否為「目前進行中」的季
   * 同時間應只有一個 isActive=true 的 Season。
   * 老闆可以提前建立下一季（isActive=false），季初切換。
   */
  isActive: boolean
  /** 建立時間 */
  createdAt: Timestamp
}


// ── ✨ 時段（NEW） ────────────────────────────────────────────

/**
 * 時段 — 球館每週重複開放的時段定義。
 *
 * 例：「飛翼館・每週四・14:00-17:00・B 場地」是一個 Timeslot。
 *
 * 設計重點：
 *   - 時段是「球館的固定資產」，不會因為某天有沒有開球而消失
 *   - 每個 Session 是時段的「某天實例」（透過 Session.timeslotId 關聯）
 *   - isHotZone 由老闆手動標記，用於館長績效計算
 *     （避免館長只開熱門時段衝業績、逃避冷門時段）
 *   - 球費（defaultCourtFee）有預設值會帶到新場次；
 *     冷氣費由每場 Session 個別填入（依當天天氣決定）
 */
export interface Timeslot {
  /** 唯一識別碼 */
  id: UUID
  /** 所屬球館 */
  venueId: UUID
  /** 顯示用標籤，可空，例：「週四晚黃金場」 */
  label: string | null
  /**
   * 星期幾
   * 0=週日、1=週一、... 6=週六（符合 JS Date.getDay()）
   */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** 開始時間，格式 HH:mm */
  startTime: string
  /** 結束時間，格式 HH:mm */
  endTime: string
  /** 場地編號，可空，例：「A 場」、「主場地」 */
  court: string | null
  /** 預設網高（建立 Session 時帶入） */
  defaultNetHeight: NetHeight
  /** 預設場次類型 */
  defaultSessionType: SessionType
  /** 預設最低程度限制；null = 無限制 */
  defaultMinSkillRequired: SkillLevel | null
  /** 預設最高程度限制；null = 無限制 */
  defaultMaxSkillAllowed: SkillLevel | null
  /** 預設容量上限，通常是 18 */
  defaultMaxCapacity: number
  /**
   * 預設球費（元） — 此時段每場每位臨打應收的基本球費。
   * 建立 Session 時會複製到 Session.courtFee，之後可個別修改。
   * ⚠️ 冷氣費沒有預設值（見 Session.acFee） — 必須每場手動輸入。
   */
  defaultCourtFee: number
  /**
   * 是否為熱門時段
   *
   * 由老闆手動標記。判定邏輯：
   *   - 平日 19:00-22:00 通常標記為熱門
   *   - 假日全天通常標記為熱門
   *   - 平日白天通常標記為冷門（isHotZone=false）
   *
   * 用途：館長績效計算 — 系統會比較
   *   「館長在熱門時段多開了幾場 vs 在冷門時段少開了幾場」，
   *   讓老闆能評估館長有沒有公平經營。
   */
  isHotZone: boolean
  /** 是否啟用中（停用後不會再產生新 Session） */
  isActive: boolean
  /** 建立時間 */
  createdAt: Timestamp
  /** 最後修改時間 */
  updatedAt: Timestamp
}


// ── 場次（🔧 修改） ──────────────────────────────────────────

/** 場次類型 */
export type SessionType =
  | 'male_only'
  | 'male_mixed'
  | 'male_position'
  | 'female_only'
  | 'female_mixed'
  | 'female_position'
  | 'rental'

/** 場次類型的人類可讀標籤 */
export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  male_only:       '男網純男',
  male_mixed:      '男網混排',
  male_position:   '男網專位',
  female_only:     '女網純女',
  female_mixed:    '女網混排',
  female_position: '女網專位',
  rental:          '包場',
}

/** 場次狀態 */
export type SessionStatus = 'open' | 'full' | 'cancelled' | 'completed'

/**
 * 場次 — 某一天某時段實際發生的那一場球。
 *
 * Session 是 Timeslot 在某個日期的「實例」：
 *   - 若是週週重複的時段：Session.timeslotId 指向母 Timeslot
 *   - 若是臨時加開的場次：Session.timeslotId = null
 *
 * 階段 1.1 變更：
 *   ✗ 移除 price（原本單一價格）
 *   ✨ 新增 courtFee + acFee：拆球費與冷氣費，老闆可分開記帳
 *   ✨ 新增 acEnabled：這場有沒有實際開冷氣
 *   ✨ 新增 timeslotId / seasonRentalId：連結到母時段與季租單
 *   ✨ 新增 isUnattended：此場是否為無人場次
 */
export interface Session {
  /** 唯一識別碼 */
  id: UUID
  /** 所屬球館 */
  venueId: UUID
  /**
   * 母時段
   * - 有值：此 Session 是 Timeslot 的某天實例
   *         （例：飛翼週四 14-17 在 4/16 那場）
   * - null：臨時加開的單次場次，沒有對應的週週時段
   */
  timeslotId: UUID | null
  /**
   * 對應的季租單
   * - 有值：此 Session 屬於某張季租單，季打人員不再付費
   * - null：完全臨打場次，所有報名者都要付費
   */
  seasonRentalId: UUID | null
  /** 由誰建立此場次 */
  createdBy: UUID
  /** 場次日期，YYYY-MM-DD */
  sessionDate: string
  /** 開始時間，HH:mm */
  startTime: string
  /** 結束時間，HH:mm */
  endTime: string
  /** 場地編號，可空 */
  court: string | null
  /** 網高 */
  netHeight: NetHeight
  /** 場次類型（純男 / 混排 / 女網等） */
  sessionType: SessionType
  /**
   * 球費（元） — 每位臨打應收的基本費用。
   * ⚠️ 季打人員不付此費用（已於季初收齊於 SeasonRental.totalAmount）
   */
  courtFee: number
  /**
   * 冷氣費（元） — 若此場開冷氣，每位臨打額外應收的金額。
   * 由開場員每場手動輸入，無預設值
   * （避免「習慣性收費」造成爭議；老闆希望每筆都有人為決定）
   */
  acFee: number
  /**
   * 此場是否實際開冷氣
   * - true：開場時對所有臨打多收 acFee
   * - false：不收 acFee（即使 acFee 有設定金額）
   */
  acEnabled: boolean
  /** 容量上限，通常 18 */
  maxCapacity: number
  /** 最低程度限制；null = 無限制 */
  minSkillRequired: SkillLevel | null
  /** 最高程度限制；null = 無限制 */
  maxSkillAllowed: SkillLevel | null
  /** 場次狀態 */
  status: SessionStatus
  /**
   * 是否為無人場次（無工讀生駐場）
   * true 時：
   *   - 客戶必須先線上報名（不接受 walk-in）
   *   - 現場由客戶自助回報已付款（Registration.selfReportedPaid）
   *   - 老闆透過「應收 vs 自助回報」差異監控
   */
  isUnattended: boolean
  /** 場次備註 */
  notes: string | null
  /** 建立時間 */
  createdAt: Timestamp
  /** 最後修改時間 */
  updatedAt: Timestamp
  // ── 衍生欄位（查詢時 join，不存入資料表）───────────
  /** 顯示用：球館名稱 */
  venueName?: string
  /** 衍生：目前報名人數（含季打 + 補位 + 臨打） */
  currentCount?: number
  /**
   * 衍生：本場應收總額
   * = walk_in 與 season_substitute 人數合計
   *   × (courtFee + (acEnabled ? acFee : 0))
   * （季打人員不算入，因為他們季初已繳費）
   */
  expectedRevenue?: number
  /** 衍生：本場實收總額 = sum(Payment.amount) */
  actualRevenue?: number
}


// ── ✨ 季租單（NEW） ─────────────────────────────────────────

/**
 * 季租單狀態
 * - pending：已建立但主揪尚未繳款
 * - active：進行中（已繳款、季尚未結束）
 * - completed：季已結束、所有 Session 已完成
 * - cancelled：已取消（例：主揪退費、人數不足）
 */
export type SeasonRentalStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export const SEASON_RENTAL_STATUS_LABEL: Record<SeasonRentalStatus, string> = {
  pending:   '待繳款',
  active:    '進行中',
  completed: '已結束',
  cancelled: '已取消',
}

/**
 * 季租單 — 「某時段 × 某季 × 某主揪」的綁定。
 *
 * 業務情境：
 *   主揪在季初找滿 18 個人包下某個時段一整季 (12 週)。
 *   主揪季初一次性繳清 totalAmount 給館方。
 *   季打人員每週免費來打。若有人請假，主揪自己找臨打補位。
 *
 * 系統角色：
 *   - 是「主揪權限」的載體：accessToken 是主揪登入的唯一憑據，
 *     主揪不需要 User 帳號
 *   - 是「應收 vs 實收」對帳的核心單據之一
 *   - 一旦建立，會自動連結到此季所有對應的 Session
 *     （透過 Session.seasonRentalId）
 */
export interface SeasonRental {
  /** 唯一識別碼 */
  id: UUID
  /** 對應的時段 */
  timeslotId: UUID
  /** 對應的季 */
  seasonId: UUID
  /**
   * 主揪 = 一個 Customer
   * （主揪不是 User／不在權限系統內，只是某個 Customer 被指定為主揪）
   */
  captainId: UUID
  /**
   * 每場應收金額（元）
   * 通常 = 球費 × 18 人
   * 此值在建立季租單時鎖定，避免後續球費調整影響已收的款
   */
  pricePerSession: number
  /**
   * 季初一次性應收（元）
   * = pricePerSession × 預期場次數（通常 = Season.numWeeks）
   * 若中途有調整（例：某週球館暫停），手動修改此值
   */
  totalAmount: number
  /**
   * 主揪實際繳交給館方的金額
   * 理想狀況下 = totalAmount。差額 > 0 代表主揪欠款，< 0 代表退款。
   */
  paidAmount: number
  /**
   * 主揪登入用的一次性連結 token（隨機產生的長字串）
   * 主揪打開 /captain/[token] 即可查看自己的季租單，
   * 不需密碼也不需建立帳號。
   * 每季重新產生，前一季的 token 自動失效。
   */
  accessToken: string
  /**
   * token 失效時間（通常 = Season.endDate 或加幾天緩衝）
   * 過期後此 token 無法再使用，主揪需向館長索取新連結。
   */
  accessTokenExpiresAt: Timestamp
  /** 季租單狀態 */
  status: SeasonRentalStatus
  /** 備註，例：「主揪要求保留 X 號的位子給某某」 */
  notes: string | null
  /** 建立時間 */
  createdAt: Timestamp
  /** 最後修改時間 */
  updatedAt: Timestamp
  // ── 衍生欄位（查詢時 join，不存入資料表）───────────
  /** 顯示用：主揪姓名 */
  captainName?: string
  /** 顯示用：主揪電話 */
  captainPhone?: string
  /** 顯示用：球館名稱 */
  venueName?: string
  /** 顯示用：季名稱 */
  seasonName?: string
  /** 顯示用：時段描述，例：「週四 14-17」 */
  timeslotLabel?: string
  /** 衍生：此季租單已產生的 Session 數 */
  generatedSessionCount?: number
  /** 衍生：應補位但未補位的場次數（健康度指標） */
  shortfallCount?: number
}


// ── 報名（🔧 修改） ──────────────────────────────────────────

/**
 * 報名狀態
 * - registered：已成功報名
 * - waitlist：排候補
 * - cancelled：已取消
 * - attended：已到場（場次結束時 batch 更新）
 */
export type RegistrationStatus = 'registered' | 'waitlist' | 'cancelled' | 'attended'

/**
 * ✨ 報名類型 — 區分付費邏輯
 *
 * - season_player：季打人員
 *   季初已隨 SeasonRental 一次性繳費，每場免費。
 *
 * - season_substitute：季打請假被「補位」的臨打
 *   付費邏輯與 walk_in 相同（要付球費 + 視情況冷氣費），
 *   但分開記錄方便老闆對帳：
 *   「主揪這季找了幾次補位 vs 自然臨打有多少」
 *
 * - walk_in：純臨打（沒有季打請假，自然來打的散客）
 *   要付球費 + 視情況冷氣費。
 */
export type RegistrationType = 'season_player' | 'season_substitute' | 'walk_in'

export const REGISTRATION_TYPE_LABEL: Record<RegistrationType, string> = {
  season_player:     '季打',
  season_substitute: '補位',
  walk_in:           '臨打',
}

/**
 * ✨ 報名來源 — 由誰建立此筆報名
 *
 * - staff：館長 / 工讀生在後台建立
 *          → registeredBy = 該員工 User.id
 *
 * - captain：主揪透過 token 連結建立
 *           → registeredBy = null
 *           → 操作者透過 SeasonRental.captainId 反查
 *
 * - self：客戶自己在線上報名頁面建立
 *         → registeredBy = null
 */
export type RegistrationSource = 'staff' | 'captain' | 'self'

/**
 * 報名 — 一位客戶在某場 Session 的入場記錄。
 *
 * 階段 1.1 變更：
 *   ✨ 新增 type：區分季打 / 補位 / 臨打
 *   ✨ 新增 registeredBySource：搭配 registeredBy
 *   🔧 registeredBy：UUID → UUID | null（自助 / 主揪建立時為 null）
 *   ✨ 新增 selfReportedPaid 等：無人場次自助回報用
 */
export interface Registration {
  /** 唯一識別碼 */
  id: UUID
  /** 對應的場次 */
  sessionId: UUID
  /** 報名者（Customer） */
  customerId: UUID
  /**
   * 報名類型 — 影響應收計算
   * - season_player：在 SeasonRental 範圍內（不另外收費）
   * - season_substitute / walk_in：要繳球費 +（acEnabled 時）冷氣費
   */
  type: RegistrationType
  /**
   * 操作員 — 建立此報名的人
   * - 有值：由館長 / 工讀生建立
   * - null：由 captain 或 self 建立（搭配 registeredBySource 識別）
   */
  registeredBy: UUID | null
  /** 來源（搭配 registeredBy 判定誰操作的） */
  registeredBySource: RegistrationSource
  /** 報名狀態 */
  status: RegistrationStatus
  /** 報名備註 */
  notes: string | null
  /** 報名時間 */
  registeredAt: Timestamp
  // ── 自助回報付款（僅無人場次使用）───────────────────
  /**
   * 客戶是否在系統按下「我已付款」按鈕
   * 只在 Session.isUnattended === true 時有意義。
   */
  selfReportedPaid: boolean
  /** 自助付款方式（cash 投錢箱 / transfer 轉帳 / online 線上付款） */
  selfPaymentMethod: PaymentMethod | null
  /**
   * 自助付款憑證 URL 或檔名
   * - 轉帳時：必填，指向截圖
   * - 投錢箱：通常 null（信任制）
   * - 線上付款：可存交易序號
   */
  selfPaymentEvidence: string | null
  /** 自助回報時間 */
  selfReportedAt: Timestamp | null
  // ── 衍生欄位（查詢時 join，不存入資料表）───────────
  /** 顯示用：客戶姓名 */
  customerName?: string
  /** 顯示用：客戶電話 */
  customerPhone?: string
  /** 顯示用：客戶程度 */
  customerSkillLevel?: SkillLevel
  /** 衍生：付款狀態（從 Payment 表 join） */
  paymentStatus?: PaymentStatus
  /** 衍生：付款方式 */
  paymentMethod?: PaymentMethod
  /** 衍生：實收金額 */
  paidAmount?: number
  /**
   * 衍生：應收金額
   * - season_player：0
   * - season_substitute / walk_in：courtFee + (acEnabled ? acFee : 0)
   */
  expectedAmount?: number
}


// ── 付款 ─────────────────────────────────────────────────────

/** 付款方式 */
export type PaymentMethod = 'cash' | 'transfer' | 'online'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:     '現金',
  transfer: '轉帳',
  online:   '線上',
}

/** 付款狀態 */
export type PaymentStatus = 'paid' | 'partial' | 'refunded' | 'unpaid'

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid:     '已付清',
  partial:  '部分付款',
  refunded: '已退款',
  unpaid:   '未付款',
}

/**
 * 付款記錄 — 一筆實際的金錢交易。
 * 一個 Registration 可有多筆 Payment（部分付款 → 補繳）。
 */
export interface Payment {
  /** 唯一識別碼 */
  id: UUID
  /** 對應的報名 */
  registrationId: UUID
  /** 收款員（User） */
  recordedBy: UUID
  /** 金額（元） */
  amount: number
  /** 付款方式 */
  method: PaymentMethod
  /** 付款狀態 */
  status: PaymentStatus
  /** 備註 */
  notes: string | null
  /** 收款時間 */
  paidAt: Timestamp
}


// ── 商品 ─────────────────────────────────────────────────────

/**
 * 商品 — 在球館銷售的物品（飲料、護膝、球等）。
 * 一個商品可屬於某館（venueId 有值）或跨館共用（venueId = null）。
 */
export interface Product {
  /** 唯一識別碼 */
  id: UUID
  /** 所屬球館；null = 跨館共用商品 */
  venueId: UUID | null
  /** 商品名稱 */
  name: string
  /** SKU 編號，可空 */
  sku: string | null
  /** 單價（元） */
  unitPrice: number
  /** 目前庫存量 */
  currentStock: number
  /** 低庫存警告閾值 */
  lowStockThreshold: number
  /** 是否上架中 */
  isActive: boolean
  /** 建立時間 */
  createdAt: Timestamp
}

/** 商品異動類型 */
export type ProductTransactionType = 'purchase_in' | 'sale' | 'gift' | 'adjustment'

export const PRODUCT_TX_LABEL: Record<ProductTransactionType, string> = {
  purchase_in: '進貨',
  sale:        '販售',
  gift:        '贈送',
  adjustment:  '盤點調整',
}

/**
 * 商品異動 — 一筆庫存變動的記錄。
 */
export interface ProductTransaction {
  /** 唯一識別碼 */
  id: UUID
  /** 對應的商品 */
  productId: UUID
  /** 在哪個球館發生（即使是共用商品也要記） */
  venueId: UUID
  /** 操作員（User） */
  operatedBy: UUID
  /** 異動類型 */
  type: ProductTransactionType
  /** 數量變化（正數增加，負數減少） */
  quantity: number
  /** 此次的單價（販售時記錄當時售價） */
  unitPrice: number | null
  /** 此筆金額（僅 sale 類型有值） */
  totalAmount: number | null
  /** 對應的客戶（販售或贈送對象） */
  customerId: UUID | null
  /** 對應的場次（在某場次發生的銷售或贈送） */
  sessionId: UUID | null
  /** 備註 */
  notes: string | null
  /** 異動時間 */
  operatedAt: Timestamp
  // ── 衍生欄位（查詢時 join）─────────────────────────
  /** 顯示用：商品名稱 */
  productName?: string
  /** 顯示用：操作員姓名 */
  operatorName?: string
  /** 顯示用：客戶姓名 */
  customerName?: string
}


// ── Audit Log（🔧 擴充） ─────────────────────────────────────

/**
 * 系統操作類別 — 所有需要追蹤的關鍵動作。
 *
 * 階段 1.1 擴充項：
 *   - 主揪相關：CAPTAIN_LOGIN、MARK_ATTENDANCE_BY_CAPTAIN、ADD_WALKIN_BY_CAPTAIN
 *   - 自助回報：SELF_PAYMENT_REPORT
 *   - 季租單：CREATE_SEASON_RENTAL、UPDATE_SEASON_RENTAL、CANCEL_SEASON_RENTAL
 */
export type AuditAction =
  // ── 既有 ────────────────────────────────────────
  | 'CREATE_REGISTRATION'
  | 'CANCEL_REGISTRATION'
  | 'UPDATE_PAYMENT'
  | 'ADD_PAYMENT'
  | 'ADD_PRODUCT_SALE'
  | 'ADD_PRODUCT_GIFT'
  | 'ADJUST_STOCK'
  | 'UPDATE_SESSION'
  | 'CANCEL_SESSION'
  // ── ✨ 階段 1.1 新增：主揪相關 ───────────────────
  /** 主揪用 token 登入 */
  | 'CAPTAIN_LOGIN'
  /** 主揪標記季打人員到場 */
  | 'MARK_ATTENDANCE_BY_CAPTAIN'
  /** 主揪加入臨打 */
  | 'ADD_WALKIN_BY_CAPTAIN'
  // ── ✨ 階段 1.1 新增：自助回報 ───────────────────
  /** 客戶在無人場次按下「已付款」 */
  | 'SELF_PAYMENT_REPORT'
  // ── ✨ 階段 1.1 新增：季租單 ─────────────────────
  /** 建立季租單（含產生 token） */
  | 'CREATE_SEASON_RENTAL'
  /** 修改季租單 */
  | 'UPDATE_SEASON_RENTAL'
  /** 取消季租單 */
  | 'CANCEL_SEASON_RENTAL'
  // ── ✨ 階段 3 production 升級新增 ────────────────
  /** 取消請假（CANCEL_REGISTRATION 的反向 — 主揪取消請假時用）*/
  | 'UNCANCEL_REGISTRATION'
  /** 館長複製主揪連結（read-like 但仍需稽核）*/
  | 'COPY_CAPTAIN_TOKEN'

/**
 * 操作者類型（階段 3 production 升級新增）
 *   - 'user'    操作者是登入的 User（u1-u4）
 *   - 'captain' 操作者是主揪（透過 accessToken 登入，不在 User 系統內）
 *   - 'system'  系統自動觸發（例：場次自動結束）
 */
export type AuditActorType = 'user' | 'captain' | 'system'

/**
 * 操作記錄 — 系統內所有關鍵動作的稽核軌跡。
 */
export interface AuditLog {
  /** 唯一識別碼 */
  id: UUID
  /**
   * 操作者（User）
   * - 主揪 / 自助操作時為 null（actorType='captain'），actorId 改去 newValues
   * - 系統自動觸發時為 null（actorType='system'）
   */
  userId: UUID | null
  /** 操作類別 */
  action: AuditAction
  /** 被操作的實體類型，例：'Session'、'Registration' */
  entityType: string
  /** 被操作的實體 ID */
  entityId: UUID
  /** 操作前的舊值（snapshot） */
  oldValues: Record<string, unknown> | null
  /** 操作後的新值（snapshot） */
  newValues: Record<string, unknown> | null
  /** 來源 IP（保留欄位） */
  ipAddress: string | null
  /** 操作時間 */
  createdAt: Timestamp
  // ── 衍生欄位 ───────────────────────────────────
  /** 顯示用：操作者姓名 */
  userName?: string
  // ── ✨ 階段 3 production 升級新增（皆可選，display only）─
  /** 操作者類型 — 區分主揪 / 員工 / 系統 */
  actorType?: AuditActorType
  /** 操作者顯示名稱快照（含 captain 的姓名）*/
  actorName?: string
  /** 球館名稱快照（部分動作不關聯特定館，可為 null）*/
  venue?: string | null
  /** 目標顯示用字串（例：「林小明（飛翼週四）」）*/
  targetLabel?: string
  /** 詳細人話描述（例：「12 場已過 7，請假 1 場」）*/
  detail?: string
}


// ── Dashboard 彙總型別（查詢用）────────────────────────────────

/**
 * 球館每日摘要 — 用於 Dashboard 列出各館即時狀況。
 * 此型別未在 1.1 階段修改，但隨著 Session 拆費用後，
 * 後續的彙總邏輯（generator）會把 totalRevenue 拆得更細。
 */
export interface VenueDailySummary {
  venueId: UUID
  venueName: string
  /** 日期，YYYY-MM-DD */
  date: string
  /** 當日總收入（球費 + 冷氣費 + 商品） */
  totalRevenue: number
  /** 當日出席人次（含季打 + 補位 + 臨打） */
  totalPlayers: number
  /** 當日場次數 */
  totalSessions: number
  /** 未付款人數 */
  unpaidCount: number
  /** 未付款金額 */
  unpaidAmount: number
  /** 贈送商品佔比（百分比） */
  giftRatio: number
  /** 低庫存商品數量 */
  stockAlerts: number
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
export type SkillScore = SkillLevel

/** 客戶自評的四項技能 */
export interface SkillSelfAssessment {
  /** 攻擊 */
  attack: SkillScore
  /** 防守 */
  defense: SkillScore
  /** 舉球 */
  setting: SkillScore
  /** 攔網 */
  block: SkillScore
}

/**
 * 公開報名（客人端填的表單資料）
 *
 * ⚠️ 與 Registration 的關係待 Milestone 1.3 釐清：
 *    目前 PublicRegistration 是表單暫存，Registration 是內部正式記錄。
 *    後續可能合併或建立明確的轉換流程。
 */
export interface PublicRegistration {
  id: UUID
  sessionId: UUID
  /** 代表人姓名 */
  leadName: string
  /** 代表人電話 */
  leadPhone: string
  /** 代表人外號 */
  leadNickname: string | null
  /** 一同報名的所有球友資料 */
  players: {
    name: string
    phone: string
    nickname: string | null
    skillSelf: SkillSelfAssessment
    /** 館長核定的程度（核定後填入） */
    skillVerified: SkillScore | null
  }[]
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'blacklisted'
  /** 取消原因 */
  cancelNote: string | null
  /** 取消時找到的替補電話 */
  replacedBy: string | null
  registeredAt: Timestamp
  cancelledAt: Timestamp | null
}

/**
 * 一次性包場（既有功能，與 SeasonRental 不同）
 *
 * ⚠️ 區分：
 *   - RentalSlot：「整場包下 3 小時」這種一次性包場
 *   - SeasonRental：「包下每週四 14-17 一整季」這種週週重複的季租
 *
 * 兩者業務邏輯完全不同，因此各自獨立。
 */
export interface RentalSlot {
  id: UUID
  venueId: UUID
  venueName: string
  /** 包場日期 */
  date: string
  startTime: string
  endTime: string
  /** 每小時單價 */
  pricePerHour: number
  /** 總時數 */
  totalHours: number
  /** 總金額 = pricePerHour × totalHours */
  totalPrice: number
  status: 'available' | 'pending' | 'booked'
  notes: string | null
}
