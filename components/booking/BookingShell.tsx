'use client'

// ============================================================
// components/booking/BookingShell.tsx
// ============================================================
// 階段 13 改寫。
//
// 客戶端報名頁的「品牌殼」— 統一 header / 背景 / footer。
// 7 個館共用同一套配色。
//
// 改寫重點：
//   - 移除舊的 Hero（粉紅漸層大標）和 CompactBar
//   - 改用新的 BookingHeader（sticky bar + tab nav + 登入鈕）
//   - 保留 Footer（LINE 官方 CTA + 地址）
//
// 注意這個檔特意 import client-side 字體（從 Google Fonts CDN）。
// ============================================================

import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import BookingHeader from './BookingHeader'
import type { PublicVenueInfo } from '@/data/api'

interface Props {
  venueSlug: string
  venueInfo: PublicVenueInfo
  /** 顯示在 header 底部的麵包屑文字（例：「5月15日 星期五 · 09:00」） */
  breadcrumb?: string
  /**
   * @deprecated 階段 13 後 hero 拿掉了，這個 prop 留著只為了不破壞舊呼叫。
   *             下一輪會清掉。
   */
  hero?: boolean
  /**
   * @deprecated 同上
   */
  backHref?: string
  children: React.ReactNode
}

export default function BookingShell({
  venueSlug, venueInfo, breadcrumb, children,
}: Props) {
  return (
    <>
      {/* 字體 — Next.js App Router 會把 <link> hoist 到 <head> */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;700;900&display=swap"
      />
      {/* 報名頁全域 reset */}
      <style dangerouslySetInnerHTML={{ __html: `
        .booking-root {
          background: ${BOOKING_COLORS.bgPrimary};
          font-family: ${BOOKING_FONTS.body};
          color: ${BOOKING_COLORS.textPrimary};
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }
        .booking-root *, .booking-root *::before, .booking-root *::after { box-sizing: border-box; }
        .booking-root button { font-family: inherit; cursor: pointer; }
        .booking-root a { -webkit-tap-highlight-color: transparent; }
      `}} />

      <div className="booking-root">
        <BookingHeader venueSlug={venueSlug} venueInfo={venueInfo} breadcrumb={breadcrumb} />

        <main style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '20px 16px 80px',
        }}>
          {children}
        </main>

        <Footer venueInfo={venueInfo} />
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Footer — LINE 官方帳號 CTA + 地址
// ─────────────────────────────────────────────────────────────
function Footer({ venueInfo }: { venueInfo: PublicVenueInfo }) {
  return (
    <footer style={{
      borderTop: `1px solid ${BOOKING_COLORS.borderLight}`,
      padding: '36px 20px 48px',
      background: BOOKING_COLORS.bgSecondary,
      marginTop: 60,
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}>
        <a
          href={venueInfo.lineOfficialUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: BOOKING_COLORS.lineGreen,
            color: '#fff',
            padding: '12px 26px',
            borderRadius: BOOKING_RADIUS.pill,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 4px 14px rgba(6, 199, 85, 0.28)',
          }}
        >
          <LineIcon size={20} />
          加入官方 LINE
        </a>
        <div style={{
          textAlign: 'center',
          color: BOOKING_COLORS.textMuted,
          fontSize: 11.5,
          lineHeight: 1.8,
        }}>
          <div>{venueInfo.name}</div>
          <div>{venueInfo.address}</div>
          <div style={{ marginTop: 6 }}>有任何疑問請透過官方 LINE 聯繫我們</div>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────
// LINE icon (inline SVG, 不依賴 lib)
// ─────────────────────────────────────────────────────────────
export function LineIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 5.667 2 10.18c0 4.047 3.554 7.435 8.355 8.075.325.07.768.215.88.493.1.252.066.647.032.903l-.143.857c-.043.252-.2.991.866.541 1.067-.45 5.757-3.39 7.857-5.802C21.243 13.62 22 12 22 10.18 22 5.667 17.523 2 12 2zM8.42 12.71h-2.13c-.184 0-.333-.149-.333-.333V8.42c0-.184.149-.333.333-.333.184 0 .333.149.333.333v3.624h1.797c.184 0 .333.15.333.334 0 .183-.149.332-.333.332zm1.46-.333c0 .183-.149.333-.333.333-.184 0-.334-.15-.334-.333v-3.96c0-.183.15-.333.334-.333.184 0 .333.15.333.333v3.96zm4.94 0c0 .143-.092.27-.228.316-.034.011-.07.017-.105.017a.333.333 0 0 1-.27-.138l-2.018-2.747v2.552c0 .183-.149.333-.333.333-.183 0-.333-.15-.333-.333v-3.96c0-.144.092-.27.228-.317.035-.011.07-.016.105-.016.104 0 .203.05.27.138l2.018 2.747V8.417c0-.184.149-.333.333-.333.184 0 .333.149.333.333v3.96zm3.04-2.314c.184 0 .334.149.334.333 0 .183-.15.333-.333.333H15.99v1.131h1.798c.184 0 .333.15.333.334 0 .183-.149.333-.333.333H15.66c-.183 0-.333-.15-.333-.333v-3.96c0-.184.15-.333.333-.333h2.13c.184 0 .333.149.333.333 0 .183-.149.333-.333.333h-1.797v1.132h1.797z"/>
    </svg>
  )
}
