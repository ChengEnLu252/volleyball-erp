'use client'

// ============================================================
// app/shop/product/[id]/page.tsx — 商品詳情頁（SC4：讀真 DB + 多圖）
// ------------------------------------------------------------
// Cyberbiz 風：多圖 gallery（主圖 + 縮圖）+ 規格選擇（尺寸 pills / 顏色 swatch）
// + 原價劃線/特價 → 看該規格庫存 → 加入購物車。無規格商品也走這頁。
// 資料：client 自取 loadShopProductAction（真 DB）。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { loadShopProductAction } from '@/app/actions/shop'
import type { StoreProduct } from '@/data/shop-types'
import ShopShell from '@/components/shop/ShopShell'
import ProductImage from '@/components/shop/ProductImage'
import { useCart, addToCart } from '@/components/shop/cart'
import { cartKey, findVariant, hasVariants, stockFor } from '@/components/shop/variants'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const cart = useCart()
  // undefined = 載入中；null = 找不到；StoreProduct = 已載入
  const [product, setProduct] = useState<StoreProduct | null | undefined>(undefined)

  const [imgIdx, setImgIdx] = useState(0)
  const [size, setSize] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let alive = true
    setProduct(undefined)
    loadShopProductAction(id).then((p) => { if (alive) setProduct(p) })
    return () => { alive = false }
  }, [id])

  const p = product && typeof product === 'object' ? product : null
  const needSize = (p?.sizes.length ?? 0) > 0
  const needColor = (p?.colors.length ?? 0) > 0
  const colorHex = p && color ? (p.colors.find((c) => c.name === color)?.hex ?? null) : null

  const sizeStock = (s: string) => !p ? 0 : needColor
    ? (color ? (findVariant(p, s, color)?.stock ?? 0) : Math.max(0, ...p.colors.map((c) => findVariant(p, s, c.name)?.stock ?? 0)))
    : (findVariant(p, s, null)?.stock ?? 0)
  const colorStock = (cName: string) => !p ? 0 : needSize
    ? (size ? (findVariant(p, size, cName)?.stock ?? 0) : Math.max(0, ...p.sizes.map((s) => findVariant(p, s, cName)?.stock ?? 0)))
    : (findVariant(p, null, cName)?.stock ?? 0)

  const variantProduct = p ? hasVariants(p) : false
  const selectionComplete = (!needSize || size !== null) && (!needColor || color !== null)
  const available = !p ? 0 : variantProduct
    ? (selectionComplete ? stockFor(p, needSize ? size : null, needColor ? color : null) : -1)
    : p.onlineStock
  const canAdd = !!p && (variantProduct ? selectionComplete && available > 0 : available > 0) && qty >= 1 && qty <= (available < 0 ? 0 : available)
  const inCart = p ? (cart[cartKey(p.id, needSize ? size : null, needColor ? color : null)] ?? 0) : 0
  const onSale = !!p?.compareAtPrice && p.compareAtPrice > p.unitPrice

  const gallery = useMemo(() => p?.images ?? [], [p])

  const doAdd = () => {
    if (!p || !canAdd) return
    addToCart(cartKey(p.id, needSize ? size : null, needColor ? color : null), qty)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2200)
  }

  if (product === undefined) {
    return <ShopShell breadcrumb="商品"><div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textMuted }}>載入中…</div></ShopShell>
  }
  if (!p) {
    return (
      <ShopShell breadcrumb="商品">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: BOOKING_COLORS.textSecondary }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>找不到這項商品
          <div style={{ marginTop: 18 }}><Link href="/shop" style={backBtn}>← 回商城</Link></div>
        </div>
      </ShopShell>
    )
  }

  return (
    <ShopShell breadcrumb={p.name}>
      <Link href="/shop" style={{ ...backBtn, marginBottom: 16 }}>← 繼續購物</Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* —— 多圖 gallery —— */}
        <div>
          {gallery.length > 0 ? (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: BOOKING_RADIUS.card, overflow: 'hidden', border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card, background: '#fff' }}>
              <img src={gallery[Math.min(imgIdx, gallery.length - 1)]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {onSale && <span style={{ position: 'absolute', top: 12, left: 12, background: BOOKING_COLORS.pinkDeep, color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>特價</span>}
            </div>
          ) : (
            <ProductImage product={p} accentHex={colorHex} radius={BOOKING_RADIUS.card} style={{ width: '100%', aspectRatio: '1 / 1', border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card }} />
          )}
          {gallery.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {gallery.slice(0, 8).map((src, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{
                  width: 56, height: 56, borderRadius: BOOKING_RADIUS.sm, overflow: 'hidden', cursor: 'pointer', padding: 0,
                  border: `2px solid ${i === imgIdx ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`, background: '#fff',
                }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* —— 資訊 + 規格 —— */}
        <div>
          {p.categories[0] && <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, marginBottom: 6 }}>{p.categories[0].name}</div>}
          <h1 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 24, fontWeight: 900, margin: '0 0 8px', color: BOOKING_COLORS.textPrimary }}>{p.name}</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>${p.unitPrice}</div>
            {onSale && <div style={{ fontSize: 15, color: BOOKING_COLORS.textMuted, textDecoration: 'line-through' }}>${p.compareAtPrice}</div>}
          </div>
          {p.description && <p style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary, lineHeight: 1.8, margin: '0 0 20px', whiteSpace: 'pre-line' }}>{p.description}</p>}

          {needColor && (
            <div style={{ marginBottom: 18 }}>
              <Label>顏色{color ? `：${color}` : ''}</Label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {p.colors.map((c) => {
                  const out = colorStock(c.name) <= 0
                  const sel = color === c.name
                  return (
                    <button key={c.name} title={c.name} disabled={out} onClick={() => { setColor(c.name); setQty(1) }} style={{
                      width: 34, height: 34, borderRadius: '50%', cursor: out ? 'not-allowed' : 'pointer', background: c.hex, position: 'relative',
                      border: `2px solid ${sel ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
                      boxShadow: sel ? `0 0 0 3px ${BOOKING_COLORS.pinkSoft}` : 'none', opacity: out ? 0.4 : 1,
                    }}>
                      {out && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: BOOKING_COLORS.textMuted }}>✕</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {needSize && (
            <div style={{ marginBottom: 18 }}>
              <Label>尺寸{size ? `：${size}` : ''}</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.sizes.map((s) => {
                  const out = sizeStock(s) <= 0
                  const sel = size === s
                  return (
                    <button key={s} disabled={out} onClick={() => { setSize(s); setQty(1) }} style={{
                      minWidth: 48, padding: '9px 12px', borderRadius: BOOKING_RADIUS.sm, cursor: out ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
                      border: `1.5px solid ${sel ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
                      background: sel ? BOOKING_COLORS.pinkSoft : '#fff',
                      color: out ? BOOKING_COLORS.textMuted : (sel ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.textSecondary),
                      textDecoration: out ? 'line-through' : 'none',
                    }}>{s}</button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: BOOKING_COLORS.textMuted, marginBottom: 14, minHeight: 18 }}>
            {variantProduct && !selectionComplete
              ? '請選擇' + [needColor && !color ? '顏色' : '', needSize && !size ? '尺寸' : ''].filter(Boolean).join(' / ')
              : available <= 0 ? <span style={{ color: BOOKING_COLORS.warn, fontWeight: 700 }}>此規格已售完</span>
              : available <= 5 ? <span style={{ color: BOOKING_COLORS.warn, fontWeight: 700 }}>僅剩 {available} 件</span>
              : `庫存 ${available} 件`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BOOKING_COLORS.pinkSoft, borderRadius: BOOKING_RADIUS.pill, padding: 3 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={stepBtn}>−</button>
              <span style={{ minWidth: 30, textAlign: 'center', fontSize: 15, fontWeight: 800, color: BOOKING_COLORS.textPrimary }}>{qty}</span>
              <button onClick={() => setQty((q) => (available > 0 ? Math.min(available, q + 1) : q))} disabled={available <= 0 || qty >= available} style={{ ...stepBtn, opacity: (available <= 0 || qty >= available) ? 0.35 : 1 }}>＋</button>
            </div>
            <button onClick={doAdd} disabled={!canAdd} style={{
              flex: 1, padding: '13px 18px', borderRadius: BOOKING_RADIUS.pill, border: 'none', fontSize: 14, fontWeight: 800,
              background: canAdd ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.bgSecondary, color: canAdd ? '#fff' : BOOKING_COLORS.textMuted,
              cursor: canAdd ? 'pointer' : 'not-allowed', boxShadow: canAdd ? BOOKING_SHADOWS.cta : 'none',
            }}>加入購物車</button>
          </div>

          {added && (
            <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: BOOKING_RADIUS.md, background: BOOKING_COLORS.okBg, color: BOOKING_COLORS.ok, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span>✓ 已加入購物車{inCart > 0 ? `（此規格 ${inCart} 件）` : ''}</span>
              <Link href="/shop/checkout" style={{ color: BOOKING_COLORS.pinkDeep, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>前往結帳 →</Link>
            </div>
          )}
        </div>
      </div>
    </ShopShell>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: BOOKING_COLORS.textPrimary, marginBottom: 9 }}>{children}</div>
}

const backBtn: React.CSSProperties = { display: 'inline-block', fontSize: 13, fontWeight: 700, color: BOOKING_COLORS.textSecondary, textDecoration: 'none' }
const stepBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#fff', color: BOOKING_COLORS.pinkDeep, fontSize: 17, fontWeight: 800, lineHeight: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
