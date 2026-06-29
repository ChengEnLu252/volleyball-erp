'use client'

// 場次明細畫面（client）。資料由 server 殼以 props 傳入（已 scope + 付款衍生）；
// 取消場次 / 改費用 走 server action，成功後 router.refresh()。取消保留樂觀鎖 + ConflictBanner。

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isConflictResult } from '@/data/api'
import { cancelSessionAction, patchSessionFeesAction } from '@/app/actions/sessions'
import { collectPaymentAction, undoPaymentAction } from '@/app/actions/payments'
import { REGISTRATION_TYPE_LABEL } from '@/types'
import type { ConflictResult, PaymentMethod } from '@/types'
import type { EffectiveRole } from '@/data/permissions'
import type { SessionDetailBundle } from '@/data/server/queries'
import ConflictBanner from '@/components/ConflictBanner'

const SKILL_LABEL: Record<string, string> = { 'E':'E','D':'D','C':'C','B':'B','B+':'B+','A':'A','A+':'A+','S':'S','S*':'S*' }
const SKILL_COLOR: Record<string, { bg: string; text: string }> = {
  'E': { bg: '#f1f5f9', text: '#64748b' }, 'D': { bg: '#e2f0fb', text: '#1e6098' }, 'C': { bg: '#dbeafe', text: '#1e40af' },
  'B': { bg: '#dcfce7', text: '#166534' }, 'B+': { bg: '#fef3c7', text: '#92400e' }, 'A': { bg: '#fed7aa', text: '#9a3412' },
  'A+': { bg: '#fce7f3', text: '#9d174d' }, 'S': { bg: '#f3e8ff', text: '#6b21a8' }, 'S*': { bg: '#1a1917', text: '#d4a843' },
}
const PAYMENT_LABEL: Record<string, string> = { paid: '已付清', unpaid: '未付款', partial: '部分付款', refunded: '已退款' }
const PAYMENT_COLOR: Record<string, { bg: string; text: string }> = {
  paid: { bg: '#dcfce7', text: '#166534' }, unpaid: { bg: '#fee2e2', text: '#991b1b' },
  partial: { bg: '#fef3c7', text: '#92400e' }, refunded: { bg: '#f1f5f9', text: '#64748b' },
}
const METHOD_LABEL: Record<string, string> = { cash: '現金', transfer: '轉帳', online: '線上' }
const TYPE_BG: Record<string, { bg: string; text: string }> = {
  season_player: { bg: '#dbeafe', text: '#1e40af' }, season_substitute: { bg: '#fef3c7', text: '#92400e' }, walk_in: { bg: '#f5f4f0', text: '#666' },
}

export default function SessionDetailClient({
  detail, role, currentUserName,
}: {
  detail: SessionDetailBundle | null
  role: EffectiveRole
  currentUserName: string | null
}) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  const [recentlyCancelled, setRecentlyCancelled] = useState<{ pendingRefundCount: number } | null>(null)

  const session = detail?.session ?? null
  const registrations = detail?.registrations ?? []

  // 樂觀鎖 snapshot（server-fed；router.refresh 後 session.updatedAt 變 → resync）
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(session?.updatedAt ?? '')
  useEffect(() => {
    if (session && !conflict && session.updatedAt !== baseUpdatedAt) setBaseUpdatedAt(session.updatedAt)
  }, [session, conflict, baseUpdatedAt])
  const reloadSnapshot = () => { setConflict(null); if (session) setBaseUpdatedAt(session.updatedAt); router.refresh() }

  // 費用表單
  const [feeForm, setFeeForm] = useState({ courtFee: '', acFee: '', acEnabled: false })
  const [feeSaved, setFeeSaved] = useState(false)
  const [feeBusy, setFeeBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    setFeeForm({ courtFee: String(session.courtFee), acFee: String(session.acFee), acEnabled: session.acEnabled })
  }, [session?.id, session?.updatedAt])

  const canEditFees = role === 'owner' || role === 'manager'
  const canCancel = !!session && (session.status === 'open' || session.status === 'full')

  // 收款（P2.1）：任何已登入 ERP 人員可收款；server 端另強制 venue scope
  const canCollect = role !== 'none' && !!session && session.status !== 'cancelled'
  const [payBusyId, setPayBusyId] = useState<string | null>(null)
  const [methodById, setMethodById] = useState<Record<string, PaymentMethod>>({})

  const handleCollect = async (regId: string, fallback: PaymentMethod = 'cash') => {
    const method = methodById[regId] ?? fallback
    setPayBusyId(regId)
    const res = await collectPaymentAction({ registrationId: regId, method })
    setPayBusyId(null)
    if (!res.ok) { alert(`⚠️ ${res.reason}`); return }
    router.refresh()
  }
  const handleUndoPayment = async (regId: string) => {
    if (!confirm('確定取消這筆收款嗎？（僅誤收時使用，會刪除已付款紀錄）')) return
    setPayBusyId(regId)
    const res = await undoPaymentAction({ registrationId: regId })
    setPayBusyId(null)
    if (!res.ok) { alert(`⚠️ ${res.reason}`); return }
    router.refresh()
  }

  const derived = useMemo(() => {
    const paidCount = registrations.filter(r => r.type === 'season_player' || r.paymentStatus === 'paid').length
    const unpaidCount = registrations.filter(r => r.type !== 'season_player' && r.paymentStatus !== 'paid').length
    const totalPaid = registrations.filter(r => r.type !== 'season_player' && r.paymentStatus === 'paid').reduce((s, r) => s + r.expectedAmount, 0)
    const activeRegs = registrations.filter(r => r.status !== 'cancelled')
    const chargeableCount = activeRegs.filter(r => r.type === 'walk_in' || r.type === 'season_substitute').length
    return { paidCount, unpaidCount, totalPaid, chargeableCount, allRegCount: activeRegs.length }
  }, [registrations])

  if (!session) {
    return <div style={{ padding: 24, color: '#888' }}>場次不存在或無權限檢視。<a href="/sessions" style={{ marginLeft: 8 }}>返回場次列表</a></div>
  }

  const formCourtFee = Number(feeForm.courtFee.replace(/,/g, '')) || 0
  const formAcFee = Number(feeForm.acFee.replace(/,/g, '')) || 0
  const feePerHead = formCourtFee + (feeForm.acEnabled ? formAcFee : 0)
  const grossExpected = feePerHead * derived.allRegCount
  const chargeableExpected = feePerHead * derived.chargeableCount
  const feeDirty = formCourtFee !== session.courtFee || formAcFee !== session.acFee || feeForm.acEnabled !== session.acEnabled

  const saveFees = async () => {
    setFeeBusy(true)
    const res = await patchSessionFeesAction({ sessionId: session.id, courtFee: formCourtFee, acFee: formAcFee, acEnabled: feeForm.acEnabled })
    setFeeBusy(false)
    if (!res.ok) { alert(`⚠️ ${res.reason}`); return }
    setFeeSaved(true); setTimeout(() => setFeeSaved(false), 2000)
    router.refresh()
  }

  const handleCancelConfirm = async (fullReason: string): Promise<string | null> => {
    const res = await cancelSessionAction({ sessionId: session.id, reason: fullReason, baseUpdatedAt })
    if (isConflictResult(res)) { setCancelOpen(false); setConflict(res); return null }
    if (!res.ok) return res.reason
    setCancelOpen(false); setRecentlyCancelled({ pendingRefundCount: res.pendingRefundCount }); router.refresh(); return null
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <a href="/sessions" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>‹ 返回場次列表</a>
        {canCancel && (
          <button type="button" onClick={() => setCancelOpen(true)}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#991b1b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🚫 取消場次
          </button>
        )}
        {session.status === 'cancelled' && (
          <span style={{ padding: '5px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>此場次已取消</span>
        )}
      </div>

      {recentlyCancelled && (
        <div style={{ background: recentlyCancelled.pendingRefundCount > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${recentlyCancelled.pendingRefundCount > 0 ? '#fb923c' : '#86efac'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>{recentlyCancelled.pendingRefundCount > 0 ? '💰' : '✓'}</div>
          <div style={{ flex: 1, fontSize: 13, color: recentlyCancelled.pendingRefundCount > 0 ? '#7c2d12' : '#166534' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>場次已取消{recentlyCancelled.pendingRefundCount > 0 && <> · <span style={{ color: '#9a3412' }}>需處理退費</span></>}</div>
            {recentlyCancelled.pendingRefundCount > 0 ? (
              <div>此場次有 <strong>{recentlyCancelled.pendingRefundCount}</strong> 筆已付款報名，請至
                <Link href="/finance/refunds" style={{ marginLeft: 6, padding: '3px 10px', borderRadius: 6, background: '#c2410c', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 12 }}>退費處理 →</Link> 進行退款或標記放棄退費。
              </div>
            ) : (<div>此場次沒有已付款報名，無需處理退費。</div>)}
          </div>
          <button type="button" onClick={() => setRecentlyCancelled(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#888', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {conflict && <ConflictBanner conflict={conflict} onReload={reloadSnapshot} onDismiss={() => setConflict(null)} />}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{session.venueName}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{session.sessionDate} · {session.startTime}–{session.endTime} · {session.court ?? '主場地'}</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            球費 ${session.courtFee}
            {session.acEnabled && session.acFee > 0 && <span style={{ color: '#3b82f6' }}> · 冷氣費 +${session.acFee}</span>}
            {session.seasonRentalId && <span style={{ color: '#1e40af' }}> · 季租場</span>}
            {session.isUnattended && <span style={{ color: '#d97706' }}> · 無人場</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <Stat label="報名人數" value={`${registrations.length} / ${session.maxCapacity}`} />
          <Stat label="已付款" value={`${derived.paidCount} 人`} color="#059669" />
          <Stat label="未付款" value={`${derived.unpaidCount} 人`} color={derived.unpaidCount > 0 ? '#e85d3a' : '#059669'} />
          <Stat label="已收金額" value={`$${derived.totalPaid.toLocaleString()}`} color="#2563eb" />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '18px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>費用設定 · 應收計算</div>
          {!canEditFees && <span style={{ fontSize: 11, color: '#aaa' }}>（僅館長 / 老闆可編輯）</span>}
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>場地費 / 人</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: '#888' }}>$</span>
              <input type="text" inputMode="numeric" value={feeForm.courtFee} disabled={!canEditFees}
                onChange={e => setFeeForm(f => ({ ...f, courtFee: e.target.value.replace(/[^0-9]/g, '') }))}
                style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0ddd4', fontSize: 14, background: canEditFees ? '#fff' : '#f5f4f0' }} />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>冷氣費 / 人</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: '#888' }}>$</span>
              <input type="text" inputMode="numeric" value={feeForm.acFee} disabled={!canEditFees}
                onChange={e => setFeeForm(f => ({ ...f, acFee: e.target.value.replace(/[^0-9]/g, '') }))}
                style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0ddd4', fontSize: 14, background: canEditFees ? '#fff' : '#f5f4f0' }} />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, cursor: canEditFees ? 'pointer' : 'default' }}>
            <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>是否開冷氣</span>
            <button type="button" disabled={!canEditFees} onClick={() => canEditFees && setFeeForm(f => ({ ...f, acEnabled: !f.acEnabled }))}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid', cursor: canEditFees ? 'pointer' : 'default', borderColor: feeForm.acEnabled ? '#3b82f6' : '#e0ddd4', background: feeForm.acEnabled ? '#eff6ff' : '#f5f4f0', color: feeForm.acEnabled ? '#1e40af' : '#888' }}>
              {feeForm.acEnabled ? '❄ 已開' : '未開'}
            </button>
          </label>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <div style={{ background: '#1a1917', color: '#fff', borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
              <div style={{ fontSize: 10, color: '#d4a843', fontWeight: 700, letterSpacing: '.04em' }}>應收（只算臨打）</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>${chargeableExpected.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>臨打+補位 {derived.chargeableCount} 人 × ${feePerHead}</div>
            </div>
            <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '10px 16px', minWidth: 130, border: '1px solid #e8e6e0' }}>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 700, letterSpacing: '.04em' }}>應收總額（全部報名）</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: '#1a1917' }}>${grossExpected.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>全部 {derived.allRegCount} 人 × ${feePerHead}</div>
            </div>
          </div>
        </div>
        {canEditFees && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button type="button" onClick={saveFees} disabled={!feeDirty || feeBusy}
              style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: feeDirty && !feeBusy ? 'pointer' : 'default', background: feeDirty ? '#1a1917' : '#e8e6e0', color: feeDirty ? '#d4a843' : '#aaa' }}>
              {feeBusy ? '儲存中…' : '儲存費用設定'}
            </button>
            {feeSaved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ 已儲存，應收已更新</span>}
            {feeDirty && !feeSaved && <span style={{ fontSize: 12, color: '#9a3412' }}>● 尚未儲存的變更</span>}
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>季打人員季初已繳費，不計入「只算臨打」應收</span>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
        <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600 }}>報名名單（{registrations.length} 人）</div>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 70px 70px 80px 80px 100px 90px 150px', padding: '8px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
          <div>#</div><div>姓名</div><div>程度</div><div>類型</div><div>報到</div><div>付款方式</div><div>付款狀態</div><div style={{ textAlign: 'right' }}>金額</div><div style={{ textAlign: 'center' }}>收款</div>
        </div>
        {registrations.map((reg, i) => (
          <div key={reg.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 70px 70px 80px 80px 100px 90px 150px', padding: '12px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12, background: reg.type !== 'season_player' && reg.paymentStatus === 'unpaid' ? '#fffbfb' : '#fff' }}>
            <div style={{ fontSize: 13, color: '#aaa' }}>{i + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#e8e6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#5b4fd8', flexShrink: 0 }}>{reg.customer.name[0]}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{reg.customer.name}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{reg.customer.phone ?? '—'}</div>
              </div>
            </div>
            <div>
              {reg.customer.skillLevel && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: SKILL_COLOR[reg.customer.skillLevel]?.bg ?? '#f1f5f9', color: SKILL_COLOR[reg.customer.skillLevel]?.text ?? '#64748b' }}>
                  {SKILL_LABEL[reg.customer.skillLevel] ?? reg.customer.skillLevel}
                </span>
              )}
            </div>
            <div>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600, background: TYPE_BG[reg.type].bg, color: TYPE_BG[reg.type].text }}>{REGISTRATION_TYPE_LABEL[reg.type]}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: reg.status === 'attended' ? '#dcfce7' : '#f5f4f0', color: reg.status === 'attended' ? '#166534' : '#888' }}>
                {reg.status === 'attended' ? '✓ 已報到' : '未報到'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>{reg.type === 'season_player' ? '—' : reg.paymentStatus === 'paid' ? METHOD_LABEL[reg.paymentMethod] : '—'}</div>
            <div>
              {reg.type === 'season_player' ? (
                <span style={{ fontSize: 11, color: '#aaa' }}>季打免費</span>
              ) : (
                <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: PAYMENT_COLOR[reg.paymentStatus]?.bg ?? '#f1f5f9', color: PAYMENT_COLOR[reg.paymentStatus]?.text ?? '#64748b' }}>
                    {PAYMENT_LABEL[reg.paymentStatus] ?? reg.paymentStatus}
                  </span>
                  {reg.paymentStatus !== 'paid' && reg.selfReportedPaid && (
                    <span style={{ fontSize: 10, color: '#92400e' }}>🙋 已自助回報</span>
                  )}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: reg.type !== 'season_player' && reg.paymentStatus === 'unpaid' ? '#e85d3a' : '#1a1917' }}>
              {reg.type === 'season_player' ? '$0' : `$${reg.expectedAmount}`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {reg.type === 'season_player' ? (
                <span style={{ fontSize: 11, color: '#ccc' }}>免費</span>
              ) : reg.paymentStatus === 'paid' ? (
                canCollect ? (
                  <button type="button" disabled={payBusyId === reg.id} onClick={() => handleUndoPayment(reg.id)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #e0ddd4', background: '#fff', color: '#991b1b', cursor: payBusyId === reg.id ? 'default' : 'pointer', opacity: payBusyId === reg.id ? 0.5 : 1 }}>
                    {payBusyId === reg.id ? '…' : '取消收款'}
                  </button>
                ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>
              ) : canCollect ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <select value={methodById[reg.id] ?? reg.selfPaymentMethod ?? 'cash'} onChange={e => setMethodById(m => ({ ...m, [reg.id]: e.target.value as PaymentMethod }))}
                    style={{ fontSize: 11, padding: '4px 2px', borderRadius: 6, border: '1px solid #e0ddd4', background: '#fff', cursor: 'pointer' }}>
                    <option value="cash">現金</option>
                    <option value="transfer">轉帳</option>
                    <option value="online">線上</option>
                  </select>
                  <button type="button" disabled={payBusyId === reg.id} onClick={() => handleCollect(reg.id, reg.selfPaymentMethod ?? 'cash')}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 7, border: 'none', background: reg.selfReportedPaid ? '#92400e' : '#1a1917', color: '#d4a843', fontWeight: 600, cursor: payBusyId === reg.id ? 'default' : 'pointer', opacity: payBusyId === reg.id ? 0.5 : 1 }}>
                    {payBusyId === reg.id ? '…' : (reg.selfReportedPaid ? '確認入帳' : '收款')}
                  </button>
                </div>
              ) : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
            </div>
          </div>
        ))}
      </div>

      {cancelOpen && (
        <CancelSessionModal
          sessionLabel={`${session.venueName} · ${session.sessionDate} ${session.startTime}`}
          pendingPreview={detail?.pendingRefundCount ?? 0}
          onClose={() => setCancelOpen(false)}
          onConfirm={handleCancelConfirm}
          currentUserHint={currentUserName}
        />
      )}
    </div>
  )
}

function CancelSessionModal({
  sessionLabel, pendingPreview, onClose, onConfirm, currentUserHint,
}: {
  sessionLabel: string
  pendingPreview: number
  onClose: () => void
  onConfirm: (fullReason: string) => Promise<string | null>
  currentUserHint: string | null
}) {
  const [reason, setReason] = useState('')
  const [notified, setNotified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit() {
    if (!reason.trim()) { setErrorMsg('請填寫取消原因（顯示於 audit log）'); return }
    setSubmitting(true)
    const fullReason = notified ? `${reason.trim()}（已通知客戶）` : reason.trim()
    const err = await onConfirm(fullReason)
    setSubmitting(false)
    if (err) setErrorMsg(err)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #991b1b' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#991b1b' }}>取消場次</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <div style={{ marginBottom: 14, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#7f1d1d' }}>
          將取消：<strong>{sessionLabel}</strong>
          {pendingPreview > 0 && (<div style={{ marginTop: 6 }}>⚠ 此場次有 <strong>{pendingPreview}</strong> 筆已付款報名，取消後需另至「退費處理」頁面手動處理退款。</div>)}
        </div>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>取消原因（必填、寫入 audit log）</span>
          <textarea value={reason} onChange={e => { setReason(e.target.value); setErrorMsg(null) }} placeholder="例：教練生病 / 場地臨時不能用 / 報名人數不足..." rows={3}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbc9c2', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 12, color: '#555' }}>
          <input type="checkbox" checked={notified} onChange={e => setNotified(e.target.checked)} style={{ cursor: 'pointer' }} />
          <span>我已通知所有已報名客戶（LINE/電話）</span>
        </label>
        {errorMsg && <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>}
        {currentUserHint && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>操作者：{currentUserHint}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #cbc9c2', background: '#fff', fontSize: 13, cursor: 'pointer' }}>不取消</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#991b1b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}>
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
