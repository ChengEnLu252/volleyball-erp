'use client'

// 工讀生時薪表（client）。資料自取自 server action（loadPartTimerSheetAction）→ 不 import
// queries.ts，避免 server-only 進 client bundle；可用於獨立路由與 staff-pay 分頁 hub。
// 系統營收由 DB（真 Payment + 商品）算；計算公式走 data/payroll-core；儲存 → savePartTimerSheetAction。

import { useEffect, useMemo, useState, useTransition } from 'react'
import { STAFF_LEVEL_LABEL } from '@/types'
import type { PartTimerPayrollSheet, PartTimerRow, StaffLevel } from '@/types'
import { computePartTimerSheetCore, defaultRateForLevel } from '@/data/payroll-core'
import { ReconHeader, StatCard, Panel, Money } from '@/components/reconciliation/Common'
import { loadPartTimerSheetAction, savePartTimerSheetAction } from '@/app/actions/payroll'

const LEVELS: StaffLevel[] = ['helper', 'captain_helper', 'senior_helper', 'captain_senior', 'captain_x2']

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

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

/** 解析數字輸入：空白→0、移除千分位逗號 */
function num(raw: string): number {
  const t = raw.trim().replace(/,/g, '')
  if (t === '') return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function newRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function PartTimerPayrollPage({ initialVenue, initialMonth }: { initialVenue?: string; initialMonth?: string }) {
  const [pending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([])
  const [venueId, setVenueId] = useState('')
  const [ym, setYm] = useState(initialMonth ?? currentMonth())
  const [canEdit, setCanEdit] = useState(false)
  const [systemRev, setSystemRev] = useState(0)
  const [draft, setDraft] = useState<PartTimerPayrollSheet | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  function load(nextVenue?: string, nextYm?: string) {
    startTransition(async () => {
      const res = await loadPartTimerSheetAction({ venueId: nextVenue, month: nextYm })
      if (res.ok) {
        setVenues(res.venues); setVenueId(res.venueId); setYm(res.month)
        setCanEdit(res.canEdit); setSystemRev(res.systemRevenue)
        setDraft({ ...res.sheet, rows: res.sheet.rows.map((r) => ({ ...r })) })
      } else {
        setVenues([]); setDraft(null)
      }
      setLoaded(true)
    })
  }
  useEffect(() => { load(initialVenue, initialMonth) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const monthOptions = useMemo(() => recentMonths(ym), [ym])
  const computed = draft ? computePartTimerSheetCore(draft, systemRev) : null

  function patchRow(id: string, p: Partial<PartTimerRow>) {
    setDraft((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) } : d))
  }
  function addRow() {
    setDraft((d) => (d ? {
      ...d,
      rows: [...d.rows, { id: newRowId(), name: '', level: 'helper', hourlyRate: defaultRateForLevel('helper'), normalHours: 0, bonus: 0, penalty: 0, note: '' }],
    } : d))
  }
  function removeRow(id: string) { setDraft((d) => (d ? { ...d, rows: d.rows.filter((r) => r.id !== id) } : d)) }
  function changeLevel(id: string, level: StaffLevel) {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        rows: d.rows.map((r) => {
          if (r.id !== id) return r
          const wasDefault = r.hourlyRate === defaultRateForLevel(r.level)
          return { ...r, level, hourlyRate: wasDefault ? defaultRateForLevel(level) : r.hourlyRate }
        }),
      }
    })
  }
  function setRevenueOverride(raw: string) {
    setDraft((d) => (d ? { ...d, revenueOverride: raw.trim() === '' ? null : num(raw) } : d))
  }
  function save() {
    if (!draft) return
    setErr(null)
    startTransition(async () => {
      const res = await savePartTimerSheetAction({ venueId, month: ym, rows: draft.rows, revenueOverride: draft.revenueOverride })
      if (!res.ok) { setErr(res.reason); return }
      setSavedTick((t) => t + 1)
      setTimeout(() => setSavedTick(0), 1800)
    })
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #e0ddd5', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: canEdit ? '#fff' : '#f7f6f3', boxSizing: 'border-box', textAlign: 'right' }
  const thStyle: React.CSSProperties = { fontSize: 11, color: '#888', fontWeight: 600, textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e8e6e0', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }

  if (!loaded) return <div style={{ padding: 24, color: '#888' }}>載入中…</div>
  if (venues.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <ReconHeader title="工讀生時薪表" subtitle="每館每月一張" backTo="/reconciliation" />
        <Panel><div style={{ padding: 24, color: '#888', fontSize: 13 }}>沒有可檢視的球館或尚未登入。</div></Panel>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .ptp-wrap  { padding-top: 56px !important; }
          .ptp-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="ptp-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
        <ReconHeader
          title="工讀生時薪表"
          subtitle="正常薪水 = 時數 × 時薪；總薪水 = 正常薪水 + 獎金 − 罰款"
          backTo="/reconciliation"
          actions={
            canEdit ? (
              <button onClick={save} disabled={pending} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: pending ? 'default' : 'pointer', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                {pending ? '儲存中…' : '儲存'}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#888' }}>唯讀（無編輯權限）</span>
            )
          }
        />

        {err && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 12 }}>⚠️ {err}</div>
        )}

        {/* 球館 / 月份 */}
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

        {/* KPI */}
        <div className="ptp-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="本月薪水" value={`$${(computed?.monthTotal ?? 0).toLocaleString()}`} sub={`${computed?.rows.length ?? 0} 人`} accent="#0d9488" />
          <StatCard label="本月營收" value={`$${(computed?.revenue ?? 0).toLocaleString()}`} sub={computed?.revenueFromSystem ? '系統值' : '人工覆寫'} accent="#d4a843" />
          <StatCard label="薪資比例" value={`${computed ? (computed.ratio * 100).toFixed(2) : '0.00'}%`} sub={computed ? `上限 ${computed.ratioLimit * 100}%・${computed.overLimit ? '超標' : '正常'}` : '薪水 ÷ 營收'} intent={computed?.overLimit ? 'danger' : 'default'} accent={computed?.overLimit ? '#dc2626' : '#7c6af7'} />
          <StatCard label="系統營收（對照）" value={`$${systemRev.toLocaleString()}`} sub="真實收（Payment+商品）" accent="#0ea5e9" />
        </div>

        {computed?.overLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 8, marginBottom: 16, background: '#fdeeea', border: '1px solid #f3c8bb' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#9a3412' }}>
              工讀生薪資佔營收 <strong>{(computed.ratio * 100).toFixed(2)}%</strong>，
              超過{venueId === 'v6' ? '新竹館' : ''}上限 <strong>{computed.ratioLimit * 100}%</strong>（規章 6-3 成本控管）。
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>該月罰款 −<Money value={computed.wageRatioPenalty} prefix="$" /></span>
          </div>
        )}

        {/* 本月營收覆寫 */}
        <Panel title="本月營收">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
            <input type="text" value={draft?.revenueOverride ?? ''} placeholder={`留空＝用系統值 $${systemRev.toLocaleString()}`}
              onChange={(e) => setRevenueOverride(e.target.value)} disabled={!canEdit}
              style={{ ...inputStyle, width: 220, textAlign: 'left' }} />
            <span style={{ fontSize: 12, color: '#888' }}>留空則「薪資比例」以系統真實收計算；填入則覆寫。</span>
          </div>
        </Panel>

        {/* 時薪表 */}
        <Panel title="工讀生明細" action={canEdit ? (
          <button onClick={addRow} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #0d9488', cursor: 'pointer', background: '#fff', color: '#0d9488', fontSize: 12, fontWeight: 600 }}>+ 新增一列</button>
        ) : undefined}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>名稱</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>等級</th>
                  <th style={thStyle}>時薪</th>
                  <th style={thStyle}>正常時數</th>
                  <th style={thStyle}>正常薪水</th>
                  <th style={thStyle}>獎金</th>
                  <th style={thStyle}>罰款</th>
                  <th style={thStyle}>總薪水</th>
                  {canEdit && <th style={{ ...thStyle, width: 36 }} />}
                </tr>
              </thead>
              <tbody>
                {(computed?.rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, minWidth: 110 }}>
                      <input type="text" value={r.name} disabled={!canEdit} onChange={(e) => patchRow(r.id, { name: e.target.value })} style={{ ...inputStyle, textAlign: 'left' }} />
                    </td>
                    <td style={{ ...tdStyle, minWidth: 130 }}>
                      <select value={r.level} disabled={!canEdit} onChange={(e) => changeLevel(r.id, e.target.value as StaffLevel)} style={{ ...inputStyle, textAlign: 'left' }}>
                        {LEVELS.map((lv) => <option key={lv} value={lv}>{STAFF_LEVEL_LABEL[lv]}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, width: 80 }}>
                      <input type="text" value={r.hourlyRate} disabled={!canEdit} onChange={(e) => patchRow(r.id, { hourlyRate: num(e.target.value) })} style={inputStyle} />
                    </td>
                    <td style={{ ...tdStyle, width: 80 }}>
                      <input type="text" value={r.normalHours} disabled={!canEdit} onChange={(e) => patchRow(r.id, { normalHours: num(e.target.value) })} style={inputStyle} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontSize: 13, color: '#666' }}>{r.normalSalary.toLocaleString()}</td>
                    <td style={{ ...tdStyle, width: 80 }}>
                      <input type="text" value={r.bonus} disabled={!canEdit} onChange={(e) => patchRow(r.id, { bonus: num(e.target.value) })} style={inputStyle} />
                    </td>
                    <td style={{ ...tdStyle, width: 80 }}>
                      <input type="text" value={r.penalty} disabled={!canEdit} onChange={(e) => patchRow(r.id, { penalty: num(e.target.value) })} style={inputStyle} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 14 }}><Money value={r.total} /></td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button onClick={() => removeRow(r.id)} title="刪除" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 16 }}>×</button>
                      </td>
                    )}
                  </tr>
                ))}
                {(computed?.rows.length ?? 0) === 0 && (
                  <tr><td colSpan={canEdit ? 9 : 8} style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
                    尚無工讀生資料{canEdit ? '，點「+ 新增一列」開始。' : '。'}
                  </td></tr>
                )}
              </tbody>
              {(computed?.rows.length ?? 0) > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#666' }}>本月薪水合計</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 16, fontWeight: 700 }}><Money value={computed?.monthTotal ?? 0} /></td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Panel>

        {/* 等級時薪參考 */}
        <Panel title="等級預設時薪（可逐人覆寫）">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
            {LEVELS.map((lv) => (
              <span key={lv} style={{ fontSize: 12, color: '#555', background: '#f5f4f0', padding: '5px 10px', borderRadius: 999 }}>
                {STAFF_LEVEL_LABEL[lv]} ${defaultRateForLevel(lv)}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
            ⚠️ 規章圖中「資深小幫手」同時出現 200 與 195 兩種時薪，故時薪以每人實際值為準（此處僅為新增列的預設）。
          </div>
        </Panel>
      </div>
    </div>
  )
}
