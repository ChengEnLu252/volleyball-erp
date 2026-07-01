'use client'

// 前台報到 / 收款畫面（client）。資料由 server 殼以 props 傳入（已 scope）。
// 報到 → setAttendanceAction；收款/取消收款 → collectPaymentAction / undoPaymentAction。
// 動作成功後 router.refresh() 重抓 server 資料。

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collectPaymentAction, undoPaymentAction } from '@/app/actions/payments'
import { setAttendanceAction } from '@/app/actions/checkin'
import { REGISTRATION_TYPE_LABEL } from '@/types'
import type { PaymentMethod } from '@/types'
import type { CheckinBundle } from '@/data/server/queries'

const SKILL_COLOR: Record<string, { bg: string; text: string }> = {
  'E':  { bg: '#f1f5f9', text: '#64748b' }, 'D':  { bg: '#e2f0fb', text: '#1e6098' }, 'C':  { bg: '#dbeafe', text: '#1e40af' },
  'B':  { bg: '#dcfce7', text: '#166534' }, 'B+': { bg: '#fef3c7', text: '#92400e' }, 'A':  { bg: '#fed7aa', text: '#9a3412' },
  'A+': { bg: '#fce7f3', text: '#9d174d' }, 'S':  { bg: '#f3e8ff', text: '#6b21a8' }, 'S*': { bg: '#1a1917', text: '#d4a843' },
}
const METHOD_LABEL: Record<string, string> = { cash: '現金', transfer: '轉帳', online: '線上' }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
/** 'YYYY-MM-DD' → '2026/7/1（週三）' */
function fmtCheckinDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAY[d.getDay()]}）`
}

export default function CheckinClient({ data }: { data: CheckinBundle }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [methodById, setMethodById] = useState<Record<string, PaymentMethod>>({})
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2000) }

  // 預設挑「報名人數最多」的場次
  const featured = useMemo(() => {
    if (data.sessions.length === 0) return null
    return data.sessions.reduce((a, b) => (b.registrations.length > a.registrations.length ? b : a))
  }, [data.sessions])

  const current = useMemo(() => {
    const id = selectedId ?? featured?.session.id ?? null
    return data.sessions.find(s => s.session.id === id) ?? featured
  }, [selectedId, featured, data.sessions])

  if (data.sessions.length === 0 || !current) {
    return <div style={{ padding: 24, color: '#888' }}>目前沒有可顯示的場次（{data.date}）。</div>
  }

  const session = current.session
  const regs = current.registrations
  const attendedCount = regs.filter(r => r.status === 'attended').length
  const unpaidCount = regs.filter(r => r.type !== 'season_player' && r.paymentStatus !== 'paid').length

  const handleCollect = async (regId: string) => {
    const method = methodById[regId] ?? 'cash'
    setBusyId(regId)
    const res = await collectPaymentAction({ registrationId: regId, method })
    setBusyId(null)
    if (!res.ok) { showToast(`⚠️ ${res.reason}`); return }
    showToast('💰 已記錄收款'); router.refresh()
  }
  const handleUndo = async (regId: string) => {
    if (!confirm('確定取消這筆收款嗎？（僅誤收時使用）')) return
    setBusyId(regId)
    const res = await undoPaymentAction({ registrationId: regId })
    setBusyId(null)
    if (!res.ok) { showToast(`⚠️ ${res.reason}`); return }
    showToast('已取消收款'); router.refresh()
  }
  const handleAttendance = async (regId: string, attended: boolean) => {
    setBusyId(regId)
    const res = await setAttendanceAction({ registrationId: regId, attended })
    setBusyId(null)
    if (!res.ok) { showToast(`⚠️ ${res.reason}`); return }
    showToast(attended ? '✓ 已報到' : '取消報到'); router.refresh()
  }

  return (
    <div style={{ padding: 20, maxWidth: 680, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1917', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999, boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {toast}
        </div>
      )}

      {!data.isToday && (
        <div style={{ background: '#fff7ed', border: '1px solid #fb923c', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#9a3412' }}>
          今天沒有場次，顯示最近有場次的日期：<strong>{fmtCheckinDate(data.date)}</strong>
        </div>
      )}

      {/* 場次選擇（當日多場時）*/}
      {data.sessions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {data.sessions.map(cs => {
            const active = cs.session.id === session.id
            return (
              <button key={cs.session.id} type="button" onClick={() => setSelectedId(cs.session.id)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: active ? '#1a1917' : '#e0ddd4', background: active ? '#1a1917' : '#fff', color: active ? '#d4a843' : '#555' }}>
                {cs.session.venueName} {cs.session.startTime}–{cs.session.endTime}（{cs.registrations.length}）
              </button>
            )
          })}
        </div>
      )}

      {/* 場次資訊卡 */}
      <div style={{ background: '#1a1917', color: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#d4a843', fontWeight: 700, marginBottom: 4 }}>📅 {fmtCheckinDate(data.date)}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{session.venueName} · {session.startTime}–{session.endTime}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <Stat value={attendedCount} label="已報到" color="#d4a843" />
          <Stat value={regs.length - attendedCount} label="未報到" color="#aaa" />
          <Stat value={unpaidCount} label="未收款" color={unpaidCount > 0 ? '#e85d3a' : '#10b981'} />
          <Stat value={Math.max(0, session.maxCapacity - regs.length)} label="剩餘名額" color="#fff" />
        </div>
      </div>

      {/* 名單 */}
      <div style={{ display: 'grid', gap: 8 }}>
        {regs.map(reg => (
          <div key={reg.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', padding: '14px 16px', borderLeft: reg.status === 'attended' ? '4px solid #10b981' : '4px solid #e8e6e0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: reg.status === 'attended' ? '#dcfce7' : '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: reg.status === 'attended' ? '#166534' : '#888', flexShrink: 0 }}>
                {reg.customer.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{reg.customer.name}</span>
                  {reg.customer.skillLevel && (
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 6, background: SKILL_COLOR[reg.customer.skillLevel]?.bg ?? '#f1f5f9', color: SKILL_COLOR[reg.customer.skillLevel]?.text ?? '#64748b', fontWeight: 600 }}>
                      {reg.customer.skillLevel}
                    </span>
                  )}
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600, background: reg.type === 'season_player' ? '#dbeafe' : reg.type === 'season_substitute' ? '#fef3c7' : '#f5f4f0', color: reg.type === 'season_player' ? '#1e40af' : reg.type === 'season_substitute' ? '#92400e' : '#666' }}>
                    {REGISTRATION_TYPE_LABEL[reg.type]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  {reg.customer.phone ?? '—'}
                  {reg.type === 'season_player' ? ' · 季打免費' : reg.paymentStatus === 'paid' ? ` · ${METHOD_LABEL[reg.paymentMethod]} $${reg.expectedAmount}（已付）` : ` · 應收 $${reg.expectedAmount}`}
                </div>
              </div>

              {/* 操作 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {reg.type !== 'season_player' && reg.paymentStatus !== 'paid' && (
                  <>
                    <select value={methodById[reg.id] ?? 'cash'} onChange={e => setMethodById(m => ({ ...m, [reg.id]: e.target.value as PaymentMethod }))}
                      style={{ fontSize: 11, padding: '6px 4px', borderRadius: 7, border: '1px solid #e0ddd4', background: '#fff', cursor: 'pointer' }}>
                      <option value="cash">現金</option><option value="transfer">轉帳</option><option value="online">線上</option>
                    </select>
                    <button type="button" disabled={busyId === reg.id} onClick={() => handleCollect(reg.id)}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: busyId === reg.id ? 'default' : 'pointer', opacity: busyId === reg.id ? 0.5 : 1 }}>
                      {busyId === reg.id ? '…' : '收款'}
                    </button>
                  </>
                )}
                {reg.type !== 'season_player' && reg.paymentStatus === 'paid' && (
                  <button type="button" disabled={busyId === reg.id} onClick={() => handleUndo(reg.id)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0ddd4', background: '#fff', color: '#991b1b', fontSize: 11, fontWeight: 600, cursor: busyId === reg.id ? 'default' : 'pointer', opacity: busyId === reg.id ? 0.5 : 1 }}>
                    {busyId === reg.id ? '…' : '取消收款'}
                  </button>
                )}
                <button type="button" disabled={busyId === reg.id} onClick={() => handleAttendance(reg.id, reg.status !== 'attended')}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: reg.status === 'attended' ? '#10b981' : '#1a1917', color: '#fff', fontSize: 12, fontWeight: 600, cursor: busyId === reg.id ? 'default' : 'pointer', minWidth: 72, opacity: busyId === reg.id ? 0.5 : 1 }}>
                  {reg.status === 'attended' ? '✓ 報到' : '報到'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
    </div>
  )
}
