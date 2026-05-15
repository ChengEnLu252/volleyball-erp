'use client'

// ============================================================
// components/booking/LineLoginModal.tsx
// ============================================================
// LINE 登入殼。階段 12 為「殼」— 不接真實 LINE OAuth，
// 點下去模擬一個 fake user 寫入 sessionStorage，預留 signInWithLine()
// 介面方便未來換真實實作。
//
// 未來真實接入時：
//   1. 申請 LINE LOGIN channel
//   2. 把這個 modal 改成「跳轉到 LINE OAuth URL」
//   3. 加 /api/auth/line/callback route 處理 token
//   4. SESSION_KEY 維持，下游頁面 (報名 form) 無需改動
// ============================================================

import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import { LineIcon } from './BookingShell'
import { seedDemoHistoryIfNeeded } from '@/data/my-bookings'

const SESSION_KEY = 'volleyops-booking-line-user'

/** Mock 階段固定 user ID — 同一 demo session 看到累積的「我的預定」紀錄。
 *  未來換真 LINE OAuth 時，這常數會被 callback 中的真實 LINE userId 取代。 */
const MOCK_FIXED_USER_ID = 'mock-line-demo-user'

export interface LineUser {
  userId: string         // 對應 LINE 的 user ID（mock 時隨機產生）
  displayName: string    // LINE 顯示名稱
  pictureUrl: string | null  // LINE 頭像（mock 為 null）
}

export function getLineUser(): LineUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as LineUser } catch { return null }
}

export function setLineUser(user: LineUser): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearLineUser(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SESSION_KEY)
}

/**
 * 未來接真實 LINE Login 時把此函式換成 OAuth 流程。
 * 現階段：用「固定 mock user」讓同 demo session 中累積的「我的預定」資料看得到。
 * 同時若是首次登入，會 seed 3 筆歷史報名作為 demo 展示資料。
 */
export function signInWithLine(): Promise<LineUser> {
  // ⛔ 真實實作會 redirect 到 LINE OAuth URL，此處 mock。
  return new Promise(resolve => {
    setTimeout(() => {
      const mockUser: LineUser = {
        userId: MOCK_FIXED_USER_ID,
        displayName: '測試用戶',
        pictureUrl: null,
      }
      setLineUser(mockUser)
      // 首次登入時，幫這個 user seed demo 歷史報名（從 GENERATED 過去場次抽 3 筆）
      seedDemoHistoryIfNeeded(mockUser.userId, mockUser.displayName)
      resolve(mockUser)
    }, 600)
  })
}


// ─────────────────────────────────────────────────────────────
// LineLoginModal — 點 CTA 跳出，提示用戶以 LINE 登入
// ─────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (user: LineUser) => void
}

export default function LineLoginModal({ open, onClose, onSuccess }: Props) {
  if (!open) return null

  async function handleLogin() {
    const user = await signInWithLine()
    onSuccess(user)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(61, 42, 48, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BOOKING_COLORS.bgCard,
          borderRadius: BOOKING_RADIUS.lg,
          maxWidth: 360, width: '100%',
          padding: '32px 28px 26px',
          boxShadow: '0 24px 60px rgba(120, 60, 80, 0.18)',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: BOOKING_COLORS.lineGreen,
          margin: '0 auto 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LineIcon size={32} color="#fff" />
        </div>

        <h2 style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 20, fontWeight: 700, margin: '0 0 10px',
          color: BOOKING_COLORS.textPrimary,
        }}>
          請先以 LINE 登入
        </h2>
        <p style={{
          fontSize: 13, color: BOOKING_COLORS.textSecondary,
          lineHeight: 1.7, margin: '0 0 24px',
        }}>
          為了確認您的報名身份、避免冒用，<br />
          報名前請先使用 LINE 登入。
        </p>

        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '14px',
            borderRadius: BOOKING_RADIUS.md,
            background: BOOKING_COLORS.lineGreen, color: '#fff',
            border: 'none', fontSize: 15, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(6, 199, 85, 0.32)',
          }}
        >
          <LineIcon size={22} />
          使用 LINE 登入
        </button>

        <button
          onClick={onClose}
          style={{
            marginTop: 12, background: 'none', border: 'none',
            color: BOOKING_COLORS.textMuted, fontSize: 12.5,
            cursor: 'pointer', padding: '6px 12px',
          }}
        >
          取消
        </button>

        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: `1px dashed ${BOOKING_COLORS.borderLight}`,
          fontSize: 10.5, color: BOOKING_COLORS.textMuted, lineHeight: 1.6,
        }}>
          系統將取得您的 LINE 顯示名稱與頭像，<br />
          不會取得 LINE 個人聊天訊息。
        </div>
      </div>
    </div>
  )
}
