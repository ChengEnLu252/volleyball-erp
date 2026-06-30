'use client'

// 報表匯出（client）。球館清單由 server 殼以 props 傳入（已 scope）。
// 匯出走 exportReportAction（真 DB → CSV 字串）→ 前端用 Blob 觸發下載。
// 商品流向報表待 P2.4 商品模組，先停用。

import { useState } from 'react'
import { exportReportAction } from '@/app/actions/reports'
import type { ReportType } from '@/data/server/queries'

type Report = { id: ReportType; icon: string; title: string; desc: string; badge: string | null }

const REPORTS: Report[] = [
  { id: 'revenue_daily', icon: '📅', title: '收入明細（每日×球館）', desc: '區間內每日各館的場次、人次、收入與付款方式', badge: '最常用' },
  { id: 'venue_summary', icon: '📊', title: '球館彙總報表',           desc: '整段期間各館合計收入、未收與付款方式',         badge: null },
  { id: 'payment',       icon: '💳', title: '付款明細',               desc: '每一筆收款紀錄，含付款方式、狀態與收款人',     badge: null },
  { id: 'customer',      icon: '👤', title: '客戶消費報表',           desc: '各客戶在區間內的場次數與累計消費',             badge: null },
]

// 今天往前 30 天，給合理預設區間
function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 86400000)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  return { from: ymd(from), to: ymd(to) }
}

export default function PaymentsExportClient({ venues }: { venues: { id: string; name: string }[] }) {
  const def = defaultRange()
  const [venueId, setVenueId] = useState<string>('all')
  const [from, setFrom] = useState(def.from)
  const [to, setTo] = useState(def.to)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function runExport(type: ReportType) {
    setBusy(type); setMsg(null)
    try {
      const res = await exportReportAction({ type, venueId, from, to })
      if (!res.ok) { setMsg({ type: 'err', text: res.reason }); return }
      if (res.rowCount === 0) { setMsg({ type: 'err', text: '此條件下沒有資料，未產生檔案' }); return }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setMsg({ type: 'ok', text: `已匯出 ${res.filename}（${res.rowCount} 列）` })
    } catch {
      setMsg({ type: 'err', text: '匯出失敗，請稍後再試' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.exp-wrap{padding-top:64px !important}.exp-grid{grid-template-columns:1fr !important}}`}</style>
      <div className="exp-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>報表匯出</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>由資料庫即時產生 CSV（可用 Excel 開啟）</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>篩選條件</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>球館</div>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
                <option value="all">所有球館</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>開始日期</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>結束日期</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }} />
            </div>
          </div>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, fontSize: 13, background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
            {msg.type === 'ok' ? '✅ ' : '⚠️ '}{msg.text}
          </div>
        )}

        <div className="exp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {REPORTS.map((r) => (
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
                onClick={() => runExport(r.id)}
                disabled={busy !== null}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
                  background: busy === r.id ? '#f0f0f0' : '#1a1917',
                  color: busy === r.id ? '#888' : '#fff', opacity: busy && busy !== r.id ? 0.5 : 1,
                }}
              >
                {busy === r.id ? '匯出中...' : '匯出 CSV'}
              </button>
            </div>
          ))}

          {/* 商品流向報表 — 待 P2.4 商品模組 */}
          <div style={{ background: '#faf9f6', borderRadius: 12, border: '1px dashed #e0ddd5', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 28, flexShrink: 0, opacity: 0.5 }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#aaa', marginBottom: 3 }}>商品流向報表</div>
              <div style={{ fontSize: 12, color: '#bbb' }}>販售與贈送紀錄 — 待商品模組（P2.4）接上後開放</div>
            </div>
            <span style={{ fontSize: 11, color: '#aaa', padding: '4px 10px', background: '#f0ede6', borderRadius: 6 }}>即將推出</span>
          </div>
        </div>

      </div>
    </div>
  )
}
