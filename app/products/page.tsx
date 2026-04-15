'use client'

import { useState } from 'react'
import { MOCK_VENUE_PRODUCTS, MOCK_PRODUCT_TRANSACTIONS } from '@/data/mock'

const TYPE_LABEL: Record<string, string> = {
  purchase_in: '進貨', sale: '販售', gift: '贈送', adjustment: '盤點調整',
}
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  purchase_in: { bg: '#dbeafe', text: '#1e40af' },
  sale:        { bg: '#dcfce7', text: '#166534' },
  gift:        { bg: '#fce7f3', text: '#9d174d' },
  adjustment:  { bg: '#f3f4f6', text: '#6b7280' },
}
const VENUE_COLOR: Record<string, string> = {
  v1: '#7c6af7', v2: '#0ea5e9', v3: '#f59e0b', v4: '#10b981', v5: '#f43f5e',
}

export default function ProductsPage() {
  const [tab, setTab] = useState<'stock' | 'transactions'>('stock')
  const [selectedVenue, setSelectedVenue] = useState<string>('all')

  const allLowStock = MOCK_VENUE_PRODUCTS.flatMap(v =>
    v.products.filter(p => p.currentStock <= p.lowStockThreshold).map(p => ({ ...p, venueName: v.venueName, venueId: v.venueId }))
  )

  const filteredVenues = selectedVenue === 'all'
    ? MOCK_VENUE_PRODUCTS
    : MOCK_VENUE_PRODUCTS.filter(v => v.venueId === selectedVenue)

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.prod-wrap{padding-top:64px !important}}`}</style>
      <div className="prod-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>商品管理</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>各館庫存狀況與商品流向紀錄</p>
        </div>

        {allLowStock.length > 0 && (
          <div style={{ background: '#fff3cd', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>庫存警告：{allLowStock.length} 項商品低於安全水位</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allLowStock.map(p => (
                  <span key={p.id} style={{ fontSize: 11, background: '#fff', border: '1px solid #fcd34d', borderRadius: 6, padding: '2px 8px', color: '#92400e' }}>
                    {p.venueName} · {p.name}（剩 {p.currentStock}）
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4 }}>
            {(['stock', 'transactions'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#1a1917' : '#888',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>
                {t === 'stock' ? '庫存狀況' : '流向紀錄'}
              </button>
            ))}
          </div>

          {tab === 'stock' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedVenue('all')} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: selectedVenue === 'all' ? '#1a1917' : '#fff',
                color: selectedVenue === 'all' ? '#fff' : '#555',
                borderColor: selectedVenue === 'all' ? '#1a1917' : '#e8e6e0',
              }}>全部球館</button>
              {MOCK_VENUE_PRODUCTS.map(v => (
                <button key={v.venueId} onClick={() => setSelectedVenue(v.venueId)} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: selectedVenue === v.venueId ? VENUE_COLOR[v.venueId] : '#fff',
                  color: selectedVenue === v.venueId ? '#fff' : '#555',
                  borderColor: selectedVenue === v.venueId ? VENUE_COLOR[v.venueId] : '#e8e6e0',
                }}>{v.venueName}</button>
              ))}
            </div>
          )}
        </div>

        {tab === 'stock' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {filteredVenues.map(venue => (
              <div key={venue.venueId} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', gap: 10, background: '#fafaf8' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: VENUE_COLOR[venue.venueId] }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{venue.venueName}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{venue.products.length} 種商品</span>
                  {venue.products.some(p => p.currentStock <= p.lowStockThreshold) && (
                    <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 7px', borderRadius: 6, marginLeft: 'auto' }}>
                      有商品庫存不足
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 0 }}>
                  {venue.products.map((p, i) => {
                    const isLow = p.currentStock <= p.lowStockThreshold
                    const isEmpty = p.currentStock === 0
                    const barWidth = Math.min((p.currentStock / (p.lowStockThreshold * 4)) * 100, 100)
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
                        borderTop: i === 0 ? 'none' : '1px solid #f5f4f0',
                        background: isEmpty ? '#fff5f5' : isLow ? '#fffbf0' : '#fff',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                            {!p.isShared && <span style={{ fontSize: 10, background: '#f0f0f0', color: '#666', padding: '1px 6px', borderRadius: 4 }}>本館獨有</span>}
                            {isEmpty && <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>已售罄</span>}
                            {!isEmpty && isLow && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 6 }}>庫存不足</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>單價 ${p.unitPrice}</div>
                        </div>

                        <div style={{ minWidth: 160 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: '#888' }}>庫存</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isEmpty ? '#991b1b' : isLow ? '#d97706' : '#1a1917' }}>
                              {p.currentStock}
                              <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}> / 水位 {p.lowStockThreshold}</span>
                            </span>
                          </div>
                          <div style={{ background: '#f0ede6', borderRadius: 4, height: 6 }}>
                            <div style={{
                              height: 6, borderRadius: 4,
                              width: `${barWidth}%`,
                              background: isEmpty ? '#991b1b' : isLow ? '#f59e0b' : '#10b981',
                              minWidth: isEmpty ? 0 : 4,
                            }} />
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: 80 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>${(p.currentStock * p.unitPrice).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: '#aaa' }}>庫存價值</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'transactions' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 80px 80px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
              <div>時間</div><div>球館</div><div>商品</div><div>類型</div><div style={{ textAlign: 'right' }}>數量</div><div style={{ textAlign: 'right' }}>金額</div><div>操作人員</div>
            </div>
            {MOCK_PRODUCT_TRANSACTIONS.map(tx => {
              const venue = MOCK_VENUE_PRODUCTS.find(v => v.venueId === tx.venueId)
              return (
                <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 80px 80px 80px 100px', padding: '12px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{tx.operatedAt.split('T')[1].slice(0,5)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: VENUE_COLOR[tx.venueId], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#555' }}>{venue?.venueName}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.productName}</div>
                    {tx.customerName && <div style={{ fontSize: 11, color: '#aaa' }}>{tx.customerName}</div>}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: TYPE_COLOR[tx.type].bg, color: TYPE_COLOR[tx.type].text, fontWeight: 500 }}>
                      {TYPE_LABEL[tx.type]}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: tx.quantity < 0 ? '#e85d3a' : '#059669' }}>
                    {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                    {tx.totalAmount ? `$${tx.totalAmount}` : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#555' }}>{tx.operatorName}</div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
