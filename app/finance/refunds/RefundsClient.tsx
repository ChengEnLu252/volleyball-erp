'use client'

// 退費處理畫面（client）。資料由 server 殼以 props 傳入（已 scope）。
// 退款 → issueRefundAction、放棄退費 → waiveRefundAction；成功後 router.refresh()。
// 待退費每列保留樂觀鎖 + ConflictBanner；退費歷史於前端做決定/球館篩選。

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isConflictResult } from '@/data/api'
import { issueRefundAction, waiveRefundAction } from '@/app/actions/refunds'
import { Badge, VENUE_COLOR } from '@/components/reconciliation/Common'
import ConflictBanner from '@/components/ConflictBanner'
import type { ConflictResult, PaymentMethod, RefundDecision } from '@/types'
import { PAYMENT_METHOD_LABEL } from '@/types'
import type { PendingRefundRow, RefundHistoryRow } from '@/data/server/queries'

const REG_TYPE_LABEL: Record<string, string> = { walk_in: '臨打', season_substitute: '補位', season_player: '季打' }
function fmtTime(iso: string | null): string { if (!iso) return '—'; return iso.length >= 16 ? iso.slice(5, 16).replace('T', ' ') : iso }
function fmtMethod(m: PaymentMethod | null): string { return m === null ? '—' : PAYMENT_METHOD_LABEL[m] }

type TabKey = 'pending' | 'history'
type Venue = { id: string; name: string }

export default function RefundsClient({ pending, history, venues }: { pending: PendingRefundRow[]; history: RefundHistoryRow[]; venues: Venue[] }) {
  const [tab, setTab] = useState<TabKey>('pending')

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.rfd-wrap{padding-top:64px !important}}`}</style>
      <div className="rfd-wrap" style={{ paddingTop: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>退費處理</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>場次取消後，對已付款報名處理退費或放棄退費的決定</p>
        </div>

        <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#f5f4f0', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
            💰 待退費 <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: pending.length > 0 ? '#e85d3a' : '#cbc9c2', color: '#fff', fontSize: 11, fontWeight: 700 }}>{pending.length}</span>
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>📜 退費歷史</TabButton>
        </div>

        {tab === 'pending' ? <PendingTab rows={pending} /> : <HistoryTab rows={history} venues={venues} />}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: active ? '#fff' : 'transparent', color: active ? '#1a1917' : '#888', boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

// ── 待退費 ─────────────────────────────────────────────────────
function PendingTab({ rows }: { rows: PendingRefundRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>沒有待處理的退費</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>當有場次被取消、且該場有已付款報名時，會出現在這裡</div>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0ede6', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>待處理清單（{rows.length} 筆）</span>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>總應退：<strong style={{ color: '#e85d3a' }}>${rows.reduce((s, r) => s + r.netPaid, 0).toLocaleString()}</strong></span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, textAlign: 'left' }}>
            <th style={{ padding: '10px', fontWeight: 500 }}>客戶</th>
            <th style={{ padding: '10px', fontWeight: 500 }}>場次</th>
            <th style={{ padding: '10px', fontWeight: 500 }}>取消時間</th>
            <th style={{ padding: '10px', fontWeight: 500, textAlign: 'right' }}>應退</th>
            <th style={{ padding: '10px', fontWeight: 500 }}>原付款</th>
            <th style={{ padding: '10px', fontWeight: 500, textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <PendingRow key={r.registrationId} row={r} />)}
        </tbody>
      </table>
    </div>
  )
}

function PendingRow({ row }: { row: PendingRefundRow }) {
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string>(row.registrationUpdatedAt)
  const [conflict, setConflict] = useState<ConflictResult | null>(null)
  const router = useRouter()
  useEffect(() => {
    if (!conflict && row.registrationUpdatedAt !== baseUpdatedAt) setBaseUpdatedAt(row.registrationUpdatedAt)
  }, [row.registrationUpdatedAt, conflict, baseUpdatedAt])
  const reloadSnapshot = () => { setConflict(null); setBaseUpdatedAt(row.registrationUpdatedAt); router.refresh() }

  const [refundOpen, setRefundOpen] = useState(false)
  const [waiveOpen, setWaiveOpen] = useState(false)

  return (
    <>
      <tr style={{ borderTop: '1px solid #f5f4f0' }}>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
          <div style={{ fontWeight: 600 }}>{row.customerName}</div>
          {row.customerPhone && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{row.customerPhone}</div>}
          <div style={{ marginTop: 4 }}>
            <Badge color={row.registrationType === 'walk_in' ? 'yellow' : (row.registrationType === 'season_substitute' ? 'purple' : 'blue')}>
              {REG_TYPE_LABEL[row.registrationType] ?? row.registrationType}
            </Badge>
          </div>
        </td>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[row.venueId] ?? '#aaa', marginRight: 6 }} />
            {row.venueName}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{row.sessionDate} {row.sessionStartTime}</div>
        </td>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontSize: 11, color: '#888' }}>
          {fmtTime(row.sessionCancelledAt)}
          {row.sessionCancelDetail && (
            <div style={{ marginTop: 3, color: '#aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.sessionCancelDetail}>{row.sessionCancelDetail}</div>
          )}
        </td>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'right' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e85d3a' }}>${row.netPaid.toLocaleString()}</span>
        </td>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontSize: 12, color: '#666' }}>{fmtMethod(row.lastPaymentMethod)}</td>
        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'right' }}>
          <button type="button" onClick={() => setRefundOpen(true)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#166534', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 6 }}>💰 退款</button>
          <button type="button" onClick={() => setWaiveOpen(true)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbc9c2', background: '#fff', fontSize: 12, fontWeight: 500, color: '#555', cursor: 'pointer' }}>📋 放棄</button>
        </td>
      </tr>
      {conflict && (
        <tr><td colSpan={6} style={{ padding: '8px 10px', background: '#fff', borderBottom: '1px solid #f5f4f0' }}><ConflictBanner conflict={conflict} onReload={reloadSnapshot} /></td></tr>
      )}
      {refundOpen && <RefundModal row={row} baseUpdatedAt={baseUpdatedAt} onClose={() => setRefundOpen(false)} onConflict={(c) => { setRefundOpen(false); setConflict(c) }} />}
      {waiveOpen && <WaiveModal row={row} baseUpdatedAt={baseUpdatedAt} onClose={() => setWaiveOpen(false)} onConflict={(c) => { setWaiveOpen(false); setConflict(c) }} />}
    </>
  )
}

function RefundModal({ row, baseUpdatedAt, onClose, onConflict }: { row: PendingRefundRow; baseUpdatedAt: string; onClose: () => void; onConflict: (c: ConflictResult) => void }) {
  const router = useRouter()
  const [amount, setAmount] = useState<string>(String(row.netPaid))
  const [method, setMethod] = useState<PaymentMethod>(row.lastPaymentMethod ?? 'transfer')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit() {
    const num = Number(amount)
    if (!Number.isFinite(num) || num <= 0) { setErrorMsg('退款金額必須大於 0'); return }
    if (num > row.netPaid) { setErrorMsg(`不能超過應退 $${row.netPaid}`); return }
    setSubmitting(true)
    const result = await issueRefundAction({ registrationId: row.registrationId, amount: num, method, notes: notes.trim() || null, baseUpdatedAt })
    setSubmitting(false)
    if (isConflictResult(result)) { onConflict(result); return }
    if (!result.ok) { setErrorMsg(result.reason); return }
    onClose(); router.refresh()
  }

  return (
    <Modal title={`退款給 ${row.customerName}`} onClose={onClose} accent="#166534">
      <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f7fdf9', borderRadius: 8, fontSize: 12 }}>
        <div style={{ color: '#555' }}>場次：<strong>{row.venueName}</strong> · {row.sessionDate} {row.sessionStartTime}</div>
        <div style={{ color: '#555', marginTop: 4 }}>客戶淨付額：<strong style={{ color: '#e85d3a' }}>${row.netPaid.toLocaleString()}</strong><span style={{ color: '#aaa', marginLeft: 8 }}>（原 {fmtMethod(row.lastPaymentMethod)}）</span></div>
      </div>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>退款金額</span>
        <input type="number" value={amount} min="0" max={row.netPaid} onChange={(e) => { setAmount(e.target.value); setErrorMsg(null) }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbc9c2', fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>可改：例如手續費自理 / 部分退費等情境。最高 ${row.netPaid}</div>
      </label>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>退款方式</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['cash', 'transfer', 'online'] as PaymentMethod[]).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: method === m ? '2px solid #166534' : '1px solid #cbc9c2', background: method === m ? '#dcfce7' : '#fff', color: method === m ? '#166534' : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{PAYMENT_METHOD_LABEL[m]}</button>
          ))}
        </div>
      </label>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>備註（選填）</span>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="例：已 LINE 通知 / 處理方式..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbc9c2', fontSize: 13, boxSizing: 'border-box' }} />
      </label>
      {errorMsg && <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #cbc9c2', background: '#fff', fontSize: 13, cursor: 'pointer' }}>取消</button>
        <button type="button" onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#166534', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}>{submitting ? '處理中…' : '確認退款'}</button>
      </div>
    </Modal>
  )
}

function WaiveModal({ row, baseUpdatedAt, onClose, onConflict }: { row: PendingRefundRow; baseUpdatedAt: string; onClose: () => void; onConflict: (c: ConflictResult) => void }) {
  const router = useRouter()
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit() {
    if (!reason.trim()) { setErrorMsg('請填寫放棄退費的原因'); return }
    setSubmitting(true)
    const result = await waiveRefundAction({ registrationId: row.registrationId, reason: reason.trim(), baseUpdatedAt })
    setSubmitting(false)
    if (isConflictResult(result)) { onConflict(result); return }
    if (!result.ok) { setErrorMsg(result.reason); return }
    onClose(); router.refresh()
  }

  return (
    <Modal title={`放棄 ${row.customerName} 的退費`} onClose={onClose} accent="#a16207">
      <div style={{ marginBottom: 14, padding: '10px 12px', background: '#fef9c3', borderRadius: 8, fontSize: 12, color: '#555' }}>
        ⚠ 此操作會將該筆退費標為「放棄」，<strong>不會建立任何金錢交易</strong>。通常用於：客戶同意改下週、信用券 / 點數抵償、金額太小不退等情境。
      </div>
      <div style={{ marginBottom: 14, fontSize: 12, color: '#555' }}>客戶淨付額 <strong style={{ color: '#e85d3a' }}>${row.netPaid.toLocaleString()}</strong> · 場次 {row.sessionDate} {row.sessionStartTime}</div>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>原因（必填）</span>
        <textarea value={reason} onChange={(e) => { setReason(e.target.value); setErrorMsg(null) }} placeholder="例：客戶 LINE 確認改下週 / 已換信用券..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbc9c2', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </label>
      {errorMsg && <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontSize: 12, marginBottom: 12 }}>{errorMsg}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #cbc9c2', background: '#fff', fontSize: 13, cursor: 'pointer' }}>取消</button>
        <button type="button" onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#a16207', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}>{submitting ? '處理中…' : '確認放棄'}</button>
      </div>
    </Modal>
  )
}

function Modal({ title, accent, children, onClose }: { title: string; accent: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${accent}` }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#888', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── 退費歷史 ───────────────────────────────────────────────────
function HistoryTab({ rows, venues }: { rows: RefundHistoryRow[]; venues: Venue[] }) {
  const [decisionFilter, setDecisionFilter] = useState<RefundDecision | 'all'>('all')
  const [venueFilter, setVenueFilter] = useState<string>('all')

  const filtered = useMemo(() => rows.filter((r) =>
    (decisionFilter === 'all' || r.decision === decisionFilter) &&
    (venueFilter === 'all' || r.venueId === venueFilter)
  ), [rows, decisionFilter, venueFilter])

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>決定類型</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', '全部'], ['refunded', '已退款'], ['waived', '放棄']] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setDecisionFilter(key)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: decisionFilter === key ? '#1a1917' : '#f5f4f0', color: decisionFilter === key ? '#fff' : '#666' }}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>球館</div>
          <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #cbc9c2', fontSize: 12, fontWeight: 500 }}>
            <option value="all">全部</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>
          共 <strong>{filtered.length}</strong> 筆
          {filtered.filter((r) => r.decision === 'refunded').length > 0 && (
            <> · 已退 <strong style={{ color: '#166534' }}>${filtered.filter((r) => r.decision === 'refunded').reduce((s, r) => s + (r.refundedAmount ?? 0), 0).toLocaleString()}</strong></>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: 40, textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 14 }}>沒有符合條件的退費紀錄</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, textAlign: 'left' }}>
                <th style={{ padding: '10px', fontWeight: 500 }}>決定</th>
                <th style={{ padding: '10px', fontWeight: 500 }}>客戶</th>
                <th style={{ padding: '10px', fontWeight: 500 }}>場次</th>
                <th style={{ padding: '10px', fontWeight: 500, textAlign: 'right' }}>金額</th>
                <th style={{ padding: '10px', fontWeight: 500 }}>方式 / 原因</th>
                <th style={{ padding: '10px', fontWeight: 500 }}>處理</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.registrationId} style={{ borderTop: '1px solid #f5f4f0' }}>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{r.decision === 'refunded' ? <Badge color="green">✓ 已退款</Badge> : <Badge color="gray">放棄</Badge>}</td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600 }}>{r.customerName}</div>
                    {r.customerPhone && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{r.customerPhone}</div>}
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', fontSize: 12 }}>
                    <div><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: VENUE_COLOR[r.venueId] ?? '#aaa', marginRight: 6 }} />{r.venueName}</div>
                    <div style={{ color: '#555', marginTop: 2 }}>{r.sessionDate} {r.sessionStartTime}</div>
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', textAlign: 'right' }}>{r.refundedAmount !== null ? <span style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>${r.refundedAmount.toLocaleString()}</span> : <span style={{ fontSize: 13, color: '#aaa' }}>—</span>}</td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', fontSize: 12, color: '#555', maxWidth: 280 }}>
                    {r.decision === 'refunded' ? (<><div>{fmtMethod(r.refundMethod)}</div>{r.refundNotes && <div style={{ color: '#888', marginTop: 2, fontSize: 11 }}>{r.refundNotes}</div>}</>) : (<div style={{ color: '#666' }}>{r.waiveReason ?? '—'}</div>)}
                  </td>
                  <td style={{ padding: '12px 10px', verticalAlign: 'top', fontSize: 11, color: '#888' }}>{r.decidedBy ?? '—'}<div style={{ marginTop: 2 }}>{fmtTime(r.decidedAt)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
