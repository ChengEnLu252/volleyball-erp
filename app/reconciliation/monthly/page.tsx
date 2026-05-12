'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getCurrentVisibleVenueIds,
  getMonthlyReconciliation,
  listSeasons,
  type MonthlyGrain,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, FilterButtons, Money, VENUE_COLOR,
} from '@/components/reconciliation/Common'

// 產生最近 6 個月的選項（含本月）
function recentMonths(today: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const y = today.getFullYear()
  const m = today.getMonth()  // 0-indexed
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
    out.push({ key, label })
  }
  return out
}

export default function MonthlyReconciliationPage() {
  const [grain, setGrain]   = useState<MonthlyGrain>('month')
  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => recentMonths(today), [today])
  const seasonOptions = useMemo(() => listSeasons().map(s => ({
    key: s.id,
    label: `${s.name}（${s.startDate.slice(5).replace('-', '/')} – ${s.endDate.slice(5).replace('-', '/')}）${s.isActive ? ' ★' : ''}`,
  })), [])

  const [monthKey, setMonthKey]   = useState<string>(monthOptions[0].key)
  const [seasonKey, setSeasonKey] = useState<string>(
    listSeasons().find(s => s.isActive)?.id ?? listSeasons()[0]?.id ?? '',
  )

  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  const result = useMemo(() => {
    const key = grain === 'month' ? monthKey : seasonKey
    const full = getMonthlyReconciliation(grain, key)
    if (visible === 'all') return full
    // 過濾 rows 並重算 totals
    const rows = full.rows.filter(r => visible.includes(r.venueId))
    const totals = {
      sessionExpected:  rows.reduce((s, r) => s + r.sessionExpected,  0),
      sessionActual:    rows.reduce((s, r) => s + r.sessionActual,    0),
      rentalAllocated:  rows.reduce((s, r) => s + r.rentalAllocated,  0),
      rentalActualPaid: rows.reduce((s, r) => s + r.rentalActualPaid, 0),
      productRevenue:   rows.reduce((s, r) => s + r.productRevenue,   0),
      productGiftValue: rows.reduce((s, r) => s + r.productGiftValue, 0),
      totalExpected:    rows.reduce((s, r) => s + r.totalExpected,    0),
      totalActual:      rows.reduce((s, r) => s + r.totalActual,      0),
      totalGap:         rows.reduce((s, r) => s + r.totalGap,         0),
    }
    return { ...full, rows, totals }
  }, [grain, monthKey, seasonKey, visible])

  const collectionRate = result.totals.totalExpected > 0
    ? Math.round((result.totals.totalActual / result.totals.totalExpected) * 1000) / 10
    : 100

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .mr-wrap   { padding-top: 64px !important; }
          .mr-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .mr-filter { flex-direction: column !important; align-items: stretch !important; }
          .mr-table  { font-size: 11px !important; }
          .mr-table th, .mr-table td { padding: 8px 6px !important; }
        }
      `}</style>

      <div className="mr-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="月結對帳"
          subtitle="老闆視角：各館月度匯總（場地 + 季租單 + 商品）"
          backTo="/reconciliation"
        />

        {/* 切換 grain + 期間 */}
        <div className="mr-filter" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterButtons
            options={[
              { value: 'month',  label: '依月份' },
              { value: 'season', label: '依季' },
            ]}
            value={grain}
            onChange={setGrain}
          />
          {grain === 'month' ? (
            <select
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0',
                fontSize: 13, background: '#fff', cursor: 'pointer',
              }}
            >
              {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          ) : (
            <select
              value={seasonKey}
              onChange={e => setSeasonKey(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0',
                fontSize: 13, background: '#fff', cursor: 'pointer',
              }}
            >
              {seasonOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#888' }}>
            {result.rangeFrom} ~ {result.rangeTo}
          </span>
        </div>

        {/* KPI */}
        <div className="mr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard
            label="期間應收"
            value={`$${result.totals.totalExpected.toLocaleString()}`}
            sub={result.periodLabel}
            accent="#d4a843"
          />
          <StatCard
            label="期間實收"
            value={`$${result.totals.totalActual.toLocaleString()}`}
            sub={`收款率 ${collectionRate}%`}
            accent="#10b981"
          />
          <StatCard
            label="期間缺口"
            value={`$${result.totals.totalGap.toLocaleString()}`}
            sub={result.totals.totalGap > 0 ? '需追討' : '已全數收齊'}
            intent={result.totals.totalGap > 0 ? 'danger' : 'default'}
            accent="#e85d3a"
          />
          <StatCard
            label="贈送等值損失"
            value={`$${result.totals.productGiftValue.toLocaleString()}`}
            sub="商品贈送（不入帳）"
            intent="warning"
            accent="#f59e0b"
          />
        </div>

        {/* 月結表格 */}
        <Panel title={`各館月結（${result.periodLabel}）`}>
          {result.rows.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
              此期間無資料
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="mr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0ede6', textAlign: 'left' }}>
                    <th style={th}>球館</th>
                    <th style={{ ...th, textAlign: 'center' }}>場次</th>
                    <th style={{ ...th, textAlign: 'right' }}>場地應收</th>
                    <th style={{ ...th, textAlign: 'right' }}>場地實收</th>
                    <th style={{ ...th, textAlign: 'right' }}>季租單應收</th>
                    <th style={{ ...th, textAlign: 'right' }}>季租單實收</th>
                    <th style={{ ...th, textAlign: 'right' }}>商品收入</th>
                    <th style={{ ...th, textAlign: 'right', background: '#fafaf8' }}>總應收</th>
                    <th style={{ ...th, textAlign: 'right', background: '#fafaf8' }}>總實收</th>
                    <th style={{ ...th, textAlign: 'right', background: '#fafaf8' }}>缺口</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(r => (
                    <tr key={r.venueId} style={{ borderBottom: '1px solid #f5f4f0' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: VENUE_COLOR[r.venueId] || '#999' }} />
                          <span style={{ fontWeight: 500 }}>{r.venueName}</span>
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'center', color: '#888' }}>{r.sessionCount}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Money value={r.sessionExpected} muted={r.sessionExpected === 0} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Money value={r.sessionActual} muted={r.sessionActual === 0} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Money value={r.rentalAllocated} muted={r.rentalAllocated === 0} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Money value={r.rentalActualPaid} muted={r.rentalActualPaid === 0} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Money value={r.productRevenue} muted={r.productRevenue === 0} />
                        {r.productGiftValue > 0 && (
                          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                            贈損 ${r.productGiftValue.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right', background: '#fafaf8', fontWeight: 600 }}>
                        ${r.totalExpected.toLocaleString()}
                      </td>
                      <td style={{ ...td, textAlign: 'right', background: '#fafaf8', fontWeight: 600 }}>
                        ${r.totalActual.toLocaleString()}
                      </td>
                      <td style={{ ...td, textAlign: 'right', background: '#fafaf8' }}>
                        {r.totalGap > 0
                          ? <Money value={r.totalGap} danger />
                          : <span style={{ color: '#10b981', fontWeight: 600 }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {/* 加總行 */}
                  <tr style={{ borderTop: '2px solid #1a1917', background: '#1a1917', color: '#f5f4f0' }}>
                    <td style={{ ...td, fontWeight: 700, color: '#d4a843' }}>合計</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {result.rows.reduce((s, r) => s + r.sessionCount, 0)}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${result.totals.sessionExpected.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${result.totals.sessionActual.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${result.totals.rentalAllocated.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${result.totals.rentalActualPaid.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${result.totals.productRevenue.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#d4a843' }}>
                      ${result.totals.totalExpected.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#d4a843' }}>
                      ${result.totals.totalActual.toLocaleString()}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: result.totals.totalGap > 0 ? '#fb923c' : '#10b981' }}>
                      ${result.totals.totalGap.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 }}>
          季租單應收/實收按「期間內 session 數 / 該季租單總 session 數」比例分攤　|　商品收入只算 sale，gift 顯示為損失
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 8px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }
