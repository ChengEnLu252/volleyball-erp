'use client'

// 管理職薪資（client）。資料自取自 server action（loadManagerSalariesAction）→ 不 import
// queries.ts，避免 server-only 進 client bundle；可用於獨立路由與 staff-pay 分頁 hub。
// 結算用 payroll-core 注入「系統推導值（sys）」即時算；儲存 → saveManagerSalariesAction。

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { ManagerSalaryRecord, ManagerLineItem } from '@/types'
import { computeManagerSalaryCore, getOffPeakRule, type ManagerSysInputs, type YearEndBonusResult } from '@/data/payroll-core'
import { ReconHeader, StatCard, Panel, Money, ProgressBar } from '@/components/reconciliation/Common'
import { loadManagerSalariesAction, saveManagerSalariesAction } from '@/app/actions/manager-salary'

function currentMonth(): string { return new Date().toISOString().slice(0, 7) }

function recentMonths(selected: string): { key: string; label: string }[] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const out: { key: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - i, 1)
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月` })
  }
  if (!out.some((o) => o.key === selected)) {
    const [yy, mm] = selected.split('-').map(Number)
    out.unshift({ key: selected, label: `${yy} 年 ${mm} 月` })
  }
  return out
}

function num(raw: string): number {
  const t = raw.trim().replace(/,/g, '')
  if (t === '') return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}
function newRecordId(venueId: string, month: string): string { return `${venueId}:${month}:mgr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
function newLineId(): string { return `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function blankRecord(venueId: string, month: string): ManagerSalaryRecord {
  return { id: newRecordId(venueId, month), venueId, month, personName: '', baseSalary: 0, designPay: 0, bonuses: [], includeOffPeakBonus: true, insuranceSelf: 0, leaveDays: 0, deductions: [], updatedBy: '', updatedAt: '' }
}

const EMPTY_SYS: ManagerSysInputs = { offPeakOpenedCount: 0, offPeakCourtRevenue: 0, hotStatus: { total: 0, opened: 0, fullyOpen: false }, monthlyRevenue: 0, floor: 0 }

export default function ManagerSalaryPage({ initialVenue, initialMonth }: { initialVenue?: string; initialMonth?: string }) {
  const [pending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([])
  const [venueId, setVenueId] = useState('')
  const [ym, setYm] = useState(initialMonth ?? currentMonth())
  const [canEdit, setCanEdit] = useState(false)
  const [sys, setSys] = useState<ManagerSysInputs>(EMPTY_SYS)
  const [yearEnd, setYearEnd] = useState<YearEndBonusResult | null>(null)
  const [drafts, setDrafts] = useState<ManagerSalaryRecord[]>([])
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set())
  const [savedTick, setSavedTick] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  function load(nextVenue?: string, nextYm?: string) {
    startTransition(async () => {
      const res = await loadManagerSalariesAction({ venueId: nextVenue, month: nextYm })
      if (res.ok) {
        setVenues(res.venues); setVenueId(res.venueId); setYm(res.month); setCanEdit(res.canEdit)
        setSys(res.sys); setYearEnd(res.yearEnd)
        setDrafts(res.records.map((r) => ({ ...r, bonuses: r.bonuses.map((b) => ({ ...b })), deductions: r.deductions.map((d) => ({ ...d })) })))
        setPersistedIds(new Set(res.records.map((r) => r.id)))
      } else { setVenues([]); setDrafts([]) }
      setLoaded(true)
    })
  }
  useEffect(() => { load(initialVenue, initialMonth) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const monthOptions = useMemo(() => recentMonths(ym), [ym])
  const year = Number(ym.slice(0, 4))
  const offPeakOpened = sys.offPeakOpenedCount
  const offPeakRule = venueId ? getOffPeakRule(venueId) : null
  const monthNetTotal = drafts.reduce((s, r) => s + computeManagerSalaryCore(r, sys).net, 0)

  function patchRecord(id: string, p: Partial<ManagerSalaryRecord>) { setDrafts((ds) => ds.map((r) => (r.id === id ? { ...r, ...p } : r))) }
  function addRecord() { setDrafts((ds) => [...ds, blankRecord(venueId, ym)]) }
  function removeDraft(id: string) { setDrafts((ds) => ds.filter((r) => r.id !== id)) }
  function addLine(id: string, field: 'bonuses' | 'deductions') { setDrafts((ds) => ds.map((r) => (r.id === id ? { ...r, [field]: [...r[field], { id: newLineId(), label: '', amount: 0 }] } : r))) }
  function patchLine(id: string, field: 'bonuses' | 'deductions', lineId: string, p: Partial<ManagerLineItem>) { setDrafts((ds) => ds.map((r) => (r.id === id ? { ...r, [field]: r[field].map((li) => (li.id === lineId ? { ...li, ...p } : li)) } : r))) }
  function removeLine(id: string, field: 'bonuses' | 'deductions', lineId: string) { setDrafts((ds) => ds.map((r) => (r.id === id ? { ...r, [field]: r[field].filter((li) => li.id !== lineId) } : r))) }

  function save() {
    setErr(null)
    startTransition(async () => {
      const res = await saveManagerSalariesAction({
        venueId, month: ym,
        records: drafts.map((r) => ({ id: r.id, personName: r.personName, baseSalary: r.baseSalary, designPay: r.designPay, bonuses: r.bonuses, includeOffPeakBonus: r.includeOffPeakBonus, insuranceSelf: r.insuranceSelf, leaveDays: r.leaveDays, deductions: r.deductions })),
      })
      if (!res.ok) { setErr(res.reason); return }
      setSavedTick((t) => t + 1)
      setTimeout(() => setSavedTick(0), 1800)
      load(venueId, ym)
    })
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #e0ddd5', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: canEdit ? '#fff' : '#f7f6f3', boxSizing: 'border-box', textAlign: 'right' }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 500, marginBottom: 4, display: 'block' }
  const fieldWrap: React.CSSProperties = { minWidth: 130, flex: '1 1 140px' }

  if (!loaded) return <div style={{ padding: 24, color: '#888' }}>載入中…</div>
  if (venues.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <ReconHeader title="管理職薪資" subtitle="每人每月一筆" backTo="/reconciliation" />
        <Panel><div style={{ padding: 24, color: '#888', fontSize: 13 }}>沒有可檢視的球館或尚未登入。</div></Panel>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media (max-width: 768px) { .mgr-wrap { padding-top: 56px !important; } .mgr-stats { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>

      <div className="mgr-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
        <ReconHeader
          title="管理職薪資"
          subtitle="館長薪資依管理規章計算（已整合原「館長績效」）：實領 = 本職薪 + 美編 + 獎金 + 冷門場次達標獎 + 冷門時段分潤獎 − 勞健保 − 請假 − 其他扣款"
          backTo="/reconciliation"
          actions={canEdit ? (
            <button onClick={save} disabled={pending} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: pending ? 'default' : 'pointer', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600 }}>{pending ? '儲存中…' : '儲存'}</button>
          ) : (<span style={{ fontSize: 12, color: '#888' }}>唯讀（無編輯權限）</span>)}
        />

        {err && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 12 }}>⚠️ {err}</div>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <select value={venueId} onChange={(e) => load(e.target.value, ym)} disabled={venues.length === 1}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0ddd5', fontSize: 13, background: '#fff' }}>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={ym} onChange={(e) => load(venueId, e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0ddd5', fontSize: 13, background: '#fff' }}>
            {monthOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          {savedTick > 0 && <span style={{ alignSelf: 'center', fontSize: 12, color: '#0d9488', fontWeight: 600 }}>✓ 已儲存</span>}
        </div>

        <div className="mgr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="本月實領合計" value={`$${monthNetTotal.toLocaleString()}`} sub={`${drafts.length} 人`} accent="#0f766e" />
          <StatCard label="冷門開團場數" value={`${offPeakOpened}`} sub={offPeakRule ? `≥${offPeakRule.tier1Open}→$${offPeakRule.tier1Bonus.toLocaleString()}・≥${offPeakRule.tier2Open}→$${offPeakRule.tier2Bonus.toLocaleString()}` : ''} accent="#d4a843" />
          <StatCard label="年度達成率" value={yearEnd?.config ? `${yearEnd.achievePct.toFixed(1)}%` : '—'} sub={yearEnd?.config ? `目標 $${yearEnd.annualTarget.toLocaleString()}` : '無年終表'} accent="#7c6af7" />
          <StatCard label="目前年終級距" value={yearEnd?.config ? `$${yearEnd.bonus.toLocaleString()}` : '—'} sub={yearEnd?.reachedTierPct != null ? `已達 ${yearEnd.reachedTierPct}%` : (yearEnd?.config ? '未達 90%' : `${year} 年無資料`)} accent="#0ea5e9" />
        </div>

        <Panel title={`年終獎金進度（${year}）`}>
          {yearEnd?.config ? (
            <div style={{ padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#555' }}>年度實收 <strong><Money value={yearEnd.annualActual} /></strong> ／ 目標 <Money value={yearEnd.annualTarget} muted /></span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f766e' }}>{yearEnd.achievePct.toFixed(1)}%</span>
              </div>
              <ProgressBar ratio={yearEnd.achievePct / 110} accent="#0f766e" height={8} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {yearEnd.config.tiers.map((t) => {
                  const reached = yearEnd.achievePct >= t.achievePct
                  return (
                    <span key={t.achievePct} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, background: reached ? '#d1fae5' : '#f5f4f0', color: reached ? '#065f46' : '#999', fontWeight: reached ? 600 : 500, border: reached ? '1px solid #6ee7b7' : '1px solid #e8e6e0' }}>
                      {t.achievePct}% → ${t.bonus.toLocaleString()}{reached ? ' ✓' : ''}
                    </span>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                投影年終獎金（依目前年度達成率）：<strong style={{ color: '#0f766e' }}> ${yearEnd.bonus.toLocaleString()}</strong>；年終為年度結算項目，不計入本月實領。
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 0', color: '#888', fontSize: 13 }}>此館 / 此年度無年終獎金表（Ace 3.0 等不在規章表內）。</div>
          )}
        </Panel>

        {drafts.map((rec) => {
          const c = computeManagerSalaryCore(rec, sys)
          const canRemove = canEdit && !persistedIds.has(rec.id)
          return (
            <Panel key={rec.id} title={rec.personName.trim() || '（未命名管理職）'}
              action={canRemove ? (<button onClick={() => removeDraft(rec.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 12, fontWeight: 600 }}>移除未存草稿</button>) : undefined}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '4px 0 10px' }}>
                <div style={{ ...fieldWrap, minWidth: 150 }}>
                  <label style={labelStyle}>姓名</label>
                  <input type="text" value={rec.personName} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { personName: e.target.value })} style={{ ...inputStyle, textAlign: 'left' }} />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle}>本職月薪</label>
                  <input type="text" value={rec.baseSalary} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { baseSalary: num(e.target.value) })} style={inputStyle} />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle}>美編 / 其他固定收入</label>
                  <input type="text" value={rec.designPay} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { designPay: num(e.target.value) })} style={inputStyle} />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle}>勞健保自付</label>
                  <input type="text" value={rec.insuranceSelf} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { insuranceSelf: num(e.target.value) })} style={inputStyle} />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle}>請假天數</label>
                  <input type="text" value={rec.leaveDays} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { leaveDays: num(e.target.value) })} style={inputStyle} />
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4, textAlign: 'right' }}>扣薪 = 月薪 ÷ 30 × 天 = <Money value={c.leaveDeduction} /></div>
                </div>
              </div>

              <LineItemEditor title="額外獎金（中秋 / 跨館輔導…）" items={rec.bonuses} canEdit={canEdit} onAdd={() => addLine(rec.id, 'bonuses')} onPatch={(lid, p) => patchLine(rec.id, 'bonuses', lid, p)} onRemove={(lid) => removeLine(rec.id, 'bonuses', lid)} accent="#0d9488" />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: '#f7f6f3', borderRadius: 8, margin: '4px 0 10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: canEdit ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={rec.includeOffPeakBonus} disabled={!canEdit} onChange={(e) => patchRecord(rec.id, { includeOffPeakBonus: e.target.checked })} />
                  自動計入冷門場次獎金
                </label>
                <span style={{ fontSize: 12, color: '#888' }}>本月冷門開團 <strong>{offPeakOpened}</strong> 場</span>
                {c.offPeak && (
                  <span style={{ fontSize: 12, marginLeft: 'auto' }}>
                    {c.offPeak.bonus > 0 && <span style={{ color: '#0f766e', fontWeight: 600 }}>獎金 +<Money value={c.offPeak.bonus} prefix="$" /></span>}
                    {c.offPeak.penalty > 0 && <span style={{ color: '#e85d3a', fontWeight: 600 }}>罰款 −<Money value={c.offPeak.penalty} prefix="$" /></span>}
                    {c.offPeak.bonus === 0 && c.offPeak.penalty === 0 && <span style={{ color: '#888' }}>未達獎金門檻、未觸罰款</span>}
                  </span>
                )}
              </div>

              {c.offPeakRevenue && rec.includeOffPeakBonus && (
                <div style={{ padding: '10px 12px', borderRadius: 8, margin: '0 0 10px', background: c.offPeakRevenue.rate === 0.20 ? '#eefaf4' : c.offPeakRevenue.rate === 0.10 ? '#fdf6ec' : '#fdeeea', border: `1px solid ${c.offPeakRevenue.rate === 0.20 ? '#bfe8d4' : c.offPeakRevenue.rate === 0.10 ? '#f3dcb5' : '#f3c8bb'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>冷門時段營收分潤</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: c.offPeakRevenue.rate === 0.20 ? '#0f766e' : c.offPeakRevenue.rate === 0.10 ? '#c98a2b' : '#e85d3a', color: '#fff' }}>{Math.round(c.offPeakRevenue.rate * 100)}%</span>
                    <span style={{ fontSize: 12, color: '#666' }}>{c.offPeakRevenue.reason}</span>
                    <span style={{ fontSize: 13, marginLeft: 'auto', color: '#0f766e', fontWeight: 700 }}>獎金 +<Money value={c.offPeakRevenue.bonus} prefix="$" /></span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    冷門純場地費 <Money value={c.offPeakRevenue.courtRevenue} /> × {Math.round(c.offPeakRevenue.rate * 100)}%
                    ｜熱門場次 {c.offPeakRevenue.hotOpened}/{c.offPeakRevenue.hotTotal}{c.offPeakRevenue.hotFullyOpen ? ' 全開' : ' 未全開'}
                    ｜月營收 <Money value={c.offPeakRevenue.monthlyRevenue} /> / 低標 <Money value={c.offPeakRevenue.floor} />
                  </div>
                </div>
              )}

              <LineItemEditor title="其他扣款" items={rec.deductions} canEdit={canEdit} onAdd={() => addLine(rec.id, 'deductions')} onPatch={(lid, p) => patchLine(rec.id, 'deductions', lid, p)} onRemove={(lid) => removeLine(rec.id, 'deductions', lid)} accent="#e85d3a" />

              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderTop: '1px solid #f0ede6', marginTop: 6, paddingTop: 12 }}>
                <SettleLine label="收入合計" value={c.grossIncome} />
                <SettleLine label="扣款合計" value={c.totalDeduction} danger />
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>實領</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}><Money value={c.net} /></div>
                </div>
              </div>
            </Panel>
          )
        })}

        {drafts.length === 0 && (
          <Panel><div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>此館本月尚無管理職薪資紀錄{canEdit ? '，點下方「+ 新增管理職」開始。' : '。'}</div></Panel>
        )}

        {canEdit && (
          <button onClick={addRecord} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #0d9488', cursor: 'pointer', background: '#fff', color: '#0d9488', fontSize: 13, fontWeight: 600 }}>+ 新增管理職</button>
        )}
      </div>
    </div>
  )
}

function LineItemEditor({ title, items, canEdit, onAdd, onPatch, onRemove, accent }: {
  title: string; items: ManagerLineItem[]; canEdit: boolean; onAdd: () => void; onPatch: (lineId: string, p: Partial<ManagerLineItem>) => void; onRemove: (lineId: string) => void; accent: string
}) {
  const num2 = (raw: string) => { const t = raw.trim().replace(/,/g, ''); if (t === '') return 0; const n = Number(t); return Number.isFinite(n) ? n : 0 }
  const inputStyle: React.CSSProperties = { padding: '6px 8px', border: '1px solid #e0ddd5', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: canEdit ? '#fff' : '#f7f6f3', boxSizing: 'border-box' }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>{title}</span>
        {canEdit && <button onClick={onAdd} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${accent}`, cursor: 'pointer', background: '#fff', color: accent, fontSize: 11, fontWeight: 600 }}>+ 新增條目</button>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#aaa', padding: '2px 0' }}>（無）</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((li) => (
            <div key={li.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={li.label} disabled={!canEdit} placeholder="項目名稱" onChange={(e) => onPatch(li.id, { label: e.target.value })} style={{ ...inputStyle, flex: '1 1 auto', textAlign: 'left' }} />
              <input type="text" value={li.amount} disabled={!canEdit} placeholder="金額" onChange={(e) => onPatch(li.id, { amount: num2(e.target.value) })} style={{ ...inputStyle, width: 110, textAlign: 'right' }} />
              {canEdit && <button onClick={() => onRemove(li.id)} title="刪除" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 16 }}>×</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SettleLine({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}><Money value={value} danger={danger} /></div>
    </div>
  )
}
