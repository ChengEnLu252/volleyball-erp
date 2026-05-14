'use client'

// ============================================================
// components/booking/BookingShell.tsx
// ============================================================
// 客戶端報名頁的「品牌殼」— 統一 header / 背景 / footer。
// 7 個館共用同一套配色，但 header 顯示各館名稱與副標。
//
// 設計：
//   - 上方：館品牌區塊（漸層粉底，serif 大字館名）
//   - 中段：children
//   - 下方：footer，含 LINE 官方帳號 CTA + 地址
//
// 注意這個檔特意 import client-side 字體（從 Google Fonts CDN）—
// 因為 root layout 沒 import 字體，這裡用 <link> + style tag 自己 inject。
// ============================================================

import Link from 'next/link'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_SHADOWS, BOOKING_RADIUS } from './theme'
import type { PublicVenueInfo } from '@/data/api'

interface Props {
  venueSlug: string
  venueInfo: PublicVenueInfo
  /** 是否要顯示 hero（首頁顯示，內頁折疊為 compact bar） */
  hero?: boolean
  /** 內頁時顯示的麵包屑/標題 */
  breadcrumb?: string
  /** 上一頁連結（內頁回首頁用） */
  backHref?: string
  children: React.ReactNode
}

export default function BookingShell({
  venueSlug, venueInfo, hero = false, breadcrumb, backHref, children,
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
      {/* 報名頁全域 reset — 用 dangerouslySetInnerHTML 避免 SSR/CSR mismatch */}
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

        {hero ? <Hero venueInfo={venueInfo} /> : <CompactBar venueInfo={venueInfo} breadcrumb={breadcrumb} backHref={backHref} venueSlug={venueSlug} />}

        <main style={{
          maxWidth: 720, margin: '0 auto',
          padding: hero ? '0 20px 100px' : '16px 20px 100px',
        }}>
          {children}
        </main>

        <Footer venueInfo={venueInfo} />
      </div>
    </>
  )
}


// ─────────────────────────────────────────────────────────────
// Hero — 首頁用，大字 + 漸層粉底
// ─────────────────────────────────────────────────────────────
function Hero({ venueInfo }: { venueInfo: PublicVenueInfo }) {
  return (
    <header style={{
      background: `linear-gradient(155deg, ${BOOKING_COLORS.pinkSoft} 0%, ${BOOKING_COLORS.bgPrimary} 70%)`,
      padding: '48px 20px 36px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 裝飾性粉圓 (左上) */}
      <div style={{
        position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: '50%',
        background: BOOKING_COLORS.pink, opacity: 0.22, filter: 'blur(8px)',
      }} />
      {/* 裝飾性粉圓 (右下) */}
      <div style={{
        position: 'absolute', bottom: -100, right: -50, width: 240, height: 240, borderRadius: '50%',
        background: BOOKING_COLORS.pink, opacity: 0.14, filter: 'blur(20px)',
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{
          fontSize: 11, letterSpacing: 4, color: BOOKING_COLORS.textSecondary,
          fontWeight: 500, marginBottom: 10, textTransform: 'uppercase',
        }}>
          {venueInfo.brandSubtitle}
        </div>
        <h1 style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 38, fontWeight: 700, margin: '0 0 14px',
          letterSpacing: '-0.5px',
          color: BOOKING_COLORS.textPrimary,
        }}>
          {venueInfo.name}
        </h1>
        <div style={{
          fontSize: 13, color: BOOKING_COLORS.textSecondary,
          maxWidth: 480, lineHeight: 1.7,
        }}>
          📍 {venueInfo.address}
        </div>
      </div>
    </header>
  )
}


// ─────────────────────────────────────────────────────────────
// CompactBar — 內頁用，窄條 header 帶返回鈕
// ─────────────────────────────────────────────────────────────
function CompactBar({ venueInfo, venueSlug, breadcrumb, backHref }: {
  venueInfo: PublicVenueInfo; venueSlug: string; breadcrumb?: string; backHref?: string
}) {
  return (
    <header style={{
      background: BOOKING_COLORS.bgCard,
      borderBottom: `1px solid ${BOOKING_COLORS.borderLight}`,
      padding: '14px 20px',
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'saturate(160%) blur(8px)',
    }}>
      <div style={{
        maxWidth: 720, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <Link href={backHref ?? `/book/${venueSlug}`} style={{
          fontSize: 22, color: BOOKING_COLORS.pinkDeep, textDecoration: 'none',
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
        }}>
          ‹
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: BOOKING_FONTS.display, fontSize: 15, fontWeight: 700,
            color: BOOKING_COLORS.textPrimary, lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {venueInfo.name}
          </div>
          {breadcrumb && (
            <div style={{
              fontSize: 11, color: BOOKING_COLORS.textMuted, marginTop: 2,
            }}>
              {breadcrumb}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


// ─────────────────────────────────────────────────────────────
// Footer — LINE 官方帳號 CTA + 版權
// ─────────────────────────────────────────────────────────────
function Footer({ venueInfo }: { venueInfo: PublicVenueInfo }) {
  return (
    <footer style={{
      borderTop: `1px solid ${BOOKING_COLORS.borderLight}`,
      padding: '36px 20px 48px',
      background: BOOKING_COLORS.bgSecondary,
      marginTop: 80,
    }}>
      <div style={{
        maxWidth: 720, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>
        <a href={venueInfo.lineOfficialUrl} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: BOOKING_COLORS.lineGreen, color: '#fff',
          padding: '12px 26px', borderRadius: BOOKING_RADIUS.pill,
          textDecoration: 'none', fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 14px rgba(6, 199, 85, 0.28)',
        }}>
          <LineIcon size={20} />
          加入官方 LINE
        </a>
        <div style={{ textAlign: 'center', color: BOOKING_COLORS.textMuted, fontSize: 11.5, lineHeight: 1.8 }}>
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
