'use client'

// ============================================================
// app/shop/page.tsx — 線上商城首頁（商品目錄）
// ============================================================
// 階段 17 建立；階段 21 改版：
//   - 精緻商品卡（品牌風格佔位圖 ProductImage，可換實拍照）。
//   - 規格商品（排球衣 / 褲 / 襪 / 鞋 / 袖套）顯示顏色點，導向詳情頁選規格。
//   - 無規格商品（飲品 / 護具…）可在卡片直接加入。
//   - 分類 chips 篩選。底部 sticky 購物車列 → 前往結帳。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listShopProducts } from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import { SHOP_CATEGORY_LABEL, type ShopCategory } from '@/types'
import ShopShell from '@/components/shop/ShopShell'
import ProductImage from '@/components/shop/ProductImage'
import { useCart, addToCart } from '@/components/shop/cart'
import { hasVariants, parseCartKey } from '@/components/shop/variants'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

const CATEGORY_ORDER: ShopCategory[] = ['apparel', 'gear', 'accessory', 'drink']

export default function ShopHome() {
  const storeVersion = useStoreSync()
  const cart = useCart()
  const [mounted, setMounted] = useState(false)
  const [activeCat, setActiveCat] = useState<ShopCategory | 'all'>('all')
  useEffect(() => { hydrateStore(); setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const products = useMemo(() => listShopProducts(), [mounted, storeVersion])

  const grouped = useMemo(() => {
    const map = new Map<ShopCategory, typeof products>()
    for (const p of products) {
      const cat = p.category as ShopCategory
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({ category: c, items: map.get(c)! }))
  }, [products])

  const visibleGroups = activeCat === 'all' ? grouped : grouped.filter(g => g.category === activeCat)

  const cartTotal = useMemo(() => {
    let sum = 0
    for (const [key, qty] of Object.entries(cart)) {
      const { productId } = parseCartKey(key)
      const p = products.find(x => x.id === productId)
      if (p) sum += qty * p.unitPrice
    }
    return sum
  }, [cart, products])

  const cartItemCount = mounted ? Object.values(cart).reduce((s, q) => s + q, 0) : 0

  return (
    <ShopShell>
      {/* —— Hero —— */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{
          fontFamily: BOOKING_FONTS.display, fontSize: 27, fontWeight: 900,
          margin: '0 0 6px', color: BOOKING_COLORS.textPrimary, letterSpacing: '0.01em',
        }}>挑選你的排球裝備</h1>
        <p style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary, margin: 0, lineHeight: 1.7 }}>
          球衣球褲、球鞋球襪、護具配件一站購齊。可選到館自取（免運）或宅配寄送，下單後我們會與你聯繫確認。
        </p>
      </div>

      {/* —— 分類 chips —— */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {(['all', ...CATEGORY_ORDER.filter(c => grouped.some(g => g.category === c))] as const).map(c => {
          const active = activeCat === c
          return (
            <button key={c} onClick={() => setActiveCat(c as ShopCategory | 'all')} style={{
              padding: '7px 15px', borderRadius: BOOKING_RADIUS.pill, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, transition: 'all .15s ease',
              border: `1.5px solid ${active ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
              background: active ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.bgCard,
              color: active ? '#fff' : BOOKING_COLORS.textSecondary,
            }}>{c === 'all' ? '全部' : SHOP_CATEGORY_LABEL[c]}</button>
          )
        })}
      </div>

      {visibleGroups.map(({ category, items }) => (
        <section key={category} style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h2 style={{
              fontFamily: BOOKING_FONTS.display, fontSize: 17, fontWeight: 700,
              margin: 0, color: BOOKING_COLORS.textPrimary,
            }}>{SHOP_CATEGORY_LABEL[category]}</h2>
            <span style={{ flex: 1, height: 1, background: BOOKING_COLORS.borderLight }} />
            <span style={{ fontSize: 11, color: BOOKING_COLORS.textMuted }}>{items.length} 項</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
            gap: 14,
          }}>
            {items.map(p => (
              <ProductCard key={p.id} product={p} qty={mounted ? (cart[p.id] ?? 0) : 0} />
            ))}
          </div>
        </section>
      ))}

      {/* —— sticky 購物車列 —— */}
      {cartItemCount > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
          background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${BOOKING_COLORS.border}`,
          boxShadow: '0 -4px 20px rgba(184,100,130,0.1)',
        }}>
          <div style={{
            maxWidth: 880, margin: '0 auto', padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted }}>購物車 {cartItemCount} 件</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: BOOKING_COLORS.textPrimary }}>${cartTotal}</div>
            </div>
            <Link href="/shop/checkout" style={{
              padding: '12px 24px', borderRadius: BOOKING_RADIUS.pill,
              background: BOOKING_COLORS.pinkDeep, color: '#fff',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
              boxShadow: BOOKING_SHADOWS.cta,
            }}>前往結帳 →</Link>
          </div>
        </div>
      )}
    </ShopShell>
  )
}

// —— 商品卡 ——
function ProductCard({ product: p, qty }: { product: ReturnType<typeof listShopProducts>[number]; qty: number }) {
  const variantProduct = hasVariants(p)
  const soldOut = p.onlineStock <= 0
  const lowStock = !soldOut && p.onlineStock <= 5
  const atMax = qty >= p.onlineStock

  return (
    <div style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      border: `1px solid ${BOOKING_COLORS.border}`,
      boxShadow: BOOKING_SHADOWS.card,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      opacity: soldOut ? 0.72 : 1,
    }}>
      <Link href={`/shop/product/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ position: 'relative' }}>
          <ProductImage product={p} radius={0} style={{ width: '100%', aspectRatio: '1 / 1' }} />
          {soldOut && (
            <span style={badgeStyle(BOOKING_COLORS.warn, '#fff')}>已售完</span>
          )}
          {lowStock && (
            <span style={{ ...badgeStyle('#fff', BOOKING_COLORS.warn), border: `1px solid ${BOOKING_COLORS.warn}` }}>
              {variantProduct ? '少量現貨' : `剩 ${p.onlineStock}`}
            </span>
          )}
        </div>

        <div style={{ padding: '12px 13px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BOOKING_COLORS.textPrimary, marginBottom: 4 }}>
            {p.name}
          </div>
          <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, lineHeight: 1.5, minHeight: 32 }}>
            {p.description}
          </div>

          {/* 顏色點預覽 */}
          {p.colors.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              {p.colors.slice(0, 5).map(c => (
                <span key={c.name} title={c.name} style={{
                  width: 13, height: 13, borderRadius: '50%', background: c.hex,
                  border: `1px solid ${BOOKING_COLORS.border}`,
                }} />
              ))}
              {p.colors.length > 5 && <span style={{ fontSize: 10, color: BOOKING_COLORS.textMuted }}>+{p.colors.length - 5}</span>}
            </div>
          )}
        </div>
      </Link>

      {/* 動作列 */}
      <div style={{
        marginTop: 'auto', padding: '6px 13px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>
          {variantProduct && p.sizes.length > 0 ? '起 ' : ''}${p.unitPrice}
        </span>

        {variantProduct ? (
          <Link href={`/shop/product/${p.id}`} style={{
            padding: '7px 13px', borderRadius: BOOKING_RADIUS.pill,
            fontSize: 12, fontWeight: 700, textDecoration: 'none',
            background: soldOut ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkSoft,
            color: soldOut ? BOOKING_COLORS.textMuted : BOOKING_COLORS.pinkDeep,
            border: `1px solid ${soldOut ? BOOKING_COLORS.border : BOOKING_COLORS.pinkBorder}`,
            whiteSpace: 'nowrap',
          }}>{soldOut ? '已售完' : '選規格 →'}</Link>
        ) : qty === 0 ? (
          <button
            disabled={soldOut}
            onClick={() => addToCart(p.id, 1)}
            style={{
              padding: '7px 14px', borderRadius: BOOKING_RADIUS.pill, border: 'none',
              fontSize: 12, fontWeight: 700,
              background: soldOut ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkDeep,
              color: soldOut ? BOOKING_COLORS.textMuted : '#fff',
              cursor: soldOut ? 'not-allowed' : 'pointer',
            }}
          >加入</button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: BOOKING_COLORS.pinkSoft, borderRadius: BOOKING_RADIUS.pill, padding: 2,
          }}>
            <button onClick={() => addToCart(p.id, -1)} style={stepBtn}>−</button>
            <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 800, color: BOOKING_COLORS.textPrimary }}>{qty}</span>
            <button
              onClick={() => { if (!atMax) addToCart(p.id, 1) }}
              disabled={atMax}
              style={{ ...stepBtn, opacity: atMax ? 0.35 : 1, cursor: atMax ? 'not-allowed' : 'pointer' }}
            >＋</button>
          </div>
        )}
      </div>
    </div>
  )
}

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    position: 'absolute', top: 8, right: 8,
    background: bg, color: fg,
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
  }
}

const stepBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', border: 'none',
  background: '#fff', color: BOOKING_COLORS.pinkDeep,
  fontSize: 15, fontWeight: 800, lineHeight: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}
