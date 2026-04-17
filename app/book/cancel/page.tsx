'use client'

import { useState } from 'react'

export default function CancelPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode]   = useState('')
  const [step, setStep]   = useState<'input' | 'confirm' | 'done'>('input')
  const [loading, setLoading] = useState(false)

  const MOCK_REG = {
    code: 'VB123456',
    venue: '飛翼排球館',
    sessionDate: '2026-04-18',
    startTime: '14:00',
    endTime: '17:00',
    count: 2,
    amount: 560,
    hoursUntilStart: 20,
    canCancel: true,
  }

  async function search() {
    if (!phone || !code) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    setStep('confirm')
  }

  async function confirm() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    setStep('done')
  }

  const isTooLate = MOCK_REG.hoursUntilStart < 12

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, width: '100%' }}>

        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', textAlign: 'center' }}>取消報名</h1>

        {step === 'input' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e8e6e0' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>報名電話</div>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="報名時填的電話" type="tel"
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e8e6e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>報名編號</div>
              <input value={code} onChange={e => setCode(e.target.value)}
                placeholder="VBxxxxxx"
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e8e6e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={search} disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: '#1a1917', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              {loading ? '查詢中...' : '查詢報名'}
            </button>
            <div style={{ marginTop: 14, fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 1.6 }}>
              開場前 12 小時以上可免費取消<br/>
              開場前 12 小時內取消須自行找人替補
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, border: '1px solid #e8e6e0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>查詢到以下報名紀錄</div>
              {[
                { label: '球館',    value: MOCK_REG.venue },
                { label: '場次',    value: `${MOCK_REG.sessionDate} ${MOCK_REG.startTime}–${MOCK_REG.endTime}` },
                { label: '報名人數', value: `${MOCK_REG.count} 人` },
                { label: '費用',    value: `$${MOCK_REG.amount}` },
                { label: '距開場',  value: `還有 ${MOCK_REG.hoursUntilStart} 小時` },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f5f4f0', fontSize: 14 }}>
                  <span style={{ color: '#888' }}>{row.label}</span>
                  <span style={{ fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {isTooLate ? (
              <div style={{ background: '#fee2e2', borderRadius: 12, padding: '16px', marginBottom: 14, border: '1px solid #fca5a5' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ 距開場不足 12 小時</div>
                <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.6 }}>
                  此時段已無法免費取消。若您仍需取消，請自行找人替補後聯繫館方確認，否則將列入黑名單。
                </div>
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
                  聯絡館方：02-2956-xxxx
                </div>
              </div>
            ) : (
              <div style={{ background: '#dcfce7', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid #86efac' }}>
                <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                  ✓ 距開場超過 12 小時，可免費取消
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setStep('input')} style={{
                padding: '12px', borderRadius: 10, border: '1px solid #e8e6e0',
                background: '#fff', fontSize: 14, color: '#555', cursor: 'pointer',
              }}>返回</button>
              {!isTooLate && (
                <button onClick={confirm} disabled={loading} style={{
                  padding: '12px', borderRadius: 10, border: 'none',
                  background: '#e85d3a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  {loading ? '取消中...' : '確認取消報名'}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e8e6e0', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>取消成功</h2>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
              您的報名已成功取消<br/>
              如有候補名單，系統將自動通知下一位
            </div>
            <a href="/" style={{
              display: 'block', padding: '12px', borderRadius: 10,
              background: '#1a1917', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}>返回首頁</a>
          </div>
        )}

      </div>
    </div>
  )
}
