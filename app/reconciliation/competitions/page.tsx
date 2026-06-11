'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  getCurrentVisibleVenueIds,
  getEffectiveRole,
  listVenues,
} from '@/data/api'
import {
  useStoreSync, hydrateStore, upsertCompetitionPlan,
} from '@/data/store'
import {
  getVenueCompetitionStatus, getCombinedGroupCount,
} from '@/data/competitions'
import {
  COMPETITION_MIN_PER_VENUE, COMPETITION_COMBINED_GROUP,
  COMPETITION_COMBINED_TARGET, COMPETITION_SHORTFALL_YEAREND_PENALTY,
  COMPETITION_STATUS_LABEL,
} from '@/types'
import type { CompetitionPlan, CompetitionStatus } from '@/types'
import { ReconHeader, StatCard, Panel, Badge, ProgressBar } from '@/components/reconciliation/Common'

const STATUS_COLOR: Record<CompetitionStatus, 'gray' | 'green' | 'red'> = {
  planned: 'gray', done: 'green', cancelled: 'red',
}

export default function CompetitionsPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); hydrateStore() }, [])

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const user = mounted ? getCurrentUser() : null
  const role = mounted && user ? getEffectiveRole(user.id) : 'none'
  const canEdit = role === 'owner' || role === 'manager'

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    return visible === 'all' ? all : all.filter(v => visible.includes(v.id))
  }, [visible])

  const statuses = useMemo(
    () => (mounted ? venues.map(v => getVenueCompetitionStatus(v.id, year)) : []),
    [mounted, venues, year, sv],
  )
  const combinedCount = useMemo(
    () => (mounted ? getCombinedGroupCount(year) : 0),
    [mounted, year, sv],
  )

  const totals = useMemo(() => {
    let unmet = 0, penalty = 0
    for (const s of statuses) {
      if (!s.met) { unmet += 1; penalty += s.yearEndPenalty }
    }
    return { unmet, penalty }
  }, [statuses])

  const [fVenue, setFVenue] = useState('')
  const [fTitle, setFTitle] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))

  if (!mounted) return <div style={{ padding: 24 }} />

  function addPlan() {
    if (!fVenue || !fTitle.trim()) return
    const rec: CompetitionPlan = {
      id: `cp-${fVenue}-${Date.now()}`,
      venueId: fVenue, title: fTitle.trim(), date: fDate, status: 'planned',
      note: '', createdBy: user?.id ?? '', createdAt: new Date().toISOString(),
    }
    upsertCompetitionPlan(rec)
    setFTitle('')
  }
  function setStatus(p: CompetitionPlan, status: CompetitionStatus) {
    upsertCompetitionPlan({ ...p, status })
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <ReconHeader
        title="比賽企劃追蹤"
        subtitle={`每館年度 ≥ ${COMPETITION_MIN_PER_VENUE} 場・未達扣年終 $${COMPETITION_SHORTFALL_YEAREND_PENALTY.toLocaleString()}`}
        backTo="/reconciliation"
      />

      <div style={noteBox}>
        ⚠️ <strong>待業主確認</strong>：內壢 + 新竹採「<strong>合計 ≥ {COMPETITION_COMBINED_TARGET} 場</strong>」門檻（是否取代兩館各自 ≥ {COMPETITION_MIN_PER_VENUE} 規章未明）。「企劃數」計入規劃中 + 已舉辦（排除取消）。
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0 16px' }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>
          {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="館數" value={`${venues.length} 館`} accent="#7c5cff" />
        <StatCard label="未達標" value={`${totals.unmet} 館`}
          intent={totals.unmet > 0 ? 'danger' : 'default'} accent="#e85d3a" />
        <StatCard label="年終扣款合計" value={`$${totals.penalty.toLocaleString()}`}
          intent={totals.penalty > 0 ? 'danger' : 'default'} accent="#dc2626" />
      </div>

      {/* 合計組 banner */}
      <Panel title="內壢 + 新竹（合計門檻）">
        <div style={{ padding: '6px 0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13 }}>合計 <strong>{combinedCount}</strong> / {COMPETITION_COMBINED_TARGET} 場</span>
            <Badge color={combinedCount >= COMPETITION_COMBINED_TARGET ? 'green' : 'red'}>
              {combinedCount >= COMPETITION_COMBINED_TARGET ? '達標' : `差 ${COMPETITION_COMBINED_TARGET - combinedCount} 場`}
            </Badge>
          </div>
          <ProgressBar ratio={combinedCount / COMPETITION_COMBINED_TARGET}
            accent={combinedCount >= COMPETITION_COMBINED_TARGET ? '#10b981' : '#dc2626'} height={8} />
        </div>
      </Panel>

      {canEdit && (
        <Panel title="新增比賽企劃">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: '4px 0' }}>
            <Field label="球館">
              <select value={fVenue || venues[0]?.id || ''} onChange={e => setFVenue(e.target.value)} style={sel}>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="比賽名稱"><input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="例：夏季排球聯誼" style={{ ...sel, width: 200 }} /></Field>
            <Field label="日期"><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={sel} /></Field>
            <button onClick={() => { if (!fVenue) setFVenue(venues[0]?.id ?? ''); addPlan() }} style={primaryBtn}>新增企劃</button>
          </div>
        </Panel>
      )}

      {statuses.map(s => (
        <Panel key={s.venueId}
          title={s.venueName + (s.inCombinedGroup ? '（合計組）' : '')}
          action={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>{s.count} / {s.target} 場</span>
              <Badge color={s.met ? 'green' : 'red'}>{s.met ? '達標' : '未達標'}</Badge>
            </span>
          }>
          <div style={{ padding: '4px 0 8px' }}>
            <ProgressBar ratio={s.count / s.target} accent={s.met ? '#10b981' : '#dc2626'} height={6} />
          </div>
          {!s.met && (
            <div style={{ fontSize: 11, color: '#9a3412', marginBottom: 6 }}>
              ⚠ {s.inCombinedGroup ? '合計組未達標' : '未達標'}，年終扣 ${s.yearEndPenalty.toLocaleString()}
            </div>
          )}
          {s.plans.length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa', padding: '4px 0' }}>尚無企劃</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {s.plans.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f4f0', fontSize: 13, flexWrap: 'wrap' }}>
                  <Badge color={STATUS_COLOR[p.status]}>{COMPETITION_STATUS_LABEL[p.status]}</Badge>
                  <span style={{ flex: 1, minWidth: 140 }}>{p.title}</span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{p.date}</span>
                  {canEdit && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      {p.status !== 'done' && <button onClick={() => setStatus(p, 'done')} style={miniBtn('#0f766e')}>標記已舉辦</button>}
                      {p.status !== 'cancelled' && <button onClick={() => setStatus(p, 'cancelled')} style={miniBtn('#9ca3af')}>取消</button>}
                      {p.status === 'cancelled' && <button onClick={() => setStatus(p, 'planned')} style={miniBtn('#7c5cff')}>恢復</button>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  )
}

const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e2dc', fontSize: 14 }
const primaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8,
  border: 'none', cursor: 'pointer', background: '#ff2d8a', color: '#fff',
}
const noteBox: React.CSSProperties = {
  fontSize: 12, color: '#7a5b00', background: '#fff7e6', border: '1px solid #ffe0a3',
  borderRadius: 8, padding: '10px 12px', lineHeight: 1.7,
}
function miniBtn(color: string): React.CSSProperties {
  return { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${color}`, background: '#fff', color }
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}
