'use client'

// ============================================================
// /blacklist — 黑名單 / 違規管理（owner / manager；七館同步）
// ------------------------------------------------------------
//   - 黑名單清單：欠費 / 違規次數 → 標記繳清（解除）、展開違規明細
//   - LINE 通知佇列：待發送（官方 API 接上後自動發）
//   - 手動記違規：搜尋客戶 → 記一次違規（累計 3 次自動列黑名單）
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import {
  loadBlacklistAction, clearCustomerDuesAction, getCustomerViolationsAction,
  recordManualViolationAction, searchCustomersForViolationAction,
  type BlacklistEntry, type PendingLineNote, type ViolationRow,
} from '@/app/actions/blacklist'
import { COLORS, FONTS } from '@/components/theme/tokens'

const VTYPE: Record<string, string> = { no_show: '未到場', unpaid: '未付款', manual: '手動' }

export default function BlacklistPage() {
  const [data, setData] = useState<{ entries: BlacklistEntry[]; pending: PendingLineNote[] } | null | undefined>(undefined)
  const [tab, setTab] = useState<'list' | 'queue'>('list')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [violations, setViolations] = useState<Record<string, ViolationRow[]>>({})
  const [recordOpen, setRecordOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const r = await loadBlacklistAction()
    setData(r.ok ? { entries: r.entries, pending: r.pending } : null)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!violations[id]) {
      const r = await getCustomerViolationsAction(id)
      if (r.ok) setViolations((s) => ({ ...s, [id]: r.rows }))
    }
  }
  const clearDues = async (e: BlacklistEntry) => {
    if (!window.confirm(`確認「${e.name}」已繳清 $${e.owed}？將解除黑名單並清除所有未解除違規。`)) return
    setBusy(true)
    const r = await clearCustomerDuesAction(e.customerId)
    setBusy(false)
    if (!r.ok) window.alert(r.reason)
    setViolations((s) => { const c = { ...s }; delete c[e.customerId]; return c })
    await refresh()
  }

  if (data === undefined) return <Shell><Empty text="載入中…" /></Shell>
  if (data === null) return <Shell><Denied /></Shell>

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>黑名單 / 違規</h1>
          <p style={{ fontSize: 13, color: COLORS.ink500, margin: '4px 0 0' }}>累計 3 次未解除違規自動列黑名單，七館同步；繳清後解除。</p>
        </div>
        <button onClick={() => setRecordOpen(true)} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: COLORS.ink900, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>＋ 手動記違規</button>
      </div>

      <div style={{ display: 'flex', gap: 4, background: COLORS.surfaceTint, borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {([['list', `黑名單（${data.entries.length}）`], ['queue', `LINE 待發送（${data.pending.length}）`]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t ? '#fff' : 'transparent', color: tab === t ? COLORS.ink900 : COLORS.ink500, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>{label}</button>
        ))}
      </div>

      {tab === 'list' ? (
        data.entries.length === 0 ? <Empty text="目前沒有黑名單" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: busy ? 0.6 : 1 }}>
            {data.entries.map((e) => {
              const open = expanded === e.customerId
              return (
                <div key={e.customerId} style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{e.name}</span>
                    <span style={{ fontSize: 12, color: COLORS.ink500 }}>{e.phone}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 7, background: '#fee2e2', color: '#991b1b' }}>違規 {e.violationCount} 次</span>
                    {e.owed > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.danger }}>欠費 ${e.owed}</span>}
                    <span style={{ fontSize: 11, color: COLORS.ink300 }}>{e.bannedAt ? new Date(e.bannedAt).toLocaleDateString('zh-TW') : ''}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={() => toggleExpand(e.customerId)} style={ghost}>{open ? '收合' : '明細'}</button>
                      <button onClick={() => clearDues(e)} style={{ ...ghost, background: COLORS.successBg, color: COLORS.success, borderColor: COLORS.successBg }}>標記繳清 · 解除</button>
                    </div>
                  </div>
                  {open && (
                    <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${COLORS.borderLight}` }}>
                      {(violations[e.customerId] ?? []).map((v) => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${COLORS.borderLight}`, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: COLORS.surfaceTint, color: COLORS.ink700 }}>{VTYPE[v.type] ?? v.type}</span>
                          <span style={{ color: COLORS.ink700 }}>{v.reason}</span>
                          {v.venueName && <span style={{ color: COLORS.ink300 }}>· {v.venueName}</span>}
                          {v.amount > 0 && <span style={{ color: COLORS.danger, fontWeight: 700 }}>${v.amount}</span>}
                          <span style={{ marginLeft: 'auto', color: COLORS.ink300 }}>{new Date(v.createdAt).toLocaleDateString('zh-TW')}{v.resolved ? '（已解除）' : ''}</span>
                        </div>
                      ))}
                      {!(violations[e.customerId] ?? []).length && <div style={{ fontSize: 12, color: COLORS.ink300, padding: '8px 0' }}>載入中…</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.borderLight}`, fontSize: 12, color: COLORS.ink500 }}>
            LINE 官方帳號 API 接上後（7 組官方帳號 token）將自動發送；目前為待發送佇列。
          </div>
          {data.pending.length === 0 ? <Empty text="沒有待發送的通知" /> : data.pending.map((n) => (
            <div key={n.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.borderLight}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{n.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: '#fef3c7', color: '#92400e' }}>待發送</span>
                {n.owedAmount > 0 && <span style={{ fontSize: 12, color: COLORS.danger, fontWeight: 700 }}>欠 ${n.owedAmount}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.ink300 }}>{new Date(n.createdAt).toLocaleString('zh-TW', { hour12: false })}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink900 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: COLORS.ink500, lineHeight: 1.6, marginTop: 2 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}

      {recordOpen && <RecordViolationModal onClose={() => setRecordOpen(false)} onDone={refresh} />}
    </Shell>
  )
}

// —— 手動記違規 modal ——
function RecordViolationModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; phone: string | null; isBanned: boolean; activeViolations: number }[]>([])
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const search = async (term: string) => {
    setQ(term)
    if (term.trim().length < 1) { setResults([]); return }
    const r = await searchCustomersForViolationAction(term)
    if (r.ok) setResults(r.results)
  }
  const submit = async () => {
    if (!picked) return
    setBusy(true); setMsg('')
    const r = await recordManualViolationAction({ customerId: picked.id, venueId: null, reason: reason || '館長手動記錄' })
    setBusy(false)
    if (!r.ok) { setMsg(r.reason); return }
    setMsg(r.banned ? `已記違規（第 ${r.count} 次）→ 已自動列入黑名單` : `已記違規（累計 ${r.count} 次）`)
    onDone()
    setTimeout(onClose, 1200)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(45,27,46,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '86vh', overflow: 'auto', fontFamily: FONTS.sans, color: COLORS.ink900 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${COLORS.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>手動記違規</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.ink300 }}>×</button>
        </div>
        <div style={{ padding: 18 }}>
          {!picked ? (
            <>
              <input autoFocus value={q} onChange={(e) => search(e.target.value)} placeholder="搜尋客戶（姓名 / 電話）" style={inp} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {results.map((r) => (
                  <button key={r.id} onClick={() => setPicked({ id: r.id, name: r.name })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 9, border: `1px solid ${COLORS.border}`, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: COLORS.ink300 }}>{r.phone}</span>
                    {r.isBanned ? <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#991b1b' }}>黑名單</span> : (r.activeViolations > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#92400e' }}>違規 {r.activeViolations}/3</span>)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, marginBottom: 10 }}>對象：<strong>{picked.name}</strong> <button onClick={() => setPicked(null)} style={{ ...ghost, marginLeft: 8 }}>更換</button></div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="違規原因（例：態度問題 / 惡意佔位…）" style={{ ...inp, resize: 'vertical' }} />
              <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 999, border: 'none', background: busy ? COLORS.border : COLORS.ink900, color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>記一次違規</button>
            </>
          )}
          {msg && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: COLORS.surfaceTint, color: COLORS.ink700, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}><style>{`@media(max-width:768px){.bl-wrap{padding-top:64px !important}}`}</style><div className="bl-wrap">{children}</div></div>
}
function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '50px 20px', color: COLORS.ink300, fontSize: 14, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>{text}</div>
}
function Denied() {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.ink500, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}><div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>此頁僅限館長／老闆</div>
}

const ghost: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink700, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${COLORS.border}`, fontSize: 14, outline: 'none', background: '#fff', color: COLORS.ink900 }
