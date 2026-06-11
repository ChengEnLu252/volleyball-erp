'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  getCurrentVisibleVenueIds,
  getEffectiveRole,
  listVenues,
} from '@/data/api'
import {
  useStoreSync, hydrateStore, upsertProcurementRequest,
} from '@/data/store'
import {
  getApprovalTier, requiresCompletionEvidence, canApprove,
  isPending, isEvidenceMissing, getVenueProcurementSummary,
  approveRequest, rejectRequest, completeRequest,
} from '@/data/procurement'
import {
  PROCUREMENT_KIND_LABEL, PROCUREMENT_TIER_LABEL, PROCUREMENT_STATUS_LABEL,
  PROCUREMENT_TIER_1, PROCUREMENT_TIER_2,
} from '@/types'
import type { ProcurementKind, ProcurementRequest, ProcurementStatus, ProcurementTier } from '@/types'
import { ReconHeader, StatCard, Panel, Money, Badge } from '@/components/reconciliation/Common'

const STATUS_COLOR: Record<ProcurementStatus, 'gray' | 'yellow' | 'green' | 'red' | 'purple'> = {
  draft: 'gray', pending: 'yellow', approved: 'green', rejected: 'red', completed: 'purple',
}
const TIER_COLOR: Record<ProcurementTier, 'gray' | 'blue' | 'red'> = {
  self: 'gray', owner: 'blue', owner_strict: 'red',
}

export default function ProcurementPage() {
  const sv = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); hydrateStore() }, [])

  const user = mounted ? getCurrentUser() : null
  const role = mounted && user ? getEffectiveRole(user.id) : 'none'

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, sv])
  const venues = useMemo(() => {
    const all = listVenues().filter(v => v.isActive)
    return visible === 'all' ? all : all.filter(v => visible.includes(v.id))
  }, [visible])

  const summaries = useMemo(
    () => (mounted ? venues.map(v => getVenueProcurementSummary(v.id)) : []),
    [mounted, venues, sv],
  )

  const totals = useMemo(() => ({
    pending: summaries.reduce((s, x) => s + x.pendingCount, 0),
    approved: summaries.reduce((s, x) => s + x.approvedAmount, 0),
    evidence: summaries.reduce((s, x) => s + x.evidenceMissingCount, 0),
  }), [summaries])

  // 新增申請表單
  const [showForm, setShowForm] = useState(false)
  const [fVenue, setFVenue] = useState('')
  const [fKind, setFKind] = useState<ProcurementKind>('purchase')
  const [fTitle, setFTitle] = useState('')
  const [fAmount, setFAmount] = useState('')

  if (!mounted) return <div style={{ padding: 24 }} />

  const canCreate = role === 'owner' || role === 'manager'

  function submitNew() {
    const amount = parseInt(fAmount, 10)
    if (!fVenue || !fTitle.trim() || !Number.isFinite(amount) || amount <= 0) return
    const rec: ProcurementRequest = {
      id: `pr-${fVenue}-${Date.now()}`,
      venueId: fVenue, kind: fKind, title: fTitle.trim(), amount,
      status: 'pending', requestedBy: user?.id ?? '', requestedAt: new Date().toISOString(),
      approvedBy: null, approvedAt: null, completionEvidenceRef: null, completedAt: null, note: '',
    }
    upsertProcurementRequest(rec)
    setFTitle(''); setFAmount(''); setShowForm(false)
  }

  function doApprove(req: ProcurementRequest) { upsertProcurementRequest(approveRequest(req, user?.id ?? '')) }
  function doReject(req: ProcurementRequest)  { upsertProcurementRequest(rejectRequest(req, user?.id ?? '')) }
  function doComplete(req: ProcurementRequest) {
    const ref = window.prompt('輸入完工存證參照（完工照編號 / 說明）：', req.completionEvidenceRef ?? '')
    if (ref === null) return
    upsertProcurementRequest(completeRequest(req, ref.trim() || null))
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <ReconHeader
        title="採購‧修繕簽核"
        subtitle="依金額分級簽核；修繕 > $5,000 須附完工存證"
        backTo="/reconciliation"
        actions={canCreate ? (
          <button onClick={() => { setShowForm(s => !s); setFVenue(venues[0]?.id ?? '') }}
            style={primaryBtn}>＋ 新增申請</button>
        ) : undefined}
      />

      {/* 待業主確認：核准路由 */}
      <div style={noteBox}>
        ⚠️ <strong>待業主確認</strong>：規章正文未明列各級核准人，此處採合理推定 —
        <strong> &lt; ${PROCUREMENT_TIER_1.toLocaleString()} 館長自核</strong>、
        <strong> ${PROCUREMENT_TIER_1.toLocaleString()}–{PROCUREMENT_TIER_2.toLocaleString()} 老闆核准</strong>、
        <strong> &gt; ${PROCUREMENT_TIER_2.toLocaleString()} 老闆核准＋強制完工存證</strong>。
      </div>

      {showForm && canCreate && (
        <Panel title="新增採購 / 修繕申請">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: '4px 0' }}>
            <Field label="球館">
              <select value={fVenue} onChange={e => setFVenue(e.target.value)} style={inp}>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="類型">
              <select value={fKind} onChange={e => setFKind(e.target.value as ProcurementKind)} style={inp}>
                <option value="purchase">採購</option>
                <option value="repair">修繕</option>
              </select>
            </Field>
            <Field label="項目">
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="例：地板翻修" style={{ ...inp, width: 200 }} />
            </Field>
            <Field label="金額">
              <input value={fAmount} onChange={e => setFAmount(e.target.value)} inputMode="numeric" placeholder="0" style={{ ...inp, width: 110 }} />
            </Field>
            {fAmount && Number(fAmount) > 0 && (
              <span style={{ fontSize: 12, color: '#666', paddingBottom: 9 }}>
                級距：<strong>{PROCUREMENT_TIER_LABEL[getApprovalTier(Number(fAmount))]}</strong>
              </span>
            )}
            <button onClick={submitNew} style={{ ...primaryBtn, marginBottom: 1 }}>送出（待簽核）</button>
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '16px 0' }}>
        <StatCard label="待簽核" value={`${totals.pending} 件`}
          intent={totals.pending > 0 ? 'warning' : 'default'} accent="#d4a843" />
        <StatCard label="已核准金額" value={`$${totals.approved.toLocaleString()}`} sub="含已完工" accent="#10b981" />
        <StatCard label="完工存證待補" value={`${totals.evidence} 件`} sub="修繕 > $5,000"
          intent={totals.evidence > 0 ? 'danger' : 'default'} accent="#e85d3a" />
      </div>

      {summaries.map(s => (
        <Panel key={s.venueId} title={s.venueName}
          action={s.pendingCount > 0
            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#c98a2b' }}>{s.pendingCount} 件待簽核</span>
            : <span style={{ fontSize: 12, color: '#0f766e' }}>無待簽核 ✓</span>}>
          {s.requests.length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa', padding: '8px 0' }}>尚無申請</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.requests.map(r => {
                const tier = getApprovalTier(r.amount)
                const approvable = isPending(r) && canApprove(role, tier)
                const evidenceGap = isEvidenceMissing(r)
                return (
                  <div key={r.id} style={{
                    padding: '10px 12px', borderRadius: 8, background: '#faf9f7',
                    border: evidenceGap ? '1px solid #fca5a5' : '1px solid #f0ede6',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Badge color={r.kind === 'repair' ? 'purple' : 'blue'}>{PROCUREMENT_KIND_LABEL[r.kind]}</Badge>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}><Money value={r.amount} /></span>
                      <Badge color={TIER_COLOR[tier]}>{PROCUREMENT_TIER_LABEL[tier]}</Badge>
                      <Badge color={STATUS_COLOR[r.status]}>{PROCUREMENT_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#999' }}>
                        申請 {r.requestedAt.slice(0, 10)}
                        {r.approvedAt && <>・簽核 {r.approvedAt.slice(0, 10)}</>}
                        {r.completionEvidenceRef && <>・存證 {r.completionEvidenceRef}</>}
                      </span>
                      {evidenceGap && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>⚠ 完工存證待補</span>
                      )}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {approvable && <>
                          <button onClick={() => doApprove(r)} style={miniBtn('#0f766e')}>核准</button>
                          <button onClick={() => doReject(r)} style={miniBtn('#dc2626')}>退回</button>
                        </>}
                        {isPending(r) && !canApprove(role, tier) && (
                          <span style={{ fontSize: 11, color: '#aaa' }}>
                            {tier === 'self' ? '可自核' : '需老闆核准'}
                          </span>
                        )}
                        {r.status === 'approved' && r.kind === 'repair'
                          && requiresCompletionEvidence(tier)
                          && (role === 'owner' || role === 'manager') && (
                          <button onClick={() => doComplete(r)} style={miniBtn('#7c5cff')}>標記完工＋存證</button>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      ))}

      <p style={{ fontSize: 11, color: '#aaa', marginTop: 12, lineHeight: 1.6 }}>
        ※ 完工存證目前以參照字串記錄（接既有 /evidence 上傳系統的照片編號）；實際照片上傳由憑證頁處理，待業主確認流程細節。
      </p>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e2dc', fontSize: 14 }
const primaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
  border: 'none', cursor: 'pointer', background: '#ff2d8a', color: '#fff',
}
const noteBox: React.CSSProperties = {
  fontSize: 12, color: '#7a5b00', background: '#fff7e6', border: '1px solid #ffe0a3',
  borderRadius: 8, padding: '10px 12px', lineHeight: 1.7, marginBottom: 4,
}
function miniBtn(color: string): React.CSSProperties {
  return { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${color}`, background: '#fff', color }
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}
