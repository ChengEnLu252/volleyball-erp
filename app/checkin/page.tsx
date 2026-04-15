'use client'

import { useState } from 'react'
import { MOCK_SESSIONS, MOCK_CUSTOMERS } from '@/data/mock'

const MOCK_REGS = [
  { id: 'r1', customerId: 'c1',  status: 'attended',   paymentStatus: 'paid',   method: 'cash',     amount: 350 },
  { id: 'r2', customerId: 'c2',  status: 'registered', paymentStatus: 'unpaid', method: 'cash',     amount: 350 },
  { id: 'r3', customerId: 'c3',  status: 'attended',   paymentStatus: 'paid',   method: 'transfer', amount: 350 },
  { id: 'r4', customerId: 'c5',  status: 'registered', paymentStatus: 'unpaid', method: 'cash',     amount: 350 },
  { id: 'r5', customerId: 'c7',  status: 'attended',   paymentStatus: 'paid',   method: 'online',   amount: 350 },
  { id: 'r6', customerId: 'c8',  status: 'registered', paymentStatus: 'unpaid', method: 'cash',     amount: 350 },
]

const SKILL_COLOR: Record<string, { bg: string; text: string }> = {
  'E':  { bg: '#f1f5f9', text: '#64748b' },
  'D':  { bg: '#dcfce7', text: '#166534' },
  'C':  { bg: '#dbeafe', text: '#1e40af' },
  'B-': { bg: '#e0f2fe', text: '#0369a1' },
  'B':  { bg: '#fef3c7', text: '#92400e' },
  'B+': { bg: '#fed7aa', text: '#9a3412' },
  'A':  { bg: '#fce7f3', text: '#9d174d' },
  'S':  { bg: '#f3e8ff', text: '#6b21a8' },
}

export default function CheckinPage() {
  const session = MOCK_SESSIONS[1]
  const [regs, setRegs] = useState(MOCK_REGS.map(r => ({
    ...r,
    customer: MOCK_CUSTOMERS.find(c => c.id === r.customerId)!,
  })))
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

  const attendedCount = regs.filter(r => r.status === 'attended').length
  const unpaidCount   = regs.filter(r => r.paymentStatus !== 'paid').length

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
            <div style={{ fontSize: 22, fontWeight: 700 }}>{session.maxCapacity - regs.length}</div>
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

              {/* 姓名 + 程度 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{reg.customer.name}</span>
                  {reg.customer.skillLevel && (
                    <span style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 6,
                      background: SKILL_COLOR[reg.customer.skillLevel].bg,
                      color: SKILL_COLOR[reg.customer.skillLevel].text,
                      fontWeight: 600,
                    }}>
                      {reg.customer.skillLevel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  {reg.customer.phone} ·{' '}
                  {reg.method === 'cash' ? '現金' : reg.method === 'transfer' ? '轉帳' : '線上'} ${ reg.amount}
                </div>
              </div>

              {/* 操作按鈕 */}
              <div style={{ display: 'flex', gap: 8 }}>
                {reg.paymentStatus !== 'paid' && (
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
                {reg.paymentStatus === 'paid' && reg.status !== 'attended' && (
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