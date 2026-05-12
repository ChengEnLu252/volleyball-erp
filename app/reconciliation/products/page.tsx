'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getCurrentVisibleVenueIds,
  getProductReconciliation,
  listVenues,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, ProgressBar, VENUE_COLOR,
} from '@/components/reconciliation/Common'

export default function ProductReconciliationPage() {
  const [venueId, setVenueId] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  const allVenues = listVenues().filter(v => v.isActive)
  const venues = visible === 'all' ? allVenues : allVenues.filter(v => visible.includes(v.id))

  useEffect(() => {
    if (visible !== 'all' && venueId !== 'all' && !visible.includes(venueId)) {
      setVenueId('all')
    }
  }, [visible, venueId])

  const products = useMemo(() => {
    const raw = getProductReconciliation({
      venueId: venueId === 'all' ? undefined : venueId,
    })
    // 視角過濾：byVenue 也要剃除 manager 看不到的館
    const filtered = visible === 'all'
      ? raw
      : raw
          .map(p => {
            const byVenue = p.byVenue.filter(b => visible.includes(b.venueId))
            // 重算各館加總後的全品數字（byVenue 只有 sale/giftCount，金額用 unitPrice 推）
            const saleCount   = byVenue.reduce((s, v) => s + v.saleCount, 0)
            const giftCount   = byVenue.reduce((s, v) => s + v.giftCount, 0)
            const saleRevenue = saleCount * p.unitPrice
            const giftValue   = giftCount * p.unitPrice
            const total = saleCount + giftCount
            const giftRatio = total === 0 ? 0 : giftCount / total
            return { ...p, byVenue, saleCount, giftCount, saleRevenue, giftValue, giftRatio }
          })
          .filter(p => p.byVenue.length > 0)
    // 異常的優先排前面，再依贈比降冪
    return filtered.sort((a, b) => {
      if (a.hasGiftAnomaly !== b.hasGiftAnomaly) return a.hasGiftAnomaly ? -1 : 1
      return b.giftRatio - a.giftRatio
    })
  }, [venueId, visible])

  const totals = useMemo(() => ({
    count: products.length,
    saleCount:    products.reduce((s, p) => s + p.saleCount,   0),
    saleRevenue:  products.reduce((s, p) => s + p.saleRevenue, 0),
    giftCount:    products.reduce((s, p) => s + p.giftCount,   0),
    giftValue:    products.reduce((s, p) => s + p.giftValue,   0),
    anomalyCount: products.filter(p => p.hasGiftAnomaly).length,
    lowStockCount: products.filter(p => p.isLowStock).length,
  }), [products])

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .pr-wrap   { padding-top: 64px !important; }
          .pr-stats  { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="pr-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="商品對帳"
          subtitle="銷售/贈送比例、各館分布 — 過去 30 天"
          backTo="/reconciliation"
        />

        {/* 球館篩選 */}
        <div style={{ marginBottom: 16 }}>
          <select
            value={venueId}
            onChange={e => setVenueId(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0',
              fontSize: 13, background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="all">全部球館</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {/* KPI */}
        <div className="pr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="商品總數" value={`${totals.count} 項`} accent="#7c6af7" />
          <StatCard
            label="銷售收入"
            value={`$${totals.saleRevenue.toLocaleString()}`}
            sub={`${totals.saleCount} 件售出`}
            accent="#10b981"
          />
          <StatCard
            label="贈送損失"
            value={`$${totals.giftValue.toLocaleString()}`}
            sub={`${totals.giftCount} 件贈出`}
            intent="warning"
            accent="#f59e0b"
          />
          <StatCard
            label="異常項目"
            value={`${totals.anomalyCount} 項`}
            sub={totals.lowStockCount > 0 ? `低庫存 ${totals.lowStockCount} 項` : ''}
            intent={totals.anomalyCount > 0 ? 'danger' : 'default'}
            accent="#e85d3a"
          />
        </div>

        {/* 限制聲明 */}
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e',
        }}>
          ℹ️ 此頁監測重點為「贈送比例異常」+「低庫存」。完整盤點對帳（理論 vs 實際）需要進貨/盤點記錄，目前展示資料未涵蓋。
        </div>

        {/* 商品列表 */}
        <Panel title={`商品明細（${products.length} 項，異常優先）`}>
          {products.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>沒有商品資料</div>
          ) : (
            <div>
              {products.map(p => {
                const isExpanded = expandedId === p.productId
                const w = p.worstVenue
                return (
                  <div key={p.productId} style={{ borderBottom: '1px solid #f0ede6' }}>
                    {/* 主行 */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : p.productId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 0', cursor: 'pointer', flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 22, width: 28, textAlign: 'center' }}>
                        {p.hasGiftAnomaly ? '🚨' : p.isLowStock ? '📉' : '📦'}
                      </div>

                      <div style={{ flex: 1, minWidth: 130 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.productName}</div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          單價 ${p.unitPrice} · 庫存 {p.currentStock}
                          {p.isLowStock && <span style={{ color: '#e85d3a', marginLeft: 6 }}>（低於閾值 {p.lowStockThreshold}）</span>}
                        </div>
                      </div>

                      <div style={{ minWidth: 110, textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>銷 {p.saleCount} 件</div>
                        <div style={{ fontSize: 11, color: '#10b981' }}>${p.saleRevenue.toLocaleString()}</div>
                      </div>

                      <div style={{ minWidth: 110, textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.hasGiftAnomaly ? '#e85d3a' : '#1a1917' }}>
                          贈 {p.giftCount} 件
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>≈ ${p.giftValue.toLocaleString()}</div>
                      </div>

                      <div style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#888' }}>整體贈比</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(p.giftRatio * 100)}%</span>
                        </div>
                        <ProgressBar
                          ratio={p.giftRatio}
                          accent={p.hasGiftAnomaly ? '#e85d3a' : p.giftRatio > 0.2 ? '#f59e0b' : '#10b981'}
                          height={5}
                        />
                      </div>

                      {p.hasGiftAnomaly && w && (
                        <Badge color="red">{w.venueName} {Math.round(w.giftRatio * 100)}%</Badge>
                      )}

                      <div style={{ fontSize: 14, color: '#888', width: 16, textAlign: 'center' }}>
                        {isExpanded ? '▾' : '▸'}
                      </div>
                    </div>

                    {/* 展開：各館分布 */}
                    {isExpanded && (
                      <div style={{
                        background: '#fafaf8', padding: '14px 16px',
                        marginBottom: 4, borderRadius: 8,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 10 }}>
                          各館分布（過去 30 天）
                        </div>
                        {p.byVenue.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#888' }}>該商品近 30 天無交易</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            {p.byVenue.map(v => {
                              const isWorst = w?.venueId === v.venueId && p.hasGiftAnomaly
                              return (
                                <div key={v.venueId} style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '6px 10px',
                                  background: isWorst ? '#fef2f2' : '#fff',
                                  border: isWorst ? '1px solid #fca5a5' : '1px solid #f0ede6',
                                  borderRadius: 6,
                                }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: VENUE_COLOR[v.venueId] || '#999' }} />
                                  <span style={{ fontSize: 12, fontWeight: 500, minWidth: 70 }}>{v.venueName}</span>
                                  <span style={{ fontSize: 11, color: '#666' }}>銷 {v.saleCount} / 贈 {v.giftCount}</span>
                                  <div style={{ flex: 1 }}>
                                    <ProgressBar
                                      ratio={v.giftRatio}
                                      accent={isWorst ? '#e85d3a' : v.giftRatio > 0.2 ? '#f59e0b' : '#10b981'}
                                      height={4}
                                    />
                                  </div>
                                  <span style={{
                                    fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right',
                                    color: isWorst ? '#e85d3a' : '#1a1917',
                                  }}>
                                    {Math.round(v.giftRatio * 100)}%
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 }}>
          異常條件：某館贈送比例 &gt; 30% 且樣本量 ≥ 5 件　|　點選列展開查看各館分布
        </div>
      </div>
    </div>
  )
}
