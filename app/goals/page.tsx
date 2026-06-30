'use client'

// ============================================================
// /goals — 館長週目標（P2.3c：工作流 + 通知落 DB）
// ============================================================
// 資料自取自 server action（loadGoalsAction）；建立/提交/確認/退回走 server action，
// 完成後 reload。截圖仍用既有 <EvidenceUpload>（瀏覽器端），evidenceId 引用存 DB；
// 截圖實體存物件儲存留 P4。
// ============================================================

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  WEEKLY_GOAL_STATUS_LABEL, WEEKLY_GOAL_SOURCE_LABEL,
} from '@/types'
import type { WeeklyGoal, WeeklyGoalStatus } from '@/types'
import { COLORS, FONTS, VENUE_COLOR } from '@/components/theme/tokens'
import EvidenceUpload from '@/components/EvidenceUpload'
import EvidencePreview from '@/components/EvidencePreview'
import {
  loadGoalsAction, createWeeklyGoalAction, submitWeeklyGoalAction,
  confirmWeeklyGoalAction, returnWeeklyGoalAction, type GoalsBundle,
} from '@/app/actions/goals'

const STATUS_STYLE: Record<WeeklyGoalStatus, { bg: string; fg: string }> = {
  assigned:  { bg: COLORS.surfaceTint, fg: COLORS.ink500 },
  submitted: { bg: COLORS.warnBg,      fg: COLORS.amberDeep },
  confirmed: { bg: COLORS.successBg,   fg: COLORS.success },
  returned:  { bg: COLORS.dangerBg,    fg: COLORS.danger },
}

/** 週標籤：「08/04 – 08/10」 */
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(weekStart + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const f = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
  return `${f(start)} – ${f(end)}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Ctx = {
  role: 'owner' | 'manager' | 'staff' | 'none'
  venues: { id: string; name: string }[]
  userName: string
  reload: () => void
  pending: boolean
}

export default function GoalsPage() {
  const [pending, startTransition] = useTransition()
  const [bundle, setBundle] = useState<GoalsBundle | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [weekFilter, setWeekFilter] = useState<string>('') // '' = 本週；'all' = 全部；或某 weekStart

  function reload() {
    startTransition(async () => {
      const res = await loadGoalsAction()
      setBundle(res); setLoaded(true)
    })
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ok = bundle?.ok ? bundle : null
  const role = ok?.role ?? 'none'
  const venues = ok?.venues ?? []
  const allGoals = ok?.goals ?? []
  const thisWeek = ok?.thisWeek ?? new Date().toISOString().slice(0, 10)
  const userName = ok?.userName ?? '館長'

  const weekOptions = useMemo(() => {
    const set = new Set<string>(allGoals.map((g) => g.weekStart))
    set.add(thisWeek)
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [allGoals, thisWeek])

  const goals = useMemo(() => {
    if (weekFilter === 'all') return allGoals
    const wk = weekFilter || thisWeek
    return allGoals.filter((g) => g.weekStart === wk)
  }, [allGoals, weekFilter, thisWeek])

  const pendingCount = allGoals.filter((g) => g.status === 'submitted').length
  const ctx: Ctx = { role, venues, userName, reload, pending }

  if (!loaded) return <div style={{ padding: 40, color: COLORS.ink500, fontSize: 14 }}>載入中…</div>
  if (!ok) return <div style={{ padding: 40, color: COLORS.ink500, fontSize: 14 }}>無權限或尚未登入。</div>

  return (
    <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}>
      <style>{`@media(max-width:768px){.goal-wrap{padding-top:64px !important}}`}</style>
      <div className="goal-wrap" style={{ opacity: pending ? 0.6 : 1 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>🎯 館長目標</h1>
            <p style={{ fontSize: 13, color: COLORS.ink500, margin: '5px 0 0' }}>
              {role === 'owner' ? '指派各館每週目標、確認完成截圖' : '完成本週目標後上傳截圖提交，老闆會收到通知確認'}
            </p>
          </div>
          {role === 'owner' && pendingCount > 0 && (
            <div style={{ padding: '8px 14px', borderRadius: 10, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, color: COLORS.amberDeep, fontSize: 13, fontWeight: 700 }}>
              ⏳ {pendingCount} 個目標待你確認
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: COLORS.ink500, fontWeight: 700 }}>檢視週次</span>
          <select value={weekFilter || thisWeek} onChange={(e) => setWeekFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surface, fontSize: 13, color: COLORS.ink900 }}>
            {weekOptions.map((wk) => <option key={wk} value={wk}>{wk === thisWeek ? '本週' : ''} {formatWeekRange(wk)}</option>)}
          </select>
          <button onClick={() => setWeekFilter('all')}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${weekFilter === 'all' ? COLORS.pink500 : COLORS.border}`, background: weekFilter === 'all' ? COLORS.pink500 : COLORS.surface, color: weekFilter === 'all' ? '#fff' : COLORS.ink700 }}>全部</button>
        </div>

        <CreateGoalCard ctx={ctx} thisWeek={thisWeek} />

        {goals.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: COLORS.ink300, fontSize: 14, background: COLORS.surface, borderRadius: 12, border: `1px dashed ${COLORS.border}` }}>這個區間還沒有目標</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {goals.map((g) => <GoalCard key={g.id} goal={g} ctx={ctx} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateGoalCard({ ctx, thisWeek }: { ctx: Ctx; thisWeek: string }) {
  const { role, venues, reload } = ctx
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? '')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (!venueId && venues[0]) setVenueId(venues[0].id) }, [venues, venueId])

  if (role !== 'owner' && role !== 'manager') return null

  const submit = async () => {
    setErr(null)
    if (!desc.trim()) { setErr('請輸入目標說明'); return }
    if (!venueId) { setErr('請選擇場館'); return }
    const r = await createWeeklyGoalAction({ venueId, weekStart: thisWeek, description: desc })
    if (!r.ok) { setErr(r.reason); return }
    setDesc(''); setOpen(false); reload()
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none', background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`, boxShadow: '0 4px 12px -2px rgba(255,45,138,0.45)' }}>
          ＋ {role === 'owner' ? '指派本週目標' : '自訂本週目標'}
        </button>
      ) : (
        <div style={{ background: COLORS.surface, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}`, boxShadow: '0 4px 16px -4px rgba(255,45,138,0.1)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{role === 'owner' ? '指派本週目標' : '自訂本週目標'}（{formatWeekRange(thisWeek)}）</div>
          {err && <div style={{ fontSize: 12, color: COLORS.danger, marginBottom: 8 }}>⚠️ {err}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceTint, fontSize: 13, color: COLORS.ink900, minWidth: 130 }}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例：本週主推護膝，目標售出 5 件；或推廣週四冷門場次" rows={2}
              style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceTint, fontSize: 13, color: COLORS.ink900, fontFamily: FONTS.sans, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={submit} disabled={ctx.pending} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.pink500 }}>送出</button>
            <button onClick={() => { setOpen(false); setDesc(''); setErr(null) }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: COLORS.ink700, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, ctx }: { goal: WeeklyGoal; ctx: Ctx }) {
  const { role, venues, userName, reload } = ctx
  const venue = venues.find((v) => v.id === goal.venueId)
  const accent = VENUE_COLOR[goal.venueId] ?? COLORS.pink500
  const st = STATUS_STYLE[goal.status]
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const canManagerUpload = role === 'manager' && (goal.status === 'assigned' || goal.status === 'returned')
  const canOwnerReview = role === 'owner' && goal.status === 'submitted'

  const onUploaded = async (evidenceId: string) => {
    const r = await submitWeeklyGoalAction({ goalId: goal.id, evidenceId })
    if (!r.ok) { setErr(r.reason); return }
    reload()
  }
  const onConfirm = async () => {
    const r = await confirmWeeklyGoalAction({ goalId: goal.id })
    if (!r.ok) { setErr(r.reason); return }
    reload()
  }
  const onReturn = async () => {
    setErr(null)
    if (!reason.trim()) { setErr('請填寫退回理由'); return }
    const r = await returnWeeklyGoalAction({ goalId: goal.id, reason })
    if (!r.ok) { setErr(r.reason); return }
    setReturning(false); setReason(''); reload()
  }

  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.borderLight}`, borderLeft: `4px solid ${accent}`, boxShadow: '0 4px 16px -4px rgba(255,45,138,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{venue?.name ?? goal.venueId}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: COLORS.surfaceTint, color: COLORS.ink500 }}>{WEEKLY_GOAL_SOURCE_LABEL[goal.source]}</span>
          <span style={{ fontSize: 11, color: COLORS.ink300 }}>{formatWeekRange(goal.weekStart)}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{WEEKLY_GOAL_STATUS_LABEL[goal.status]}</span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 10px', color: COLORS.ink900 }}>{goal.description}</p>

      {goal.status === 'returned' && goal.returnReason && (
        <div style={{ fontSize: 12, color: COLORS.danger, background: COLORS.dangerBg, padding: '8px 12px', borderRadius: 8, marginBottom: 10 }}>↩ 老闆退回理由：{goal.returnReason}</div>
      )}

      {goal.evidenceId && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <EvidencePreview value={goal.evidenceId} size={64} showFilename={false} />
          <div style={{ fontSize: 11, color: COLORS.ink500, lineHeight: 1.6 }}>
            <div>提交於 {fmtDateTime(goal.submittedAt)}</div>
            {goal.status === 'confirmed' && <div style={{ color: COLORS.success }}>老闆已確認 · {fmtDateTime(goal.confirmedAt)}</div>}
          </div>
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: COLORS.danger, marginBottom: 8 }}>⚠️ {err}</div>}

      {canManagerUpload && (
        <div style={{ background: COLORS.surfaceTint, borderRadius: 10, padding: 12, marginTop: 4, border: `1px dashed ${COLORS.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink700, marginBottom: 8 }}>{goal.status === 'returned' ? '重新上傳完成截圖' : '上傳完成截圖提交'}</div>
          <EvidenceUpload sourceType="captain_goal" sourceId={goal.id} uploadedByName={userName} onUploaded={onUploaded} onError={(r) => setErr(`上傳失敗：${r}`)} buttonLabel="選擇截圖" />
        </div>
      )}

      {canOwnerReview && (
        <div style={{ marginTop: 4 }}>
          {!returning ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onConfirm} disabled={ctx.pending} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.success }}>✓ 確認完成</button>
              <button onClick={() => setReturning(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: COLORS.danger, background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBg}` }}>↩ 退回</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="退回理由（會通知館長）" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surface, fontSize: 13, color: COLORS.ink900 }} />
              <button onClick={onReturn} disabled={ctx.pending} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.danger }}>確定退回</button>
              <button onClick={() => { setReturning(false); setReason('') }} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: COLORS.ink700, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>取消</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
