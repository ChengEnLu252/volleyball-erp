// ============================================================
// data/permissions.ts — 階段 3.5 權限 runtime
// ============================================================
// 此檔的職責：
//   1. 定義「頁面 × 角色」存取矩陣（11 頁 × 4 角色）
//   2. UserVenueRole 種子資料（generator.ts 凍結，種子放這裡）
//   3. 純函數 helpers：path → page key、effective role 推算
//
// 設計理由：
//   - generator.ts 凍結，無法新增 userVenueRoles 欄位
//   - 把「種子」放 const、helpers 放 pure function
//   - api.ts 在 section 八封裝對外查詢（list / getEffectiveRole 等）
//   - 高階消費者（Sidebar / RequireRole / pages）只 import api.ts
// ============================================================

import type { UserVenueRole, VenueRole } from '@/types'


// ============================================================
// 1. 頁面 key — 對應 sidebar nav 的 href（去掉前綴 '/'）
// ============================================================

export type PageKey =
  | 'dashboard'
  | 'ai-summary'
  | 'sessions'
  | 'checkin'
  | 'customers'
  | 'products'
  | 'finance'
  | 'reconciliation'
  | 'captains'
  | 'finance/payments'
  | 'audit'
  | 'integrations'
  // 階段 21 M4：員工薪資（取代舊「館長績效」入口；薪資依管理規章計算）
  | 'staff-pay'
  // 階段 8：上傳憑證 admin 列表
  | 'evidence'
  // 階段 10：退費鏈（cancelSession 後的「待退費」+「退費歷史」）
  | 'finance/refunds'
  // 階段 12：報名熱度看板（按館 × 按日聚合的未來兩週狀態）
  | 'booking-overview'
  // 階段 16：館長週目標 + 通知收件匣
  | 'goals'
  | 'notifications'
  // 階段 17：線上商城後台訂單管理
  | 'orders'
  // SC2：線上商城商品管理（新增/編輯/規格/分類/圖）
  | 'shop-products'
  // 黑名單 / 違規管理
  | 'blacklist'
  // Round 5C：帳號審核（自助註冊者，僅 owner）
  | 'approvals'

export const PAGE_LABEL: Record<PageKey, string> = {
  'dashboard':        '總覽',
  'ai-summary':       'AI 營運摘要',
  'sessions':         '場次管理',
  'checkin':          '前台操作',
  'customers':        '客戶資料',
  'products':         '商品管理',
  'finance':          '財務報表',
  'reconciliation':   '對帳系統',
  'captains':         '主揪管理',
  'finance/payments': '報表匯出',
  'staff-pay':        '員工薪資',
  'audit':            '操作紀錄',
  'integrations':     '整合設定',
  'evidence':         '上傳憑證',
  'finance/refunds':  '退費處理',
  'booking-overview': '報名熱度',
  'goals':            '館長目標',
  'notifications':    '通知',
  'orders':           '商城訂單',
  'shop-products':    '商城商品',
  'blacklist':        '黑名單',
  'approvals':        '帳號審核',
}


// ============================================================
// 2. Effective role — 一個 user 的「實際角色」
// ============================================================
// 推算規則：
//   - globalRole='owner'  → 'owner'
//   - globalRole='staff' 且 UserVenueRole 至少一個 role='manager' → 'manager'
//   - globalRole='staff' 且所有 UserVenueRole 都是 role='staff'  → 'staff'
//   - globalRole='staff' 但完全沒 UserVenueRole（理論不該發生）→ 'none'
//
// 'manager' 跟 'staff' 不會混存於同一 user 的多個館 — 至少 demo 不處理這情境。
// 若日後遇到，採「最高權限優先」原則：有 manager 就視為 manager。
// ============================================================

export type EffectiveRole = 'owner' | 'manager' | 'staff' | 'none'

export const EFFECTIVE_ROLE_LABEL: Record<EffectiveRole, string> = {
  owner:   '最高權限',
  manager: '館長',
  staff:   '工讀生',
  none:    '無權限',
}


// ============================================================
// 3. 頁面存取等級
// ============================================================

export type PageAccess =
  | 'full'        // 全館資料（owner）
  | 'own_venue'   // 限自己館（manager / staff）
  | 'denied'      // 完全擋掉，page guard 顯示 403

/** 權限矩陣（11 頁 × 4 角色） */
export const PAGE_ACCESS_MATRIX: Record<PageKey, Record<EffectiveRole, PageAccess>> = {
  'dashboard':        { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 階段 15：AI 營運摘要 — 與 dashboard 同層級（owner 全部、manager 自己館、staff 擋）
  'ai-summary':       { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'sessions':         { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'checkin':          { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'customers':        { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'products':         { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'finance':          { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'reconciliation':   { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'captains':         { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'finance/payments': { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 階段 21 M4：員工薪資 — 管理資訊，owner 全部、manager 自己館、staff 擋（沿用舊績效頁權限）
  'staff-pay':        { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'audit':            { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
  'integrations':     { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
  // 階段 8：上傳憑證列表 — 與 audit 同層級，owner 限定（檔內含敏感截圖）
  'evidence':         { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
  // 階段 10：退費處理（與 finance 同層級 — owner 看全部、manager 看自己館、staff 擋）
  'finance/refunds':  { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 階段 12：報名熱度看板（owner 看全部、manager 看自己館、staff 也可看 — 跟 sessions 同層）
  'booking-overview': { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  // 階段 16：館長目標 — owner 全部（指派 + 確認）、manager 自己館（完成 + 上傳）、staff 擋
  'goals':            { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 階段 16：通知收件匣 — owner / manager 各看自己的；staff 暫不發通知 → 擋
  'notifications':    { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 階段 17：商城訂單 — owner 看全部、manager 看自己館取貨單、staff 擋
  'orders':           { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // SC2：商城商品管理 — owner / manager 可管理單一商城；staff 擋
  'shop-products':    { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // 黑名單 — owner / manager 皆可管理（七館同步）；staff 擋
  'blacklist':        { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  // Round 5C：帳號審核 — 僅 owner
  'approvals':        { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
}


// ============================================================
// 4. UserVenueRole 種子（generator.ts 凍結，種子放這裡）
// ============================================================
// demo 設定：
//   u1 王家凱     globalRole='owner'  → 不綁館（owner 看全部）
//   u2 王館主     globalRole='staff'  → 飛翼 v3 manager
//   u3 李小芳     globalRole='staff'  → 球魔方 v1 manager
//   u4 工讀生小明 globalRole='staff'  → 飛翼 v3 staff
// ============================================================

export const USER_VENUE_ROLES_SEED: ReadonlyArray<UserVenueRole> = [
  { userId: 'u2', venueId: 'v3', role: 'manager' },
  { userId: 'u3', venueId: 'v1', role: 'manager' },
  { userId: 'u4', venueId: 'v3', role: 'staff' },
]


// ============================================================
// 5. Demo 真實登入身份
// ============================================================
// 預設 owner u1 登入（demo 環境設定）。
// 當 currentUserId !== REAL_USER_ID 時 = owner 在「切視角」模式，
// Sidebar 頂部顯示「您正以 X 視角檢視」橫幅 + 一鍵回到 u1。
// 未來接真登入時，把這個改成讀 session/cookie。
// ============================================================

export const REAL_USER_ID = 'u1'


// ============================================================
// 5.5. Demo 密碼（階段 14 — 仿真登入體驗）
// ============================================================
// 每個 demo 使用者的登入密碼。未來接真登入時，這層整個拿掉，
// 改成由後端 verify。
//
// 預設全部 0000 — 老闆要的「示範時的儀式感」夠用就好；
// 想為單一角色換密碼，這裡改字串即可。
// ============================================================

export const USER_PASSWORDS: Readonly<Record<string, string>> = {
  u1: '0000', // 王家凱 — owner
  u2: '0000', // 王館主 — manager 飛翼
  u3: '0000', // 李小芳 — manager 球魔方 2.0
  u4: '0000', // 工讀生小明 — staff 飛翼
}

/** 驗證 user + password 組合是否正確。未知 userId 一律 false。 */
export function verifyUserPassword(userId: string, password: string): boolean {
  const expected = USER_PASSWORDS[userId]
  if (expected === undefined) return false
  return expected === password
}


// ============================================================
// 6. 純函數 helpers
// ============================================================

/**
 * 從 URL path 推 page key。
 *
 * 注意 prefix match 順序：finance/payments、finance/refunds 要在 finance 之前判斷。
 * 對外公開頁（/captain/[token]、/book/[venue]、/login）回 null —
 * 這些不在權限矩陣管轄範圍（主揪走 token、訂場是公開頁、登入頁本身）。
 */
export function pathToPageKey(path: string): PageKey | null {
  const ordered: ReadonlyArray<readonly [PageKey, string]> = [
    ['finance/payments', '/finance/payments'],
    ['finance/refunds',  '/finance/refunds'],
    ['booking-overview', '/booking-overview'],
    ['ai-summary',       '/ai-summary'],
    ['notifications',    '/notifications'],
    ['goals',            '/goals'],
    ['shop-products',    '/shop-products'],
    ['blacklist',        '/blacklist'],
    ['orders',           '/orders'],
    ['dashboard',        '/dashboard'],
    ['sessions',         '/sessions'],
    ['checkin',          '/checkin'],
    ['customers',        '/customers'],
    ['products',         '/products'],
    ['staff-pay',        '/reconciliation/staff-pay'],
    ['reconciliation',   '/reconciliation'],
    ['captains',         '/captains'],
    ['audit',            '/audit'],
    ['integrations',     '/integrations'],
    ['finance',          '/finance'],
  ]
  for (const [key, prefix] of ordered) {
    if (path === prefix || path.startsWith(prefix + '/')) return key
  }
  return null
}

/**
 * 從 globalRole + UserVenueRole list 推 effective role。
 */
export function deriveEffectiveRole(
  globalRole: 'owner' | 'staff',
  venueRoles: ReadonlyArray<UserVenueRole>,
): EffectiveRole {
  if (globalRole === 'owner') return 'owner'
  if (venueRoles.length === 0) return 'none'
  // 取最高權限（manager > staff）
  const hasManager = venueRoles.some(r => r.role === 'manager')
  if (hasManager) return 'manager'
  return 'staff'
}

/**
 * page access lookup — 找不到 page key 預設給 owner full、其他 denied
 * （安全 default：未知頁工讀生擋）
 */
export function lookupPageAccess(page: PageKey, role: EffectiveRole): PageAccess {
  return PAGE_ACCESS_MATRIX[page][role]
}

/**
 * 工讀生額外規則：可看欠款，但獎金 / 全館營收欄位遮蔽。
 * 此函數讓 UI 元件決定是否顯示獎金 / 全館加總。
 */
export function canSeeBonusAndTotals(role: EffectiveRole): boolean {
  return role === 'owner' || role === 'manager'
}

/**
 * Sidebar 角色 label 組合 — 「館長 · 飛翼」、「工讀生 · 飛翼」、「最高權限」。
 * 多館 manager 顯示「館長 · 飛翼+1」。
 *
 * @param effectiveRole user 的實際角色
 * @param venueNames    user 綁的 venue name 陣列（順序保持 stable）
 */
export function composeRoleLabel(
  effectiveRole: EffectiveRole,
  venueNames: ReadonlyArray<string>,
): string {
  if (effectiveRole === 'owner') return EFFECTIVE_ROLE_LABEL.owner
  if (effectiveRole === 'none')  return EFFECTIVE_ROLE_LABEL.none
  if (venueNames.length === 0) {
    return EFFECTIVE_ROLE_LABEL[effectiveRole]
  }
  const head = venueNames[0]
  const rest = venueNames.length - 1
  const venuePart = rest > 0 ? `${head}+${rest}` : head
  return `${EFFECTIVE_ROLE_LABEL[effectiveRole]} · ${venuePart}`
}

/** VenueRole label（給內部 audit / debug 用，不對外） */
export const VENUE_ROLE_LABEL: Record<VenueRole, string> = {
  manager: '館長',
  staff:   '工讀生',
}
