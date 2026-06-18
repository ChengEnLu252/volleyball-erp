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
//                          階段 6 補 PRODUCT_TRANSFER + SEND_SELF_REPORT_REMINDER
//                          階段 7 拆 PRODUCT_TRANSFER 為 4 個 phase union
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

/** 性別（報名自助建檔用）— male 男 / female 女 / undisclosed 不透露 */
export type Gender = 'male' | 'female' | 'undisclosed'

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
  /** 性別（報名自助建檔用；可不透露。舊資料可能無此欄位）*/
  gender?: Gender | null
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
  /**
   * 最後修改時間（階段 9 新增）。
   *
   * 用於樂觀鎖衝突偵測（baseUpdatedAt snapshot）。
   * - 種子資料：generator 設為 registeredAt
   * - 主揪請假 / 自助回報已付款 / 取消請假等 mutation：bump 為 new Date()
   *
   * 為向後相容：legacy localStorage diff 中的 Registration 沒此欄位 →
   * hydrate 時 fallback `r.updatedAt ?? r.registeredAt`。
   */
  updatedAt: Timestamp
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
  /**
   * 退費決策（階段 10 新增）。
   *
   * 場次取消（Session.status='cancelled'）後，admin 對該場 paid Registration
   * 做的「終局決定」：
   * - `null` ：尚未決定（或本筆 Registration 與退費無關 — 例：unpaid / season_player）
   * - `'refunded'`：已開過 negative Payment；refund mutation 成功時 set
   * - `'waived'` ：admin 標記「放棄退費」（客戶同意 / 改下週 / 信用券處理外...）
   *
   * 「待退費清單」derived query 條件：
   *   session.status === 'cancelled' &&
   *   sum(positive Payment for this reg) > 0 &&
   *   refundDecision === null
   *
   * 為向後相容：legacy localStorage diff 中 Registration 沒此欄位 →
   * hydrate 時 fallback `r.refundDecision ?? null`。
   */
  refundDecision: RefundDecision | null
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
 * 退費決策（階段 10 新增）— Registration.refundDecision 的 union。
 *
 * 只列終局狀態。`null` 代表「未決定」/「不適用」(unpaid / season_player 等)。
 * - `'refunded'`：已開 negative Payment 退款
 * - `'waived'` ：admin 與客戶協商「不退」(改下週 / 信用券 / 客戶同意作罷)
 *
 * 「進行中」狀態不獨立列 — 由「session 已取消 + 有 paid Payment + decision === null」derive。
 */
export type RefundDecision = 'refunded' | 'waived'

export const REFUND_DECISION_LABEL: Record<RefundDecision, string> = {
  refunded: '已退款',
  waived:   '放棄退費',
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
  /**
   * 是否為「誠實商店」商品（投錢箱、無人販售）— 階段 6 新增。
   * 預設視為 false；true 表示該商品需納入 `/reconciliation/honest-shop` 對帳。
   * Optional 以維持與既有 seed/persisted 資料相容（未設視為 false）。
   */
  isHonestShop?: boolean
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


// ── 階段 5 衍生 entity（階段 6 從 store.ts 搬入 types） ─────────

/**
 * 跨館調貨單狀態 — 3 階段 flow（pending → in_transit → completed），
 * 另有 cancelled 終態。
 */
export type ProductTransferStatus =
  | 'pending'    // 已申請、待出貨館確認
  | 'in_transit' // 已出貨、待入貨館收件
  | 'completed'  // 已完成入帳
  | 'cancelled'  // 已取消

export const PRODUCT_TRANSFER_STATUS_LABEL: Record<ProductTransferStatus, string> = {
  pending:    '待處理',
  in_transit: '運送中',
  completed:  '已完成',
  cancelled:  '已取消',
}

/**
 * 跨館調貨單（階段 5 Block C）— 從 store.ts 搬入 types/index.ts（階段 6）。
 *
 * 注意：
 * - in-memory 持久化（透過 PersistedDiff），不在 generator seed 內。
 * - 取消已 in_transit 的調貨「不退庫存」（決策 #20）— 需另開逆向調貨補回。
 */
export interface ProductTransfer {
  /** 唯一識別碼 */
  id: UUID
  /** 調貨的商品 */
  productId: UUID
  /** 來源球館 */
  fromVenueId: UUID
  /** 目的球館 */
  toVenueId: UUID
  /** 調貨數量（正整數） */
  quantity: number
  /** 申請者（User） */
  requestedBy: UUID
  /** 目前狀態 */
  status: ProductTransferStatus
  /** 申請時間 */
  requestedAt: Timestamp
  /**
   * 最後修改時間（階段 9 新增）。
   *
   * 用於樂觀鎖衝突偵測（baseUpdatedAt snapshot）。
   * - 新建：requestedAt
   * - shipProductTransfer / receiveProductTransfer / cancelProductTransfer：bump 為 new Date()
   *
   * 為向後相容：legacy localStorage diff 中的 ProductTransfer 沒此欄位 →
   * hydrate 時 fallback `t.updatedAt ?? t.requestedAt`。
   */
  updatedAt: Timestamp
  /** 完成時間（status='completed' 時填入；其他 status 為 null） */
  completedAt: Timestamp | null
  /** 備註 */
  notes: string | null
}

/**
 * 誠實商店投錢箱盤點記錄（階段 5 Block B）— 從 store.ts 搬入 types/index.ts（階段 6）。
 *
 * 注意：
 * - in-memory 持久化（透過 PersistedDiff），不在 generator seed 內。
 * - 盤點當下同步寫一筆 `adjustment` ProductTransaction（決策 #14）。
 */
export interface BoxAuditRecord {
  /** 唯一識別碼 */
  id: UUID
  /** 盤點的球館 */
  venueId: UUID
  /** 盤點的商品 */
  productId: UUID
  /** 盤點時間 */
  auditedAt: Timestamp
  /**
   * 最後修改時間（階段 9 新增）。
   *
   * 用於未來可能的盤點記錄補附憑證 / 修改備註等 mutation 的樂觀鎖。
   * 目前 mutation 端尚未實作修改既有盤點，但欄位先補上以保型別一致性。
   * - 新建：auditedAt
   */
  updatedAt: Timestamp
  /** 盤點期間起始日 */
  periodStart: string
  /** 盤點期間結束日 */
  periodEnd: string
  /** 帳面銷售金額（期間內該商品 sum sale.totalAmount） */
  expectedRevenue: number
  /** 帳面銷售數量 */
  expectedQuantitySold: number
  /** 老闆數到的投錢箱實收 */
  countedCash: number
  /** 老闆數到的實際庫存 */
  countedStock: number
  /** 缺口金額（expectedRevenue − countedCash, 正數 = 短少） */
  cashDiscrepancy: number
  /** 執行盤點的老闆（User） */
  auditedBy: UUID
  /** 備註 */
  notes: string | null
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
  /** 階段 12 新增：館長/老闆建立新場次（範本批量 / 單場手動皆用此 action） */
  | 'CREATE_SESSION'
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
  // ── ✨ 階段 6 新增（補階段 5 留下的技術債）─────
  /** 老闆對可疑客戶一鍵發自助回報提醒（Block A 自助回報）*/
  | 'SEND_SELF_REPORT_REMINDER'
  // ── ✨ 階段 7 新增：跨館調貨 4 個 phase 各自 union member ─
  // 階段 6 用單一 'PRODUCT_TRANSFER' + newValues.step 區分；階段 7 拆出來
  // 讓 audit filter 可以單獨篩選「只看出貨」或「只看取消」。
  // newValues.step 仍然保留（向後相容 + 額外資訊），但已不再是區分依據。
  /** 跨館調貨：申請（pending） */
  | 'PRODUCT_TRANSFER_CREATED'
  /** 跨館調貨：出貨確認（pending → in_transit，扣 from 館庫存） */
  | 'PRODUCT_TRANSFER_SHIPPED'
  /** 跨館調貨：收貨確認（in_transit → completed，加 to 館庫存） */
  | 'PRODUCT_TRANSFER_RECEIVED'
  /** 跨館調貨：取消（任何狀態 → cancelled） */
  | 'PRODUCT_TRANSFER_CANCELLED'
  // ── ✨ 階段 8 新增：上傳憑證 store + 衝突偵測 ───
  /** 上傳憑證檔（image blob 進 IndexedDB；meta 進 store）*/
  | 'UPLOAD_EVIDENCE'
  /** 刪除憑證檔（admin 操作，會同時刪 IndexedDB blob + meta）*/
  | 'DELETE_EVIDENCE'
  /**
   * 樂觀鎖衝突：mutation 帶入的 baseUpdatedAt 與當前 entity.updatedAt 不符。
   * 此 action 寫進 audit log 時，被擋下的 mutation **沒有**真的執行；
   * newValues 記錄試圖寫入的 patch、oldValues 記錄當下 entity 的 updatedAt。
   */
  | 'CONFLICT_DETECTED'
  // ── ✨ 階段 10 新增：場次取消後的退費決策 ───────
  /**
   * 開退費（cancelSession 後 admin 對某 paid Registration 處理）。
   * 效果：建一筆 Payment(amount<0, status='refunded') + Registration.refundDecision='refunded'。
   * newValues 包 { amount, method, paymentId, refundDecision:'refunded' }
   * oldValues 包 { refundDecision:null, updatedAt: ... }
   */
  | 'ISSUE_REFUND'
  /**
   * 放棄退費（admin 標記不退錢）— 不開 Payment，純標旗。
   * newValues 包 { reason, refundDecision:'waived' }
   * oldValues 包 { refundDecision:null, updatedAt: ... }
   */
  | 'WAIVE_REFUND'
  // ── ✨ 階段 16 新增：館長週目標 ───────────────────
  /** 建立週目標（老闆指派 or 館長自加） */
  | 'CREATE_WEEKLY_GOAL'
  /** 館長上傳完成截圖、提交週目標（assigned → submitted） */
  | 'SUBMIT_WEEKLY_GOAL'
  /** 老闆確認週目標完成（submitted → confirmed） */
  | 'CONFIRM_WEEKLY_GOAL'
  /** 老闆退回週目標（submitted → assigned，附理由） */
  | 'RETURN_WEEKLY_GOAL'
  // ── ✨ 階段 17 新增：線上商城訂單 ─────────────────
  /** 建立商城訂單（線上自助 / 後台代客皆用此 action；扣 onlineStock） */
  | 'CREATE_ORDER'
  /** 標記訂單已付款（pending → paid；金流串接前由後台手動標記） */
  | 'PAY_ORDER'
  /** 標記訂單已完成（→ fulfilled，已出貨 / 已取貨） */
  | 'FULFILL_ORDER'
  /** 取消訂單（→ cancelled，回補 onlineStock） */
  | 'CANCEL_ORDER'
  /** 調整商城商品庫存 / 上下架（onlineStock / isListed） */
  | 'ADJUST_SHOP_STOCK'

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


// ── ✨ 階段 8 新增：上傳憑證 store ─────────────────────────────

/**
 * 憑證可附在哪些業務實體上。
 *
 * 階段 8 開：'self_payment'（自助回報轉帳截圖）
 * 階段 9 擴：
 *   - 'box_audit'：誠實商店投錢箱盤點現場照（投錢箱外觀 / 實際庫存照）
 *   - 'transfer'：跨館調貨簽收單 / 出貨包裝照
 *
 * 新增 sourceType 時要同步維護的地方：
 *   1. 此 union + EVIDENCE_SOURCE_LABEL
 *   2. data/api.ts 的 uploadEvidence：補對應 sourceId → venue lookup 規則
 *   3. （可選）對應業務頁面接上 <EvidenceUpload> 元件
 */
export type EvidenceSourceType = 'self_payment' | 'box_audit' | 'transfer' | 'captain_goal'

export const EVIDENCE_SOURCE_LABEL: Record<EvidenceSourceType, string> = {
  self_payment: '自助回報轉帳',
  box_audit:    '盤點現場',
  transfer:     '調貨簽收',
  // 階段 16：館長週目標完成截圖。sourceId = WeeklyGoal.id
  captain_goal: '館長目標完成',
}

/**
 * 上傳憑證的 metadata（不含 blob 本體）。
 *
 * **資料分流**：blob 進 IndexedDB（key=id）、此 meta 進 PersistedDiff
 * （隨 localStorage 一起 hydrate）。兩邊用 id 串。
 *
 * 為什麼分流？localStorage 對大 string 不友善（5MB ceiling），
 * 而 IndexedDB 對 Blob 是 native 支援；分流後 meta 可以隨 store
 * 一起 audit / list 而不污染 hot path。
 */
export interface UploadedEvidence {
  /** evd_xxx 格式，與 IndexedDB blob key 一致 */
  id: UUID
  /** 業務來源類型 */
  sourceType: EvidenceSourceType
  /** 來源實體 id（例：Registration.id）*/
  sourceId: UUID
  /** 原始檔名 */
  filename: string
  /** MIME（image/jpeg / image/png 等）*/
  mimeType: string
  /** Blob 大小（bytes）*/
  size: number
  /** 上傳者顯示名（顧客名或員工名）*/
  uploadedByName: string
  /** 上傳時間 ISO */
  uploadedAt: Timestamp
  /**
   * Blob 是否還在 IndexedDB 內。
   *
   * 用途：admin 刪除時保留 meta 但標記 false，audit 仍可追蹤；
   *      也可能因瀏覽器清資料而 meta 在但 blob 不在。
   */
  blobAvailable: boolean
}

/**
 * 衝突偵測（樂觀鎖）的 mutation 結果。
 *
 * 適用於改既有 entity 的 mutation。caller 可在 args 內帶
 * `baseUpdatedAt`（呼叫時記下的 entity.updatedAt）；server 端
 * 比對若不符 → return `{ ok: false, conflict: true, ... }` +
 * 寫 'CONFLICT_DETECTED' audit log；mutation 本身不執行。
 *
 * 不傳 baseUpdatedAt 視為「強制覆蓋」（向後相容）。
 */
export interface ConflictResult {
  ok: false
  conflict: true
  reason: string
  /** 當下 entity 的 updatedAt（讓 UI 可顯示「他人於 X 修改過」）*/
  currentUpdatedAt: Timestamp
  /** 修改者快照（從最後一筆此 entity 的 audit log 推出，可能 null）*/
  lastEditedBy?: string | null
}


// ============================================================
// 階段 16 — 館長週目標 + 通知收件匣
// ============================================================
// 業務脈絡（館主需求）：
//   每館每週都有一個「館長目標」(可能商品推銷 / 冷門場次推廣)。
//   原本館長完成後截圖丟 LINE 群組給老闆看 → 改成系統內：
//     1. 老闆指派目標給某館某週，或館長自己登記要做的事
//     2. 館長完成後在系統上傳完成截圖 (走既有 EvidenceUpload)
//     3. 提交後「自動通知老闆」(寫一筆 AppNotification 給 owner)
//     4. 老闆在收件匣 / 目標頁確認 (或退回重做)
//     5. 確認 / 退回會回頭通知該館館長
//
// 通知系統刻意做成「泛用收件匣」: type + recipientUserId + linkHref，
// 之後 F3 對帳回報也能 push 通知 (新增 NotificationType member 即可)。
// ============================================================

/** 週目標狀態流 */
export type WeeklyGoalStatus =
  | 'assigned'   // 已指派 / 已建立，待館長完成
  | 'submitted'  // 館長已上傳截圖，待老闆確認
  | 'confirmed'  // 老闆已確認完成
  | 'returned'   // 老闆退回 (附理由)，館長需重做後重新提交

export const WEEKLY_GOAL_STATUS_LABEL: Record<WeeklyGoalStatus, string> = {
  assigned:  '待完成',
  submitted: '待確認',
  confirmed: '已確認',
  returned:  '已退回',
}

/** 週目標來源：誰建立的 */
export type WeeklyGoalSource =
  | 'owner_assigned'  // 老闆 (凱哥) 指派給該館
  | 'manager_self'    // 館長自己登記要做的事

export const WEEKLY_GOAL_SOURCE_LABEL: Record<WeeklyGoalSource, string> = {
  owner_assigned: '老闆指派',
  manager_self:   '館長自訂',
}

/**
 * 館長週目標。
 *
 * 一館一週可以有多個目標 (老闆指派 + 館長自訂混合)。
 * weekStart 用「該週週一」的 ISO date (YYYY-MM-DD) 當作週識別。
 */
export interface WeeklyGoal {
  /** wg_xxx */
  id: UUID
  /** 所屬球館 */
  venueId: UUID
  /** 該週週一日期 (YYYY-MM-DD)，用於分週 */
  weekStart: string
  /** 目標說明 (純文字) */
  description: string
  /** 來源：老闆指派 or 館長自訂 */
  source: WeeklyGoalSource
  /** 建立者 User.id */
  createdBy: UUID
  /** 目前狀態 */
  status: WeeklyGoalStatus
  /** 完成截圖的 UploadedEvidence.id；尚未上傳為 null */
  evidenceId: UUID | null
  /** 提交者 User.id (館長)；尚未提交為 null */
  submittedBy: UUID | null
  /** 提交時間 ISO；尚未提交為 null */
  submittedAt: Timestamp | null
  /** 老闆確認者 User.id；尚未確認為 null */
  confirmedBy: UUID | null
  /** 確認時間 ISO；尚未確認為 null */
  confirmedAt: Timestamp | null
  /** 退回理由；未退回為 null */
  returnReason: string | null
  /** 建立時間 ISO */
  createdAt: Timestamp
  /** 最後更新時間 ISO (樂觀鎖 / 排序用) */
  updatedAt: Timestamp
}

/**
 * 通知類型。
 *
 * 階段 16 先有目標三種；之後 F3 對帳可加 'reconciliation_submitted' 等。
 */
export type NotificationType =
  | 'goal_submitted'  // 館長提交完成截圖 → 通知老闆
  | 'goal_confirmed'  // 老闆確認 → 通知館長
  | 'goal_returned'   // 老闆退回 → 通知館長
  // ── 階段 17 新增：線上商城 ───────────────────────
  | 'order_placed'    // 顧客 / 後台下單 → 通知老闆（+ 取貨館館長）

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  goal_submitted: '目標待確認',
  goal_confirmed: '目標已確認',
  goal_returned:  '目標被退回',
  order_placed:   '新訂單',
}

/**
 * 應用內通知 (收件匣的一筆)。
 *
 * 設計成泛用：recipientUserId 指定收件人 (老闆 / 某館長)，
 * linkHref 點擊跳轉，relatedType/relatedId 串回業務實體。
 * blob / 截圖不在這 — 透過 linkHref 導到對應頁面看。
 */
export interface AppNotification {
  /** ntf_xxx */
  id: UUID
  /** 通知類型 */
  type: NotificationType
  /** 收件人 User.id */
  recipientUserId: UUID
  /** 標題 (列表粗體) */
  title: string
  /** 內文 (一兩句說明) */
  body: string
  /** 點擊跳轉路徑；null = 不可點 */
  linkHref: string | null
  /** 關聯實體類型 (例：'WeeklyGoal')；null = 無 */
  relatedType: string | null
  /** 關聯實體 id；null = 無 */
  relatedId: UUID | null
  /** 是否已讀 */
  isRead: boolean
  /** 建立時間 ISO */
  createdAt: Timestamp
}


// ============================================================
// 階段 17：線上商城（ShopProduct + Order）
// ============================================================
// 設計決策（用戶確認，勿改）：
//   1. 商城是「單一統合商城」，不分館呈現一份目錄。
//   2. 庫存用「獨立的線上商城庫存池」(onlineStock)，與各館 venueProducts 完全分開。
//   3. 取貨支援「到館自取」與「宅配寄送」兩種，顧客結帳時選。
//   4. 金流之後要串真實金流 → 先預留 paymentChannel 欄位；目前 paidAt 由後台手動標記。
//   5. 商城公開頁在 /shop（走 ChromeShell 白名單，無 ERP 登入閘門），
//      後台訂單管理在 /orders（owner 全部、manager 自己館取貨單、staff 擋）。
//   6. 下單不強制 LINE 登入，沿用「以電話識別顧客」慣例，只填姓名 + 電話。
// ============================================================

/** 商城商品分類 */
export type ShopCategory = 'drink' | 'gear' | 'apparel' | 'accessory'

export const SHOP_CATEGORY_LABEL: Record<ShopCategory, string> = {
  drink:     '飲品補給',
  gear:      '護具裝備',
  apparel:   '服飾',
  accessory: '配件',
}

/** 商品顏色選項（顏色名 + 色票 hex，供前台 swatch 顯示） */
export interface ShopColor {
  /** 顏色名稱，例：'純白'、'墨黑'、'櫻花粉' */
  name: string
  /** 色票顏色 hex（白色等淺色前台會自動加描邊） */
  hex: string
}

/**
 * 商品規格（尺寸 × 顏色的單一組合），每個組合各自有獨立庫存。
 *
 * - 無尺寸軸的商品 size 為 null；無顏色軸的 color 為 null。
 * - 同時無尺寸也無顏色 → 此商品 variants 為空陣列，庫存改用 onlineStock。
 */
export interface ShopVariant {
  /** 尺寸，例：'M'、'EU 42'；無尺寸軸則 null */
  size: string | null
  /** 顏色名（對應 ShopProduct.colors[].name）；無顏色軸則 null */
  color: string | null
  /** 此規格的線上庫存 */
  stock: number
}

/**
 * 線上商城商品。
 *
 * 與各館實體庫存 (venueProducts) **完全分開**：商城有自己的庫存池。
 *
 * 庫存兩種模式：
 *   - 無規格商品（variants 為空）：庫存就是 onlineStock。
 *   - 有規格商品（variants 非空）：權威庫存在 variants[].stock；
 *     onlineStock 維持為「所有規格庫存加總」，方便既有列表 / 徽章沿用。
 *
 * 圖片：imageUrl 有值用實拍照；為 null 時前台用品牌風格佔位圖（ProductImage 元件）。
 */
export interface ShopProduct {
  /** shop_xxx */
  id: UUID
  /** 商品名稱 */
  name: string
  /** 分類 */
  category: ShopCategory
  /** 單價（元；同商品各規格同價） */
  unitPrice: number
  /** 線上商城庫存。有規格時 = 各規格庫存加總（自動同步維護） */
  onlineStock: number
  /** 是否上架中（false = 下架，前台不顯示，但後台仍可見） */
  isListed: boolean
  /** 商品說明（純文字） */
  description: string
  /** 卡片佔位用 emoji（佔位圖內的輔助視覺 / fallback） */
  emoji: string
  /** 真實商品圖網址；null = 用品牌佔位圖。之後上傳實拍照填這裡（例 '/shop/jersey.jpg'） */
  imageUrl: string | null
  /** 可選尺寸（空陣列 = 無尺寸軸） */
  sizes: string[]
  /** 可選顏色（空陣列 = 無顏色軸） */
  colors: ShopColor[]
  /** 規格庫存矩陣（空陣列 = 無規格，庫存用 onlineStock） */
  variants: ShopVariant[]
  /** 對應系統內 Product.id（由現有商品整併而來時填）；無則 null */
  sourceProductId: UUID | null
  /** 建立時間 ISO */
  createdAt: Timestamp
  /** 最後更新時間 ISO（樂觀鎖 / 排序用） */
  updatedAt: Timestamp
}

/** 取貨 / 配送方式 */
export type FulfillmentType = 'pickup' | 'shipping'

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup:   '到館自取',
  shipping: '宅配寄送',
}

/** 訂單來源通路 */
export type OrderChannel = 'online' | 'backend'

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  online:  '線上商城',
  backend: '後台代客',
}

/**
 * 訂單狀態流：pending → paid → fulfilled，另有 cancelled 終態。
 *   - pending   下單成立、待付款 / 待處理
 *   - paid      已付款（金流串接前由後台手動標記）
 *   - fulfilled 已出貨 / 已取貨完成
 *   - cancelled 已取消（回補 onlineStock）
 */
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   '待處理',
  paid:      '已付款',
  fulfilled: '已完成',
  cancelled: '已取消',
}

/**
 * 付款方式 — 金流串接前的「預計付款方式」預留欄位。
 * 未來串真實金流時，online_gateway 會由 webhook 回拋付款結果。
 */
export type PaymentChannel = 'cash_on_pickup' | 'cash_on_delivery' | 'online_gateway'

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  cash_on_pickup:   '到館付款',
  cash_on_delivery: '貨到付款',
  online_gateway:   '線上金流（待串接）',
}

/** 訂單明細行（內嵌於 Order；下單當下對價格 / 名稱 / 規格做快照） */
export interface OrderItem {
  /** ShopProduct.id */
  productId: UUID
  /** 下單當下的商品名稱快照 */
  name: string
  /** 下單當下的單價快照 */
  unitPrice: number
  /** 數量 */
  quantity: number
  /** 小計 = unitPrice * quantity */
  subtotal: number
  /** 規格：尺寸快照（無尺寸軸或舊單為 null / undefined） */
  size?: string | null
  /** 規格：顏色快照（無顏色軸或舊單為 null / undefined） */
  color?: string | null
}

/** 宅配收件資訊（fulfillment='shipping' 時填） */
export interface ShippingInfo {
  recipient: string
  phone: string
  address: string
}

/**
 * 商城訂單。
 *
 * in-memory 持久化（透過 PersistedDiff），demo 種子有幾筆示範單。
 * 金流：paymentChannel 記錄「預計付款方式」；paidAt 由後台手動標記，
 * 未來串真實金流時把 markOrderPaid 改成 webhook 回拋即可。
 */
export interface Order {
  /** ord_xxx */
  id: UUID
  /** 人類可讀單號 SH-YYYYMMDD-XXXX */
  orderNo: string
  /** 來源通路 */
  channel: OrderChannel
  /** 買家姓名 */
  customerName: string
  /** 買家電話（以電話識別顧客） */
  customerPhone: string
  /** 買家 email，可空 */
  customerEmail: string | null
  /** 後台代客下單時的操作員 User.id；線上自助為 null */
  placedByUserId: UUID | null
  /** 訂單明細 */
  items: OrderItem[]
  /** 商品小計加總 */
  itemTotal: number
  /** 運費（pickup 為 0） */
  shippingFee: number
  /** 應付總額 = itemTotal + shippingFee */
  total: number
  /** 取貨 / 配送方式 */
  fulfillment: FulfillmentType
  /** pickup 時的取貨球館；shipping 為 null */
  pickupVenueId: UUID | null
  /** shipping 時的收件資訊；pickup 為 null */
  shipping: ShippingInfo | null
  /** 預計付款方式 */
  paymentChannel: PaymentChannel
  /** 目前狀態 */
  status: OrderStatus
  /** 顧客備註 */
  notes: string | null
  /** 付款時間 ISO；未付款為 null */
  paidAt: Timestamp | null
  /** 完成時間 ISO；未完成為 null */
  fulfilledAt: Timestamp | null
  /** 取消時間 ISO；未取消為 null */
  cancelledAt: Timestamp | null
  /** 取消理由；未取消為 null */
  cancelReason: string | null
  /** 建立時間 ISO */
  createdAt: Timestamp
  /** 最後更新時間 ISO（樂觀鎖 / 排序用） */
  updatedAt: Timestamp
}


// ============================================================
// 階段 18：月記帳表（館長輸入 + 老闆對帳）
// ============================================================
// 來源：客戶現行的「多爾森健康有限公司記帳表」Excel（每館每月一張）。
// 設計：每天一筆 LedgerDay（venueId + date 唯一）。館長用「每日引導式
//       表單」輸入；小計 / 總計 / 場地費加總 / 冷門 / 冷氣試算皆為衍生
//       計算（見 data/ledger.ts），不存。
//
// 持久化：沿用 PersistedDiff（localStorage diff），不進 generator 種子。
// 對帳：data/ledger.ts 的 getLedgerReconciliation 把館長數字與系統既有
//       資料（場次 / 收款 / 商品 / 誠實商店 / 季租）自動比對找差異。
// ============================================================

/**
 * 單一時段的場地費值。
 * - number：該時段收到的場地費金額
 * - string：非金額註記（例：「包場」「季租」），不計入場地費加總
 * - 缺值（undefined）：該時段沒有資料
 */
export type LedgerSlotValue = number | string

/**
 * 月記帳表的「一天」。對應 Excel 一個日期欄（直行）。
 *
 * 唯一鍵：`${venueId}:${date}`。
 */
export interface LedgerDay {
  /** 所屬球館 */
  venueId: UUID
  /** 日期 YYYY-MM-DD */
  date: string

  // ── 場地費：各時段（Excel 列 8-9 ~ 24-01）─────────────
  /** key = 時段 key（見 data/ledger.ts LEDGER_SLOTS），value = 金額或註記 */
  slots: Record<string, LedgerSlotValue>

  // ── 銷售類別（Excel 商品 / 零食 / 飲料 / 冷氣 / 其他）──
  /** 商品（球衣、襪子等銷售） */
  merch: number
  /** 零食 */
  snacks: number
  /** 飲料 */
  drinks: number
  /** 冷氣（類別列；與下方「冷氣費」不同列，忠實保留兩者） */
  ac: number
  /** 其他 */
  other: number

  // ── 收費 / 退款（Excel 季打收費 / 包場預付 / 冷氣費 / 退款）─
  /** 季打收費 */
  seasonFee: number
  /** 包場預付 */
  privatePrepay: number
  /** 冷氣費 */
  acFee: number
  /** 退款（可為負） */
  refund: number

  // ── 冷氣度數（Excel 右側每日彙總的唯一人工輸入欄）────
  /** 當日冷氣度數（kWh）；冷氣試算 = 度數 × 單價（見 LEDGER_AC_RATE） */
  acDegrees: number

  // ── 文字明細（Excel 包場季打明細 / 退款明細 / 商品明細）─
  /** 包場、季打收費明細 */
  bookingNote: string
  /** 退款明細 */
  refundNote: string
  /** 商品明細 */
  merchNote: string

  // ── 流程狀態 ───────────────────────────────────────
  /** 回報完畢（Excel 右側「回報完畢」TRUE/FALSE）；館長按下表示當日已填妥 */
  reported: boolean

  /** 最後編輯者（User.id） */
  updatedBy: UUID
  /** 最後編輯時間 ISO */
  updatedAt: Timestamp
}


// ════════════════════════════════════════════════════════════
// 階段 19：員工薪資計算
//   - 工讀生時薪表（每館每月一張；正常薪水 = 時數 × 時薪）
//   - 管理職薪資（每人每月一筆；本職 + 美編 + 獎金 − 勞健保 − 請假）
//   - 規章常數：冷門場次獎金/罰則、年終獎金級距（見 data/payroll.ts）
// ════════════════════════════════════════════════════════════

/** 工讀生等級 */
export type StaffLevel =
  | 'helper'          // 小幫手
  | 'captain_helper'  // 主揪小幫手
  | 'senior_helper'   // 資深小幫手
  | 'captain_senior'  // 主揪資深小幫手
  | 'captain_x2'      // 主揪*2小幫手

export const STAFF_LEVEL_LABEL: Record<StaffLevel, string> = {
  helper:         '小幫手',
  captain_helper: '主揪小幫手',
  senior_helper:  '資深小幫手',
  captain_senior: '主揪資深小幫手',
  captain_x2:     '主揪*2小幫手',
}

/**
 * 各等級「預設」時薪（元 / 時）。
 * ⚠️ 僅為預設值：個別員工的 PartTimerRow.hourlyRate 可覆寫
 *    （規章圖中資深小幫手同時出現 200 與 195，故時薪以「每人」為準）。
 */
export const STAFF_LEVEL_DEFAULT_RATE: Record<StaffLevel, number> = {
  helper:         190,
  captain_helper: 195,
  senior_helper:  200,
  captain_senior: 220,
  captain_x2:     210,
}

/** 工讀生薪資表的一列 */
export interface PartTimerRow {
  /** 穩定 row id */
  id: string
  /** 姓名 */
  name: string
  /** 等級 */
  level: StaffLevel
  /** 此列實際時薪（建立時帶等級預設，可個別覆寫） */
  hourlyRate: number
  /** 正常時數 */
  normalHours: number
  /** 獎金（手動，正數） */
  bonus: number
  /** 罰款（手動，正數） */
  penalty: number
  /** 備註 */
  note: string
}

/** 工讀生薪資表 — 每館每月一張（venue-scoped，比照記帳表持久化模式） */
export interface PartTimerPayrollSheet {
  /** 所屬球館 */
  venueId: UUID
  /** 月份 YYYY-MM */
  month: string
  /** 工讀生列 */
  rows: PartTimerRow[]
  /**
   * 本月營收（人工覆寫）。
   * null = 用系統值（getSystemMonthlyVenueRevenue）；用於「薪資比例」分母。
   */
  revenueOverride: number | null
  /** 最後編輯者 */
  updatedBy: UUID
  /** 最後編輯時間 ISO */
  updatedAt: Timestamp
}

/** 管理職的單一收入 / 扣款條目（彈性：名稱 + 金額） */
export interface ManagerLineItem {
  id: string
  label: string
  /** 金額（一律存正數；是收入或扣款由所在欄位決定） */
  amount: number
}

/** 管理職薪資 — 每人每月一筆 */
export interface ManagerSalaryRecord {
  /** 穩定 id：`${venueId}:${month}:${slug}` */
  id: string
  /** 對應館（用於冷門場次獎金、年終獎金的自動計算） */
  venueId: UUID
  /** 月份 YYYY-MM */
  month: string
  /** 姓名 */
  personName: string
  /** 本職月薪（也是請假扣薪的 base） */
  baseSalary: number
  /** 美編等其他固定收入 */
  designPay: number
  /** 額外獎金（中秋、跨館輔導等手動條目） */
  bonuses: ManagerLineItem[]
  /** 是否把「冷門場次獎金」自動計入（從系統冷門開團數算） */
  includeOffPeakBonus: boolean
  /** 勞健保自付額（扣款，正數） */
  insuranceSelf: number
  /** 請假天數（扣薪 = baseSalary / 30 × 天數） */
  leaveDays: number
  /** 其他扣款條目（正數） */
  deductions: ManagerLineItem[]
  /** 最後編輯者 */
  updatedBy: UUID
  /** 最後編輯時間 ISO */
  updatedAt: Timestamp
}

/** 冷門場次獎金 / 罰則規則（每館；見規章圖） */
export interface OffPeakBonusRule {
  /** 滿場場數（context；門檻約為其 50%/75%） */
  fullCount: number
  /** 達 tier1Open 場 → tier1Bonus */
  tier1Open: number
  tier1Bonus: number
  /** 達 tier2Open 場 → tier2Bonus */
  tier2Open: number
  tier2Bonus: number
  /** 最少開團場數（低於此 → 罰款 penalty） */
  minOpen: number
  /** 罰款（正數） */
  penalty: number
}

/** 年終獎金級距 */
export interface YearEndBonusTier {
  /** 達成率（%）：90 / 100 / 105 / 110 ... */
  achievePct: number
  /** 該級距年終獎金 */
  bonus: number
}

/** 年終獎金設定（每館每年） */
export interface YearEndBonusConfig {
  /** 100% 月營收基準 */
  baseMonthlyRevenue: number
  /** 級距（由低到高） */
  tiers: YearEndBonusTier[]
}


// ============================================================
// 階段 20：報表繳交追蹤（規章 3-2 報表繳交期限表 + 6-3 遲交罰則）
// ============================================================

export type ReportType =
  | 'parttime_wage'   // 工讀生薪資明細表/時薪表
  | 'petty_cash'      // 零用金表
  | 'manager_salary'  // 館主薪資表
  | 'product_stock'   // 月底商品庫存表
  | 'wage_receipt'    // 工讀生薪資領取表
  | 'schedule'        // 排班表（發布下月）
  | 'cash_deposit'    // 現金存款回報（每週一）

export interface ReportDef {
  type: ReportType
  name: string
  /** 每月應繳日（cash_deposit 為每週制，dueDay 表示每週一，計算另論） */
  dueDay: number
  target: string
  note?: string
  /** 每週制報表（現金存款回報） */
  weekly?: boolean
}

/** 規章 3-2 / 6-3：報表繳交期限表（已合併兩表，月底庫存表期限取 6-3 之 25 日） */
export const REPORT_DEFS: ReportDef[] = [
  { type: 'parttime_wage',  name: '工讀生薪資明細表', dueDay: 3,  target: '財務部-凱哥',   note: '含時數資料' },
  { type: 'petty_cash',     name: '零用金表',         dueDay: 3,  target: '各館管理組',   note: '管理部-俊逸監督' },
  { type: 'manager_salary', name: '館主薪資表',       dueDay: 5,  target: '財務部-凱哥' },
  { type: 'product_stock',  name: '月底商品庫存表',   dueDay: 25, target: '各館管理組',   note: '商品部-木春監督（3-2 表記 5 日、6-3 表記 25 日，暫採 25 日）' },
  { type: 'wage_receipt',   name: '工讀生薪資領取表', dueDay: 10, target: '財務部-凱哥' },
  { type: 'schedule',       name: '排班表',           dueDay: 25, target: '各館管理組',   note: '發布下月班表' },
  { type: 'cash_deposit',   name: '現金存款回報',     dueDay: 1,  target: '各館管理組',   note: '每週一 17:00 前', weekly: true },
]

/** 規章 6-3：每逾期一項報表罰 500 元 */
export const REPORT_LATE_PENALTY = 500

/** 一張報表某館某月的繳交紀錄；唯一鍵 = `${venueId}:${month}:${type}` */
export interface ReportSubmission {
  id: string
  venueId: string
  month: string          // YYYY-MM
  type: ReportType
  /** 該月幾日繳交（1-31）；null = 尚未繳交 */
  submittedDay: number | null
}

export type ReportStatusKind = 'ontime' | 'late' | 'pending' | 'missed'


// ════════════════════════════════════════════════════════════
// 階段 20 · Milestone 2
//   1. 記帳表異常罰則偵測（規章 6-3）
//   2. 採購 / 修繕分級簽核（金額級距；每級核准人為合理推定，待業主確認）
//   3. 零用金台帳（年度 6 萬上限；超支扣年終 5000）
//   4. 比賽企劃追蹤（每館≥3、新竹+內壢合計≥4；未達扣年終 3000）
// ════════════════════════════════════════════════════════════

// ── M2-1：記帳表異常罰則（規章 6-3）──────────────────────────
/** 記帳表異常種類（併入 ReconciliationAnomaly 一起追蹤） */
export type LedgerAnomalyKind = 'deposit_mismatch' | 'negative_balance' | 'revenue_omission'
/** 規章 6-3 記帳罰則金額 */
export const LEDGER_PENALTY_DEPOSIT  = 100  // 匯款少匯 / 多匯
export const LEDGER_PENALTY_NEGATIVE = 500  // 負帳未填說明
export const LEDGER_PENALTY_OMISSION = 100  // 營收漏填
export const LEDGER_ANOMALY_LABEL: Record<LedgerAnomalyKind, string> = {
  deposit_mismatch: '匯款金額不符',
  negative_balance: '負帳未填說明',
  revenue_omission: '營收漏填',
}

// ── M2-2：採購 / 修繕分級簽核 ────────────────────────────────
export type ProcurementKind = 'purchase' | 'repair'
export const PROCUREMENT_KIND_LABEL: Record<ProcurementKind, string> = {
  purchase: '採購', repair: '修繕',
}
/** 規章金額級距（核准人為合理推定，待業主確認） */
export const PROCUREMENT_TIER_1 = 2000  // < 2000：館長自核
export const PROCUREMENT_TIER_2 = 5000  // 2000–5000：老闆核；> 5000：老闆核 + 強制修繕單 / 完工照
export type ProcurementTier = 'self' | 'owner' | 'owner_strict'
export const PROCUREMENT_TIER_LABEL: Record<ProcurementTier, string> = {
  self:         '館長自核（< $2,000）',
  owner:        '老闆核准（$2,000–5,000）',
  owner_strict: '老闆核准＋完工存證（> $5,000）',
}
export type ProcurementStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed'
export const PROCUREMENT_STATUS_LABEL: Record<ProcurementStatus, string> = {
  draft: '草稿', pending: '待簽核', approved: '已核准', rejected: '已退回', completed: '已完工',
}
export interface ProcurementRequest {
  id: string
  venueId: string
  kind: ProcurementKind
  title: string
  amount: number
  status: ProcurementStatus
  requestedBy: UUID
  requestedAt: Timestamp
  approvedBy: UUID | null
  approvedAt: Timestamp | null
  /** 修繕完工存證（規章 > $5,000 強制）：evidence 參照 / 說明（接既有 /evidence 上傳系統） */
  completionEvidenceRef: string | null
  completedAt: Timestamp | null
  note: string
}

// ── M2-3：零用金台帳（年度 6 萬上限；超支扣年終 5000）─────────
export const PETTY_CASH_ANNUAL_CAP = 60000
export const PETTY_CASH_OVERSPEND_YEAREND_PENALTY = 5000
export const PETTY_CASH_CATEGORIES = ['清潔用品', '文具', '茶水', '維護耗材', '交通', '雜支'] as const
export type PettyCashCategory = typeof PETTY_CASH_CATEGORIES[number]
export interface PettyCashEntry {
  id: string
  venueId: string
  date: string            // YYYY-MM-DD
  category: PettyCashCategory
  label: string
  amount: number          // 支出金額（正數）
  enteredBy: UUID
  enteredAt: Timestamp
  note: string
}

// ── M2-4：比賽企劃追蹤 ───────────────────────────────────────
export const COMPETITION_MIN_PER_VENUE = 3
/** 內壢(v4) + 新竹(v6) 採「合計」門檻（待業主確認：是否取代各自的 ≥3） */
export const COMPETITION_COMBINED_GROUP: readonly string[] = ['v4', 'v6']
export const COMPETITION_COMBINED_TARGET = 4
export const COMPETITION_SHORTFALL_YEAREND_PENALTY = 3000
export type CompetitionStatus = 'planned' | 'done' | 'cancelled'
export const COMPETITION_STATUS_LABEL: Record<CompetitionStatus, string> = {
  planned: '規劃中', done: '已舉辦', cancelled: '取消',
}
export interface CompetitionPlan {
  id: string
  venueId: string
  title: string
  date: string            // YYYY-MM-DD
  status: CompetitionStatus
  note: string
  createdBy: UUID
  createdAt: Timestamp
}
