'use client'

import { use } from 'react'
import { MOCK_SESSIONS, MOCK_CUSTOMERS } from '@/data/mock'

const MOCK_REGISTRATIONS = [
  { id: 'r1', customerId: 'c1', status: 'attended',   paymentStatus: 'paid',    method: 'cash',     amount: 350 },
  { id: 'r2', customerId: 'c2', status: 'registered', paymentStatus: 'unpaid',  method: 'cash',     amount: 350 },
  { id: 'r3', customerId: 'c3', status: 'attended',   paymentStatus: 'paid',    method: 'transfer', amount: 350 },
  { id: 'r4', customerId: 'c5', status: 'attended',   paymentStatus: 'paid',    method: 'online',   amount: 350 },
  { id: 'r5', customerId: 'c6', status: 'registered', paymentStatus: 'partial', method: 'cash',     amount: 200 },
  { id: 'r6', customerId: 'c7', status: 'attended',   paymentStatus: 'paid',    method: 'transfer', amount: 350 },
  { id: 'r7', customerId: 'c8', status: 'registered', paymentStatus: 'unpaid',  method: 'cash',     amount: 350 },
  { id: 'r8', customerId: 'c10',status: 'attended',   paymentStatus: 'paid',    method: 'cash',     amount: 350 },
]

const SKILL_LABEL: Record<string, string> = {
  'E':'E','D':'D','C':'C','B-':'B-','B':'B','B+':'B+','A':'A','S':'S',
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
  paid: '已付清', unpaid: '未付款', partial: '部分付款',
}
const PAYMENT_COLOR: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#dcfce7', text: '#166534' },
  unpaid:  { bg: '#fee2e2', text: '#991b1b' },
  partial: { bg: '#fef3c7', text: '#92400e' },
}
const METHOD_LABEL: Record<string, string> = {
  cash: '現金', transfer: '轉帳', online: '線上',
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0]
  const registrations = MOCK_REGISTRATIONS.map(r => ({
    ...r,
    customer: MOCK_CUSTOMERS.find(c => c.id === r.customerId)!,
  }))

  const paidCount   = registrations.filter(r => r.paymentStatus === 'paid').length
  const unpaidCount = registrations.filter(r => r.paymentStatus !== 'paid').length
  const totalPaid   = registrations.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.amount, 0)

  return (
    <div style={{ padding: 24 }}>
      <a href="/sessions" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        ‹ 返回場次列表
      </a>

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
          display: 'grid', gridTemplateColumns: '32px 1fr 80px 90px 80px 100px 90px',
          padding: '8px 20px', background: '#fafaf8',
          fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12,
        }}>
          <div>#</div><div>姓名</div><div>程度</div><div>報到</div><div>付款方式</div><div>付款狀態</div><div style={{ textAlign: 'right' }}>金額</div>
        </div>

        {registrations.map((reg, i) => (
          <div key={reg.id} style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 80px 90px 80px 100px 90px',
            padding: '12px 20px', borderTop: '1px solid #f5f4f0',
            alignItems: 'center', gap: 12,
            background: reg.paymentStatus === 'unpaid' ? '#fffbfb' : '#fff',
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
                <div style={{ fontSize: 11, color: '#aaa' }}>{reg.customer.phone}</div>
              </div>
            </div>
            <div>
              {reg.customer.skillLevel && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 8,
                  background: SKILL_COLOR[reg.customer.skillLevel].bg,
                  color: SKILL_COLOR[reg.customer.skillLevel].text,
                }}>
                  {SKILL_LABEL[reg.customer.skillLevel]}
                </span>
              )}
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
            <div style={{ fontSize: 12, color: '#555' }}>{METHOD_LABEL[reg.method]}</div>
            <div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 8,
                background: PAYMENT_COLOR[reg.paymentStatus].bg,
                color: PAYMENT_COLOR[reg.paymentStatus].text,
              }}>
                {PAYMENT_LABEL[reg.paymentStatus]}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: reg.paymentStatus === 'unpaid' ? '#e85d3a' : '#1a1917' }}>
              ${reg.amount}
            </div>
          </div>
        ))}
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
