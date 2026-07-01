'use client'

// ============================================================
// components/shop/ShopShell.tsx — 線上商城品牌殼
// ============================================================
// 階段 17 新增。
//
// 沿用 /book 報名頁的「日式柔感」設計 token（粉 / 奶白 / serif 標題），
// 與 ERP 後台區隔。所有 /shop/* 頁面共用此殼。
//
//   - Header：sticky，Logo + 購物車（顯示件數，連到 /shop/checkout）
//   - Footer：店家資訊 + 回後台連結
// ============================================================

import Link from 'next/link'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'
import { useCart } from './cart'

interface Props {
  /** header 底部的麵包屑（例：「結帳」「訂單成立」） */
  breadcrumb?: string
  /** 是否隱藏購物車按鈕（結帳 / 確認頁不需要） */
  hideCart?: boolean
  children: React.ReactNode
}

function CartButton() {
  const cart = useCart()
  const count = Object.values(cart).reduce((s, q) => s + q, 0)
  return (
    <Link
      href="/shop/checkout"
      style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: BOOKING_RADIUS.pill,
        background: count > 0 ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.bgSecondary,
        color: count > 0 ? '#fff' : BOOKING_COLORS.textSecondary,
        textDecoration: 'none', fontSize: 13, fontWeight: 700,
        border: `1px solid ${count > 0 ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
        transition: 'all .15s ease',
      }}
    >
      <span style={{ fontSize: 15 }}>🛒</span>
      <span>購物車</span>
      {count > 0 && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 9, background: '#fff', color: BOOKING_COLORS.pinkDeep,
          fontSize: 11, fontWeight: 800, lineHeight: 1,
        }}>{count > 99 ? '99+' : count}</span>
      )}
    </Link>
  )
}

export default function ShopShell({ breadcrumb, hideCart, children }: Props) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;700;900&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .shop-root {
          background: ${BOOKING_COLORS.bgPrimary};
          font-family: ${BOOKING_FONTS.body};
          color: ${BOOKING_COLORS.textPrimary};
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }
        .shop-root *, .shop-root *::before, .shop-root *::after { box-sizing: border-box; }
        .shop-root button { font-family: inherit; cursor: pointer; }
        .shop-root a { -webkit-tap-highlight-color: transparent; }
        .shop-root input, .shop-root textarea, .shop-root select { font-family: inherit; }
      `}} />

      <div className="shop-root">
        {/* —— Header —— */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(253,250,247,0.86)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${BOOKING_COLORS.border}`,
        }}>
          <div style={{
            maxWidth: 880, margin: '0 auto',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <Link href="/shop" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 22 }}>🏐</span>
              <span>
                <span style={{
                  display: 'block', fontFamily: BOOKING_FONTS.display,
                  fontSize: 18, fontWeight: 700, color: BOOKING_COLORS.textPrimary, lineHeight: 1.1,
                }}>排球選物店</span>
                <span style={{
                  display: 'block', fontSize: 10, letterSpacing: '0.18em',
                  color: BOOKING_COLORS.pinkDeep, fontWeight: 700, marginTop: 1,
                }}>VOLLEYOPS SHOP</span>
              </span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/shop/orders" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: BOOKING_RADIUS.pill,
                background: BOOKING_COLORS.bgSecondary, color: BOOKING_COLORS.textSecondary, textDecoration: 'none',
                fontSize: 13, fontWeight: 700, border: `1px solid ${BOOKING_COLORS.border}`, whiteSpace: 'nowrap',
              }}>🔎 <span>訂單查詢</span></Link>
              {!hideCart && <CartButton />}
            </div>
          </div>
          {breadcrumb && (
            <div style={{
              maxWidth: 880, margin: '0 auto',
              padding: '0 16px 10px', fontSize: 12, color: BOOKING_COLORS.textMuted,
            }}>
              <Link href="/shop" style={{ color: BOOKING_COLORS.pinkDeep, textDecoration: 'none' }}>商城首頁</Link>
              <span style={{ margin: '0 6px' }}>›</span>
              {breadcrumb}
            </div>
          )}
        </header>

        {/* —— Main —— */}
        <main style={{ maxWidth: 880, margin: '0 auto', padding: '20px 16px 90px' }}>
          {children}
        </main>

        {/* —— Footer —— */}
        <footer style={{
          borderTop: `1px solid ${BOOKING_COLORS.border}`,
          background: BOOKING_COLORS.bgSecondary,
          padding: '28px 16px 40px',
        }}>
          <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontFamily: BOOKING_FONTS.display, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              排球選物店
            </div>
            <p style={{ fontSize: 12, color: BOOKING_COLORS.textMuted, margin: '0 0 4px', lineHeight: 1.7 }}>
              到館自取免運 · 宅配滿額另有優惠（即將推出）
            </p>
            <p style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, margin: 0 }}>
              下單後我們會盡快與您聯繫確認，付款方式以結帳頁選擇為準。
            </p>
            <div style={{ marginTop: 14, boxShadow: BOOKING_SHADOWS.card, display: 'inline-block', borderRadius: BOOKING_RADIUS.pill }}>
              <a href="/dashboard" style={{
                display: 'inline-block', padding: '7px 16px', borderRadius: BOOKING_RADIUS.pill,
                background: '#fff', color: BOOKING_COLORS.textSecondary,
                fontSize: 11, fontWeight: 700, textDecoration: 'none',
                border: `1px solid ${BOOKING_COLORS.border}`,
              }}>← 回管理後台</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
