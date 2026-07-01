'use client'

// ============================================================
// app/shop/orders/page.tsx — 訂單查詢（SC5：會員 lite）
// ------------------------------------------------------------
// 訪客用「單號 + 電話」雙重比對查詢訂單狀態 / 明細（Cyberbiz 風）。
// 無需登入。?no=<orderNo> 可預填單號（下單確認頁帶過來）。
// ============================================================

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { lookupOrderAction } from '@/app/actions/shop'
import type { OrderView } from '@/data/shop-types'
import { ORDER_STATUS_LABEL, FULFILLMENT_LABEL, PAYMENT_CHANNEL_LABEL } from '@/types'
import ShopShell from '@/components/shop/ShopShell'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

const STATUS_COLOR: Record<OrderView['status'], { bg: string; fg: string }> = {
  pending: { bg: BOOKING_COLORS.warnBg, fg: BOOKING_COLORS.warn },
  paid: { bg: BOOKING_COLORS.pinkSoft, fg: BOOKING_COLORS.pinkDeep },
  fulfilled: { bg: BOOKING_COLORS.okBg, fg: BOOKING_COLORS.ok },
  cancelled: { bg: BOOKING_COLORS.bgSecondary, fg: BOOKING_COLORS.textMuted },
}

function OrdersContent() {
  const params = useSearchParams()
  const [orderNo, setOrderNo] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const no = params.get('no')
    if (no) setOrderNo(no)
  }, [params])

  const doSearch = async () => {
    if (!orderNo.trim() || !phone.trim()) return
    setLoading(true); setSearched(true)
    const o = await lookupOrderAction({ orderNo: orderNo.trim(), phone: phone.trim() })
    setOrder(o); setLoading(false)
  }

  return (
    <>
      <h1 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>訂單查詢</h1>
      <p style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary, margin: '0 0 18px', lineHeight: 1.7 }}>輸入下單時的「單號」與「電話」即可查看訂單狀態與明細。</p>

      <div style={{ background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card, padding: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>訂單單號</label>
          <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="SH-20260701-1234" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>訂購電話</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx-xxx-xxx" style={inputStyle}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
        </div>
        <button onClick={doSearch} disabled={loading || !orderNo.trim() || !phone.trim()} style={{
          width: '100%', padding: '13px', borderRadius: BOOKING_RADIUS.pill, border: 'none',
          background: (!orderNo.trim() || !phone.trim()) ? BOOKING_COLORS.bgSecondary : BOOKING_COLORS.pinkDeep,
          color: (!orderNo.trim() || !phone.trim()) ? BOOKING_COLORS.textMuted : '#fff',
          fontSize: 14, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', boxShadow: BOOKING_SHADOWS.cta,
        }}>{loading ? '查詢中…' : '查詢訂單'}</button>
      </div>

      {searched && !loading && !order && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: BOOKING_COLORS.textSecondary, background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}` }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔍</div>查無此訂單，請確認單號與電話是否正確
        </div>
      )}

      {order && (
        <div style={{ background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card, border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted }}>單號</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>{order.orderNo}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: STATUS_COLOR[order.status].bg, color: STATUS_COLOR[order.status].fg }}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          <SummaryRow label="下單時間" value={new Date(order.createdAt).toLocaleString('zh-TW', { hour12: false })} />
          <SummaryRow label="取貨方式" value={FULFILLMENT_LABEL[order.fulfillment] + (order.pickupVenueName ? `（${order.pickupVenueName}）` : '')} />
          {order.shipping && <SummaryRow label="收件" value={`${order.shipping.recipient}・${order.shipping.address}`} />}
          <SummaryRow label="付款方式" value={PAYMENT_CHANNEL_LABEL[order.paymentChannel]} />
          <SummaryRow label="訂購人" value={`${order.customerName}・${order.customerPhone}`} />

          <div style={{ height: 1, background: BOOKING_COLORS.borderLight, margin: '12px 0' }} />
          {order.items.map((it, idx) => {
            const spec = [it.size, it.color].filter(Boolean).join('・')
            return (
              <div key={`${it.productId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: BOOKING_COLORS.textSecondary }}>{it.name}{spec ? `（${spec}）` : ''} × {it.quantity}</span>
                <span style={{ fontWeight: 700 }}>${it.subtotal}</span>
              </div>
            )
          })}
          <div style={{ height: 1, background: BOOKING_COLORS.borderLight, margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: BOOKING_COLORS.textMuted, marginBottom: 4 }}>
            <span>運費</span><span>{order.shippingFee === 0 ? '免運' : `$${order.shippingFee}`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>應付總額</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: BOOKING_COLORS.pinkVividDeep }}>${order.total}</span>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <Link href="/shop" style={{ fontSize: 13, fontWeight: 700, color: BOOKING_COLORS.textSecondary, textDecoration: 'none' }}>← 回商城</Link>
      </div>
    </>
  )
}

export default function OrdersLookupPage() {
  return (
    <ShopShell breadcrumb="訂單查詢" hideCart>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textMuted }}>載入中…</div>}>
        <OrdersContent />
      </Suspense>
    </ShopShell>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 8 }}>
      <span style={{ color: BOOKING_COLORS.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: BOOKING_COLORS.textPrimary, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: BOOKING_COLORS.textSecondary, marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BOOKING_COLORS.border}`,
  fontSize: 14, outline: 'none', background: '#fff', color: BOOKING_COLORS.textPrimary,
}
