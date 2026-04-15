'use client'

import { useState } from 'react'

export default function ExportPage() {
  const [exporting, setExporting] = useState<string | null>(null)

  function mockExport(type: string) {
    setExporting(type)
    setTimeout(() => setExporting(null), 2000)
  }

  const reports = [
    { id: 'daily',    icon: '📅', title: '今日報表',     desc: '今日所有球館的收入、人次、付款明細',  badge: '最常用' },
    { id: 'weekly',   icon: '📊', title: '本週報表',     desc: '近 7 日各館收入趨勢與比較',           badge: null },
    { id: 'monthly',  icon: '📈', title: '本月報表',     desc: '本月完整財務統計與分析',              badge: null },
    { id: 'payment',  icon: '💳', title: '付款明細',     desc: '所有付款紀錄，含付款方式與狀態',      badge: null },
    { id: 'product',  icon: '📦', title: '商品流向報表', desc: '販售與贈送紀錄，含操作人員',          badge: '常用' },
    { id: 'customer', icon: '👤', title: '客戶消費報表', desc: '各客戶累計場次與消費金額',            badge: null },
  ]

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.exp-wrap{padding-top:64px !important}.exp-grid{grid-template-columns:1fr !important}}`}</style>
      <div className="exp-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>報表匯出</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>匯出 Excel / CSV 格式報表</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>篩選條件</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>球館</div>
              <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
                <option>所有球館</option>
                {['球魔方','Ace','飛翼','日日','Playone'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>開始日期</div>
              <input type="date" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }} defaultValue="2026-04-01" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>結束日期</div>
              <input type="date" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }} defaultValue="2026-04-15" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>格式</div>
              <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
                <option>Excel (.xlsx)</option>
                <option>CSV (.csv)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="exp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</span>
                  {r.badge && <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 6, fontWeight: 500 }}>{r.badge}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.desc}</div>
              </div>
              <button
                onClick={() => mockExport(r.id)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
                  background: exporting === r.id ? '#f0f0f0' : '#1a1917',
                  color: exporting === r.id ? '#888' : '#fff',
                }}
              >
                {exporting === r.id ? '匯出中...' : '匯出'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '14px 18px', marginTop: 16, fontSize: 12, color: '#888' }}>
          💡 正式上線後，報表將即時從資料庫產生，包含完整的歷史資料。目前為 Demo 展示版本。
        </div>
      </div>
    </div>
  )
}
