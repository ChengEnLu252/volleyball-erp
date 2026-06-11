'use client'

// ============================================================
// /orders — 商城訂單管理（階段 17）
// ============================================================
// owner   → 看全部訂單；manager → 看自己館「到館自取」訂單；staff 被 LayoutGuard 擋。
// 功能：
//   - 訂單列表（依狀態篩選 + 狀態統計）
//   - 標記已付款 / 標記完成 / 取消（回補庫存）
//   - 代客下單（channel='backend'）
//   - 線上商城庫存管理（調庫存 / 上下架）
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import {
  listOrders, getOrderStatusCounts,
  markOrderPaid, fulfillOrder, cancelOrder, createOrder,
  listShopProducts, adjustShopStock, adjustShopVariantStock, toggleShopListing,
  getCurrentEffectiveRole, getVenue, listVenues, listAllUsers,
  getShopShippingFee,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import {
  ORDER_STATUS_LABEL, ORDER_CHANNEL_LABEL, FULFILLMENT_LABEL, PAYMENT_CHANNEL_LABEL,
  SHOP_CATEGORY_LABEL,
  type Order, type OrderStatus, type FulfillmentType, type PaymentChannel, type ShopProduct,
} from '@/types'
import { cartKey, parseCartKey, hasVariants, stockFor, variantLabel } from '@/components/shop/variants'
import { COLORS, FONTS } from '@/components/theme/tokens'

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  pending:   { bg: COLORS.warnBg,    fg: COLORS.amberDeep },
  paid:      { bg: '#dbeafe',        fg: '#1e40af' },
  fulfilled: { bg: COLORS.successBg, fg: COLORS.success },
  cancelled: { bg: COLORS.surfaceTint, fg: COLORS.ink300 },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function OrdersPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { hydrateStore(); setMounted(true) }, [])

  const [tab, setTab] = useState<'orders' | 'inventory'>('orders')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const role = useMemo(() => (mounted ? getCurrentEffectiveRole() : 'owner'), [mounted, storeVersion])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orders = useMemo(() => (mounted ? listOrders() : []), [mounted, storeVersion])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const counts = useMemo(() => (mounted ? getOrderStatusCounts() : { pending: 0, paid: 0, fulfilled: 0, cancelled: 0 }), [mounted, storeVersion])
  const users = useMemo(() => listAllUsers(), [])

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)

  const userName = (id: string | null) => id ? (users.find(u => u.id === id)?.name ?? id) : null

  const doCancel = (o: Order) => {
    const reason = window.prompt(`取消訂單 ${o.orderNo}？\n請輸入取消理由（會回補庫存）：`, '')
    if (reason === null) return
    const res = cancelOrder(o.id, reason)
    if (!res.ok) window.alert(res.reason)
  }

  return (
    <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}>
      <style>{`@media(max-width:768px){.ord-wrap{padding-top:64px !important}}`}</style>
      <div className="ord-wrap">

        {/* —— Header —— */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>商城訂單</h1>
            <p style={{ fontSize: 13, color: COLORS.ink500, margin: '4px 0 0' }}>
              {role === 'owner' ? '全部球館的線上 / 代客訂單' : '您球館的到館自取訂單'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/shop" target="_blank" style={{
              padding: '9px 14px', borderRadius: 9, background: '#fff', border: `1px solid ${COLORS.border}`,
              color: COLORS.ink700, textDecoration: 'none', fontSize: 13, fontWeight: 700,
            }}>🛍️ 開啟商城 ↗</a>
            <button onClick={() => setComposeOpen(true)} style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(255,45,138,0.5)',
            }}>＋ 代客下單</button>
          </div>
        </div>

        {/* —— Tabs —— */}
        <div style={{ display: 'flex', gap: 4, background: COLORS.surfaceTint, borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
          {([['orders', '訂單列表'], ['inventory', '商城庫存']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? COLORS.ink900 : COLORS.ink500,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'orders' ? (
          <>
            {/* 狀態篩選 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {([['all', '全部', orders.length],
                 ['pending', ORDER_STATUS_LABEL.pending, counts.pending],
                 ['paid', ORDER_STATUS_LABEL.paid, counts.paid],
                 ['fulfilled', ORDER_STATUS_LABEL.fulfilled, counts.fulfilled],
                 ['cancelled', ORDER_STATUS_LABEL.cancelled, counts.cancelled]] as const).map(([s, label, n]) => (
                <button key={s} onClick={() => setStatusFilter(s as OrderStatus | 'all')} style={{
                  padding: '6px 13px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: statusFilter === s ? COLORS.ink900 : '#fff',
                  color: statusFilter === s ? '#fff' : COLORS.ink700,
                  borderColor: statusFilter === s ? COLORS.ink900 : COLORS.border,
                }}>{label} <span style={{ opacity: 0.7 }}>{n}</span></button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Empty text={mounted ? '目前沒有符合的訂單' : '載入中…'} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(o => {
                  const venue = o.pickupVenueId ? getVenue(o.pickupVenueId) : null
                  const isOpen = expanded === o.id
                  return (
                    <div key={o.id} style={{
                      background: COLORS.surface, borderRadius: 14,
                      border: `1px solid ${COLORS.border}`, overflow: 'hidden',
                    }}>
                      {/* 摘要列 */}
                      <button onClick={() => setExpanded(isOpen ? null : o.id)} style={{
                        width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: COLORS.pink700 }}>{o.orderNo}</span>
                        <Badge bg={STATUS_STYLE[o.status].bg} fg={STATUS_STYLE[o.status].fg}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        <span style={{ fontSize: 11, color: COLORS.ink300, background: COLORS.surfaceTint, padding: '2px 8px', borderRadius: 6 }}>
                          {ORDER_CHANNEL_LABEL[o.channel]}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customerName}</span>
                        <span style={{ fontSize: 12, color: COLORS.ink500 }}>
                          {FULFILLMENT_LABEL[o.fulfillment]}{venue ? `・${venue.name}` : ''}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: COLORS.pink600 }}>${o.total}</span>
                        <span style={{ fontSize: 11, color: COLORS.ink300 }}>{fmt(o.createdAt)}</span>
                        <span style={{ fontSize: 12, color: COLORS.ink300 }}>{isOpen ? '▲' : '▼'}</span>
                      </button>

                      {/* 展開明細 */}
                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${COLORS.borderLight}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, margin: '12px 0' }}>
                            <Info label="聯絡電話" value={o.customerPhone} />
                            {o.customerEmail && <Info label="Email" value={o.customerEmail} />}
                            <Info label="付款方式" value={PAYMENT_CHANNEL_LABEL[o.paymentChannel]} />
                            {o.placedByUserId && <Info label="代客操作員" value={userName(o.placedByUserId) ?? '—'} />}
                            {o.shipping && <Info label="收件地址" value={`${o.shipping.recipient}・${o.shipping.address}`} />}
                            {o.notes && <Info label="備註" value={o.notes} />}
                            {o.paidAt && <Info label="付款時間" value={fmt(o.paidAt)} />}
                            {o.fulfilledAt && <Info label="完成時間" value={fmt(o.fulfilledAt)} />}
                            {o.cancelReason && <Info label="取消理由" value={o.cancelReason} />}
                          </div>

                          {/* 明細 */}
                          <div style={{ background: COLORS.surfaceTint, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                            {o.items.map((it, idx) => {
                              const spec = variantLabel(it.size, it.color)
                              return (
                                <div key={`${it.productId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                                  <span style={{ color: COLORS.ink700 }}>{it.name}{spec ? `（${spec}）` : ''} × {it.quantity}</span>
                                  <span style={{ fontWeight: 700 }}>${it.subtotal}</span>
                                </div>
                              )
                            })}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLORS.ink500, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${COLORS.border}` }}>
                              <span>運費</span><span>{o.shippingFee === 0 ? '免運' : `$${o.shippingFee}`}</span>
                            </div>
                          </div>

                          {/* 動作 */}
                          {o.status !== 'cancelled' && o.status !== 'fulfilled' && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {o.status === 'pending' && (
                                <ActBtn onClick={() => { const r = markOrderPaid(o.id); if (!r.ok) window.alert(r.reason) }} color="#1e40af" bg="#dbeafe">標記已付款</ActBtn>
                              )}
                              <ActBtn onClick={() => { const r = fulfillOrder(o.id); if (!r.ok) window.alert(r.reason) }} color={COLORS.success} bg={COLORS.successBg}>
                                ✓ 標記完成（{o.fulfillment === 'pickup' ? '已取貨' : '已出貨'}）
                              </ActBtn>
                              <ActBtn onClick={() => doCancel(o)} color={COLORS.danger} bg={COLORS.dangerBg}>取消訂單</ActBtn>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <InventoryTab />
        )}
      </div>

      {composeOpen && <ComposeOrderModal onClose={() => setComposeOpen(false)} />}
    </div>
  )
}

// ============================================================
// 商城庫存管理
// ============================================================
function InventoryTab() {
  const storeVersion = useStoreSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const products = useMemo(() => listShopProducts({ includeUnlisted: true }), [storeVersion])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // 無規格商品：直接調 onlineStock
  const saveSimple = (id: string, current: number) => {
    const raw = editing[id]
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) { setEditing(s => { const c = { ...s }; delete c[id]; return c }); return }
    if (n !== current) { const r = adjustShopStock(id, n); if (!r.ok) window.alert(r.reason) }
    setEditing(s => { const c = { ...s }; delete c[id]; return c })
  }

  // 規格商品：調某規格庫存
  const saveVariant = (p: ShopProduct, size: string | null, color: string | null, current: number) => {
    const key = cartKey(p.id, size, color)
    const raw = editing[key]
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) { setEditing(s => { const c = { ...s }; delete c[key]; return c }); return }
    if (n !== current) { const r = adjustShopVariantStock(p.id, size, color, n); if (!r.ok) window.alert(r.reason) }
    setEditing(s => { const c = { ...s }; delete c[key]; return c })
  }

  return (
    <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.borderLight}`, fontSize: 12, color: COLORS.ink500 }}>
        線上商城為「獨立庫存池」，與各館實體庫存（商品管理頁）分開計算。下單會自動扣減、取消會自動回補。有尺寸 / 顏色的商品可逐一規格設定庫存。
      </div>
      {products.map(p => {
        const variantProduct = hasVariants(p)
        const isOpen = expanded[p.id] ?? false
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${COLORS.borderLight}`, opacity: p.isListed ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 24 }}>{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}
                  <span style={{ fontSize: 11, color: COLORS.ink300, fontWeight: 500, marginLeft: 8 }}>{SHOP_CATEGORY_LABEL[p.category]}・${p.unitPrice}</span>
                </div>
              </div>

              {variantProduct ? (
                <button onClick={() => setExpanded(s => ({ ...s, [p.id]: !isOpen }))} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${COLORS.border}`, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: COLORS.ink700,
                }}>
                  <span style={{ color: COLORS.ink500 }}>總庫存 {p.onlineStock}</span>
                  <span>{p.variants.length} 規格 {isOpen ? '▲' : '▼'}</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: COLORS.ink500 }}>庫存</span>
                  <input
                    type="number"
                    value={editing[p.id] ?? String(p.onlineStock)}
                    onChange={e => setEditing(s => ({ ...s, [p.id]: e.target.value }))}
                    onBlur={() => saveSimple(p.id, p.onlineStock)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${COLORS.border}`, fontSize: 13, textAlign: 'center' }}
                  />
                </div>
              )}

              <button onClick={() => { const r = toggleShopListing(p.id, !p.isListed); if (!r.ok) window.alert(r.reason) }} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: p.isListed ? COLORS.successBg : '#fff',
                color: p.isListed ? COLORS.success : COLORS.ink500,
                borderColor: p.isListed ? COLORS.success : COLORS.border,
              }}>{p.isListed ? '上架中' : '已下架'}</button>
            </div>

            {/* 規格庫存矩陣 */}
            {variantProduct && isOpen && (
              <div style={{ padding: '0 16px 14px 52px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8 }}>
                {p.variants.map(v => {
                  const key = cartKey(p.id, v.size, v.color)
                  const hex = v.color ? (p.colors.find(c => c.name === v.color)?.hex ?? null) : null
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 9, background: v.stock <= 0 ? COLORS.dangerBg : COLORS.surfaceTint,
                    }}>
                      {hex && <span style={{ width: 12, height: 12, borderRadius: '50%', background: hex, border: `1px solid ${COLORS.border}`, flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: COLORS.ink700 }}>{variantLabel(v.size, v.color) || '單一規格'}</span>
                      <input
                        type="number"
                        value={editing[key] ?? String(v.stock)}
                        onChange={e => setEditing(s => ({ ...s, [key]: e.target.value }))}
                        onBlur={() => saveVariant(p, v.size, v.color, v.stock)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        style={{ width: 52, padding: '5px 6px', borderRadius: 7, border: `1.5px solid ${COLORS.border}`, fontSize: 13, textAlign: 'center' }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// 代客下單 modal
// ============================================================
function ComposeOrderModal({ onClose }: { onClose: () => void }) {
  const storeVersion = useStoreSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const products = useMemo(() => listShopProducts(), [storeVersion])
  const venues = useMemo(() => listVenues().filter(v => v.isActive), [])

  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [sel, setSel] = useState<Record<string, { size: string | null; color: string | null }>>({})
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup')
  const [pickupVenueId, setPickupVenueId] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [payment, setPayment] = useState<PaymentChannel>('cash_on_pickup')
  const [error, setError] = useState('')

  useEffect(() => { setPayment(fulfillment === 'pickup' ? 'cash_on_pickup' : 'cash_on_delivery') }, [fulfillment])

  const bump = (key: string, d: number, cap: number) => setQtys(s => {
    const next = Math.max(0, Math.min((s[key] ?? 0) + d, cap))
    const c = { ...s }
    if (next === 0) delete c[key]; else c[key] = next
    return c
  })

  const lines = Object.entries(qtys).map(([key, q]) => {
    const { productId, size, color } = parseCartKey(key)
    return { p: products.find(x => x.id === productId)!, size, color, q }
  }).filter(l => l.p)
  const itemTotal = lines.reduce((s, l) => s + l.p.unitPrice * l.q, 0)
  const total = itemTotal + getShopShippingFee(fulfillment)

  const submit = () => {
    setError('')
    const res = createOrder({
      channel: 'backend',
      customerName: name, customerPhone: phone, customerEmail: null,
      items: lines.map(l => ({ productId: l.p.id, quantity: l.q, size: l.size, color: l.color })),
      fulfillment,
      pickupVenueId: fulfillment === 'pickup' ? pickupVenueId : null,
      shipping: fulfillment === 'shipping' ? { recipient: name, phone, address } : null,
      paymentChannel: payment,
      notes: '館長 / 後台代客下單',
    })
    if (!res.ok) { setError(res.reason); return }
    onClose()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(45,27,46,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3)', fontFamily: FONTS.sans, color: COLORS.ink900,
      }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${COLORS.borderLight}`, position: 'sticky', top: 0, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>代客下單</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.ink300 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          {/* 商品挑選 */}
          <SectionLabel>選擇商品</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {products.map(p => {
              if (hasVariants(p)) {
                const cur = sel[p.id] ?? { size: p.sizes.length ? null : null, color: p.colors.length ? null : null }
                const size = p.sizes.length ? cur.size : null
                const color = p.colors.length ? cur.color : null
                const complete = (!p.sizes.length || size !== null) && (!p.colors.length || color !== null)
                const avail = complete ? stockFor(p, size, color) : 0
                const key = cartKey(p.id, size, color)
                const q = complete ? (qtys[key] ?? 0) : 0
                const setField = (f: 'size' | 'color', v: string) =>
                  setSel(s => ({ ...s, [p.id]: { size: cur.size, color: cur.color, [f]: v || null } }))
                return (
                  <div key={p.id} style={{ padding: '8px 10px', borderRadius: 10, background: q > 0 ? COLORS.pink50 : COLORS.surfaceTint }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{p.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.ink300 }}>
                          ${p.unitPrice}・{complete ? `此規格庫存 ${avail}` : '請選規格'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => bump(key, -1, avail)} disabled={!complete || q <= 0} style={{ ...miniBtn, opacity: (!complete || q <= 0) ? 0.35 : 1 }}>−</button>
                        <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{q}</span>
                        <button onClick={() => bump(key, 1, avail)} disabled={!complete || q >= avail} style={{ ...miniBtn, opacity: (!complete || q >= avail) ? 0.35 : 1 }}>＋</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                      {p.sizes.length > 0 && (
                        <select value={size ?? ''} onChange={e => setField('size', e.target.value)} style={{ ...mInput, marginBottom: 0, flex: 1, padding: '6px 8px', fontSize: 12 }}>
                          <option value="">尺寸…</option>
                          {p.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {p.colors.length > 0 && (
                        <select value={color ?? ''} onChange={e => setField('color', e.target.value)} style={{ ...mInput, marginBottom: 0, flex: 1, padding: '6px 8px', fontSize: 12 }}>
                          <option value="">顏色…</option>
                          {p.colors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                )
              }

              const q = qtys[p.id] ?? 0
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: q > 0 ? COLORS.pink50 : COLORS.surfaceTint }}>
                  <span style={{ fontSize: 18 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.ink300 }}>${p.unitPrice}・庫存 {p.onlineStock}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => bump(p.id, -1, p.onlineStock)} style={miniBtn}>−</button>
                    <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{q}</span>
                    <button onClick={() => bump(p.id, 1, p.onlineStock)} disabled={q >= p.onlineStock} style={{ ...miniBtn, opacity: q >= p.onlineStock ? 0.35 : 1 }}>＋</button>
                  </div>
                </div>
              )
            })}
          </div>

          <SectionLabel>取貨方式</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['pickup', 'shipping'] as FulfillmentType[]).map(f => (
              <button key={f} onClick={() => setFulfillment(f)} style={{
                flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${fulfillment === f ? COLORS.pink500 : COLORS.border}`,
                background: fulfillment === f ? COLORS.pink50 : '#fff', color: fulfillment === f ? COLORS.pink600 : COLORS.ink500,
              }}>{FULFILLMENT_LABEL[f]}</button>
            ))}
          </div>
          {fulfillment === 'pickup' ? (
            <select value={pickupVenueId} onChange={e => setPickupVenueId(e.target.value)} style={mInput}>
              <option value="">選擇取貨球館</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="收件地址" style={mInput} />
          )}

          <SectionLabel>顧客資訊</SectionLabel>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="顧客姓名 *" style={mInput} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="顧客電話 *" style={mInput} />

          <SectionLabel>付款方式</SectionLabel>
          <select value={payment} onChange={e => setPayment(e.target.value as PaymentChannel)} style={mInput}>
            {(fulfillment === 'pickup' ? ['cash_on_pickup', 'online_gateway'] : ['cash_on_delivery', 'online_gateway'] as PaymentChannel[]).map(opt => (
              <option key={opt} value={opt}>{PAYMENT_CHANNEL_LABEL[opt as PaymentChannel]}</option>
            ))}
          </select>

          {error && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: COLORS.dangerBg, color: COLORS.danger, fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 13, color: COLORS.ink500 }}>應付總額</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.pink600 }}>${total}</span>
          </div>
          <button onClick={submit} disabled={lines.length === 0} style={{
            width: '100%', marginTop: 12, padding: '13px', borderRadius: 999, border: 'none',
            background: lines.length === 0 ? COLORS.border : `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`,
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: lines.length === 0 ? 'not-allowed' : 'pointer',
          }}>建立訂單</button>
        </div>
      </div>
    </div>
  )
}

// —— 小元件 ——
function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7 }}>{children}</span>
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.ink300, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.ink700, fontWeight: 500 }}>{value}</div>
    </div>
  )
}
function ActBtn({ onClick, color, bg, children }: { onClick: () => void; color: string; bg: string; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{children}</button>
}
function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '50px 20px', color: COLORS.ink300, fontSize: 14, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>{text}</div>
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.pink700, letterSpacing: '0.06em', margin: '4px 0 8px' }}>{children}</div>
}

const miniBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: '#fff',
  color: COLORS.pink600, fontSize: 14, fontWeight: 800, cursor: 'pointer', lineHeight: 1,
}
const mInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${COLORS.border}`,
  fontSize: 14, marginBottom: 8, outline: 'none', background: '#fff', color: COLORS.ink900,
}
