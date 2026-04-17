'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { VENUE_BY_SLUG } from '@/data/mock'

function ConfirmationContent() {
  const params = useSearchParams()
  const venue    = params.get('venue')    ?? 'flywing'
  const count    = params.get('count')    ?? '1'
  const method   = params.get('method')  ?? 'cash'
  const waitlist = params.get('waitlist') === 'true'

  const venueInfo = VENUE_BY_SLUG[venue]
  const code = `VB${Date.now().toString().slice(-6)}`

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{waitlist ? '⏳' : '✅'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            {waitlist ? '候補報名成功' : '報名成功！'}
          </h1>
          <div style={{ fontSize: 14, color: '#888' }}>
            {waitlist
              ? '有人取消時我們會立即通知您'
              : '請截圖保存此頁面作為憑證'}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 14, border: '1px solid #e8e6e0' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>報名編號</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, color: '#1a1917' }}>{code}</div>
          </div>
          {[
            { label: '球館',    value: venueInfo?.name ?? venue },
            { label: '報名人數', value: `${count} 人` },
            { label: '付款方式', value: method === 'cash' ? '現場付款（現金）' : '銀行轉帳' },
            { label: '狀態',    value: waitlist ? '候補中' : '已確認' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f5f4f0', fontSize: 14 }}>
              <span style={{ color: '#888' }}>{row.label}</span>
              <span style={{ fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {method === 'transfer' && !waitlist && (
          <div style={{ background: '#fef3c7', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid #fcd34d' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>💳 轉帳資訊</div>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
              {venueInfo?.transferInfo}<br/>
              轉帳金額請備註「報名編號 {code}」
            </div>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚠️ 取消規則提醒</div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
            · 開場前 12 小時以上：可免費取消<br/>
            · 開場前 12 小時內：須自行找人替補並通知館方<br/>
            · 未找替補直接缺席：列入黑名單
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a href={`/book/${venue}/cancel`} style={{
            padding: '12px', borderRadius: 10, border: '1px solid #e8e6e0',
            textAlign: 'center', textDecoration: 'none', fontSize: 14, color: '#555', background: '#fff',
          }}>取消報名</a>
          <a href={`/book/${venue}`} style={{
            padding: '12px', borderRadius: 10, border: 'none',
            textAlign: 'center', textDecoration: 'none', fontSize: 14, color: '#fff', background: '#1a1917', fontWeight: 600,
          }}>返回場次列表</a>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>}><ConfirmationContent /></Suspense>
}
