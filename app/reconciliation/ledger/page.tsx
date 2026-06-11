'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  getCurrentVisibleVenueIds,
  getEffectiveRole,
  listVenues,
} from '@/data/api'
import { useStoreSync, hydrateStore, upsertLedgerDay } from '@/data/store'
import {
  LEDGER_SLOTS,
  LEDGER_CATEGORY_FIELDS,
  LEDGER_CHARGE_FIELDS,
  LEDGER_AC_RATE,
  computeLedgerDerived,
  getLedgerDay,
  getLedgerMonth,
  makeEmptyLedgerDay,
  weekdayOf,
} from '@/data/ledger'
import type { LedgerDay, LedgerSlotValue } from '@/types'
import { ReconHeader, StatCard, Panel } from '@/components/reconciliation/Common'

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

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

function daysInMonthArr(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}

/** 把使用者輸入字串轉成 slot 值：空→刪除、純數字→number、其他→字串註記 */
function parseSlot(raw: string): LedgerSlotValue | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) && /^-?[\d,]+(\.\d+)?$/.test(t) ? n : t
}

export default function LedgerInputPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); hydrateStore() }, [])

  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => recentMonths(today), [today])

  // 角色 / 可見球館
  const user = mounted ? getCurrentUser() : null
  const role = mounted && user ? getEffectiveRole(user.id) : 'none'
  const canEdit = role === 'owner' || role === 'manager'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    return visible === 'all' ? all : all.filter(v => visible.includes(v.id))
  }, [visible])

  const [venueId, setVenueId] = useState<string>('')
  const [ym, setYm] = useState<string>(monthOptions[0].key)
  const [selDate, setSelDate] = useState<string>(today.toISOString().slice(0, 10))

  // 預設選第一個可見球館
  useEffect(() => {
    if (!venueId && venues.length > 0) setVenueId(venues[0].id)
  }, [venues, venueId])

  // 表單草稿（編輯中的 LedgerDay）
  const [draft, setDraft] = useState<LedgerDay | null>(null)
  const [savedTick, setSavedTick] = useState(0)

  // 切換 球館 / 日期 → 載入既有或建空白
  useEffect(() => {
    if (!mounted || !venueId || !user) return
    const existing = getLedgerDay(venueId, selDate)
    setDraft(existing ? { ...existing, slots: { ...existing.slots } } : makeEmptyLedgerDay(venueId, selDate, user.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, venueId, selDate, sv])

  const monthInfo = useMemo(
    () => (mounted && venueId) ? getLedgerMonth(venueId, ym) : null,
    [mounted, venueId, ym, sv],
  )

  if (!mounted) return <div style={{ padding: 24 }} />

  if (venues.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <ReconHeader title="月記帳輸入" subtitle="館長每日記帳" backTo="/reconciliation" />
        <Panel><div style={{ padding: 24, color: '#888', fontSize: 13 }}>沒有可記帳的球館。</div></Panel>
      </div>
    )
  }

  const derived = draft ? computeLedgerDerived(draft) : null
  const filledSet = new Set((monthInfo?.days ?? []).map(d => d.date))

  function patch(p: Partial<LedgerDay>) {
    setDraft(d => d ? { ...d, ...p } : d)
  }
  function patchSlot(key: string, raw: string) {
    setDraft(d => {
      if (!d) return d
      const slots = { ...d.slots }
      const v = parseSlot(raw)
      if (v === undefined) delete slots[key]
      else slots[key] = v
      return { ...d, slots }
    })
  }
  function save() {
    if (!draft || !user) return
    upsertLedgerDay({ ...draft, updatedBy: user.id, updatedAt: new Date().toISOString() })
    setSavedTick(t => t + 1)
    setTimeout(() => setSavedTick(0), 1800)
  }

  const venueName = venues.find(v => v.id === venueId)?.name ?? ''

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .lg-wrap   { padding-top: 64px !important; }
          .lg-stats  { grid-template-columns: repeat(2, 1fr) !important; }
          .lg-slots  { grid-template-columns: 1fr !important; }
          .lg-cats   { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .lg-input { width: 100%; padding: 9px 11px; border: 1px solid #e0ddd5; border-radius: 8px; font-size: 14px; box-sizing: border-box; background: #fff; }
        .lg-input:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.12); }
      `}</style>

      <div className="lg-wrap" style={{ paddingTop: 0 }}>
        <ReconHeader
          title="月記帳輸入"
          subtitle="館長每日記帳：填好後系統自動算小計／總計，老闆即可對帳"
          backTo="/reconciliation"
          actions={
            <a href="/reconciliation/ledger/review" style={{
              fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 600,
              border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 12px', background: '#ecfdf5',
            }}>老闆對帳 →</a>
          }
        />

        {!canEdit && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 12 }}>
            您目前的角色為唯讀，無法輸入記帳。
          </div>
        )}

        {/* 球館 + 月份 + 日期 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          {visible === 'all' && (
            <select value={venueId} onChange={e => setVenueId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {visible !== 'all' && (
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1917' }}>{venueName}</span>
          )}
          <select value={ym} onChange={e => setYm(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: '#fff' }}>
            {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {/* 日期橫條：點選某天進入編輯 */}
        <Panel title={`選擇日期（${ym}）`}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0' }}>
            {daysInMonthArr(ym).map(d => {
              const dn = Number(d.slice(-2))
              const wd = weekdayOf(d)
              const isSel = d === selDate && d.slice(0, 7) === ym
              const isFilled = filledSet.has(d)
              return (
                <button key={d} onClick={() => { setSelDate(d); if (ym !== d.slice(0, 7)) setYm(d.slice(0, 7)) }}
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
            {/* 即時衍生 KPI */}
            <div className="lg-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '4px 0 14px' }}>
              <StatCard label="場地費加總" value={`$${derived.courtTotal.toLocaleString()}`} accent="#2563eb" />
              <StatCard label="小計" value={`$${derived.subtotal.toLocaleString()}`} accent="#7c6af7" />
              <StatCard label="總計" value={`$${derived.total.toLocaleString()}`} accent="#10b981" />
              <StatCard label="冷門加總" value={`$${derived.offpeakTotal.toLocaleString()}`} sub={`平日 ${derived.offpeakWeekday.toLocaleString()} ／ 深夜 ${derived.offpeakLate.toLocaleString()}`} accent="#f59e0b" />
            </div>

            {/* 場地時段 */}
            <Panel title="場地費 · 各時段（可輸入金額，或填「包場」「季租」等註記）">
              <div className="lg-slots" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_SLOTS.map(slot => {
                  const v = draft.slots[slot.key]
                  return (
                    <label key={slot.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 52, fontSize: 12, color: '#666', flexShrink: 0 }}>{slot.label}</span>
                      <input className="lg-input" inputMode="text" disabled={!canEdit}
                        defaultValue={v === undefined ? '' : String(v)}
                        key={`${selDate}-${slot.key}`}
                        onBlur={e => patchSlot(slot.key, e.target.value)}
                        placeholder="—" />
                    </label>
                  )
                })}
              </div>
            </Panel>

            {/* 銷售類別 */}
            <Panel title="銷售類別">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_CATEGORY_FIELDS.map(f => (
                  <NumField key={f.key} label={f.label} disabled={!canEdit}
                    value={(draft as unknown as Record<string, number>)[f.key]}
                    onChange={n => patch({ [f.key]: n } as Partial<LedgerDay>)} />
                ))}
              </div>
            </Panel>

            {/* 收費 / 退款 */}
            <Panel title="收費 / 退款">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '6px 0' }}>
                {LEDGER_CHARGE_FIELDS.map(f => (
                  <NumField key={f.key} label={f.label} disabled={!canEdit}
                    value={(draft as unknown as Record<string, number>)[f.key]}
                    onChange={n => patch({ [f.key]: n } as Partial<LedgerDay>)} />
                ))}
              </div>
            </Panel>

            {/* 冷氣 */}
            <Panel title="冷氣（只記錄，不與系統比對）">
              <div className="lg-cats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '6px 0', alignItems: 'end' }}>
                <NumField label="冷氣度數" disabled={!canEdit}
                  value={draft.acDegrees} onChange={n => patch({ acDegrees: n })} />
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>冷氣試算（一度 {LEDGER_AC_RATE} 元）</div>
                  <div style={{ padding: '9px 11px', background: '#f5f4f0', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                    ${derived.acEstimate.toLocaleString()}
                  </div>
                </div>
              </div>
            </Panel>

            {/* 文字明細 */}
            <Panel title="明細備註">
              <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
                <TextField label="包場、季打收費明細" disabled={!canEdit}
                  value={draft.bookingNote} onChange={t => patch({ bookingNote: t })} />
                <TextField label="退款明細" disabled={!canEdit}
                  value={draft.refundNote} onChange={t => patch({ refundNote: t })} />
                <TextField label="商品明細" disabled={!canEdit}
                  value={draft.merchNote} onChange={t => patch({ merchNote: t })} />
              </div>
            </Panel>

            {/* 回報完畢 + 儲存 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: canEdit ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!canEdit} checked={draft.reported}
                  onChange={e => patch({ reported: e.target.checked })}
                  style={{ width: 18, height: 18 }} />
                <span>回報完畢</span>
              </label>
              {canEdit && (
                <button onClick={save} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: savedTick ? '#059669' : '#10b981', color: '#fff', fontSize: 14, fontWeight: 600,
                }}>
                  {savedTick ? '✓ 已儲存' : '儲存當日記帳'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (n: number) => void; disabled?: boolean
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      <input className="lg-input" inputMode="numeric" disabled={disabled}
        defaultValue={value ? String(value) : ''}
        key={`${label}-${value}`}
        onBlur={e => {
          const n = Number(e.target.value.replace(/,/g, ''))
          onChange(Number.isFinite(n) ? n : 0)
        }}
        placeholder="0" />
    </label>
  )
}

function TextField({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (t: string) => void; disabled?: boolean
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      <input className="lg-input" type="text" disabled={disabled}
        defaultValue={value}
        key={`${label}-${value}`}
        onBlur={e => onChange(e.target.value)}
        placeholder="—" />
    </label>
  )
}
