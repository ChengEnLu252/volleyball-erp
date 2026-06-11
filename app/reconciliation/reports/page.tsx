'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  getCurrentVisibleVenueIds,
  getEffectiveRole,
  listVenues,
} from '@/data/api'
import { useStoreSync, hydrateStore, upsertReportSubmission } from '@/data/store'
import {
  getVenueReportSummary,
  reportsCurrentMonth,
} from '@/data/reports'
import { REPORT_LATE_PENALTY } from '@/types'
import type { ReportStatusKind, ReportSubmission, ReportType } from '@/types'
import { ReconHeader, StatCard, Panel, Money } from '@/components/reconciliation/Common'

function recentMonths(today: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const y = today.getFullYear(), m = today.getMonth()
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
    })
  }
  return out
}

const STATUS_META: Record<ReportStatusKind, { label: string; color: string; bg: string }> = {
  ontime:  { label: '準時',     color: '#0f766e', bg: '#eefaf4' },
  late:    { label: '遲交',     color: '#c98a2b', bg: '#fdf6ec' },
  pending: { label: '待繳',     color: '#6b7280', bg: '#f4f4f5' },
  missed:  { label: '逾期未繳', color: '#dc2626', bg: '#fdeeea' },
}

export default function ReportTrackingPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); hydrateStore() }, [])

  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => recentMonths(today), [today])
  const [ym, setYm] = useState<string>(reportsCurrentMonth())

  const user = mounted ? getCurrentUser() : null
  const role = mounted && user ? getEffectiveRole(user.id) : 'none'
  const canEdit = role === 'owner' || role === 'manager'

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    return visible === 'all' ? all : all.filter(v => visible.includes(v.id))
  }, [visible])

  const summaries = useMemo(
    () => (mounted ? venues.map(v => getVenueReportSummary(v.id, ym)) : []),
    [mounted, venues, ym, sv],
  )

  const totals = useMemo(() => {
    const overdue = summaries.reduce((s, x) => s + x.overdueCount, 0)
    const penalty = summaries.reduce((s, x) => s + x.penaltyTotal, 0)
    const all = summaries.reduce((s, x) => s + x.rows.length, 0)
    const ontime = summaries.reduce((s, x) => s + x.ontime, 0)
    return { overdue, penalty, ontimeRate: all > 0 ? Math.round((ontime / all) * 100) : 0 }
  }, [summaries])

  if (!mounted) return <div style={{ padding: 24 }} />

  function markSubmitted(venueId: string, type: ReportType, submittedDay: number | null) {
    const rec: ReportSubmission = { id: `${venueId}:${ym}:${type}`, venueId, month: ym, type, submittedDay }
    upsertReportSubmission(rec)
  }

  const todayDay = new Date().getDate()

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <ReconHeader
        title="報表繳交追蹤"
        subtitle="規章 3-2 報表繳交期限表・逾期一項罰 $500（規章 6-3）"
        backTo="/reconciliation"
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={ym}
          onChange={e => setYm(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e2dc', fontSize: 14 }}
        >
          {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#888' }}>共 {venues.length} 館</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="逾期項數" value={`${totals.overdue} 項`} sub="遲交 + 逾期未繳"
          intent={totals.overdue > 0 ? 'danger' : 'default'} accent={totals.overdue > 0 ? '#dc2626' : '#0f766e'} />
        <StatCard label="逾期罰款合計" value={`$${totals.penalty.toLocaleString()}`} sub={`每項 $${REPORT_LATE_PENALTY}`}
          intent={totals.penalty > 0 ? 'danger' : 'default'} accent="#e85d3a" />
        <StatCard label="準時率" value={`${totals.ontimeRate}%`} sub="準時項 ÷ 全部" accent="#0d9488" />
      </div>

      {summaries.map(s => (
        <Panel
          key={s.venueId}
          title={s.venueName}
          action={
            <span style={{ fontSize: 12, fontWeight: 700, color: s.penaltyTotal > 0 ? '#dc2626' : '#0f766e' }}>
              {s.penaltyTotal > 0 ? <>罰款 <Money value={s.penaltyTotal} prefix="$" /></> : '無逾期 ✓'}
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.rows.map(r => {
              const meta = STATUS_META[r.status]
              return (
                <div key={r.def.type} style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '8px 10px', borderRadius: 8, background: meta.bg,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: meta.color, color: '#fff', whiteSpace: 'nowrap',
                  }}>{meta.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.def.name}</span>
                  <span style={{ fontSize: 11, color: '#999' }}>
                    {r.def.weekly ? '每週一' : `每月 ${r.def.dueDay} 日`}・{r.def.target}
                    {r.submittedDay != null && <>・繳於 {r.submittedDay} 日</>}
                  </span>
                  {r.penalty > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>−<Money value={r.penalty} prefix="$" /></span>
                  )}
                  {canEdit && (
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {r.submittedDay == null ? (
                        <button
                          onClick={() => markSubmitted(s.venueId, r.def.type, todayDay)}
                          style={btnStyle('#0f766e')}
                        >標記今日繳交</button>
                      ) : (
                        <button
                          onClick={() => markSubmitted(s.venueId, r.def.type, null)}
                          style={btnStyle('#9ca3af')}
                        >取消繳交</button>
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>
      ))}

      <p style={{ fontSize: 11, color: '#aaa', marginTop: 12, lineHeight: 1.6 }}>
        ※「月底商品庫存表」期限在規章 3-2 表記 5 日、6-3 表記 25 日，此處暫採 25 日，待業主確認。
        「現金存款回報」為每週一制，此處以月為單位簡化呈現。
      </p>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
    border: `1px solid ${color}`, background: '#fff', color,
  }
}
