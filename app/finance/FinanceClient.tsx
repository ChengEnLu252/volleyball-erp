'use client'

// 財務報表（client）。資料由 server 殼以 props 傳入（已 scope，真 Payment 彙總）。
// 期間（今日/本週/本月）以 ?period= 重新 SSR；其餘純渲染。

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { VENUE_COLOR } from '@/components/reconciliation/Common'
import type { FinanceReportBundle } from '@/data/server/queries'

const PERIOD_LABEL: Record<string, string> = { today: '今日', week: '本週', month: '本月' }
const METHOD_LABEL: Record<string, string> = { cash: '現金', transfer: '轉帳', online: '線上' }
const METHOD_COLOR: Record<string, string> = { cash: '#7c6af7', transfer: '#0ea5e9', online: '#10b981' }

export default function FinanceClient({ report }: { report: FinanceReportBundle | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const period = report?.period ?? 'week'
  const changePeriod = (p: string) => startTransition(() => router.replace(`/finance?period=${p}`))

  if (!report) return <div style={{ padding: 24, color: '#888' }}>無權限或尚未登入。</div>

  const maxRevenue = Math.max(1, ...report.days.map((d) => d.revenue))
  const pl = PERIOD_LABEL[period]

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.fin-wrap{padding-top:64px !important}.fin-grid{grid-template-columns:1fr !important}}`}</style>
      <div className="fin-wrap" style={{ paddingTop: 0, opacity: pending ? 0.6 : 1 }}>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>財務報表</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>收入統計與分析 · {report.rangeFrom} ~ {report.rangeTo}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/reconciliation" style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#1a1917', color: '#d4a843', textDecoration: 'none', whiteSpace: 'nowrap' }}>💰 進入對帳系統 →</Link>
            <div style={{ display: 'flex', gap: 4, background: '#f5f4f0', borderRadius: 10, padding: 4 }}>
              {(['today', 'week', 'month'] as const).map((p) => (
                <button key={p} onClick={() => changePeriod(p)} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: period === p ? '#fff' : 'transparent', color: period === p ? '#1a1917' : '#888', boxShadow: period === p ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{PERIOD_LABEL[p]}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: `${pl}總收入`, value: `$${report.totalRevenue.toLocaleString()}`, sub: `${report.days.length} 天合計`, accent: '#d4a843' },
            { label: '平均日收入', value: `$${report.avgDailyRevenue.toLocaleString()}`, sub: '每日平均', accent: '#2563eb' },
            { label: `${pl}出席人次`, value: `${report.totalPlayers.toLocaleString()} 人`, sub: `${report.totalSessions} 場`, accent: '#059669' },
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{pl}每日收入</div>
            {report.days.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>此期間無收入資料</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: report.days.length > 14 ? 3 : 8, height: 140, overflowX: 'auto' }}>
                {report.days.map((d, i) => {
                  const last = i === report.days.length - 1
                  return (
                    <div key={d.date} style={{ flex: 1, minWidth: report.days.length > 14 ? 12 : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {report.days.length <= 14 && <div style={{ fontSize: 10, color: '#888' }}>${Math.round(d.revenue / 1000)}K</div>}
                      <div title={`${d.date}　$${d.revenue.toLocaleString()}　${d.players} 人`} style={{ width: '100%', borderRadius: 6, background: last ? '#1a1917' : '#e8e6e0', height: `${(d.revenue / maxRevenue) * 100}px`, minHeight: 4, transition: 'height .3s' }} />
                      {report.days.length <= 14 && <div style={{ fontSize: 10, color: last ? '#1a1917' : '#aaa', fontWeight: last ? 700 : 400 }}>{d.date.slice(5)}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>付款方式分佈</div>
            {report.paymentBreakdown.every((p) => p.amount === 0) ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#aaa', fontSize: 12 }}>此期間無收款</div>
            ) : report.paymentBreakdown.map((p) => (
              <div key={p.method} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{METHOD_LABEL[p.method]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.ratio}%</span>
                </div>
                <div style={{ background: '#f0ede6', borderRadius: 4, height: 6 }}>
                  <div style={{ height: 6, borderRadius: 4, width: `${p.ratio}%`, background: METHOD_COLOR[p.method] }} />
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>${p.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600 }}>各館收入明細（{pl}）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
            <div>球館</div><div style={{ textAlign: 'right' }}>收入</div><div style={{ textAlign: 'right' }}>人次</div><div style={{ textAlign: 'right' }}>場次</div><div style={{ textAlign: 'right' }}>未收款</div>
          </div>
          {report.venueSummaries.length === 0 ? (
            <div style={{ padding: '24px 20px', color: '#aaa', fontSize: 13, textAlign: 'center' }}>此期間無場次</div>
          ) : report.venueSummaries.map((v) => (
            <div key={v.venueId} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '14px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: VENUE_COLOR[v.venueId] ?? '#999' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v.venueName}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>${v.totalRevenue.toLocaleString()}</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{v.totalPlayers} 人</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#555' }}>{v.totalSessions} 場</div>
              <div style={{ textAlign: 'right', fontSize: 13, color: v.unpaidAmount > 0 ? '#e85d3a' : '#888', fontWeight: v.unpaidAmount > 0 ? 600 : 400 }}>{v.unpaidAmount > 0 ? `$${v.unpaidAmount.toLocaleString()}` : '—'}</div>
            </div>
          ))}
          {report.venueSummaries.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 100px', padding: '14px 20px', borderTop: '2px solid #e8e6e0', alignItems: 'center', gap: 12, background: '#fafaf8' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>合計</div>
              <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700 }}>${report.totalRevenue.toLocaleString()}</div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{report.totalPlayers} 人</div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{report.totalSessions} 場</div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#e85d3a' }}>${report.venueSummaries.reduce((s, v) => s + v.unpaidAmount, 0).toLocaleString()}</div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
