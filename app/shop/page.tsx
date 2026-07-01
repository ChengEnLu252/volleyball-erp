'use client'

// ============================================================
// app/shop/page.tsx — 線上商城首頁（SC4：Cyberbiz 風 + 讀真 DB）
// ------------------------------------------------------------
// 版面照對方 lineaone.cyberbiz.co：Hero → 分類導覽 → 商品格狀。
// 商品卡：真實照片 + 原價劃線/特價徽章 + 售罄/少量。保留我們的粉紅元素。
// 資料：client 自取 loadStorefrontAction（讀真 DB 上架商品）。
// 購物車：沿用 localStorage useCart（前台即時同步）。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { loadStorefrontAction } from '@/app/actions/shop'
import type { StoreProduct, StoreCategory } from '@/data/shop-types'
import ShopShell from '@/components/shop/ShopShell'
import ProductImage from '@/components/shop/ProductImage'
import { useCart, addToCart } from '@/components/shop/cart'
import { hasVariants, parseCartKey } from '@/components/shop/variants'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

export default function ShopHome() {
  const cart = useCart()
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<{ categories: StoreCategory[]; products: StoreProduct[] } | null>(null)
  const [activeCat, setActiveCat] = useState<string>('all') // 'all' | category.id

  useEffect(() => {
    setMounted(true)
    loadStorefrontAction().then(setData)
  }, [])

  const products = data?.products ?? []
  const categories = data?.categories ?? []

  // 依分類分組（一個商品可屬多類 → 多個區塊都出現）
  const sections = useMemo(() => {
    return categories
      .map((c) => ({ category: c, items: products.filter((p) => p.categories.some((pc) => pc.id === c.id)) }))
      .filter((s) => s.items.length > 0)
  }, [categories, products])

  const visible = activeCat === 'all' ? sections : sections.filter((s) => s.category.id === activeCat)

  const cartTotal = useMemo(() => {
    let sum = 0
    for (const [key, qty] of Object.entries(cart)) {
      const { productId } = parseCartKey(key)
      const p = products.find((x) => x.id === productId)
      if (p) sum += qty * p.unitPrice
    }
    return sum
  }, [cart, products])
  const cartItemCount = mounted ? Object.values(cart).reduce((s, q) => s + q, 0) : 0

  return (
    <ShopShell>
      {/* —— Hero —— */}
      <div style={{
        margin: '0 0 18px', padding: '28px 24px', borderRadius: BOOKING_RADIUS.card,
        background: `linear-gradient(135deg, ${BOOKING_COLORS.pinkSoft} 0%, #fff 55%, ${BOOKING_COLORS.pinkSoft} 100%)`,
        border: `1px solid ${BOOKING_COLORS.pinkBorder}`, position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{ position: 'absolute', right: -18, top: -18, fontSize: 96, opacity: 0.16 }}>🏐</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: BOOKING_COLORS.pinkDeep, letterSpacing: '0.08em', marginBottom: 6 }}>一線本舖 · 排球選物</div>
        <h1 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 26, fontWeight: 900, margin: '0 0 6px', color: BOOKING_COLORS.textPrimary }}>
          球場上的一切，這裡都有
        </h1>
        <p style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary, margin: 0, lineHeight: 1.7 }}>
          排球 · 籃球 · 匹克球 · 聯名服飾 · 配件器材。到館自取免運，宅配全台配送。
        </p>
      </div>

      {/* —— 分類導覽 —— */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {[{ id: 'all', name: '全部' } as { id: string; name: string }, ...categories].map((c) => {
          const active = activeCat === c.id
          return (
            <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
              padding: '8px 16px', borderRadius: BOOKING_RADIUS.pill, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, transition: 'all .15s ease', whiteSpace: 'nowrap',
              border: `1.5px solid ${active ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
              background: active ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.bgCard,
              color: active ? '#fff' : BOOKING_COLORS.textSecondary,
            }}>{c.name}</button>
          )
        })}
      </div>

      {/* —— 載入中 —— */}
      {!data && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 14,
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              background: BOOKING_COLORS.bgSecondary, borderRadius: BOOKING_RADIUS.card,
              aspectRatio: '3 / 4', animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.55}50%{opacity:.85}}`}</style>
        </div>
      )}

      {data && sections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: BOOKING_COLORS.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛍️</div>目前尚無上架商品
        </div>
      )}

      {/* —— 分類區塊 + 商品格狀 —— */}
      {visible.map(({ category, items }) => (
        <section key={category.id} style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h2 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 17, fontWeight: 800, margin: 0, color: BOOKING_COLORS.textPrimary }}>{category.name}</h2>
            <span style={{ flex: 1, height: 1, background: BOOKING_COLORS.borderLight }} />
            <span style={{ fontSize: 11, color: BOOKING_COLORS.textMuted }}>{items.length} 項</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 14 }}>
            {items.map((p) => <ProductCard key={p.id} product={p} qty={mounted ? (cart[p.id] ?? 0) : 0} />)}
          </div>
        </section>
      ))}

      {/* —— sticky 購物車列 —— */}
      {cartItemCount > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
          background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${BOOKING_COLORS.border}`, boxShadow: '0 -4px 20px rgba(184,100,130,0.1)',
        }}>
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted }}>購物車 {cartItemCount} 件</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: BOOKING_COLORS.textPrimary }}>${cartTotal}</div>
            </div>
            <Link href="/shop/checkout" style={{
              padding: '12px 24px', borderRadius: BOOKING_RADIUS.pill, background: BOOKING_COLORS.pinkDeep,
              color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', boxShadow: BOOKING_SHADOWS.cta,
            }}>前往結帳 →</Link>
          </div>
        </div>
      )}
    </ShopShell>
  )
}

// —— 商品卡（Cyberbiz 風：真圖 + 原價劃線/特價徽章）——
function ProductCard({ product: p, qty }: { product: StoreProduct; qty: number }) {
  const variantProduct = hasVariants(p)
  const soldOut = p.onlineStock <= 0
  const lowStock = !soldOut && p.onlineStock <= 5
  const atMax = qty >= p.onlineStock
  const onSale = !!p.compareAtPrice && p.compareAtPrice > p.unitPrice
  const off = onSale ? Math.round((1 - p.unitPrice / (p.compareAtPrice as number)) * 100) : 0

  return (
    <div style={{
      background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card,
      border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: soldOut ? 0.72 : 1,
    }}>
      <Link href={`/shop/product/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ position: 'relative' }}>
          <ProductImage product={p} radius={0} style={{ width: '100%', aspectRatio: '1 / 1' }} />
          {onSale && !soldOut && <span style={badgeStyle(BOOKING_COLORS.pinkDeep, '#fff')}>-{off}%</span>}
          {soldOut && <span style={badgeStyle(BOOKING_COLORS.warn, '#fff')}>已售完</span>}
          {lowStock && !onSale && (
            <span style={{ ...badgeStyle('#fff', BOOKING_COLORS.warn), border: `1px solid ${BOOKING_COLORS.warn}` }}>
              {variantProduct ? '少量現貨' : `剩 ${p.onlineStock}`}
            </span>
          )}
        </div>
        <div style={{ padding: '12px 13px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BOOKING_COLORS.textPrimary, marginBottom: 4, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>
            {p.name}
          </div>
          {p.colors.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              {p.colors.slice(0, 5).map((c) => (
                <span key={c.name} title={c.name} style={{ width: 13, height: 13, borderRadius: '50%', background: c.hex, border: `1px solid ${BOOKING_COLORS.border}` }} />
              ))}
              {p.colors.length > 5 && <span style={{ fontSize: 10, color: BOOKING_COLORS.textMuted }}>+{p.colors.length - 5}</span>}
            </div>
          )}
        </div>
      </Link>

      <div style={{ marginTop: 'auto', padding: '6px 13px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>
            {variantProduct && p.sizes.length > 0 ? '起 ' : ''}${p.unitPrice}
          </span>
          {onSale && <span style={{ fontSize: 12, color: BOOKING_COLORS.textMuted, textDecoration: 'line-through' }}>${p.compareAtPrice}</span>}
        </span>

        {variantProduct ? (
          <Link href={`/shop/product/${p.id}`} style={{
            padding: '7px 13px', borderRadius: BOOKING_RADIUS.pill, fontSize: 12, fontWeight: 700, textDecoration: 'none',
            background: soldOut ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkSoft,
            color: soldOut ? BOOKING_COLORS.textMuted : BOOKING_COLORS.pinkDeep,
            border: `1px solid ${soldOut ? BOOKING_COLORS.border : BOOKING_COLORS.pinkBorder}`, whiteSpace: 'nowrap',
          }}>{soldOut ? '已售完' : '選規格 →'}</Link>
        ) : qty === 0 ? (
          <button disabled={soldOut} onClick={() => addToCart(p.id, 1)} style={{
            padding: '7px 14px', borderRadius: BOOKING_RADIUS.pill, border: 'none', fontSize: 12, fontWeight: 700,
            background: soldOut ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkDeep,
            color: soldOut ? BOOKING_COLORS.textMuted : '#fff', cursor: soldOut ? 'not-allowed' : 'pointer',
          }}>加入</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BOOKING_COLORS.pinkSoft, borderRadius: BOOKING_RADIUS.pill, padding: 2 }}>
            <button onClick={() => addToCart(p.id, -1)} style={stepBtn}>−</button>
            <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 800, color: BOOKING_COLORS.textPrimary }}>{qty}</span>
            <button onClick={() => { if (!atMax) addToCart(p.id, 1) }} disabled={atMax} style={{ ...stepBtn, opacity: atMax ? 0.35 : 1, cursor: atMax ? 'not-allowed' : 'pointer' }}>＋</button>
          </div>
        )}
      </div>
    </div>
  )
}

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return { position: 'absolute', top: 8, right: 8, background: bg, color: fg, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }
}

const stepBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#fff', color: BOOKING_COLORS.pinkDeep,
  fontSize: 15, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
