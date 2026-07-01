'use client'

// ============================================================
// app/shop/checkout/page.tsx — 結帳（SC5：讀真 DB + 下單寫 DB）
// ------------------------------------------------------------
//   - 購物車 productId → loadCheckoutDataAction 解析真商品 + 取貨球館
//   - 選取貨方式 / 訂購人資訊 / 付款方式
//   - 送出 → placeOrderAction（交易內守衛式扣庫存 + 建單）→ 確認頁
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadCheckoutDataAction, placeOrderAction } from '@/app/actions/shop'
import type { StoreProduct, FulfillmentType, PaymentChannel } from '@/data/shop-types'
import { SHOP_SHIPPING_FEE } from '@/data/shop-types'
import { FULFILLMENT_LABEL, PAYMENT_CHANNEL_LABEL } from '@/types'
import ShopShell from '@/components/shop/ShopShell'
import ProductImage from '@/components/shop/ProductImage'
import { useCart, addToCart, setQty, clearCart } from '@/components/shop/cart'
import { parseCartKey, stockFor, variantLabel } from '@/components/shop/variants'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

export default function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<{ venues: { id: string; name: string }[]; products: StoreProduct[] } | null>(null)

  // 表單狀態
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup')
  const [pickupVenueId, setPickupVenueId] = useState<string>('')
  const [recipient, setRecipient] = useState('')
  const [shipPhone, setShipPhone] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<PaymentChannel>('cash_on_pickup')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 首次載入時，用當下購物車的 productId 解析商品 + 球館
  useEffect(() => {
    setMounted(true)
    const ids = [...new Set(Object.keys(cart).map((k) => parseCartKey(k).productId))]
    loadCheckoutDataAction(ids).then(setData)
    // 僅首次載入解析（送出前 re-validate 由 server 端做）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const venues = data?.venues ?? []
  const productById = useMemo(() => new Map((data?.products ?? []).map((p) => [p.id, p])), [data])

  const lines = useMemo(() => {
    return Object.entries(cart)
      .map(([key, qty]) => {
        const { productId, size, color } = parseCartKey(key)
        const p = productById.get(productId)
        return p ? { key, product: p, size, color, qty } : null
      })
      .filter((x): x is { key: string; product: StoreProduct; size: string | null; color: string | null; qty: number } => x !== null)
  }, [cart, productById])

  const itemTotal = lines.reduce((s, l) => s + l.product.unitPrice * l.qty, 0)
  const shippingFee = fulfillment === 'shipping' ? SHOP_SHIPPING_FEE : 0
  const total = itemTotal + shippingFee

  useEffect(() => { setPayment(fulfillment === 'pickup' ? 'cash_on_pickup' : 'cash_on_delivery') }, [fulfillment])

  const paymentOptions: PaymentChannel[] = fulfillment === 'pickup'
    ? ['cash_on_pickup', 'online_gateway']
    : ['cash_on_delivery', 'online_gateway']

  const handleSubmit = async () => {
    setError('')
    if (lines.length === 0) { setError('購物車是空的'); return }
    setSubmitting(true)
    const res = await placeOrderAction({
      customerName: name, customerPhone: phone, customerEmail: email || null,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty, size: l.size, color: l.color })),
      fulfillment,
      pickupVenueId: fulfillment === 'pickup' ? pickupVenueId : null,
      shipping: fulfillment === 'shipping' ? { recipient: recipient || name, phone: shipPhone || phone, address } : null,
      paymentChannel: payment,
      notes: notes || null,
    })
    if (!res.ok) { setError(res.reason); setSubmitting(false); return }
    clearCart()
    router.push(`/shop/confirmation?order=${res.orderId}`)
  }

  // 載入中
  if (!data) {
    return <ShopShell breadcrumb="結帳" hideCart><div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textMuted }}>載入中…</div></ShopShell>
  }

  // 空購物車
  if (mounted && lines.length === 0) {
    return (
      <ShopShell breadcrumb="結帳" hideCart>
        <div style={{ textAlign: 'center', padding: '60px 20px', background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>購物車是空的</div>
          <p style={{ fontSize: 13, color: BOOKING_COLORS.textMuted, marginBottom: 18 }}>先去挑幾樣裝備吧！</p>
          <Link href="/shop" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: BOOKING_RADIUS.pill, background: BOOKING_COLORS.pinkDeep, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>← 回商城逛逛</Link>
        </div>
      </ShopShell>
    )
  }

  return (
    <ShopShell breadcrumb="結帳" hideCart>
      <h1 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 22, fontWeight: 900, margin: '0 0 18px' }}>結帳</h1>

      {/* —— 購物車明細 —— */}
      <Card title="訂單明細">
        {lines.map((l) => {
          const max = stockFor(l.product, l.size, l.color)
          const spec = variantLabel(l.size, l.color)
          const colorHex = l.color ? (l.product.colors.find((c) => c.name === l.color)?.hex ?? null) : null
          return (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${BOOKING_COLORS.borderLight}` }}>
              <ProductImage product={l.product} accentHex={colorHex} radius={10} style={{ width: 46, height: 46, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{l.product.name}</div>
                {spec && <div style={{ fontSize: 11, color: BOOKING_COLORS.pinkDeep, fontWeight: 600 }}>{spec}</div>}
                <div style={{ fontSize: 12, color: BOOKING_COLORS.textMuted }}>${l.product.unitPrice} / 件</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: BOOKING_COLORS.pinkSoft, borderRadius: BOOKING_RADIUS.pill, padding: 2 }}>
                <button onClick={() => addToCart(l.key, -1)} style={stepBtn}>−</button>
                <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 800 }}>{l.qty}</span>
                <button onClick={() => { if (l.qty < max) addToCart(l.key, 1) }} disabled={l.qty >= max} style={{ ...stepBtn, opacity: l.qty >= max ? 0.35 : 1 }}>＋</button>
              </div>
              <div style={{ width: 64, textAlign: 'right', fontSize: 14, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>${l.product.unitPrice * l.qty}</div>
              <button onClick={() => setQty(l.key, 0)} style={{ background: 'none', border: 'none', color: BOOKING_COLORS.textMuted, fontSize: 16, cursor: 'pointer', padding: 2 }} title="移除">×</button>
            </div>
          )
        })}
      </Card>

      {/* —— 取貨方式 —— */}
      <Card title="取貨方式">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(['pickup', 'shipping'] as FulfillmentType[]).map((f) => (
            <button key={f} onClick={() => setFulfillment(f)} style={{
              flex: 1, padding: '12px', borderRadius: BOOKING_RADIUS.md,
              border: `1.5px solid ${fulfillment === f ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
              background: fulfillment === f ? BOOKING_COLORS.pinkSoft : '#fff',
              color: fulfillment === f ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.textSecondary,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {f === 'pickup' ? '🏟️ ' : '📦 '}{FULFILLMENT_LABEL[f]}
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{f === 'pickup' ? '免運費' : `運費 $${SHOP_SHIPPING_FEE}`}</div>
            </button>
          ))}
        </div>

        {fulfillment === 'pickup' ? (
          <Field label="取貨球館">
            <select value={pickupVenueId} onChange={(e) => setPickupVenueId(e.target.value)} style={inputStyle}>
              <option value="">請選擇取貨球館</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
        ) : (
          <>
            <Field label="收件人"><input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="留空則用下方訂購人姓名" style={inputStyle} /></Field>
            <Field label="收件電話"><input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="留空則用下方訂購人電話" style={inputStyle} /></Field>
            <Field label="收件地址"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例：新北市新莊區中正路100號5樓" style={inputStyle} /></Field>
          </>
        )}
      </Card>

      {/* —— 訂購人資訊 —— */}
      <Card title="訂購人資訊">
        <Field label="姓名 *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="您的姓名" style={inputStyle} /></Field>
        <Field label="電話 *"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx-xxx-xxx" style={inputStyle} /></Field>
        <Field label="Email（選填）"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="收訂單通知用，可不填" style={inputStyle} /></Field>
        <Field label="備註（選填）"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="例：希望週六下午取貨" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
      </Card>

      {/* —— 付款方式 —— */}
      <Card title="付款方式">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paymentOptions.map((opt) => {
            const isGateway = opt === 'online_gateway'
            return (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: BOOKING_RADIUS.md, cursor: 'pointer', border: `1.5px solid ${payment === opt ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`, background: payment === opt ? BOOKING_COLORS.pinkSoft : '#fff' }}>
                <input type="radio" name="payment" checked={payment === opt} onChange={() => setPayment(opt)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>{PAYMENT_CHANNEL_LABEL[opt]}</span>
                {isGateway && <span style={{ marginLeft: 'auto', fontSize: 10, color: BOOKING_COLORS.textMuted, background: BOOKING_COLORS.bgSecondary, padding: '2px 8px', borderRadius: 6 }}>線上刷卡 / 行動支付即將開放</span>}
              </label>
            )
          })}
        </div>
      </Card>

      {/* —— 金額 + 送出 —— */}
      <div style={{ background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card, padding: 16, marginTop: 16 }}>
        <Row label="商品小計" value={`$${itemTotal}`} />
        <Row label="運費" value={shippingFee === 0 ? '免運' : `$${shippingFee}`} />
        <div style={{ height: 1, background: BOOKING_COLORS.borderLight, margin: '10px 0' }} />
        <Row label="應付總額" value={`$${total}`} big />

        {error && <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: BOOKING_COLORS.warnBg, color: BOOKING_COLORS.warn, fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

        <button onClick={handleSubmit} disabled={submitting || !mounted} style={{
          width: '100%', marginTop: 14, padding: '14px', borderRadius: BOOKING_RADIUS.pill, border: 'none',
          background: BOOKING_COLORS.pinkDeep, color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: submitting ? 'wait' : 'pointer', boxShadow: BOOKING_SHADOWS.cta, opacity: submitting ? 0.7 : 1,
        }}>{submitting ? '送出中…' : `確認下單 ($${total})`}</button>

        <p style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, textAlign: 'center', marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
          送出後我們會與您聯繫確認，付款於{fulfillment === 'pickup' ? '取貨時' : '出貨 / 收件時'}完成。可用單號＋電話於「訂單查詢」追蹤。
        </p>
      </div>
    </ShopShell>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: BOOKING_COLORS.textPrimary, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: BOOKING_COLORS.textSecondary, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: big ? 0 : 6 }}>
      <span style={{ fontSize: big ? 14 : 13, fontWeight: big ? 800 : 500, color: big ? BOOKING_COLORS.textPrimary : BOOKING_COLORS.textSecondary }}>{label}</span>
      <span style={{ fontSize: big ? 22 : 13, fontWeight: 800, color: big ? BOOKING_COLORS.pinkVividDeep : BOOKING_COLORS.textPrimary }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BOOKING_COLORS.border}`,
  fontSize: 14, outline: 'none', background: '#fff', color: BOOKING_COLORS.textPrimary,
}
const stepBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#fff', color: BOOKING_COLORS.pinkDeep,
  fontSize: 15, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
