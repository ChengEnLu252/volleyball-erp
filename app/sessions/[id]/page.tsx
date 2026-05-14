'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getSession, listSessionRegistrations, listSessions,
  cancelSession, countPendingRefundsForSession,
  getCurrentUser,
} from '@/data/api'
import { useStoreSync } from '@/data/store'
import { REGISTRATION_TYPE_LABEL } from '@/types'
import type { ConflictResult } from '@/types'
import ConflictBanner from '@/components/ConflictBanner'

const SKILL_LABEL: Record<string, string> = {
  'E':'E','D':'D','C':'C','B':'B','B+':'B+','A':'A','A+':'A+','S':'S','S*':'S*',
}
const SKILL_COLOR: Record<string, { bg: string; text: string }> = {
  'E':  { bg: '#f1f5f9', text: '#64748b' },
  'D':  { bg: '#e2f0fb', text: '#1e6098' },
  'C':  { bg: '#dbeafe', text: '#1e40af' },
  'B':  { bg: '#dcfce7', text: '#166534' },
  'B+': { bg: '#fef3c7', text: '#92400e' },
  'A':  { bg: '#fed7aa', text: '#9a3412' },
  'A+': { bg: '#fce7f3', text: '#9d174d' },
  'S':  { bg: '#f3e8ff', text: '#6b21a8' },
  'S*': { bg: '#1a1917', text: '#d4a843' },
}
const PAYMENT_LABEL: Record<string, string> = {
  paid: '已付清', unpaid: '未付款', partial: '部分付款', refunded: '已退款',
}
const PAYMENT_COLOR: Record<string, { bg: string; text: string }> = {
  paid:     { bg: '#dcfce7', text: '#166534' },
  unpaid:   { bg: '#fee2e2', text: '#991b1b' },
  partial:  { bg: '#fef3c7', text: '#92400e' },
  refunded: { bg: '#f1f5f9', text: '#64748b' },
}
const METHOD_LABEL: Record<string, string> = {
  cash: '現金', transfer: '轉帳', online: '線上',
}

const TYPE_BG: Record<string, { bg: string; text: string }> = {
  season_player:     { bg: '#dbeafe', text: '#1e40af' },
  season_substitute: { bg: '#fef3c7', text: '#92400e' },
  walk_in:           { bg: '#f5f4f0', text: '#666' },
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // 階段 10：mutation 互動需要訂閱 store 才能看到 cancelSession 後 status 變化
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // 找指定的場次；找不到時退回到「最有戲劇感」的今天場次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => {
    const s = getSession(id)
    if (s) return s
    const today = new Date().toISOString().split('T')[0]
    const todays = listSessions({ date: today })
    if (todays.length > 0) return todays.reduce((a, b) =>
      (b.currentCount ?? 0) > (a.currentCount ?? 0) ? b : a)
    return listSessions()[0]
  }, [id, storeVersion])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const registrations = useMemo(() => {
    if (!session) return []
    return listSessionRegistrations(session.id).map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      paymentStatus: r.paymentStatus ?? 'unpaid',
      method: r.paymentMethod ?? 'cash',
      amount: r.expectedAmount ?? 0,
      customer: r.customer,
    }))
  }, [session, storeVersion])

  // ── 階段 10：取消場次 modal 狀態 ──────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  /** 剛取消成功 → 顯示「待退費 N 筆」reminder 橫幅 */
  const [recentlyCancelled, setRecentlyCancelled] = useState<{ pendingRefundCount: number } | null>(null)

  // baseUpdatedAt snapshot：當 session.updatedAt 改變且非衝突狀態，sync
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(session?.updatedAt ?? '')
  useEffect(() => {
    if (!session) return
    if (!conflict && session.updatedAt !== baseUpdatedAt) {
      setBaseUpdatedAt(session.updatedAt)
    }
  }, [session, conflict, baseUpdatedAt])
  const reloadSnapshot = () => {
    setConflict(null)
    if (session) setBaseUpdatedAt(session.updatedAt)
  }

  if (!session) {
    return <div style={{ padding: 24 }}>場次不存在。</div>
  }

  const paidCount   = registrations.filter(r => r.type === 'season_player' || r.paymentStatus === 'paid').length
  const unpaidCount = registrations.filter(r => r.type !== 'season_player' && r.paymentStatus !== 'paid').length
  const totalPaid   = registrations
    .filter(r => r.type !== 'season_player' && r.paymentStatus === 'paid')
    .reduce((s, r) => s + r.amount, 0)

  // 可否取消：open / full 狀態才能取消；status='cancelled' / 'completed' 不行
  const canCancel = mounted && (session.status === 'open' || session.status === 'full')
  const currentUser = mounted ? getCurrentUser() : null

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <a href="/sessions" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ‹ 返回場次列表
        </a>
        {canCancel && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            style={{
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #fecaca', background: '#fff', color: '#991b1b',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
          >
            🚫 取消場次
          </button>
        )}
        {session.status === 'cancelled' && (
          <span style={{ padding: '5px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>
            此場次已取消
          </span>
        )}
      </div>

      {/* 取消後 reminder（顯示一次，按 × 關掉） */}
      {recentlyCancelled && (
        <div style={{
          background: recentlyCancelled.pendingRefundCount > 0 ? '#fff7ed' : '#f0fdf4',
          border: `1px solid ${recentlyCancelled.pendingRefundCount > 0 ? '#fb923c' : '#86efac'}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>
            {recentlyCancelled.pendingRefundCount > 0 ? '💰' : '✓'}
          </div>
          <div style={{ flex: 1, fontSize: 13, color: recentlyCancelled.pendingRefundCount > 0 ? '#7c2d12' : '#166534' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              場次已取消
              {recentlyCancelled.pendingRefundCount > 0 && (
                <> · <span style={{ color: '#9a3412' }}>需處理退費</span></>
              )}
            </div>
            {recentlyCancelled.pendingRefundCount > 0 ? (
              <div>
                此場次有 <strong>{recentlyCancelled.pendingRefundCount}</strong> 筆已付款報名，請至
                <Link href="/finance/refunds" style={{
                  marginLeft: 6, padding: '3px 10px', borderRadius: 6,
                  background: '#c2410c', color: '#fff', textDecoration: 'none',
                  fontWeight: 600, fontSize: 12,
                }}>
                  退費處理 →
                </Link>
                {' '}進行退款或標記放棄退費。
              </div>
            ) : (
              <div>此場次沒有已付款報名，無需處理退費。</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRecentlyCancelled(null)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 16, color: '#888', padding: 0, lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      {/* 樂觀鎖衝突 banner */}
      {conflict && (
        <ConflictBanner conflict={conflict} onReload={reloadSnapshot} onDismiss={() => setConflict(null)} />
      )}

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
        padding: '20px 24px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{session.venueName}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {session.sessionDate} · {session.startTime}–{session.endTime} · {session.court ?? '主場地'}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            球費 ${session.courtFee}
            {session.acEnabled && session.acFee > 0 && <span style={{ color: '#3b82f6' }}> · 冷氣費 +${session.acFee}</span>}
            {session.seasonRentalId && <span style={{ color: '#1e40af' }}> · 季租場</span>}
            {session.isUnattended && <span style={{ color: '#d97706' }}> · 無人場</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <Stat label="報名人數" value={`${registrations.length} / ${session.maxCapacity}`} />
          <Stat label="已付款"   value={`${paidCount} 人`}   color="#059669" />
          <Stat label="未付款"   value={`${unpaidCount} 人`} color={unpaidCount > 0 ? '#e85d3a' : '#059669'} />
          <Stat label="已收金額" value={`$${totalPaid.toLocaleString()}`} color="#2563eb" />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
        <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600 }}>
          報名名單（{registrations.length} 人）
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 70px 70px 80px 80px 100px 90px',
          padding: '8px 20px', background: '#fafaf8',
          fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12,
        }}>
          <div>#</div><div>姓名</div><div>程度</div><div>類型</div><div>報到</div><div>付款方式</div><div>付款狀態</div><div style={{ textAlign: 'right' }}>金額</div>
        </div>

        {registrations.map((reg, i) => (
          <div key={reg.id} style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 70px 70px 80px 80px 100px 90px',
            padding: '12px 20px', borderTop: '1px solid #f5f4f0',
            alignItems: 'center', gap: 12,
            background: reg.type !== 'season_player' && reg.paymentStatus === 'unpaid' ? '#fffbfb' : '#fff',
          }}>
            <div style={{ fontSize: 13, color: '#aaa' }}>{i + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: '#e8e6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: '#5b4fd8', flexShrink: 0,
              }}>
                {reg.customer.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{reg.customer.name}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{reg.customer.phone ?? '—'}</div>
              </div>
            </div>
            <div>
              {reg.customer.skillLevel && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 8,
                  background: SKILL_COLOR[reg.customer.skillLevel]?.bg ?? '#f1f5f9',
                  color: SKILL_COLOR[reg.customer.skillLevel]?.text ?? '#64748b',
                }}>
                  {SKILL_LABEL[reg.customer.skillLevel] ?? reg.customer.skillLevel}
                </span>
              )}
            </div>
            <div>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600,
                background: TYPE_BG[reg.type].bg, color: TYPE_BG[reg.type].text,
              }}>
                {REGISTRATION_TYPE_LABEL[reg.type]}
              </span>
            </div>
            <div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 8,
                background: reg.status === 'attended' ? '#dcfce7' : '#f5f4f0',
                color: reg.status === 'attended' ? '#166534' : '#888',
              }}>
                {reg.status === 'attended' ? '✓ 已報到' : '未報到'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              {reg.type === 'season_player' ? '—' : METHOD_LABEL[reg.method]}
            </div>
            <div>
              {reg.type === 'season_player' ? (
                <span style={{ fontSize: 11, color: '#aaa' }}>季打免費</span>
              ) : (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 8,
                  background: PAYMENT_COLOR[reg.paymentStatus]?.bg ?? '#f1f5f9',
                  color: PAYMENT_COLOR[reg.paymentStatus]?.text ?? '#64748b',
                }}>
                  {PAYMENT_LABEL[reg.paymentStatus] ?? reg.paymentStatus}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600, textAlign: 'right',
              color: reg.type !== 'season_player' && reg.paymentStatus === 'unpaid' ? '#e85d3a' : '#1a1917',
            }}>
              {reg.type === 'season_player' ? '$0' : `$${reg.amount}`}
            </div>
          </div>
        ))}
      </div>

      {cancelOpen && (
        <CancelSessionModal
          sessionLabel={`${session.venueName} · ${session.sessionDate} ${session.startTime}`}
          baseUpdatedAt={baseUpdatedAt}
          onClose={() => setCancelOpen(false)}
          onConflict={c => { setCancelOpen(false); setConflict(c) }}
          onSuccess={() => {
            setCancelOpen(false)
            const n = countPendingRefundsForSession(session.id)
            setRecentlyCancelled({ pendingRefundCount: n })
          }}
          sessionId={session.id}
          currentUserHint={currentUser?.name ?? null}
        />
      )}
    </div>
  )
}


// ============================================================
// 取消場次 modal（階段 10）
// ============================================================

function CancelSessionModal({
  sessionId, sessionLabel, baseUpdatedAt, onClose, onConflict, onSuccess, currentUserHint,
}: {
  sessionId: string
  sessionLabel: string
  baseUpdatedAt: string
  onClose: () => void
  onConflict: (c: ConflictResult) => void
  onSuccess: () => void
  currentUserHint: string | null
}) {
  const [reason, setReason] = useState('')
  const [notified, setNotified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 簡單預檢：算一下此場次「目前」會有幾筆需要退費（給使用者心理準備）
  const pendingPreview = countPendingRefundsForSession(sessionId)

  function handleSubmit() {
    if (!reason.trim()) {
      setErrorMsg('請填寫取消原因（顯示於 audit log）')
      return
    }
    setSubmitting(true)
    // 「☑ 已通知」勾選 → 串入 reason 文字，方便 audit log 可追
    const fullReason = notified
      ? `${reason.trim()}（已通知客戶）`
      : reason.trim()
    const result = cancelSession(sessionId, {
      reason: fullReason,
      baseUpdatedAt,
    })
    setSubmitting(false)
    if ('conflict' in result && result.conflict) {
      onConflict(result as ConflictResult)
      return
    }
    if (!result.ok) {
      setErrorMsg(result.reason)
      return
    }
    onSuccess()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
          padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #991b1b',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#991b1b' }}>取消場次</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        <div style={{ marginBottom: 14, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#7f1d1d' }}>
          將取消：<strong>{sessionLabel}</strong>
          {pendingPreview > 0 && (
            <div style={{ marginTop: 6 }}>
              ⚠ 此場次有 <strong>{pendingPreview}</strong> 筆已付款報名，取消後需另至「退費處理」頁面手動處理退款。
            </div>
          )}
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>取消原因（必填、寫入 audit log）</span>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setErrorMsg(null) }}
            placeholder="例：教練生病 / 場地臨時不能用 / 報名人數不足..."
            rows={3}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid #cbc9c2', fontSize: 13, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 12, color: '#555' }}>
          <input
            type="checkbox"
            checked={notified}
            onChange={e => setNotified(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>我已通知所有已報名客戶（LINE/電話）</span>
        </label>

        {errorMsg && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontSize: 12, marginBottom: 12 }}>
            {errorMsg}
          </div>
        )}

        {currentUserHint && (
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>
            操作者：{currentUserHint}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #cbc9c2', background: '#fff', fontSize: 13, cursor: 'pointer' }}
          >
            不取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '8px 14px', borderRadius: 7, border: 'none',
              background: '#991b1b', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? '處理中…' : '確認取消場次'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color = '#1a1917' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{label}</div>
    </div>
  )
}
