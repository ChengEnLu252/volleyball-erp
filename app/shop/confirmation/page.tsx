'use client'

// ============================================================
// app/shop/confirmation/page.tsx — 訂單成立
// ============================================================
// 階段 17 新增。QS: order=<orderId>
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getOrder, getVenue } from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import { ORDER_STATUS_LABEL, FULFILLMENT_LABEL, PAYMENT_CHANNEL_LABEL } from '@/types'
import ShopShell from '@/components/shop/ShopShell'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS, BOOKING_SHADOWS } from '@/components/booking/theme'

function ConfirmationContent() {
  const params = useSearchParams()
  const orderId = params.get('order') ?? ''
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { hydrateStore(); setMounted(true) }, [])

  // 依賴 storeVersion + mounted 確保 hydrate 後重抓
  void storeVersion
  const order = mounted ? getOrder(orderId) : null

  if (mounted && !order) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: BOOKING_COLORS.textSecondary }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🤔</div>
        找不到這筆訂單
        <div style={{ marginTop: 18 }}>
          <Link href="/shop" style={backBtnStyle}>← 回商城</Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return <div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textMuted }}>載入中…</div>
  }

  const venue = order.pickupVenueId ? getVenue(order.pickupVenueId) : null

  return (
    <>
      {/* 成功標頭 */}
      <div style={{ textAlign: 'center', padding: '20px 0 26px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
          background: BOOKING_COLORS.okBg, color: BOOKING_COLORS.ok,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>✓</div>
        <h1 style={{ fontFamily: BOOKING_FONTS.display, fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>訂單已成立！</h1>
        <p style={{ fontSize: 13, color: BOOKING_COLORS.textSecondary, margin: 0 }}>
          單號 <strong style={{ color: BOOKING_COLORS.pinkVividDeep }}>{order.orderNo}</strong>
          ｜我們會盡快與您聯繫確認
        </p>
      </div>

      {/* 訂單卡 */}
      <div style={{
        background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.card,
        border: `1px solid ${BOOKING_COLORS.border}`, boxShadow: BOOKING_SHADOWS.card,
        padding: 18, marginBottom: 14,
      }}>
        <SummaryRow label="訂單狀態" value={ORDER_STATUS_LABEL[order.status]} />
        <SummaryRow label="取貨方式" value={FULFILLMENT_LABEL[order.fulfillment] + (venue ? `（${venue.name}）` : '')} />
        {order.shipping && (
          <SummaryRow label="收件" value={`${order.shipping.recipient}・${order.shipping.address}`} />
        )}
        <SummaryRow label="付款方式" value={PAYMENT_CHANNEL_LABEL[order.paymentChannel]} />
        <SummaryRow label="訂購人" value={`${order.customerName}・${order.customerPhone}`} />
        {order.notes && <SummaryRow label="備註" value={order.notes} />}

        <div style={{ height: 1, background: BOOKING_COLORS.borderLight, margin: '12px 0' }} />

        {order.items.map((it, idx) => {
          const spec = [it.size, it.color].filter(Boolean).join('・')
          return (
            <div key={`${it.productId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: BOOKING_COLORS.textSecondary }}>
                {it.name}{spec ? `（${spec}）` : ''} × {it.quantity}
              </span>
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

      <div style={{ textAlign: 'center' }}>
        <Link href="/shop" style={backBtnStyle}>← 繼續購物</Link>
      </div>
    </>
  )
}

export default function ConfirmationPage() {
  return (
    <ShopShell breadcrumb="訂單成立" hideCart>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textMuted }}>載入中…</div>}>
        <ConfirmationContent />
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

const backBtnStyle: React.CSSProperties = {
  display: 'inline-block', padding: '10px 22px', borderRadius: 999,
  background: '#fff', color: BOOKING_COLORS.textSecondary, fontSize: 13, fontWeight: 700,
  textDecoration: 'none', border: `1px solid ${BOOKING_COLORS.border}`,
}
