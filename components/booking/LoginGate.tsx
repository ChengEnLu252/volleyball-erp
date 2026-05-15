'use client'

// ============================================================
// components/booking/LoginGate.tsx — LINE 登入閘門
// ============================================================
// 階段 13 新增。
//
// 用途：包住「需要登入才能看的內容」，未登入時顯示 CTA + 模糊預覽。
// 已登入則直接 render children。
//
// 使用範例：
//   <LoginGate
//     reason="登入後才能查看可預訂日期與場次"
//     blurredPreview={<BookingCalendar ... />}
//   >
//     <BookingCalendar ... />
//   </LoginGate>
//
// 設計：
//   - 未登入：用「半透明遮罩 + 中央 CTA」覆蓋 blurredPreview，
//             視覺上能看到下面有東西，提示「登入解鎖」
//   - 點 CTA → 彈 LineLoginModal
//   - 登入成功 → 自動切到 children
// ============================================================

import { useEffect, useState } from 'react'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import { LineIcon } from './BookingShell'
import LineLoginModal, { getLineUser, type LineUser } from './LineLoginModal'

interface Props {
  /** 已登入時要顯示的內容 */
  children: React.ReactNode
  /** 未登入時要在遮罩下隱約顯示的預覽（可重複 children；可選） */
  blurredPreview?: React.ReactNode
  /** CTA 上方的解釋文字 */
  reason?: string
  /** CTA 按鈕文字 */
  ctaLabel?: string
}

export default function LoginGate({
  children, blurredPreview, reason, ctaLabel,
}: Props) {
  const [user, setUser] = useState<LineUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    setUser(getLineUser())
    setHydrated(true)
  }, [])

  function handleSuccess(u: LineUser) {
    setUser(u)
    setLoginOpen(false)
  }

  // SSR / 第一次 paint 還沒讀到 sessionStorage — 為避免 hydration mismatch，
  // 先 render 一個 placeholder（保持結構與已登入 children 一致即可）
  if (!hydrated) {
    return (
      <div style={{ minHeight: 200, opacity: 0.6 }}>
        {blurredPreview ?? null}
      </div>
    )
  }

  if (user) {
    return <>{children}</>
  }

  // 未登入：顯示閘門
  return (
    <>
      <div style={{ position: 'relative' }}>
        {/* 模糊預覽（若有） */}
        {blurredPreview && (
          <div style={{
            filter: 'blur(6px) saturate(0.6)',
            opacity: 0.7,
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {blurredPreview}
          </div>
        )}

        {/* 遮罩 + CTA */}
        <div style={{
          position: blurredPreview ? 'absolute' : 'relative',
          inset: blurredPreview ? 0 : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: blurredPreview ? undefined : 280,
          padding: '36px 24px',
          background: blurredPreview
            ? `linear-gradient(135deg, rgba(253, 250, 247, 0.65), rgba(252, 231, 238, 0.78))`
            : 'transparent',
          backdropFilter: blurredPreview ? 'blur(2px)' : undefined,
          borderRadius: blurredPreview ? BOOKING_RADIUS.card : undefined,
        }}>
          <div style={{
            background: BOOKING_COLORS.bgCard,
            borderRadius: BOOKING_RADIUS.card,
            padding: '28px 26px',
            textAlign: 'center',
            maxWidth: 360,
            width: '100%',
            border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
            boxShadow: '0 8px 26px rgba(184, 100, 130, 0.16)',
          }}>
            {/* 大圖示 */}
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: BOOKING_COLORS.pinkSoft,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              border: `2px solid ${BOOKING_COLORS.pinkBorder}`,
            }}>
              🏐
            </div>

            <h3 style={{
              fontFamily: BOOKING_FONTS.display,
              fontSize: 18,
              fontWeight: 700,
              margin: '0 0 10px',
              color: BOOKING_COLORS.textPrimary,
            }}>
              請先以 LINE 登入
            </h3>

            <p style={{
              fontSize: 13,
              color: BOOKING_COLORS.textSecondary,
              lineHeight: 1.7,
              margin: '0 0 20px',
            }}>
              {reason ?? '登入後才能查看可預訂日期與場次'}
            </p>

            <button
              onClick={() => setLoginOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '13px 16px',
                background: BOOKING_COLORS.lineGreen,
                color: '#fff',
                border: 'none',
                borderRadius: BOOKING_RADIUS.md,
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(6, 199, 85, 0.30)',
              }}
            >
              <LineIcon size={20} />
              {ctaLabel ?? '使用 LINE 登入'}
            </button>

            <div style={{
              marginTop: 14,
              fontSize: 11,
              color: BOOKING_COLORS.textMuted,
              lineHeight: 1.6,
            }}>
              系統將取得您的 LINE 顯示名稱與頭像，
              <br />
              不會取得 LINE 個人聊天訊息。
            </div>
          </div>
        </div>
      </div>

      <LineLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  )
}
