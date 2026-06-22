'use client'

// 新增場次畫面（client）。球館 + 時段範本由 server 殼 props 傳入；
// 預覽/建立走 server action（previewBatchExpansionAction / expandTimeslotToSessionsAction /
// createCustomSessionAction）。

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  previewBatchExpansionAction, expandTimeslotToSessionsAction, createCustomSessionAction,
} from '@/app/actions/sessions'
import type { Timeslot, SessionType, NetHeight, SkillLevel } from '@/types'
import type { EffectiveRole } from '@/data/permissions'
import type { BatchPreview } from '@/data/server/queries'

type OkPreview = Extract<BatchPreview, { ok: true }>
type VenueLite = { id: string; name: string }

const SESSION_TYPE_OPTIONS: Array<{ value: SessionType; label: string }> = [
  { value: 'male_only', label: '男網純男場' }, { value: 'male_mixed', label: '男網混排' }, { value: 'male_position', label: '男網專位' },
  { value: 'female_only', label: '女網純女場' }, { value: 'female_mixed', label: '女網混排' }, { value: 'female_position', label: '女網專位' },
]
const NET_HEIGHT_OPTIONS: Array<{ value: NetHeight; label: string }> = [
  { value: 'male', label: '男網（2.43m）' }, { value: 'female', label: '女網（2.24m）' }, { value: 'adjustable', label: '可調' },
]
const SKILL_OPTIONS: Array<SkillLevel> = ['E', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S*']
const WEEKS_OPTIONS = [2, 4, 8, 12] as const
const WEEK_LABELS_FULL = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function today(): string {
  const d = new Date(); const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Tab = 'batch' | 'manual'

export default function SessionNewClient({
  venues, timeslots, role,
}: {
  venues: VenueLite[]
  timeslots: Timeslot[]
  role: EffectiveRole
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('batch')
  const tsByVenue = useMemo(() => {
    const m = new Map<string, Timeslot[]>()
    for (const t of timeslots) { const a = m.get(t.venueId) ?? []; a.push(t); m.set(t.venueId, a) }
    return m
  }, [timeslots])

  if (role === 'staff') {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>權限不足</h1>
        <p style={{ color: '#888', fontSize: 14 }}>新增場次需館長以上權限。</p>
        <Link href="/sessions" style={{ color: '#5b4fd8', fontSize: 13 }}>← 回場次管理</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/sessions" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>← 場次管理</Link>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '6px 0 4px' }}>新增場次</h1>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>「範本批量」適合一次展開週週固定時段，「單場手動」適合臨時加場</p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: '#fff', borderRadius: 12, padding: 4, border: '1px solid #e8e6e0' }}>
        <TabBtn active={tab === 'batch'} onClick={() => setTab('batch')} icon="📋" label="範本批量" hint="從常用時段一鍵展開未來 N 週" />
        <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')} icon="✏️" label="單場手動" hint="逐欄位設定，可不綁範本" />
      </div>
      {tab === 'batch' && <BatchForm venues={venues} tsByVenue={tsByVenue} onCreated={() => router.push('/sessions')} />}
      {tab === 'manual' && <ManualForm venues={venues} tsByVenue={tsByVenue} onCreated={(id) => router.push(`/sessions/${id}`)} />}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: string; label: string; hint: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none', background: active ? '#1a1917' : 'transparent', color: active ? '#fff' : '#555', cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>{icon}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span></div>
      <div style={{ fontSize: 11, opacity: active ? 0.8 : 0.5, marginTop: 4 }}>{hint}</div>
    </button>
  )
}

function sortTs(list: Timeslot[]): Timeslot[] {
  return [...list].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
}

// ── Batch ───────────────────────────────────────────────────
function BatchForm({ venues, tsByVenue, onCreated }: { venues: VenueLite[]; tsByVenue: Map<string, Timeslot[]>; onCreated: (firstId: string) => void }) {
  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? '')
  const timeslots = useMemo(() => sortTs(tsByVenue.get(venueId) ?? []), [tsByVenue, venueId])
  const [timeslotId, setTimeslotId] = useState<string>('')
  useEffect(() => {
    if (timeslots.length > 0 && !timeslots.find(t => t.id === timeslotId)) setTimeslotId(timeslots[0]!.id)
    else if (timeslots.length === 0) setTimeslotId('')
  }, [timeslots, timeslotId])

  const [weeks, setWeeks] = useState<number>(4)
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [preview, setPreview] = useState<BatchPreview | null>(null)

  useEffect(() => {
    if (!timeslotId) { setPreview(null); return }
    let cancelled = false
    previewBatchExpansionAction({ timeslotId, fromDate: today(), weeks }).then(p => { if (!cancelled) setPreview(p) })
    return () => { cancelled = true }
  }, [timeslotId, weeks])

  async function handleCreate() {
    if (!timeslotId) return
    setSubmitting(true)
    const result = await expandTimeslotToSessionsAction({ timeslotId, fromDate: today(), weeks, notes: notes.trim() || null })
    setSubmitting(false)
    if (!result.ok) { alert(result.reason); return }
    alert(`已建立 ${result.createdSessionIds.length} 筆場次${result.skippedDates.length > 0 ? `（略過 ${result.skippedDates.length} 筆已存在日期）` : ''}`)
    onCreated(result.createdSessionIds[0] ?? '')
  }

  const okPreview = preview?.ok ? preview : null

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Section title="1. 選擇範本">
        <FieldRow label="球館"><Select value={venueId} onChange={setVenueId}>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></FieldRow>
        <FieldRow label="時段範本">
          {timeslots.length === 0 ? (<div style={{ fontSize: 12, color: '#aaa' }}>此館尚無時段範本</div>) : (
            <Select value={timeslotId} onChange={setTimeslotId}>
              {timeslots.map(ts => <option key={ts.id} value={ts.id}>{WEEK_LABELS_FULL[ts.dayOfWeek]} {ts.startTime}–{ts.endTime}{ts.court ? ` · ${ts.court}` : ''}{ts.label ? ` （${ts.label}）` : ''}</option>)}
            </Select>
          )}
        </FieldRow>
      </Section>

      <Section title="2. 展開週數">
        <div style={{ display: 'flex', gap: 8 }}>
          {WEEKS_OPTIONS.map(w => (
            <button key={w} onClick={() => setWeeks(w)} style={{ flex: 1, padding: '12px', borderRadius: 8, border: weeks === w ? '2px solid #1a1917' : '1px solid #e8e6e0', background: weeks === w ? '#1a1917' : '#fff', color: weeks === w ? '#fff' : '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{w} 週</button>
          ))}
        </div>
        <FieldRow label="統一備註（可選）" inline><Input value={notes} onChange={setNotes} placeholder="例：暑假特別場、B 以上" /></FieldRow>
      </Section>

      {okPreview && (<Section title="3. 預覽"><PreviewSummary preview={okPreview} /><PreviewDateList dates={okPreview.dates} /></Section>)}
      {preview && !preview.ok && (<div style={{ padding: 16, background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{preview.reason}</div>)}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <Link href="/sessions" style={{ padding: '11px 22px', borderRadius: 8, border: '1px solid #e8e6e0', textDecoration: 'none', color: '#555', fontSize: 14, fontWeight: 500 }}>取消</Link>
        <button onClick={() => setShowConfirm(true)} disabled={!okPreview || okPreview.totalNew === 0 || submitting}
          style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: (!okPreview || okPreview.totalNew === 0 || submitting) ? '#ccc' : '#1a1917', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!okPreview || okPreview.totalNew === 0 || submitting) ? 'not-allowed' : 'pointer' }}>
          建立 {okPreview ? okPreview.totalNew : 0} 筆場次
        </button>
      </div>

      {showConfirm && okPreview && (
        <ConfirmModal
          title={`確認建立 ${okPreview.totalNew} 筆場次？`}
          body={`將在 ${okPreview.venueName} 展開 ${WEEK_LABELS_FULL[okPreview.timeslot.dayOfWeek]} ${okPreview.timeslot.startTime}–${okPreview.timeslot.endTime} 共 ${okPreview.totalNew} 筆${okPreview.totalSkipped > 0 ? `（${okPreview.totalSkipped} 筆已存在會自動略過）` : ''}。`}
          confirmLabel="確認建立"
          onConfirm={() => { setShowConfirm(false); handleCreate() }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}

function PreviewSummary({ preview }: { preview: OkPreview }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
      <StatBox label="球館" value={preview.venueName} />
      <StatBox label="新建筆數" value={`${preview.totalNew}`} suffix="筆" color="#10b981" />
      <StatBox label="自動略過" value={`${preview.totalSkipped}`} suffix="筆" color={preview.totalSkipped > 0 ? '#d97706' : '#aaa'} />
    </div>
  )
}

function PreviewDateList({ dates }: { dates: Array<{ date: string; skip: boolean; reason: string | null }> }) {
  return (
    <div style={{ background: '#fafaf8', borderRadius: 10, padding: 12, maxHeight: 240, overflowY: 'auto', border: '1px solid #f0ede6' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
        {dates.map(d => {
          const [y, m, dd] = d.date.split('-').map(Number)
          const dow = WEEK_LABELS_FULL[new Date(y!, m! - 1, dd!).getDay()]
          return (
            <div key={d.date} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 11.5, background: d.skip ? '#fef3c7' : '#dcfce7', color: d.skip ? '#92400e' : '#166534', opacity: d.skip ? 0.7 : 1, fontWeight: 500 }}>
              <div style={{ fontWeight: 700 }}>{d.date.slice(5)}</div>
              <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>{dow} · {d.skip ? '略過' : '新建'}</div>
              {d.skip && d.reason && <div style={{ fontSize: 9.5, marginTop: 2, opacity: 0.7 }}>{d.reason}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Manual ──────────────────────────────────────────────────
function ManualForm({ venues, tsByVenue, onCreated }: { venues: VenueLite[]; tsByVenue: Map<string, Timeslot[]>; onCreated: (sessionId: string) => void }) {
  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? '')
  const timeslots = useMemo(() => sortTs(tsByVenue.get(venueId) ?? []), [tsByVenue, venueId])
  const [timeslotId, setTimeslotId] = useState<string>('')
  const [sessionDate, setSessionDate] = useState<string>(today())
  const [startTime, setStartTime] = useState<string>('19:00')
  const [endTime, setEndTime] = useState<string>('22:00')
  const [court, setCourt] = useState<string>('')
  const [netHeight, setNetHeight] = useState<NetHeight>('male')
  const [sessionType, setSessionType] = useState<SessionType>('male_mixed')
  const [courtFee, setCourtFee] = useState<number>(280)
  const [acFee, setAcFee] = useState<number>(0)
  const [acEnabled, setAcEnabled] = useState<boolean>(false)
  const [maxCapacity, setMaxCapacity] = useState<number>(18)
  const [minSkill, setMinSkill] = useState<SkillLevel | ''>('')
  const [maxSkill, setMaxSkill] = useState<SkillLevel | ''>('')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')

  function applyTimeslot(tsId: string) {
    setTimeslotId(tsId)
    if (!tsId) return
    const ts = timeslots.find(t => t.id === tsId)
    if (!ts) return
    setStartTime(ts.startTime); setEndTime(ts.endTime); setCourt(ts.court ?? '')
    setNetHeight(ts.defaultNetHeight); setSessionType(ts.defaultSessionType); setCourtFee(ts.defaultCourtFee)
    setMaxCapacity(ts.defaultMaxCapacity); setMinSkill(ts.defaultMinSkillRequired ?? ''); setMaxSkill(ts.defaultMaxSkillAllowed ?? '')
    const start = new Date(today() + 'T00:00:00')
    const offset = (ts.dayOfWeek - start.getDay() + 7) % 7
    start.setDate(start.getDate() + offset)
    const pad = (n: number) => n.toString().padStart(2, '0')
    setSessionDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`)
  }

  async function handleSubmit() {
    setError(''); setSubmitting(true)
    const result = await createCustomSessionAction({
      venueId, timeslotId: timeslotId || null, sessionDate, startTime, endTime, court: court.trim() || null,
      netHeight, sessionType, courtFee, acFee: acFee || 0, acEnabled: acFee > 0 ? acEnabled : false,
      maxCapacity, minSkillRequired: minSkill || null, maxSkillAllowed: maxSkill || null, notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (!result.ok) { setError(result.reason); return }
    onCreated(result.sessionId)
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Section title="基本資訊">
        <FieldRow label="球館"><Select value={venueId} onChange={setVenueId}>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></FieldRow>
        <FieldRow label="基於範本（選填）">
          <Select value={timeslotId} onChange={applyTimeslot}>
            <option value="">— 不綁範本（臨時場次）—</option>
            {timeslots.map(ts => <option key={ts.id} value={ts.id}>{WEEK_LABELS_FULL[ts.dayOfWeek]} {ts.startTime}–{ts.endTime}{ts.label ? ` · ${ts.label}` : ''}</option>)}
          </Select>
        </FieldRow>
      </Section>

      <Section title="時間與場地">
        <FieldRow label="日期"><Input type="date" value={sessionDate} onChange={setSessionDate} /></FieldRow>
        <FieldRow label="時段">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input type="time" value={startTime} onChange={setStartTime} /><span style={{ color: '#888' }}>—</span><Input type="time" value={endTime} onChange={setEndTime} />
          </div>
        </FieldRow>
        <FieldRow label="場地（選填）"><Input value={court} onChange={setCourt} placeholder="例：A 場 / 主場地" /></FieldRow>
      </Section>

      <Section title="場次設定">
        <FieldRow label="網高"><Select value={netHeight} onChange={(v: string) => setNetHeight(v as NetHeight)}>{NET_HEIGHT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></FieldRow>
        <FieldRow label="場次類型"><Select value={sessionType} onChange={(v: string) => setSessionType(v as SessionType)}>{SESSION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></FieldRow>
        <FieldRow label="容量上限"><Input type="number" value={String(maxCapacity)} onChange={(v: string) => setMaxCapacity(Math.max(1, Number(v) || 1))} /></FieldRow>
      </Section>

      <Section title="程度範圍（選填）">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FieldRow label="最低程度" inline><Select value={minSkill} onChange={(v: string) => setMinSkill(v as SkillLevel | '')}><option value="">不限</option>{SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</Select></FieldRow>
          <FieldRow label="最高程度" inline><Select value={maxSkill} onChange={(v: string) => setMaxSkill(v as SkillLevel | '')}><option value="">不限</option>{SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</Select></FieldRow>
        </div>
      </Section>

      <Section title="費用">
        <FieldRow label="球費（每位）"><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#888' }}>$</span><Input type="number" value={String(courtFee)} onChange={(v: string) => setCourtFee(Math.max(0, Number(v) || 0))} /></div></FieldRow>
        <FieldRow label="冷氣費（每位）"><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#888' }}>$</span><Input type="number" value={String(acFee)} onChange={(v: string) => setAcFee(Math.max(0, Number(v) || 0))} placeholder="0 = 此場無冷氣選項" /></div></FieldRow>
        {acFee > 0 && (
          <FieldRow label="本場是否開冷氣" inline>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={acEnabled} onChange={e => setAcEnabled(e.target.checked)} /><span>是（開冷氣，客人需付冷氣費）</span>
            </label>
          </FieldRow>
        )}
      </Section>

      <Section title="備註（選填）"><Input value={notes} onChange={setNotes} placeholder="例：歡迎新手、需自備飲水" /></Section>

      {error && <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>⚠ {error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <Link href="/sessions" style={{ padding: '11px 22px', borderRadius: 8, border: '1px solid #e8e6e0', textDecoration: 'none', color: '#555', fontSize: 14, fontWeight: 500 }}>取消</Link>
        <button onClick={handleSubmit} disabled={submitting || !venueId || !sessionDate || !startTime || !endTime}
          style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: (submitting || !venueId || !sessionDate || !startTime || !endTime) ? '#ccc' : '#1a1917', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (submitting || !venueId || !sessionDate || !startTime || !endTime) ? 'not-allowed' : 'pointer' }}>
          {submitting ? '建立中…' : '建立場次'}
        </button>
      </div>
    </div>
  )
}

// ── 通用元件 ─────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '18px 22px' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: '#555' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  )
}
function FieldRow({ label, inline, children }: { label: string; inline?: boolean; children: React.ReactNode }) {
  if (inline) return (<div><div style={{ fontSize: 11.5, color: '#888', marginBottom: 5 }}>{label}</div>{children}</div>)
  return (<label style={{ display: 'block' }}><div style={{ fontSize: 11.5, color: '#888', marginBottom: 5 }}>{label}</div>{children}</label>)
}
function Input({ value, onChange, type, placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }} />
}
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit' }}>{children}</select>
}
function StatBox({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10.5, color: '#888', marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? '#1a1917', lineHeight: 1 }}>{value}{suffix && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 3 }}>{suffix}</span>}</div>
    </div>
  )
}
function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '24px 26px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px' }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: '0 0 20px' }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', color: '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>取消</button>
          <button onClick={onConfirm} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1a1917', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
