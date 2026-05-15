// ============================================================
// data/my-bookings.ts — 客戶端「我的預定」mock 儲存
// ============================================================
// 階段 13 新增。
//
// 為什麼需要這個檔：
//   報名 submit 在現階段是 mock（會把資料丟到 confirmation URL，沒寫進 GENERATED）。
//   但「我的預定」頁要列出已報名場次 + 歷史報名，所以需要本地端持久化。
//
// 設計：
//   - 用 sessionStorage（不是 localStorage — demo 結束就清）
//   - Key 綁 LINE userId，不同 user 不共享
//   - 提供 add / cancel / list / seedDemoHistory 四個操作
//   - 首次登入 seedDemoHistory 會塞 3 筆過去場次（用 GENERATED 中已存在的歷史 sessions）
//
// 未來真實實作：
//   - 把 sessionStorage 換成 fetch('/api/me/bookings')
//   - 函式介面 (signature) 保持不變，下游頁面無需改動
// ============================================================

import { GENERATED } from './generator'

const STORAGE_PREFIX = 'volleyops-my-bookings-'
const SEED_FLAG_PREFIX = 'volleyops-my-bookings-seeded-'

export interface MyBookingItem {
  /** 內部 id（uuid-ish），用於取消 */
  id: string
  /** 對應的 session id（GENERATED.sessions 內的 id；mock 歷史也可能用真實 session id） */
  sessionId: string
  venueId: string
  venueName: string
  venueSlug: string
  sessionDate: string         // YYYY-MM-DD
  startTime: string           // HH:mm
  endTime: string             // HH:mm
  sessionType: string         // 同 PublicSession.sessionType
  /** 報名人名稱（LINE displayName 或自填） */
  registrantName: string
  /** 候補 / 正取 */
  isWaitlist: boolean
  /** 已取消 / 已報名 / 已完成（過去日期且未取消） */
  status: 'registered' | 'cancelled' | 'completed'
  /** 報名時的金額（球費 + 冷氣，若有） */
  totalFee: number
  /** 付款方式 */
  payMethod: 'cash' | 'linepay' | 'transfer'
  /** 報名時間（ISO） */
  createdAt: string
  /** 取消時間（若有） */
  cancelledAt?: string
}

// ─────────────────────────────────────────────────────────────
// 內部 helper
// ─────────────────────────────────────────────────────────────

function storageKey(lineUserId: string): string {
  return STORAGE_PREFIX + lineUserId
}

function seedFlagKey(lineUserId: string): string {
  return SEED_FLAG_PREFIX + lineUserId
}

function readAll(lineUserId: string): MyBookingItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(storageKey(lineUserId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(lineUserId: string, items: MyBookingItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey(lineUserId), JSON.stringify(items))
  } catch (e) {
    // sessionStorage 滿了，直接吞掉
    console.warn('my-bookings storage write failed', e)
  }
}

function genId(): string {
  return 'mb-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4)
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

/** 簡易反查 slug from venueId */
const VENUE_ID_TO_SLUG: Record<string, string> = {
  v1: 'magicblock',
  v2: 'ace2.0',
  v3: 'flywing',
  v4: 'hibi',
  v5: 'playone',
  v6: 'smash',
  v7: 'ace3.0',
}

const VENUE_ID_TO_NAME: Record<string, string> = {
  v1: '球魔方 2.0 排球館',
  v2: 'Ace 2.0 排球館',
  v3: '飛翼排球館',
  v4: 'Hibi 日日排球館',
  v5: 'play one 排球館',
  v6: '就醬瘋排球館',
  v7: 'Ace 3.0 排球館',
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * 列出某用戶所有「我的預定」（含取消、含歷史），新到舊排序。
 * 自動計算狀態：未取消 + 已過日期 → 'completed'
 */
export function listMyBookings(lineUserId: string): MyBookingItem[] {
  const items = readAll(lineUserId)
  const today = todayStr()
  // 自動把過期未取消的標為 completed
  let mutated = false
  const updated = items.map(item => {
    if (item.status === 'registered' && item.sessionDate < today) {
      mutated = true
      return { ...item, status: 'completed' as const }
    }
    return item
  })
  if (mutated) writeAll(lineUserId, updated)
  // 排序：未來場次（registered）優先（近 → 遠），其次過去（新 → 舊）
  return updated.sort((a, b) => {
    if (a.status === 'registered' && b.status !== 'registered') return -1
    if (a.status !== 'registered' && b.status === 'registered') return 1
    if (a.status === 'registered') {
      // 都是未來，由近到遠
      return (a.sessionDate + a.startTime).localeCompare(b.sessionDate + b.startTime)
    }
    // 都是歷史（completed / cancelled），由新到舊
    return (b.sessionDate + b.startTime).localeCompare(a.sessionDate + a.startTime)
  })
}

/** 列出「即將」場次（未取消、未過期） */
export function listUpcomingBookings(lineUserId: string): MyBookingItem[] {
  return listMyBookings(lineUserId).filter(b => b.status === 'registered')
}

/** 列出歷史場次（已完成 + 已取消） */
export function listHistoryBookings(lineUserId: string): MyBookingItem[] {
  return listMyBookings(lineUserId).filter(b => b.status !== 'registered')
}

/** 新增一筆報名 */
export function addMyBooking(
  lineUserId: string,
  data: Omit<MyBookingItem, 'id' | 'status' | 'createdAt'> & { status?: MyBookingItem['status'] },
): MyBookingItem {
  const item: MyBookingItem = {
    id: genId(),
    status: data.status ?? 'registered',
    createdAt: new Date().toISOString(),
    ...data,
  }
  const all = readAll(lineUserId)
  all.push(item)
  writeAll(lineUserId, all)
  return item
}

/** 取消一筆報名（不刪，標記 cancelled） */
export function cancelMyBooking(lineUserId: string, bookingId: string): boolean {
  const all = readAll(lineUserId)
  const idx = all.findIndex(b => b.id === bookingId)
  if (idx === -1) return false
  if (all[idx]!.status !== 'registered') return false
  all[idx] = {
    ...all[idx]!,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  }
  writeAll(lineUserId, all)
  return true
}

/**
 * 取消是否合法：開場前 24H 才可自行取消（舊系統規則）。
 * 回傳 { ok, reason } 給 UI 用。
 */
export function canCancelBooking(item: MyBookingItem): { ok: boolean; reason?: string } {
  if (item.status !== 'registered') {
    return { ok: false, reason: '此場次已不可取消' }
  }
  const now = new Date()
  const sessionStart = new Date(`${item.sessionDate}T${item.startTime}:00`)
  const diffHours = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (diffHours < 24) {
    return {
      ok: false,
      reason: '開場前 24 小時內不可自行取消，請私訊官方帳號協助處理',
    }
  }
  return { ok: true }
}

/**
 * 首次登入時，為新用戶塞 demo 歷史資料（3 筆過去場次）。
 * 從 GENERATED.sessions 找最近過去的 3 場，標記為 'completed'。
 * 已 seed 過會跳過。
 */
export function seedDemoHistoryIfNeeded(lineUserId: string, registrantName: string): void {
  if (typeof window === 'undefined') return
  const flagKey = seedFlagKey(lineUserId)
  if (window.sessionStorage.getItem(flagKey)) return  // 已 seed

  const today = todayStr()
  // 找最近 60 天內、已過期、有 session 的歷史場次
  const pastSessions = GENERATED.sessions
    .filter(s => s.sessionDate < today)
    .filter(s => s.status !== 'cancelled')
    .filter(s => s.seasonRentalId === null)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))   // 新到舊
    .slice(0, 12)  // 從最近 12 筆中隨機抽

  // 隨機抽 3 場（但用 seed 的方式：用 lineUserId 做 hash 確保同個 user 看到同樣的 demo）
  const seed = lineUserId.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const sample: typeof pastSessions = []
  for (let i = 0; i < 3 && pastSessions.length > 0; i++) {
    const idx = (seed + i * 7) % pastSessions.length
    const picked = pastSessions[idx]
    if (picked && !sample.includes(picked)) sample.push(picked)
  }

  const methods: MyBookingItem['payMethod'][] = ['cash', 'linepay', 'transfer']
  for (let i = 0; i < sample.length; i++) {
    const s = sample[i]!
    const slug = VENUE_ID_TO_SLUG[s.venueId] ?? 'flywing'
    const venueName = VENUE_ID_TO_NAME[s.venueId] ?? '飛翼排球館'
    addMyBooking(lineUserId, {
      sessionId: s.id,
      venueId: s.venueId,
      venueName,
      venueSlug: slug,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      sessionType: s.sessionType,
      registrantName,
      isWaitlist: false,
      totalFee: s.courtFee + (s.acEnabled ? s.acFee : 0),
      payMethod: methods[i % methods.length]!,
      status: 'completed',
    })
  }

  window.sessionStorage.setItem(flagKey, '1')
}

/** 清除某用戶所有資料（給「登出 → 清空」用） */
export function clearMyBookings(lineUserId: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(storageKey(lineUserId))
  window.sessionStorage.removeItem(seedFlagKey(lineUserId))
}
