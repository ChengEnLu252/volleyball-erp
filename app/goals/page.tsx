'use client'

// ============================================================
// /goals — 館長週目標（階段 16）
// ============================================================
// 角色感知單頁：
//   owner   → 看所有館目標，可「指派新目標」，對待確認目標「確認 / 退回」
//   manager → 看自己館目標，可「自訂目標」，對待完成 / 被退回目標上傳截圖並提交
//   staff   → 被 LayoutGuard 擋（denied）
//
// 上傳走既有 <EvidenceUpload sourceType="captain_goal" sourceId={goal.id}>，
// 上傳完成回傳 evidenceId → submitWeeklyGoal() → 自動通知老闆。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentEffectiveRole, getCurrentVisibleVenueIds, getCurrentUser,
  getVenue, listVenues,
  listWeeklyGoals, createWeeklyGoal, submitWeeklyGoal,
  confirmWeeklyGoal, returnWeeklyGoal,
  getCurrentWeekStart, formatWeekRange,
  WEEKLY_GOAL_STATUS_LABEL, WEEKLY_GOAL_SOURCE_LABEL,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { WeeklyGoal, WeeklyGoalStatus } from '@/types'
import { COLORS, FONTS, VENUE_COLOR } from '@/components/theme/tokens'
import EvidenceUpload from '@/components/EvidenceUpload'
import EvidencePreview from '@/components/EvidencePreview'

// 狀態色標
const STATUS_STYLE: Record<WeeklyGoalStatus, { bg: string; fg: string }> = {
  assigned:  { bg: COLORS.surfaceTint, fg: COLORS.ink500 },
  submitted: { bg: COLORS.warnBg,      fg: COLORS.amberDeep },
  confirmed: { bg: COLORS.successBg,   fg: COLORS.success },
  returned:  { bg: COLORS.dangerBg,    fg: COLORS.danger },
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function GoalsPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { hydrateStore(); setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const role = useMemo(() => (mounted ? getCurrentEffectiveRole() : 'owner'), [mounted, storeVersion])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => (mounted ? getCurrentVisibleVenueIds() : 'all'), [mounted, storeVersion])
  const me = mounted ? getCurrentUser() : null

  const thisWeek = getCurrentWeekStart()
  const [weekFilter, setWeekFilter] = useState<string>('') // '' = 本週；'all' = 全部；或某 weekStart

  // 所有可見目標（依視角過濾）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGoals = useMemo(() => listWeeklyGoals({ visible }), [visible, storeVersion, mounted])

  // 週下拉選項（出現過的所有週）
  const weekOptions = useMemo(() => {
    const set = new Set<string>(allGoals.map(g => g.weekStart))
    set.add(thisWeek)
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [allGoals, thisWeek])

  const goals = useMemo(() => {
    if (weekFilter === 'all') return allGoals
    const wk = weekFilter || thisWeek
    return allGoals.filter(g => g.weekStart === wk)
  }, [allGoals, weekFilter, thisWeek])

  const pendingCount = allGoals.filter(g => g.status === 'submitted').length

  if (!mounted) {
    return <div style={{ padding: 40, color: COLORS.ink500, fontSize: 14 }}>載入中…</div>
  }

  return (
    <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}>
      <style>{`@media(max-width:768px){.goal-wrap{padding-top:64px !important}}`}</style>
      <div className="goal-wrap">

        {/* Hero */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 館長目標
            </h1>
            <p style={{ fontSize: 13, color: COLORS.ink500, margin: '5px 0 0' }}>
              {role === 'owner'
                ? '指派各館每週目標、確認完成截圖'
                : '完成本週目標後上傳截圖提交，老闆會收到通知確認'}
            </p>
          </div>
          {role === 'owner' && pendingCount > 0 && (
            <div style={{
              padding: '8px 14px', borderRadius: 10, background: COLORS.warnBg,
              border: `1px solid ${COLORS.warnBorder}`, color: COLORS.amberDeep,
              fontSize: 13, fontWeight: 700,
            }}>
              ⏳ {pendingCount} 個目標待你確認
            </div>
          )}
        </div>

        {/* 週篩選 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: COLORS.ink500, fontWeight: 700 }}>檢視週次</span>
          <select
            value={weekFilter || thisWeek}
            onChange={e => setWeekFilter(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: COLORS.surface, fontSize: 13, color: COLORS.ink900,
            }}
          >
            {weekOptions.map(wk => (
              <option key={wk} value={wk}>
                {wk === thisWeek ? '本週' : ''} {formatWeekRange(wk)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setWeekFilter('all')}
            style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${weekFilter === 'all' ? COLORS.pink500 : COLORS.border}`,
              background: weekFilter === 'all' ? COLORS.pink500 : COLORS.surface,
              color: weekFilter === 'all' ? '#fff' : COLORS.ink700,
            }}
          >
            全部
          </button>
        </div>

        {/* 建立目標 */}
        <CreateGoalCard role={role} visible={visible} thisWeek={thisWeek} />

        {/* 目標清單 */}
        {goals.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center', color: COLORS.ink300, fontSize: 14,
            background: COLORS.surface, borderRadius: 12, border: `1px dashed ${COLORS.border}`,
          }}>
            這個區間還沒有目標
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {goals.map(g => (
              <GoalCard key={g.id} goal={g} role={role} meName={me?.name ?? '館長'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 建立目標卡（owner 指派 / manager 自訂）
// ============================================================
function CreateGoalCard({
  role, visible, thisWeek,
}: {
  role: 'owner' | 'manager' | 'staff' | 'none'
  visible: string[] | 'all'
  thisWeek: string
}) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')

  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    if (visible === 'all') return all
    return all.filter(v => visible.includes(v.id))
  }, [visible])

  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? '')
  useEffect(() => {
    if (!venueId && venues[0]) setVenueId(venues[0].id)
  }, [venues, venueId])

  if (role !== 'owner' && role !== 'manager') return null

  const submit = () => {
    if (!desc.trim()) { alert('請輸入目標說明'); return }
    if (!venueId) { alert('請選擇場館'); return }
    createWeeklyGoal({ venueId, weekStart: thisWeek, description: desc })
    setDesc('')
    setOpen(false)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', color: '#fff', border: 'none',
            background: `linear-gradient(95deg, ${COLORS.pink500}, ${COLORS.pink400})`,
            boxShadow: '0 4px 12px -2px rgba(255,45,138,0.45)',
          }}
        >
          ＋ {role === 'owner' ? '指派本週目標' : '自訂本週目標'}
        </button>
      ) : (
        <div style={{
          background: COLORS.surface, borderRadius: 12, padding: 16,
          border: `1px solid ${COLORS.border}`, boxShadow: '0 4px 16px -4px rgba(255,45,138,0.1)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            {role === 'owner' ? '指派本週目標' : '自訂本週目標'}（{formatWeekRange(thisWeek)}）
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <select
              value={venueId}
              onChange={e => setVenueId(e.target.value)}
              style={{
                padding: '9px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceTint, fontSize: 13, color: COLORS.ink900, minWidth: 130,
              }}
            >
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="例：本週主推護膝，目標售出 5 件；或推廣週四冷門場次"
              rows={2}
              style={{
                flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${COLORS.border}`, background: COLORS.surfaceTint,
                fontSize: 13, color: COLORS.ink900, fontFamily: FONTS.sans, resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={submit} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.pink500,
            }}>送出</button>
            <button onClick={() => { setOpen(false); setDesc('') }} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', color: COLORS.ink700, background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
            }}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 單一目標卡
// ============================================================
function GoalCard({
  goal, role, meName,
}: {
  key?: string | number
  goal: WeeklyGoal
  role: 'owner' | 'manager' | 'staff' | 'none'
  meName: string
}) {
  const venue = getVenue(goal.venueId)
  const accent = VENUE_COLOR[goal.venueId] ?? COLORS.pink500
  const st = STATUS_STYLE[goal.status]

  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')

  const canManagerUpload =
    role === 'manager' && (goal.status === 'assigned' || goal.status === 'returned')
  const canOwnerReview = role === 'owner' && goal.status === 'submitted'

  const onUploaded = (evidenceId: string) => {
    const r = submitWeeklyGoal({ goalId: goal.id, evidenceId })
    if (!r.ok) alert(r.reason)
  }

  const onConfirm = () => {
    const r = confirmWeeklyGoal({ goalId: goal.id })
    if (!r.ok) alert(r.reason)
  }

  const onReturn = () => {
    if (!reason.trim()) { alert('請填寫退回理由'); return }
    const r = returnWeeklyGoal({ goalId: goal.id, reason })
    if (!r.ok) { alert(r.reason); return }
    setReturning(false); setReason('')
  }

  return (
    <div style={{
      background: COLORS.surface, borderRadius: 12, padding: 16,
      border: `1px solid ${COLORS.borderLight}`,
      borderLeft: `4px solid ${accent}`,
      boxShadow: '0 4px 16px -4px rgba(255,45,138,0.08)',
    }}>
      {/* 頭部：場館 + 來源 + 狀態 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{venue?.name ?? goal.venueId}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: COLORS.surfaceTint, color: COLORS.ink500,
          }}>{WEEKLY_GOAL_SOURCE_LABEL[goal.source]}</span>
          <span style={{ fontSize: 11, color: COLORS.ink300 }}>{formatWeekRange(goal.weekStart)}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
          background: st.bg, color: st.fg, whiteSpace: 'nowrap',
        }}>{WEEKLY_GOAL_STATUS_LABEL[goal.status]}</span>
      </div>

      {/* 內容 */}
      <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 10px', color: COLORS.ink900 }}>
        {goal.description}
      </p>

      {/* 退回理由（被退回時顯示給館長） */}
      {goal.status === 'returned' && goal.returnReason && (
        <div style={{
          fontSize: 12, color: COLORS.danger, background: COLORS.dangerBg,
          padding: '8px 12px', borderRadius: 8, marginBottom: 10,
        }}>
          ↩ 老闆退回理由：{goal.returnReason}
        </div>
      )}

      {/* 已上傳截圖預覽 + 提交資訊 */}
      {goal.evidenceId && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <EvidencePreview value={goal.evidenceId} size={64} showFilename={false} />
          <div style={{ fontSize: 11, color: COLORS.ink500, lineHeight: 1.6 }}>
            <div>提交於 {fmtDateTime(goal.submittedAt)}</div>
            {goal.status === 'confirmed' && <div style={{ color: COLORS.success }}>老闆已確認 · {fmtDateTime(goal.confirmedAt)}</div>}
          </div>
        </div>
      )}

      {/* 館長操作：上傳截圖提交 */}
      {canManagerUpload && (
        <div style={{
          background: COLORS.surfaceTint, borderRadius: 10, padding: 12, marginTop: 4,
          border: `1px dashed ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink700, marginBottom: 8 }}>
            {goal.status === 'returned' ? '重新上傳完成截圖' : '上傳完成截圖提交'}
          </div>
          <EvidenceUpload
            sourceType="captain_goal"
            sourceId={goal.id}
            uploadedByName={meName}
            onUploaded={onUploaded}
            onError={(r) => alert(`上傳失敗：${r}`)}
            buttonLabel="選擇截圖"
          />
        </div>
      )}

      {/* 老闆操作：確認 / 退回 */}
      {canOwnerReview && (
        <div style={{ marginTop: 4 }}>
          {!returning ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onConfirm} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.success,
              }}>✓ 確認完成</button>
              <button onClick={() => setReturning(true)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', color: COLORS.danger, background: COLORS.dangerBg,
                border: `1px solid ${COLORS.dangerBg}`,
              }}>↩ 退回</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="退回理由（會通知館長）"
                style={{
                  flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${COLORS.border}`, background: COLORS.surface,
                  fontSize: 13, color: COLORS.ink900,
                }}
              />
              <button onClick={onReturn} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', color: '#fff', border: 'none', background: COLORS.danger,
              }}>確定退回</button>
              <button onClick={() => { setReturning(false); setReason('') }} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', color: COLORS.ink700, background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}>取消</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
