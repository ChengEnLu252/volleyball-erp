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
  | 'sessions'
  | 'checkin'
  | 'customers'
  | 'products'
  | 'finance'
  | 'reconciliation'
  | 'captains'
  | 'finance/payments'
  | 'performance'
  | 'audit'
  | 'integrations'
  // 階段 8：上傳憑證 admin 列表
  | 'evidence'

export const PAGE_LABEL: Record<PageKey, string> = {
  'dashboard':        '總覽',
  'sessions':         '場次管理',
  'checkin':          '前台操作',
  'customers':        '客戶資料',
  'products':         '商品管理',
  'finance':          '財務報表',
  'reconciliation':   '對帳系統',
  'captains':         '主揪管理',
  'finance/payments': '報表匯出',
  'performance':      '館長績效',
  'audit':            '操作紀錄',
  'integrations':     '整合設定',
  'evidence':         '上傳憑證',
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
  'sessions':         { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'checkin':          { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'customers':        { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'products':         { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'finance':          { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'reconciliation':   { owner: 'full', manager: 'own_venue', staff: 'own_venue', none: 'denied' },
  'captains':         { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'finance/payments': { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'performance':      { owner: 'full', manager: 'own_venue', staff: 'denied',    none: 'denied' },
  'audit':            { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
  'integrations':     { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
  // 階段 8：上傳憑證列表 — 與 audit 同層級，owner 限定（檔內含敏感截圖）
  'evidence':         { owner: 'full', manager: 'denied',    staff: 'denied',    none: 'denied' },
}


// ============================================================
// 4. UserVenueRole 種子（generator.ts 凍結，種子放這裡）
// ============================================================
// demo 設定：
//   u1 陳老闆     globalRole='owner'  → 不綁館（owner 看全部）
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
// 6. 純函數 helpers
// ============================================================

/**
 * 從 URL path 推 page key。
 *
 * 注意 prefix match 順序：finance/payments 要在 finance 之前判斷。
 * 對外公開頁（/captain/[token]、/book/[venue]、/login）回 null —
 * 這些不在權限矩陣管轄範圍（主揪走 token、訂場是公開頁、登入頁本身）。
 */
export function pathToPageKey(path: string): PageKey | null {
  const ordered: ReadonlyArray<readonly [PageKey, string]> = [
    ['finance/payments', '/finance/payments'],
    ['dashboard',        '/dashboard'],
    ['sessions',         '/sessions'],
    ['checkin',          '/checkin'],
    ['customers',        '/customers'],
    ['products',         '/products'],
    ['reconciliation',   '/reconciliation'],
    ['captains',         '/captains'],
    ['performance',      '/performance'],
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
