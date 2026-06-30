'use client'

// 月記帳輸入（client）。資料自取自 server action（loadLedgerInputAction）→ 不從 queries.ts
// 直接 import，避免 server-only 進 client bundle；可同時用於獨立路由與 bookkeeping 分頁 hub。
// 球館・月份切換 → 重新呼叫 action；日選擇 + 編輯在本地；儲存 → saveLedgerDayAction → 重新載入。

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  LEDGER_SLOTS, LEDGER_CATEGORY_FIELDS, LEDGER_CHARGE_FIELDS, LEDGER_AC_RATE,
  computeLedgerDerived, makeEmptyLedgerDay, weekdayOf,
} from '@/data/ledger-core'
import type { LedgerDay, LedgerSlotValue } from '@/types'
import { ReconHeader, StatCard, Panel } from '@/components/reconciliation/Common'
import { saveLedgerDayAction, loadLedgerInputAction, type SaveLedgerInput } from '@/app/actions/ledger'

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function recentMonths(selectedYm: string): { key: string; label: string }[] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const out: { key: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - i, 1)
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月` })
  }
  if (!out.some((o) => o.key === selectedYm)) {
    const [yy, mm] = selectedYm.split('-').map(Number)
    out.unshift({ key: selectedYm, label: `${yy} 年 ${mm} 月` })
  }
  return out
}

function daysInMonthArr(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}

/** 使用者輸入字串 → slot 值：空→刪除、純數字→number、其他→字串註記 */
function parseSlot(raw: string): LedgerSlotValue | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) && /^-?[\d,]+(\.\d+)?$/.test(t) ? n : t
}

type Bundle = {
  venues: { id: string; name: string }[]
  venueId: string
  ym: string
  canEdit: boolean
  monthDays: LedgerDay[]
  userId: string
}

export default function LedgerInputClient({ initialVenue, initialYm }: { initialVenue?: string; initialYm?: string }) {
  const [pending, startTransition] = useTransition()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 初次載入 + 切換球館/月份時重抓
  function load(venueId?: string, ym?: string) {
    startTransition(async () => {
      const res = await loadLedgerInputAction({ venueId, ym })
      if (res.ok) {
        setBundle({ venues: res.venues, venueId: res.venueId, ym: res.ym, canEdit: res.canEdit, monthDays: res.monthDays, userId: res.userId })
      } else {
        setBundle({ venues: [], venueId: '', ym: ym ?? currentYm(), canEdit: false, monthDays: [], userId: '' })
      }
      setLoaded(true)
    })
  }
  useEffect(() => { load(initialVenue, initialYm) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ym = bundle?.ym ?? initialYm ?? currentYm()
  const venueId = bundle?.venueId ?? ''
  const venues = bundle?.venues ?? []
  const canEdit = bundle?.canEdit ?? false
  const userId = bundle?.userId ?? ''
  const monthDays = bundle?.monthDays ?? []

  const monthOptions = useMemo(() => recentMonths(ym), [ym])
  const venueName = venues.find((v) => v.id === venueId)?.name ?? ''
  const byDate = useMemo(() => new Map(monthDays.map((d) => [d.date, d])), [monthDays])
  const filledSet = useMemo(() => new Set(monthDays.map((d) => d.date)), [monthDays])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [selDate, setSelDate] = useState('')
  // 載入新月份後，預設選今天（若在本月）否則該月 1 號
  useEffect(() => {
    if (!bundle) return
    setSelDate(todayStr.slice(0, 7) === ym ? todayStr : `${ym}-01`)
  }, [ym, bundle, todayStr])

  const [draft, setDraft] = useState<LedgerDay | null>(null)
  useEffect(() => {
    if (!selDate || !venueId) { setDraft(null); return }
    const existing = byDate.get(selDate)
    setDraft(existing ? { ...existing, slots: { ...existing.slots } } : makeEmptyLedgerDay(venueId, selDate, userId))
  }, [selDate, venueId, byDate, userId])

  const [savedTick, setSavedTick] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const derived = draft ? computeLedgerDerived(draft) : null

  function patch(p: Partial<LedgerDay>) { setDraft((d) => (d ? { ...d, ...p } : d)) }
  function patchSlot(key: string, raw: string) {
    setDraft((d) => {
      if (!d) return d
      const slots = { ...d.slots }
      const v = parseSlot(raw)
      if (v === undefined) delete slots[key]; else slots[key] = v
      return { ...d, slots }
    })
  }

  function save() {
    if (!draft) return
    setErr(null)
    const payload: SaveLedgerInput = {
      venueId, date: selDate, slots: draft.slots,
      merch: draft.merch, snacks: draft.snacks, drinks: draft.drinks, ac: draft.ac, other: draft.other,
      seasonFee: draft.seasonFee, privatePrepay: draft.privatePrepay, acFee: draft.acFee, refund: draft.refund,
      acDegrees: draft.acDegrees,
      bookingNote: draft.bookingNote, refundNote: draft.refundNote, merchNote: draft.merchNote,
      reported: draft.reported,
    }
    startTransition(async () => {
      const res = await saveLedgerDayAction(payload)
      if (!res.ok) { setErr(res.reason); return }
      setSavedTick((t) => t + 1)
      setTimeout(() => setSavedTick(0), 1800)
      load(venueId, ym) // 重新載入該月，更新已填標記
    })
  }

  if (!loaded) return <div style={{ padding: 24, color: '#888' }}>載入中…</div>
  if (venues.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <ReconHeader title="月記帳輸入" subtitle="館長每日記帳" backTo="/reconciliation" />
        <Panel><div style={{ padding: 24, color: '#888', fontSize: 13 }}>沒有可記帳的球館或尚未登入。</div></Panel>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .lg-wrap  { padding-top: 64px !important; }
          .lg-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .lg-slots { grid-template-columns: 1fr !important; }
          .lg-cats  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .lg-input { width: 100%; padding: 9px 11px; border: 1px solid #e0ddd5; border-radius: 8px; font-size: 14px; box-sizing: border-box; background: #fff; }
        .lg-input:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
      `}</style>

      <div className="lg-wrap" style={{ paddingTop: 0, opacity: pending ? 0.6 : 1 }}>
        <ReconHeader
          title="月記帳輸入"
          subtitle="館長每日記帳：填好後系統自動算小計／總計，老闆即可對帳"
          backTo="/reconciliation"
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canEdit && (
                <a href="/reconciliation/ledger/import" style={{
                  fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600,
                  border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 12px', background: '#eff6ff',
                }}>📤 Excel 匯入</a>
              )}
              <a href={`/reconciliation/ledger/review?venue=${venueId}&ym=${ym}`} style={{
                fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 600,
                border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 12px', background: '#ecfdf5',
              }}>老闆對帳 →</a>
            </div>
          }
        />

        {!canEdit && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 12 }}>
            您目前的角色為唯讀，無法輸入記帳。
          </div>
        )}
        {err && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 12 }}>
            ⚠️ {err}
          </div>
        )}

        {/* 球館 + 月份 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          {venues.length > 1 ? (
            <select value={venueId} onChange={(e) => load(e.target.value, ym)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>{venueName}</span>
          )}
          <select value={ym} onChange={(e) => load(venueId, e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
            {monthOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {/* 日期橫條 */}
        <Panel title={`選擇日期（${ym}）`}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0' }}>
            {daysInMonthArr(ym).map((d) => {
              const dn = Number(d.slice(-2))
              const wd = weekdayOf(d)
              const isSel = d === selDate
              const isFilled = filledSet.has(d)
              return (
                <button key={d} onClick={() => setSelDate(d)}
                  style={{
                    width: 42, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                    border: isSel ? '2px solid #10b981' : '1px solid #e8e6e0',
                    background: isSel ? '#ecfdf5' : isFilled ? '#f0fdf4' : '#fff',
                    fontSize: 13, lineHeight: 1.3, textAlign: 'center', position: 'relative',
                  }}>
                  <div style={{ fontWeight: 600, color: (wd === 0 || wd === 6) ? '#e85d3a' : '#1a1917' }}>{dn}</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{WEEKDAY_LABEL[wd]}</div>
                  {isFilled && <div style={{ position: 'absolute', top: 2, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />}
                </button>
              )
            })}
          </div>
        </Panel>

        {draft && derived && (
          <>
            <div className="lg-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '4px 0 14px' }}>
              <StatCard label="場地費加總" value={`$${derived.courtTotal.toLocaleString()}`} accent="#2563eb" />
              <StatCard label="小計" value={`$${derived.subtotal.toLocaleString()}`} accent="#7c6af7" />
              <StatCard label="總計" value={`$${derived.total.toLocaleString()}`} accent="#10b981" />
              <StatCard label="冷門加總" value={`$${derived.offpeakTotal.toLocaleString()}`} sub={`平日 ${derived.offpeakWeekday.toLocaleString()} ／ 深夜 ${derived.offpeakLate.toLocaleString()}`} accent="#f59e0b" />
            </div>

            <Panel title="場地費 · 各時段（可輸入金額，或填「包場」「季租」等註記）">
              <div className="lg-slots" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_SLOTS.map((slot) => {
                  const v = draft.slots[slot.key]
                  return (
                    <label key={slot.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 52, fontSize: 12, color: '#666', flexShrink: 0 }}>{slot.label}</span>
                      <input className="lg-input" inputMode="text" disabled={!canEdit}
                        defaultValue={v === undefined ? '' : String(v)}
                        key={`${selDate}-${slot.key}`}
                        onBlur={(e) => patchSlot(slot.key, e.target.value)}
                        placeholder="—" />
                    </label>
                  )
                })}
              </div>
            </Panel>

            <Panel title="銷售類別">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_CATEGORY_FIELDS.map((f) => (
                  <NumField key={f.key} label={f.label} disabled={!canEdit}
                    value={(draft as unknown as Record<string, number>)[f.key]}
                    onChange={(n) => patch({ [f.key]: n } as Partial<LedgerDay>)} />
                ))}
              </div>
            </Panel>

            <Panel title="收費 / 退款">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_CHARGE_FIELDS.map((f) => (
                  <NumField key={f.key} label={f.label} disabled={!canEdit}
                    value={(draft as unknown as Record<string, number>)[f.key]}
                    onChange={(n) => patch({ [f.key]: n } as Partial<LedgerDay>)} />
                ))}
              </div>
            </Panel>

            <Panel title="冷氣（只記錄，不與系統比對）">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '6px 0', alignItems: 'end' }}>
                <NumField label="冷氣度數" disabled={!canEdit}
                  value={draft.acDegrees} onChange={(n) => patch({ acDegrees: n })} />
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>冷氣試算（一度 {LEDGER_AC_RATE} 元）</div>
                  <div style={{ padding: '9px 11px', background: '#f5f4f0', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                    ${derived.acEstimate.toLocaleString()}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="明細備註">
              <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
                <TextField label="包場、季打收費明細" disabled={!canEdit} value={draft.bookingNote} onChange={(t) => patch({ bookingNote: t })} />
                <TextField label="退款明細" disabled={!canEdit} value={draft.refundNote} onChange={(t) => patch({ refundNote: t })} />
                <TextField label="商品明細" disabled={!canEdit} value={draft.merchNote} onChange={(t) => patch({ merchNote: t })} />
              </div>
            </Panel>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: canEdit ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!canEdit} checked={draft.reported}
                  onChange={(e) => patch({ reported: e.target.checked })} style={{ width: 18, height: 18 }} />
                <span>回報完畢</span>
              </label>
              {canEdit && (
                <button onClick={save} disabled={pending} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none', cursor: pending ? 'default' : 'pointer',
                  background: savedTick ? '#059669' : '#10b981', color: '#fff', fontSize: 14, fontWeight: 600,
                }}>
                  {savedTick ? '✓ 已儲存' : pending ? '儲存中…' : '儲存當日記帳'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      <input className="lg-input" inputMode="numeric" disabled={disabled}
        defaultValue={value ? String(value) : ''}
        key={`${label}-${value}`}
        onBlur={(e) => { const n = Number(e.target.value.replace(/,/g, '')); onChange(Number.isFinite(n) ? n : 0) }}
        placeholder="0" />
    </label>
  )
}

function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (t: string) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      <input className="lg-input" type="text" disabled={disabled}
        defaultValue={value}
        key={`${label}-${value}`}
        onBlur={(e) => onChange(e.target.value)}
        placeholder="—" />
    </label>
  )
}
