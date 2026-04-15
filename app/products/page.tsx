'use client'

import { useState } from 'react'
import { MOCK_PRODUCTS, MOCK_PRODUCT_TRANSACTIONS } from '@/data/mock'

const TYPE_LABEL: Record<string, string> = {
  purchase_in: '進貨', sale: '販售', gift: '贈送', adjustment: '盤點調整',
}
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  purchase_in: { bg: '#dbeafe', text: '#1e40af' },
  sale:        { bg: '#dcfce7', text: '#166534' },
  gift:        { bg: '#fce7f3', text: '#9d174d' },
  adjustment:  { bg: '#f3f4f6', text: '#6b7280' },
}

export default function ProductsPage() {
  const [tab, setTab] = useState<'stock' | 'transactions'>('stock')

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.prod-wrap{padding-top:64px !important}}`}</style>
      <div className="prod-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>商品管理</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>庫存狀況與商品流向紀錄</p>
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
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
          <div style={{ display: 'grid', gap: 10 }}>
            {MOCK_PRODUCTS.map(p => {
              const ratio = p.currentStock / (p.lowStockThreshold * 4)
              const isLow = p.currentStock <= p.lowStockThreshold
              return (
                <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isLow ? '#fca5a5' : '#e8e6e0'}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                      {isLow && <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 7px', borderRadius: 6, fontWeight: 500 }}>庫存不足</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>SKU: {p.sku} · 單價 ${p.unitPrice}</div>
                  </div>

                  <div style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>庫存</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isLow ? '#e85d3a' : '#1a1917' }}>
                        {p.currentStock} <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>/ 安全水位 {p.lowStockThreshold}</span>
                      </span>
                    </div>
                    <div style={{ background: '#f0ede6', borderRadius: 4, height: 6 }}>
                      <div style={{ height: 6, borderRadius: 4, width: `${Math.min(ratio * 100, 100)}%`, background: isLow ? '#e85d3a' : '#10b981' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${(p.currentStock * p.unitPrice).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>庫存價值</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'transactions' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
              <div>時間</div><div>商品</div><div>類型</div><div style={{ textAlign: 'right' }}>數量</div><div style={{ textAlign: 'right' }}>金額</div><div>操作人員</div>
            </div>
            {MOCK_PRODUCT_TRANSACTIONS.map(tx => (
              <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 80px 80px 100px', padding: '12px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 11, color: '#888' }}>{tx.operatedAt.split('T')[1].slice(0,5)}</div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
