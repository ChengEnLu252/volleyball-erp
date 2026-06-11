'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentVisibleVenueIds,
  listVenues,
} from '@/data/api'
import { useStoreSync, hydrateStore } from '@/data/store'
import {
  getLedgerReconciliation,
  getLedgerMonth,
  weekdayOf,
  type LedgerCompareCell,
} from '@/data/ledger'
import {
  ReconHeader, StatCard, Panel, FilterButtons, Money,
} from '@/components/reconciliation/Common'

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']
type Grain = 'daily' | 'monthly'

function recentMonths(today: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const y = today.getFullYear(), m = today.getMonth()
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ key, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月` })
  }
  return out
}

export default function LedgerReviewPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); hydrateStore() }, [])

  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => recentMonths(today), [today])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    return visible === 'all' ? all : all.filter(v => visible.includes(v.id))
  }, [visible])

  const [venueId, setVenueId] = useState('')
  const [ym, setYm] = useState(monthOptions[0].key)
  const [grain, setGrain] = useState<Grain>('daily')

  useEffect(() => {
    if (!venueId && venues.length > 0) setVenueId(venues[0].id)
  }, [venues, venueId])

  const recon = useMemo(
    () => (mounted && venueId) ? getLedgerReconciliation(venueId, ym) : null,
    [mounted, venueId, ym, sv],
  )
  const monthInfo = useMemo(
    () => (mounted && venueId) ? getLedgerMonth(venueId, ym) : null,
    [mounted, venueId, ym, sv],
  )

  if (!mounted) return <div style={{ padding: 24 }} />

  if (venues.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <ReconHeader title="月記帳對帳" subtitle="老闆對帳視角" backTo="/reconciliation" />
        <Panel><div style={{ padding: 24, color: '#888', fontSize: 13 }}>沒有可對帳的球館。</div></Panel>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .lr-wrap   { padding-top: 64px !important; }
          .lr-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .lr-table  { font-size: 11px !important; }
          .lr-table th, .lr-table td { padding: 7px 5px !important; }
        }
      `}</style>

      <div className="lr-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="月記帳對帳"
          subtitle="老闆視角：館長填的數字 vs 系統既有資料，差異自動標紅"
          backTo="/reconciliation"
          actions={
            <a href="/reconciliation/ledger" style={{
              fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 600,
              border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 12px', background: '#ecfdf5',
            }}>去記帳輸入 →</a>
          }
        />

        {/* 控制列 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <select value={venueId} onChange={e => setVenueId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={ym} onChange={e => setYm(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
            {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <FilterButtons
            options={[{ value: 'daily', label: '逐日' }, { value: 'monthly', label: '逐月' }]}
            value={grain}
            onChange={setGrain}
          />
        </div>

        {recon && monthInfo && (
          <>
            {/* KPI */}
            <div className="lr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              <StatCard label="已填天數" value={`${monthInfo.summary.filledDays} 天`}
                sub={`回報完畢 ${monthInfo.summary.reportedDays} 天`} accent="#2563eb" />
              <StatCard label="差異格數" value={`${recon.totals.flaggedCells} 格`}
                sub="場地/商品/退款逐日" intent={recon.totals.flaggedCells > 0 ? 'danger' : 'default'} accent="#e85d3a" />
              <StatCard label="場地費差異" value={fmtDiff(recon.totals.court)}
                sub={`館長 $${recon.totals.court.ledger.toLocaleString()}`}
                intent={isFlagged(recon.totals.court) ? 'danger' : 'default'} accent="#7c6af7" />
              <StatCard label="商品差異" value={fmtDiff(recon.totals.merch)}
                sub={`館長 $${recon.totals.merch.ledger.toLocaleString()}`}
                intent={isFlagged(recon.totals.merch) ? 'danger' : 'default'} accent="#f59e0b" />
            </div>

            {recon.empty && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#9a3412', marginBottom: 12 }}>
                本月此球館尚無館長記帳資料。下表僅顯示系統側數字（館長欄為 0）。
              </div>
            )}

            {/* 逐日表 */}
            {grain === 'daily' && (
              <Panel title="逐日對帳（場地費 / 商品 / 退款）">
                {recon.daily.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>本月無資料</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="lr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f0ede6' }}>
                          <th style={th}>日期</th>
                          <th style={thG} colSpan={3}>場地費</th>
                          <th style={thG} colSpan={3}>商品</th>
                          <th style={thG} colSpan={3}>退款</th>
                          <th style={{ ...th, textAlign: 'center' }}>回報</th>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f0ede6' }}>
                          <th style={thSub}></th>
                          {['館長', '系統', '差', '館長', '系統', '差', '館長', '系統', '差'].map((h, i) => (
                            <th key={i} style={{ ...thSub, borderLeft: i % 3 === 0 ? '1px solid #f0ede6' : 'none' }}>{h}</th>
                          ))}
                          <th style={thSub}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recon.daily.map(r => {
                          const wd = r.weekday
                          return (
                            <tr key={r.date} style={{ borderBottom: '1px solid #f7f6f2' }}>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                <span style={{ color: (wd === 0 || wd === 6) ? '#e85d3a' : '#1a1917', fontWeight: 500 }}>
                                  {Number(r.date.slice(-2))}（{WEEKDAY_LABEL[wd]}）
                                </span>
                              </td>
                              {cellTriple(r.court, true)}
                              {cellTriple(r.merch, false)}
                              {cellTriple(r.refund, false)}
                              <td style={{ ...td, textAlign: 'center' }}>
                                {r.hasLedger ? (r.reported ? '✓' : '–') : ''}
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{ borderTop: '2px solid #1a1917', background: '#fafaf8', fontWeight: 700 }}>
                          <td style={td}>月計</td>
                          {cellTriple(recon.totals.court, true)}
                          {cellTriple(recon.totals.merch, false)}
                          {cellTriple(recon.totals.refund, false)}
                          <td style={td}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}

            {/* 逐月：三個逐日桶的月加總 */}
            {grain === 'monthly' && (
              <Panel title="逐月對帳（月加總）">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0ede6', textAlign: 'left' }}>
                      <th style={th}>項目</th>
                      <th style={{ ...th, textAlign: 'right' }}>館長</th>
                      <th style={{ ...th, textAlign: 'right' }}>系統</th>
                      <th style={{ ...th, textAlign: 'right' }}>差異</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRow('場地費', recon.totals.court)}
                    {monthlyRow('商品', recon.totals.merch)}
                    {monthlyRow('退款', recon.totals.refund)}
                  </tbody>
                </table>
              </Panel>
            )}

            {/* 逐月桶（誠實商店 / 季打）— 永遠顯示，因系統僅有月資料 */}
            <Panel title="逐月比對（系統僅月資料）">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0ede6', textAlign: 'left' }}>
                    <th style={th}>項目</th>
                    <th style={{ ...th, textAlign: 'right' }}>館長</th>
                    <th style={{ ...th, textAlign: 'right' }}>系統</th>
                    <th style={{ ...th, textAlign: 'right' }}>差異</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.monthly.map(m => (
                    <tr key={m.key} style={{ borderBottom: '1px solid #f5f4f0' }}>
                      <td style={td}>{m.label}</td>
                      <td style={{ ...td, textAlign: 'right' }}>${m.ledger.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#888' }}>
                        {m.system === null ? '系統無對應資料' : `$${m.system.toLocaleString()}`}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {m.diff === null
                          ? <span style={{ color: '#aaa' }}>—</span>
                          : <Money value={m.diff} danger={m.diff !== 0} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            {/* 只存不比 */}
            <Panel title="只記錄、不比對（系統無對應資料）">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '6px 0' }}>
                <RO label="包場預付" value={recon.storeOnly.privatePrepay} />
                <RO label="冷氣費" value={recon.storeOnly.acFee} />
                <RO label="其他" value={recon.storeOnly.other} />
                <RO label="冷氣度數" value={recon.storeOnly.acDegrees} suffix=" 度" money={false} />
                <RO label={`冷氣試算（一度 ${recon.rate} 元）`} value={recon.storeOnly.acEstimate} />
                <RO label="盤損（冷氣費 − 試算）" value={recon.storeOnly.acLoss} />
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

function isFlagged(c: LedgerCompareCell): boolean {
  return c.diff !== null && c.diff !== 0
}
function fmtDiff(c: LedgerCompareCell): string {
  if (c.diff === null) return '—'
  const s = c.diff > 0 ? '+' : c.diff < 0 ? '-' : ''
  return `${s}$${Math.abs(c.diff).toLocaleString()}`
}

/** 一個桶的「館長 / 系統 / 差」三格（td） */
function cellTriple(c: LedgerCompareCell, leftBorder: boolean) {
  const flagged = c.diff !== null && c.diff !== 0
  return (
    <>
      <td style={{ ...td, textAlign: 'right', borderLeft: leftBorder ? '1px solid #f0ede6' : '1px solid #f7f6f2' }}>
        {c.ledger.toLocaleString()}
      </td>
      <td style={{ ...td, textAlign: 'right', color: '#888' }}>
        {c.system === null ? '—' : c.system.toLocaleString()}
      </td>
      <td style={{ ...td, textAlign: 'right', fontWeight: flagged ? 700 : 400, color: flagged ? '#e85d3a' : '#bbb', background: flagged ? '#fef2f2' : 'transparent' }}>
        {c.diff === null ? '—' : c.diff === 0 ? '0' : (c.diff > 0 ? '+' : '') + c.diff.toLocaleString()}
      </td>
    </>
  )
}

function monthlyRow(label: string, c: LedgerCompareCell) {
  const flagged = c.diff !== null && c.diff !== 0
  return (
    <tr style={{ borderBottom: '1px solid #f5f4f0' }}>
      <td style={td}>{label}</td>
      <td style={{ ...td, textAlign: 'right' }}>${c.ledger.toLocaleString()}</td>
      <td style={{ ...td, textAlign: 'right', color: '#888' }}>{c.system === null ? '—' : `$${c.system.toLocaleString()}`}</td>
      <td style={{ ...td, textAlign: 'right', color: flagged ? '#e85d3a' : '#1a1917', fontWeight: flagged ? 700 : 500 }}>
        {c.diff === null ? '—' : <Money value={c.diff} danger={flagged} />}
      </td>
    </tr>
  )
}

function RO({ label, value, money = true, suffix = '' }: { label: string; value: number; money?: boolean; suffix?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1917' }}>
        {money ? '$' : ''}{value.toLocaleString()}{suffix}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 7px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', textAlign: 'left' }
const thG: React.CSSProperties = { ...th, textAlign: 'center', borderLeft: '1px solid #f0ede6' }
const thSub: React.CSSProperties = { padding: '4px 7px', fontSize: 10, fontWeight: 500, color: '#aaa', textAlign: 'right', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 7px', verticalAlign: 'middle', whiteSpace: 'nowrap' }
