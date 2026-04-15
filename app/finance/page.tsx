'use client'

import { useState } from 'react'
import { MOCK_VENUE_SUMMARIES } from '@/data/mock'

const WEEKLY: { date: string; revenue: number; players: number }[] = [
  { date: '04/08', revenue: 32600, players: 58 },
  { date: '04/09', revenue: 35200, players: 63 },
  { date: '04/10', revenue: 28800, players: 51 },
  { date: '04/11', revenue: 41200, players: 74 },
  { date: '04/12', revenue: 38400, players: 69 },
  { date: '04/13', revenue: 44800, players: 80 },
  { date: '04/14', revenue: 37720, players: 73 },
]

const VENUE_COLOR: Record<string, string> = {
  v1: '#7c6af7', v2: '#0ea5e9', v3: '#f59e0b', v4: '#10b981', v5: '#f43f5e',
}

const PAYMENT_BREAKDOWN = [
  { method: '現金', amount: 18500, ratio: 49 },
  { method: '轉帳', amount: 14200, ratio: 38 },
  { method: '線上', amount: 5020,  ratio: 13 },
]

export default function FinancePage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')
  const totalRevenue = WEEKLY.reduce((s, d) => s + d.revenue, 0)
  const maxRevenue = Math.max(...WEEKLY.map(d => d.revenue))

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.fin-wrap{padding-top:64px !important}.fin-grid{grid-template-columns:1fr !important}}`}</style>
      <div className="fin-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>財務報表</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>收入統計與分析</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4 }}>
            {(['today', 'week', 'month'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: period === p ? '#fff' : 'transparent',
                color: period === p ? '#1a1917' : '#888',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>
                {p === 'today' ? '今日' : p === 'week' ? '本週' : '本月'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: '本週總收入', value: `$${totalRevenue.toLocaleString()}`, sub: '7 天合計', accent: '#d4a843' },
            { label: '平均日收入', value: `$${Math.round(totalRevenue/7).toLocaleString()}`, sub: '每日平均', accent: '#2563eb' },
            { label: '本週出席人次', value: `${WEEKLY.reduce((s,d)=>s+d.players,0)} 人`, sub: '日均 67 人', accent: '#059669' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e8e6e0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-1px' }}>{c.value}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{c.sub}</div>
              <div style={{ position: 'absolute', top: 16, right: 16, width: 4, height: 36, borderRadius: 2, background: c.accent }} />
            </div>
          ))}
        </div>

        <div className="fin-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>本週每日收入</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {WEEKLY.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: '#888' }}>${Math.round(d.revenue/1000)}K</div>
                  <div style={{ width: '100%', borderRadius: 6, background: i === 6 ? '#1a1917' : '#e8e6e0', height: `${(d.revenue / maxRevenue) * 100}px`, minHeight: 8, transition: 'height .3s' }} />
                  <div style={{ fontSize: 10, color: i === 6 ? '#1a1917' : '#aaa', fontWeight: i === 6 ? 700 : 400 }}>{d.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>付款方式分佈</div>
            {PAYMENT_BREAKDOWN.map((p, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{p.method}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.ratio}%</span>
                </div>
                <div style={{ background: '#f0ede6', borderRadius: 4, height: 6 }}>
                  <div style={{ height: 6, borderRadius: 4, width: `${p.ratio}%`, background: ['#7c6af7','#0ea5e9','#10b981'][i] }} />
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>${p.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600 }}>各館今日收入明細</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
            <div>球館</div><div style={{ textAlign: 'right' }}>收入</div><div style={{ textAlign: 'right' }}>人次</div><div style={{ textAlign: 'right' }}>場次</div><div style={{ textAlign: 'right' }}>未收款</div>
          </div>
          {MOCK_VENUE_SUMMARIES.map(v => (
            <div key={v.venueId} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '14px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: VENUE_COLOR[v.venueId] }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v.venueName}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>${v.totalRevenue.toLocaleString()}</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{v.totalPlayers} 人</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{v.totalSessions} 場</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: v.unpaidAmount > 0 ? '#e85d3a' : '#888', fontWeight: v.unpaidAmount > 0 ? 600 : 400 }}>
                {v.unpaidAmount > 0 ? `$${v.unpaidAmount.toLocaleString()}` : '—'}
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '14px 20px', borderTop: '2px solid #e8e6e0', alignItems: 'center', gap: 12, background: '#fafaf8' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>合計</div>
            <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700 }}>${MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.totalRevenue,0).toLocaleString()}</div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.totalPlayers,0)} 人</div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.totalSessions,0)} 場</div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#e85d3a' }}>${MOCK_VENUE_SUMMARIES.reduce((s,v)=>s+v.unpaidAmount,0).toLocaleString()}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
