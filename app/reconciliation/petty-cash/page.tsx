'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  getCurrentVisibleVenueIds,
  getEffectiveRole,
  listVenues,
} from '@/data/api'
import {
  useStoreSync, hydrateStore, upsertPettyCashEntry,
} from '@/data/store'
import { getVenuePettyCashSummary } from '@/data/petty-cash'
import { computeYearEndOutlook } from '@/data/year-end'
import {
  PETTY_CASH_ANNUAL_CAP, PETTY_CASH_OVERSPEND_YEAREND_PENALTY, PETTY_CASH_CATEGORIES,
} from '@/types'
import type { PettyCashCategory, PettyCashEntry } from '@/types'
import { ReconHeader, StatCard, Panel, Money, ProgressBar } from '@/components/reconciliation/Common'

export default function PettyCashPage() {
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

  const [selVenue, setSelVenue] = useState('')
  useEffect(() => { if (!selVenue && venues[0]) setSelVenue(venues[0].id) }, [venues, selVenue])

  const summary = useMemo(
    () => (mounted && selVenue ? getVenuePettyCashSummary(selVenue, year) : null),
    [mounted, selVenue, year, sv],
  )
  const outlook = useMemo(
    () => (mounted && selVenue ? computeYearEndOutlook(selVenue, year) : null),
    [mounted, selVenue, year, sv],
  )

  // 新增支出
  const [fCat, setFCat] = useState<PettyCashCategory>(PETTY_CASH_CATEGORIES[0])
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))

  if (!mounted) return <div style={{ padding: 24 }} />

  function addEntry() {
    const amount = parseInt(fAmount, 10)
    if (!selVenue || !fLabel.trim() || !Number.isFinite(amount) || amount <= 0) return
    const rec: PettyCashEntry = {
      id: `pc-${selVenue}-${Date.now()}`,
      venueId: selVenue, date: fDate, category: fCat, label: fLabel.trim(),
      amount, enteredBy: user?.id ?? '', enteredAt: new Date().toISOString(), note: '',
    }
    upsertPettyCashEntry(rec)
    setFLabel(''); setFAmount('')
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <ReconHeader
        title="零用金台帳"
        subtitle={`年度上限 $${PETTY_CASH_ANNUAL_CAP.toLocaleString()}・超支扣年終 $${PETTY_CASH_OVERSPEND_YEAREND_PENALTY.toLocaleString()}`}
        backTo="/reconciliation"
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selVenue} onChange={e => setSelVenue(e.target.value)} style={sel}>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>
          {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
      </div>

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="年度已用" value={`$${summary.total.toLocaleString()}`}
              intent={summary.overCap ? 'danger' : 'default'} accent="#7c5cff" />
            <StatCard label="剩餘額度" value={`$${summary.remaining.toLocaleString()}`}
              intent={summary.remaining < 0 ? 'danger' : 'default'}
              sub={`上限 $${summary.cap.toLocaleString()}`} accent="#10b981" />
            <StatCard label="超支扣年終" value={`$${summary.yearEndPenalty.toLocaleString()}`}
              intent={summary.yearEndPenalty > 0 ? 'danger' : 'default'}
              sub={summary.overCap ? `超出 $${summary.overAmount.toLocaleString()}` : '未超支'} accent="#e85d3a" />
          </div>

          <Panel title={`年度額度使用（${Math.round((summary.total / summary.cap) * 100)}%）`}>
            <div style={{ padding: '6px 0 10px' }}>
              <ProgressBar ratio={summary.total / summary.cap}
                accent={summary.overCap ? '#dc2626' : summary.total / summary.cap > 0.8 ? '#d4a843' : '#10b981'}
                height={10} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginTop: 6 }}>
                <span>$0</span>
                <span>上限 ${summary.cap.toLocaleString()}</span>
              </div>
              {summary.overCap && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#fdeeea', border: '1px solid #f5b7a8', borderRadius: 8, fontSize: 12, color: '#9a3412' }}>
                  ⚠ 已超出年度上限 <strong>${summary.overAmount.toLocaleString()}</strong>，依規章扣年終獎金 <strong>${summary.yearEndPenalty.toLocaleString()}</strong>。
                </div>
              )}
            </div>
          </Panel>

          {/* 接既有年終引擎：實得展望 */}
          {outlook && (
            <Panel title="年終獎金實得展望（接既有年終引擎）">
              <div style={{ padding: '6px 0', fontSize: 13 }}>
                <Row label="級距獎金" value={<Money value={outlook.grossBonus} />} />
                {outlook.deductions.map((d, i) => (
                  <Row key={i} label={`− ${d.label}`} value={<span style={{ color: '#dc2626' }}>−<Money value={d.amount} /></span>} />
                ))}
                <div style={{ borderTop: '1px solid #eee', marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>實得年終</span><span><Money value={outlook.net} /></span>
                </div>
              </div>
            </Panel>
          )}

          {canEdit && (
            <Panel title="新增零用金支出">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: '4px 0' }}>
                <Field label="日期"><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={sel} /></Field>
                <Field label="類別">
                  <select value={fCat} onChange={e => setFCat(e.target.value as PettyCashCategory)} style={sel}>
                    {PETTY_CASH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="說明"><input value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="例：清潔用品" style={{ ...sel, width: 180 }} /></Field>
                <Field label="金額"><input value={fAmount} onChange={e => setFAmount(e.target.value)} inputMode="numeric" placeholder="0" style={{ ...sel, width: 100 }} /></Field>
                <button onClick={addEntry} style={primaryBtn}>新增</button>
              </div>
            </Panel>
          )}

          {summary.byMonth.map(b => (
            <Panel key={b.month} title={b.month}
              action={<span style={{ fontSize: 12, fontWeight: 700 }}><Money value={b.total} /></span>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.entries.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f4f0', fontSize: 13 }}>
                    <span style={{ fontSize: 11, color: '#888', background: '#f3f4f6', padding: '2px 8px', borderRadius: 999 }}>{e.category}</span>
                    <span style={{ flex: 1 }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>{e.date.slice(5)}</span>
                    <Money value={e.amount} />
                  </div>
                ))}
              </div>
            </Panel>
          ))}
          {summary.byMonth.length === 0 && (
            <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: 24 }}>本年度尚無零用金支出紀錄</p>
          )}
        </>
      )}
    </div>
  )
}

const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e2dc', fontSize: 14 }
const primaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8,
  border: 'none', cursor: 'pointer', background: '#ff2d8a', color: '#fff',
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#444' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}
