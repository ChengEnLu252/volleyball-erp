'use client'

import { useEffect, useState, useMemo } from 'react'
import { listSessions, listSessionRegistrations, getCurrentVisibleVenueIds } from '@/data/api'
import { useStoreSync } from '@/data/store'
import { REGISTRATION_TYPE_LABEL } from '@/types'
import type { RegistrationWithCustomer } from '@/data/api'

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

const METHOD_LABEL: Record<string, string> = { cash: '現金', transfer: '轉帳', online: '線上' }

/**
 * 在沒有 URL 帶 sessionId 的情況下，挑「今天人最多的場次」當作
 * 「現在正在進行的場次」— demo 起來最有戲劇感。
 *
 * 視角過濾：manager / staff 只挑自己館的場次。
 */
function pickFeaturedSession(visible: string[] | 'all') {
  const today = new Date().toISOString().split('T')[0]
  const allToday = listSessions({ date: today })
  const todaySessions = visible === 'all'
    ? allToday
    : allToday.filter(s => visible.includes(s.venueId))
  if (todaySessions.length > 0) {
    return todaySessions.reduce((a, b) =>
      (b.currentCount ?? 0) > (a.currentCount ?? 0) ? b : a)
  }
  // fallback：拿任何一個非取消、非未來的場次（也走視角過濾）
  const allFallback = listSessions().filter(s => s.sessionDate <= today && s.status !== 'cancelled')
  const fallback = visible === 'all'
    ? allFallback
    : allFallback.filter(s => visible.includes(s.venueId))
  return fallback[fallback.length - 1] ?? (visible === 'all' ? listSessions()[0] : null)
}

/** 把 RegistrationWithCustomer 轉成 UI 用的 row（含可變的 status/paymentStatus） */
type RegRow = {
  id: string
  customerId: string
  type: 'season_player' | 'season_substitute' | 'walk_in'
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended'
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'refunded'
  paymentMethod: 'cash' | 'transfer' | 'online'
  amount: number
  customer: RegistrationWithCustomer['customer']
}

export default function CheckinPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  const session = useMemo(() => pickFeaturedSession(visible), [visible])
  const initialRegs: RegRow[] = useMemo(() => {
    if (!session) return []
    return listSessionRegistrations(session.id).map(r => ({
      id: r.id,
      customerId: r.customerId,
      type: r.type,
      status: r.status,
      paymentStatus: r.paymentStatus ?? 'unpaid',
      paymentMethod: r.paymentMethod ?? 'cash',
      amount: r.expectedAmount ?? 0,
      customer: r.customer,
    }))
  }, [session])

  const [regs, setRegs] = useState<RegRow[]>(initialRegs)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function toggleCheckin(id: string) {
    setRegs(prev => prev.map(r => {
      if (r.id !== id) return r
      const next = r.status === 'attended' ? 'registered' : 'attended'
      showToast(next === 'attended' ? `✓ ${r.customer.name} 已報到` : `${r.customer.name} 取消報到`)
      return { ...r, status: next }
    }))
  }

  function markPaid(id: string) {
    setRegs(prev => prev.map(r => {
      if (r.id !== id) return r
      showToast(`💰 ${r.customer.name} 已記錄收款`)
      return { ...r, paymentStatus: 'paid' }
    }))
  }

  if (!session) {
    return <div style={{ padding: 24 }}>目前沒有可顯示的場次。</div>
  }

  const attendedCount = regs.filter(r => r.status === 'attended').length
  const unpaidCount   = regs.filter(r => r.type !== 'season_player' && r.paymentStatus !== 'paid').length

  return (
    <div style={{ padding: 20, maxWidth: 680, margin: '0 auto' }}>

      {/* Toast 通知 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1917', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)',
        }}>
          {toast}
        </div>
      )}

      {/* 場次資訊卡 */}
      <div style={{
        background: '#1a1917', color: '#fff', borderRadius: 14,
        padding: '18px 20px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>目前場次</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{session.venueName} · {session.startTime}–{session.endTime}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#d4a843' }}>{attendedCount}</div>
            <div style={{ fontSize: 11, color: '#888' }}>已報到</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#aaa' }}>{regs.length - attendedCount}</div>
            <div style={{ fontSize: 11, color: '#888' }}>未報到</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: unpaidCount > 0 ? '#e85d3a' : '#10b981' }}>{unpaidCount}</div>
            <div style={{ fontSize: 11, color: '#888' }}>未收款</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{Math.max(0, session.maxCapacity - regs.length)}</div>
            <div style={{ fontSize: 11, color: '#888' }}>剩餘名額</div>
          </div>
        </div>
      </div>

      {/* 名單 */}
      <div style={{ display: 'grid', gap: 8 }}>
        {regs.map(reg => (
          <div key={reg.id} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0',
            padding: '14px 16px',
            borderLeft: reg.status === 'attended' ? '4px solid #10b981' : '4px solid #e8e6e0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

              {/* 頭像 */}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: reg.status === 'attended' ? '#dcfce7' : '#f5f4f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700,
                color: reg.status === 'attended' ? '#166534' : '#888',
                flexShrink: 0,
              }}>
                {reg.customer.name[0]}
              </div>

              {/* 姓名 + 程度 + 報名類型 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{reg.customer.name}</span>
                  {reg.customer.skillLevel && (
                    <span style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 6,
                      background: SKILL_COLOR[reg.customer.skillLevel]?.bg ?? '#f1f5f9',
                      color: SKILL_COLOR[reg.customer.skillLevel]?.text ?? '#64748b',
                      fontWeight: 600,
                    }}>
                      {reg.customer.skillLevel}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600,
                    background: reg.type === 'season_player' ? '#dbeafe' : reg.type === 'season_substitute' ? '#fef3c7' : '#f5f4f0',
                    color:      reg.type === 'season_player' ? '#1e40af' : reg.type === 'season_substitute' ? '#92400e' : '#666',
                  }}>
                    {REGISTRATION_TYPE_LABEL[reg.type]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  {reg.customer.phone}
                  {reg.type === 'season_player'
                    ? ' · 季打免費'
                    : ` · ${METHOD_LABEL[reg.paymentMethod]} $${reg.amount}`}
                </div>
              </div>

              {/* 操作按鈕 */}
              <div style={{ display: 'flex', gap: 8 }}>
                {reg.type !== 'season_player' && reg.paymentStatus !== 'paid' && (
                  <button
                    onClick={() => markPaid(reg.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: 'none',
                      background: '#fef3c7', color: '#92400e',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    收款
                  </button>
                )}
                {reg.type !== 'season_player' && reg.paymentStatus === 'paid' && reg.status !== 'attended' && (
                  <span style={{ fontSize: 12, color: '#10b981', padding: '8px 4px' }}>✓ 已付款</span>
                )}
                <button
                  onClick={() => toggleCheckin(reg.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: reg.status === 'attended' ? '#10b981' : '#1a1917',
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    minWidth: 72,
                  }}
                >
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
