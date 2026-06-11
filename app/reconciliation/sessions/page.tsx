'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getCurrentVisibleVenueIds,
  getSessionReconciliation,
  listVenues,
  RECONCILIATION_PERIOD_LABEL,
  SESSION_RECON_STATUS_LABEL,
  type ReconciliationPeriod,
  type SessionReconciliationStatus,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import {
  ReconHeader, StatCard, Panel, Badge, Money, FilterButtons, VENUE_COLOR,
} from '@/components/reconciliation/Common'

const STATUS_BADGE_COLOR: Record<SessionReconciliationStatus, 'green' | 'red' | 'purple' | 'gray'> = {
  matched:   'green',
  shortfall: 'red',
  overpaid:  'purple',
  no_charge: 'gray',
}

export default function SessionReconciliationPage() {
  const [period, setPeriod]               = useState<ReconciliationPeriod>('week')
  const [venueId, setVenueId]             = useState<string>('all')
  const [onlyShortfall, setOnlyShortfall] = useState(false)

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

  const rows = useMemo(() => {
    const all = getSessionReconciliation({
      period,
      venueId: venueId === 'all' ? undefined : venueId,
      onlyShortfall,
    })
    if (visible === 'all') return all
    return all.filter(r => visible.includes(r.venueId))
  }, [period, venueId, onlyShortfall, visible])

  const totals = useMemo(() => ({
    sessionCount: rows.length,
    expected: rows.reduce((s, r) => s + r.expectedRevenue, 0),
    actual:   rows.reduce((s, r) => s + r.actualRevenue, 0),
    gap:      rows.reduce((s, r) => s + r.gap, 0),
    shortfallCount: rows.filter(r => r.gap > 0).length,
  }), [rows])

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .sr-wrap   { padding-top: 64px !important; }
          .sr-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .sr-filter { flex-direction: column !important; align-items: stretch !important; }
          .sr-table  { font-size: 11px !important; }
          .sr-table th, .sr-table td { padding: 8px 6px !important; }
        }
      `}</style>

      <div className="sr-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="場次對帳"
          subtitle="逐場應收 vs 實收，標出少收場次"
          backTo="/reconciliation"
        />

        {/* 篩選器 */}
        <div className="sr-filter" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterButtons
            options={[
              { value: 'week',   label: RECONCILIATION_PERIOD_LABEL.week },
              { value: 'month',  label: RECONCILIATION_PERIOD_LABEL.month },
              { value: 'season', label: RECONCILIATION_PERIOD_LABEL.season },
              { value: 'all',    label: RECONCILIATION_PERIOD_LABEL.all },
            ]}
            value={period}
            onChange={setPeriod}
          />

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

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyShortfall}
              onChange={e => setOnlyShortfall(e.target.checked)}
            />
            只看少收場次
          </label>
        </div>

        {/* KPI */}
        <div className="sr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="場次數"   value={`${totals.sessionCount} 場`}                   accent="#2563eb" />
          <StatCard label="總應收"   value={`$${totals.expected.toLocaleString()}`}        accent="#d4a843" />
          <StatCard label="總實收"   value={`$${totals.actual.toLocaleString()}`}          accent="#10b981" />
          <StatCard
            label="總缺口"
            value={`$${totals.gap.toLocaleString()}`}
            sub={totals.shortfallCount > 0 ? `${totals.shortfallCount} 場少收` : '全數對齊'}
            intent={totals.gap > 0 ? 'danger' : 'default'}
            accent="#e85d3a"
          />
        </div>

        {/* 表格 */}
        <Panel title={`場次明細（${RECONCILIATION_PERIOD_LABEL[period]}・${rows.length} 場）`}>
          {rows.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
              此條件下沒有場次資料
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0ede6', textAlign: 'left' }}>
                    <th style={th}>日期</th>
                    <th style={th}>時段</th>
                    <th style={th}>球館</th>
                    <th style={th}>類型</th>
                    <th style={{ ...th, textAlign: 'right' }}>應收總額</th>
                    <th style={{ ...th, textAlign: 'right' }}>應收(臨打)</th>
                    <th style={{ ...th, textAlign: 'right' }}>實收</th>
                    <th style={{ ...th, textAlign: 'right' }}>缺口</th>
                    <th style={{ ...th, textAlign: 'center' }}>狀態</th>
                    <th style={{ ...th, textAlign: 'center' }}>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const totalPlayers = r.walkInCount + r.substituteCount + r.seasonPlayerCount
                    return (
                      <tr key={r.sessionId} style={{ borderBottom: '1px solid #f5f4f0' }}>
                        <td style={td}>
                          <div style={{ fontWeight: 500 }}>{r.sessionDate.slice(5)}</div>
                          <div style={{ fontSize: 10, color: '#888' }}>{r.sessionDate.slice(0, 4)}</div>
                        </td>
                        <td style={td}>{r.startTime}–{r.endTime}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: VENUE_COLOR[r.venueId] || '#999' }} />
                            {r.venueName}
                          </div>
                        </td>
                        <td style={td}>
                          <div style={{ fontSize: 12 }}>
                            {r.seasonPlayerCount > 0 && <span style={{ color: '#7c6af7' }}>季{r.seasonPlayerCount} </span>}
                            {r.substituteCount > 0  && <span style={{ color: '#d97706' }}>補{r.substituteCount} </span>}
                            {r.walkInCount > 0      && <span style={{ color: '#1a1917' }}>臨{r.walkInCount}</span>}
                            {totalPlayers === 0     && <span style={{ color: '#aaa' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <Money value={r.grossExpectedRevenue} muted={r.grossExpectedRevenue === 0} />
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <Money value={r.expectedRevenue} muted={r.expectedRevenue === 0} />
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <Money value={r.actualRevenue} muted={r.actualRevenue === 0} />
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {r.gap > 0
                            ? <Money value={r.gap} danger />
                            : r.gap < 0
                              ? <span style={{ color: '#7c6af7' }}>+${Math.abs(r.gap).toLocaleString()}</span>
                              : <span style={{ color: '#aaa' }}>—</span>
                          }
                          {r.unpaidCount > 0 && (
                            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{r.unpaidCount} 人未繳</div>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <Badge color={STATUS_BADGE_COLOR[r.status]}>
                            {SESSION_RECON_STATUS_LABEL[r.status]}
                          </Badge>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          {r.isUnattended && <span title="無人場次" style={{ fontSize: 14 }}>🤖</span>}
                          {r.hasSelfReportMismatch && <span title="自助回報異常" style={{ fontSize: 14 }}>⚠️</span>}
                          {r.acEnabled && <span title={`冷氣費 $${r.acFee}/人`} style={{ fontSize: 14, marginLeft: 4 }}>❄️</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 }}>
          應收總額 = 全部報名人數 × (球費 + 冷氣費)　|　應收(臨打) = 臨打 + 補位 人數 × (球費 + 冷氣費)，季打人員季初已繳故不計　|　實收 = sum(Payment.amount)
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 8px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }
const td: React.CSSProperties = { padding: '10px 8px', verticalAlign: 'middle' }
