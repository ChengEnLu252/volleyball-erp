'use client'

// ============================================================
// /orders — 商城訂單管理（SC3：讀真 DB + server action）
// ============================================================
// owner → 全部訂單；manager → 自己館「到館自取」訂單；staff 被擋。
//   - 訂單列表（狀態篩選 + 統計）+ 明細展開
//   - 標記已付款 / 標記完成（宅配可填物流單號）/ 取消（回補庫存）
//   - 代客下單（channel='backend'）
//   - 線上商城庫存管理（調庫存 / 上下架）
// 全部經 server action：後端強制授權 + 交易安全。
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadOrdersAdminAction, loadComposeDataAction, loadShopInventoryAction,
  markOrderPaidAction, fulfillOrderAction, cancelOrderAction,
  adjustShopStockAction, adjustShopVariantStockAction, toggleShopListingAction,
  composeBackendOrderAction,
} from '@/app/actions/orders-admin'
import type { AdminOrder, OrderStatus, StoreProduct, FulfillmentType, PaymentChannel } from '@/data/shop-types'
import {
  ORDER_STATUS_LABEL, ORDER_CHANNEL_LABEL, FULFILLMENT_LABEL, PAYMENT_CHANNEL_LABEL,
} from '@/types'
import { cartKey, parseCartKey, hasVariants, stockFor, variantLabel } from '@/components/shop/variants'
import { COLORS, FONTS } from '@/components/theme/tokens'

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  pending: { bg: COLORS.warnBg, fg: COLORS.amberDeep },
  paid: { bg: '#dbeafe', fg: '#1e40af' },
  fulfilled: { bg: COLORS.successBg, fg: COLORS.success },
  cancelled: { bg: COLORS.surfaceTint, fg: COLORS.ink300 },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const EMPTY_COUNTS: Record<OrderStatus, number> = { pending: 0, paid: 0, fulfilled: 0, cancelled: 0 }

export default function OrdersPage() {
  const [state, setState] = useState<{ role: 'owner' | 'manager'; orders: AdminOrder[]; counts: Record<OrderStatus, number> } | null | undefined>(undefined)
  const [tab, setTab] = useState<'orders' | 'inventory'>('orders')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const res = await loadOrdersAdminAction({})
    setState(res.ok ? { role: res.role, orders: res.orders, counts: res.counts } : null)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const orders = state?.orders ?? []
  const counts = state?.counts ?? EMPTY_COUNTS
  const role = state?.role ?? 'owner'
  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)

  const run = async (fn: () => Promise<{ ok: boolean; reason?: string }>) => {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (!r.ok && r.reason) window.alert(r.reason)
    await refresh()
  }

  const doPaid = (o: AdminOrder) => run(() => markOrderPaidAction(o.id))
  const doFulfill = (o: AdminOrder) => {
    if (o.fulfillment === 'shipping') {
      const tracking = window.prompt(`標記出貨 ${o.orderNo}\n物流單號（可留空）：`, o.trackingNumber ?? '')
      if (tracking === null) return
      const provider = window.prompt('物流商 / 方式（可留空，如：黑貓 / 7-11）：', o.shippingProvider ?? '') ?? ''
      return run(() => fulfillOrderAction({ orderId: o.id, trackingNumber: tracking, shippingProvider: provider }))
    }
    return run(() => fulfillOrderAction({ orderId: o.id }))
  }
  const doCancel = (o: AdminOrder) => {
    const reason = window.prompt(`取消訂單 ${o.orderNo}？\n請輸入取消理由（會回補庫存）：`, '')
    if (reason === null) return
    return run(() => cancelOrderAction({ orderId: o.id, reason }))
  }

  // 無權限
  if (state === null) {
    return (
      <div style={{ padding: 24, fontFamily: FONTS.sans }}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.ink500, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>此頁僅限館長／老闆
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}>
      <style>{`@media(max-width:768px){.ord-wrap{padding-top:64px !important}}`}</style>
      <div className="ord-wrap">
        {/* —— Header —— */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>商城訂單</h1>
            <p style={{ fontSize: 13, color: COLORS.ink500, margin: '4px 0 0' }}>{role === 'owner' ? '全部球館的線上 / 代客訂單' : '您球館的到館自取訂單'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/shop" target="_blank" style={{ padding: '9px 14px', borderRadius: 9, background: '#fff', border: `1px solid ${COLORS.border}`, color: COLORS.ink700, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>🛍️ 開啟商城 ↗</a>
            <button onClick={() => setComposeOpen(true)} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(255,45,138,0.5)' }}>＋ 代客下單</button>
          </div>
        </div>

        {/* —— Tabs —— */}
        <div style={{ display: 'flex', gap: 4, background: COLORS.surfaceTint, borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
          {([['orders', '訂單列表'], ['inventory', '商城庫存']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t ? '#fff' : 'transparent', color: tab === t ? COLORS.ink900 : COLORS.ink500, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{label}</button>
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
                <button key={s} onClick={() => setStatusFilter(s as OrderStatus | 'all')} style={{ padding: '6px 13px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: statusFilter === s ? COLORS.ink900 : '#fff', color: statusFilter === s ? '#fff' : COLORS.ink700, borderColor: statusFilter === s ? COLORS.ink900 : COLORS.border }}>{label} <span style={{ opacity: 0.7 }}>{n}</span></button>
              ))}
            </div>

            {state === undefined ? (
              <Empty text="載入中…" />
            ) : filtered.length === 0 ? (
              <Empty text="目前沒有符合的訂單" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: busy ? 0.6 : 1 }}>
                {filtered.map((o) => {
                  const isOpen = expanded === o.id
                  return (
                    <div key={o.id} style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                      <button onClick={() => setExpanded(isOpen ? null : o.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: COLORS.pink700 }}>{o.orderNo}</span>
                        <Badge bg={STATUS_STYLE[o.status].bg} fg={STATUS_STYLE[o.status].fg}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        <span style={{ fontSize: 11, color: COLORS.ink300, background: COLORS.surfaceTint, padding: '2px 8px', borderRadius: 6 }}>{ORDER_CHANNEL_LABEL[o.channel]}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customerName}</span>
                        <span style={{ fontSize: 12, color: COLORS.ink500 }}>{FULFILLMENT_LABEL[o.fulfillment]}{o.pickupVenueName ? `・${o.pickupVenueName}` : ''}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: COLORS.pink600 }}>${o.total}</span>
                        <span style={{ fontSize: 11, color: COLORS.ink300 }}>{fmt(o.createdAt)}</span>
                        <span style={{ fontSize: 12, color: COLORS.ink300 }}>{isOpen ? '▲' : '▼'}</span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${COLORS.borderLight}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, margin: '12px 0' }}>
                            <Info label="聯絡電話" value={o.customerPhone} />
                            {o.customerEmail && <Info label="Email" value={o.customerEmail} />}
                            <Info label="付款方式" value={PAYMENT_CHANNEL_LABEL[o.paymentChannel]} />
                            {o.placedByName && <Info label="代客操作員" value={o.placedByName} />}
                            {o.shipping && <Info label="收件地址" value={`${o.shipping.recipient}・${o.shipping.address}`} />}
                            {o.trackingNumber && <Info label="物流單號" value={`${o.shippingProvider ? o.shippingProvider + '・' : ''}${o.trackingNumber}`} />}
                            {o.notes && <Info label="備註" value={o.notes} />}
                            {o.paidAt && <Info label="付款時間" value={fmt(o.paidAt)} />}
                            {o.fulfilledAt && <Info label="完成時間" value={fmt(o.fulfilledAt)} />}
                            {o.cancelReason && <Info label="取消理由" value={o.cancelReason} />}
                          </div>

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

                          {o.status !== 'cancelled' && o.status !== 'fulfilled' && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {o.status === 'pending' && <ActBtn onClick={() => doPaid(o)} color="#1e40af" bg="#dbeafe">標記已付款</ActBtn>}
                              <ActBtn onClick={() => doFulfill(o)} color={COLORS.success} bg={COLORS.successBg}>✓ 標記完成（{o.fulfillment === 'pickup' ? '已取貨' : '已出貨'}）</ActBtn>
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

      {composeOpen && <ComposeOrderModal onClose={() => setComposeOpen(false)} onDone={refresh} />}
    </div>
  )
}

// ============================================================
// 商城庫存管理
// ============================================================
function InventoryTab() {
  const [products, setProducts] = useState<StoreProduct[] | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const reload = useCallback(async () => {
    const r = await loadShopInventoryAction()
    setProducts(r.ok ? r.products : [])
  }, [])
  useEffect(() => { reload() }, [reload])

  const saveSimple = async (id: string, current: number) => {
    const raw = editing[id]
    setEditing((s) => { const c = { ...s }; delete c[id]; return c })
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    if (Number.isNaN(n) || n === current) return
    const r = await adjustShopStockAction({ productId: id, newStock: n })
    if (!r.ok) window.alert(r.reason)
    await reload()
  }
  const saveVariant = async (p: StoreProduct, size: string | null, color: string | null, current: number) => {
    const key = cartKey(p.id, size, color)
    const raw = editing[key]
    setEditing((s) => { const c = { ...s }; delete c[key]; return c })
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    if (Number.isNaN(n) || n === current) return
    const r = await adjustShopVariantStockAction({ productId: p.id, size, color, newStock: n })
    if (!r.ok) window.alert(r.reason)
    await reload()
  }
  const toggle = async (p: StoreProduct) => {
    const r = await toggleShopListingAction({ productId: p.id, isListed: !p.isListed })
    if (!r.ok) window.alert(r.reason)
    await reload()
  }

  if (!products) return <Empty text="載入中…" />

  return (
    <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.borderLight}`, fontSize: 12, color: COLORS.ink500 }}>
        線上商城為「獨立庫存池」，與各館實體庫存分開。下單自動扣減、取消自動回補。有尺寸 / 顏色的商品可逐一規格設定庫存。
      </div>
      {products.map((p) => {
        const variantProduct = hasVariants(p)
        const isOpen = expanded[p.id] ?? false
        return (
          <div key={p.id} style={{ borderBottom: `1px solid ${COLORS.borderLight}`, opacity: p.isListed ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 24 }}>{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}
                  <span style={{ fontSize: 11, color: COLORS.ink300, fontWeight: 500, marginLeft: 8 }}>{p.categories[0]?.name ?? ''}・${p.unitPrice}</span>
                </div>
              </div>
              {variantProduct ? (
                <button onClick={() => setExpanded((s) => ({ ...s, [p.id]: !isOpen }))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: COLORS.ink700 }}>
                  <span style={{ color: COLORS.ink500 }}>總庫存 {p.onlineStock}</span>
                  <span>{p.variants.length} 規格 {isOpen ? '▲' : '▼'}</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: COLORS.ink500 }}>庫存</span>
                  <input type="number" value={editing[p.id] ?? String(p.onlineStock)} onChange={(e) => setEditing((s) => ({ ...s, [p.id]: e.target.value }))} onBlur={() => saveSimple(p.id, p.onlineStock)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${COLORS.border}`, fontSize: 13, textAlign: 'center' }} />
                </div>
              )}
              <button onClick={() => toggle(p)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: p.isListed ? COLORS.successBg : '#fff', color: p.isListed ? COLORS.success : COLORS.ink500, borderColor: p.isListed ? COLORS.success : COLORS.border }}>{p.isListed ? '上架中' : '已下架'}</button>
            </div>

            {variantProduct && isOpen && (
              <div style={{ padding: '0 16px 14px 52px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8 }}>
                {p.variants.map((v) => {
                  const key = cartKey(p.id, v.size, v.color)
                  const hex = v.color ? (p.colors.find((c) => c.name === v.color)?.hex ?? null) : null
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: v.stock <= 0 ? COLORS.dangerBg : COLORS.surfaceTint }}>
                      {hex && <span style={{ width: 12, height: 12, borderRadius: '50%', background: hex, border: `1px solid ${COLORS.border}`, flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: COLORS.ink700 }}>{variantLabel(v.size, v.color) || '單一規格'}</span>
                      <input type="number" value={editing[key] ?? String(v.stock)} onChange={(e) => setEditing((s) => ({ ...s, [key]: e.target.value }))} onBlur={() => saveVariant(p, v.size, v.color, v.stock)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={{ width: 52, padding: '5px 6px', borderRadius: 7, border: `1.5px solid ${COLORS.border}`, fontSize: 13, textAlign: 'center' }} />
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
function ComposeOrderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ venues: { id: string; name: string }[]; products: StoreProduct[] } | null>(null)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [sel, setSel] = useState<Record<string, { size: string | null; color: string | null }>>({})
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup')
  const [pickupVenueId, setPickupVenueId] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [payment, setPayment] = useState<PaymentChannel>('cash_on_pickup')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadComposeDataAction().then((r) => setData(r.ok ? { venues: r.venues, products: r.products } : { venues: [], products: [] })) }, [])
  useEffect(() => { setPayment(fulfillment === 'pickup' ? 'cash_on_pickup' : 'cash_on_delivery') }, [fulfillment])

  const products = data?.products ?? []
  const venues = data?.venues ?? []

  const bump = (key: string, d: number, cap: number) => setQtys((s) => {
    const next = Math.max(0, Math.min((s[key] ?? 0) + d, cap))
    const c = { ...s }
    if (next === 0) delete c[key]; else c[key] = next
    return c
  })

  const lines = Object.entries(qtys).map(([key, q]) => {
    const { productId, size, color } = parseCartKey(key)
    return { p: products.find((x) => x.id === productId)!, size, color, q }
  }).filter((l) => l.p)
  const itemTotal = lines.reduce((s, l) => s + l.p.unitPrice * l.q, 0)
  const total = itemTotal + (fulfillment === 'shipping' ? 80 : 0)

  const submit = async () => {
    setError(''); setSubmitting(true)
    const res = await composeBackendOrderAction({
      customerName: name, customerPhone: phone, customerEmail: null,
      items: lines.map((l) => ({ productId: l.p.id, quantity: l.q, size: l.size, color: l.color })),
      fulfillment,
      pickupVenueId: fulfillment === 'pickup' ? pickupVenueId : null,
      shipping: fulfillment === 'shipping' ? { recipient: name, phone, address } : null,
      paymentChannel: payment,
      notes: '館長 / 後台代客下單',
    })
    setSubmitting(false)
    if (!res.ok) { setError(res.reason); return }
    onDone(); onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(45,27,46,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3)', fontFamily: FONTS.sans, color: COLORS.ink900 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${COLORS.borderLight}`, position: 'sticky', top: 0, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>代客下單</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.ink300 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          <SectionLabel>選擇商品</SectionLabel>
          {!data ? <div style={{ fontSize: 13, color: COLORS.ink300, padding: '10px 0' }}>載入中…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {products.map((p) => {
                if (hasVariants(p)) {
                  const cur = sel[p.id] ?? { size: null, color: null }
                  const size = p.sizes.length ? cur.size : null
                  const color = p.colors.length ? cur.color : null
                  const complete = (!p.sizes.length || size !== null) && (!p.colors.length || color !== null)
                  const avail = complete ? stockFor(p, size, color) : 0
                  const key = cartKey(p.id, size, color)
                  const q = complete ? (qtys[key] ?? 0) : 0
                  const setField = (f: 'size' | 'color', v: string) => setSel((s) => ({ ...s, [p.id]: { size: cur.size, color: cur.color, [f]: v || null } }))
                  return (
                    <div key={p.id} style={{ padding: '8px 10px', borderRadius: 10, background: q > 0 ? COLORS.pink50 : COLORS.surfaceTint }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{p.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: COLORS.ink300 }}>${p.unitPrice}・{complete ? `此規格庫存 ${avail}` : '請選規格'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => bump(key, -1, avail)} disabled={!complete || q <= 0} style={{ ...miniBtn, opacity: (!complete || q <= 0) ? 0.35 : 1 }}>−</button>
                          <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{q}</span>
                          <button onClick={() => bump(key, 1, avail)} disabled={!complete || q >= avail} style={{ ...miniBtn, opacity: (!complete || q >= avail) ? 0.35 : 1 }}>＋</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                        {p.sizes.length > 0 && (
                          <select value={size ?? ''} onChange={(e) => setField('size', e.target.value)} style={{ ...mInput, marginBottom: 0, flex: 1, padding: '6px 8px', fontSize: 12 }}>
                            <option value="">尺寸…</option>
                            {p.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                        {p.colors.length > 0 && (
                          <select value={color ?? ''} onChange={(e) => setField('color', e.target.value)} style={{ ...mInput, marginBottom: 0, flex: 1, padding: '6px 8px', fontSize: 12 }}>
                            <option value="">顏色…</option>
                            {p.colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
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
          )}

          <SectionLabel>取貨方式</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['pickup', 'shipping'] as FulfillmentType[]).map((f) => (
              <button key={f} onClick={() => setFulfillment(f)} style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${fulfillment === f ? COLORS.pink500 : COLORS.border}`, background: fulfillment === f ? COLORS.pink50 : '#fff', color: fulfillment === f ? COLORS.pink600 : COLORS.ink500 }}>{FULFILLMENT_LABEL[f]}</button>
            ))}
          </div>
          {fulfillment === 'pickup' ? (
            <select value={pickupVenueId} onChange={(e) => setPickupVenueId(e.target.value)} style={mInput}>
              <option value="">選擇取貨球館</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="收件地址" style={mInput} />
          )}

          <SectionLabel>顧客資訊</SectionLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="顧客姓名 *" style={mInput} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="顧客電話 *" style={mInput} />

          <SectionLabel>付款方式</SectionLabel>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentChannel)} style={mInput}>
            {((fulfillment === 'pickup' ? ['cash_on_pickup', 'online_gateway'] : ['cash_on_delivery', 'online_gateway']) as PaymentChannel[]).map((opt) => (
              <option key={opt} value={opt}>{PAYMENT_CHANNEL_LABEL[opt]}</option>
            ))}
          </select>

          {error && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: COLORS.dangerBg, color: COLORS.danger, fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 13, color: COLORS.ink500 }}>應付總額</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.pink600 }}>${total}</span>
          </div>
          <button onClick={submit} disabled={lines.length === 0 || submitting} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 999, border: 'none', background: (lines.length === 0 || submitting) ? COLORS.border : `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: (lines.length === 0 || submitting) ? 'not-allowed' : 'pointer' }}>{submitting ? '建立中…' : '建立訂單'}</button>
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

const miniBtn: React.CSSProperties = { width: 24, height: 24, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.pink600, fontSize: 14, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }
const mInput: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${COLORS.border}`, fontSize: 14, marginBottom: 8, outline: 'none', background: '#fff', color: COLORS.ink900 }
