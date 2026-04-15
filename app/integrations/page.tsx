'use client'

import { useState } from 'react'

export default function IntegrationsPage() {
  const [lineEnabled, setLineEnabled] = useState(false)
  const [payEnabled, setPayEnabled]   = useState(false)

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.int-wrap{padding-top:64px !important}}`}</style>
      <div className="int-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>整合設定</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>LINE 通知與金流串接設定</p>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>LINE 通知整合</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>透過 LINE 傳送即時通知給老闆和館主</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: lineEnabled ? '#059669' : '#888' }}>{lineEnabled ? '已啟用' : '未啟用'}</span>
                <div onClick={() => setLineEnabled(!lineEnabled)} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', position: 'relative',
                  background: lineEnabled ? '#059669' : '#d1d5db',
                }}>
                  <div style={{ position: 'absolute', top: 2, left: lineEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { label: '報名成功通知', desc: '客戶報名後自動發送確認訊息', enabled: true  },
                  { label: '場次提醒',     desc: '開場前 1 小時提醒已報名客戶', enabled: true  },
                  { label: '未付款提醒',   desc: '超過 2 小時未付款自動提醒',   enabled: true  },
                  { label: '異常警報',     desc: '庫存不足、贈送異常等即時通知', enabled: false },
                  { label: '每日營運摘要', desc: '每晚 22:00 發送當日報表給老闆', enabled: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fafaf8', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: item.enabled ? '#dcfce7' : '#f3f4f6', color: item.enabled ? '#166534' : '#6b7280', fontWeight: 500 }}>
                      {item.enabled ? '已設定' : '未設定'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
                📌 正式上線後需要提供 LINE Channel Access Token 完成串接設定
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>線上金流整合</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>報名時支援線上刷卡付款，自動與報名系統綁定</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: payEnabled ? '#059669' : '#888' }}>{payEnabled ? '已啟用' : '未啟用'}</span>
                <div onClick={() => setPayEnabled(!payEnabled)} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background .2s', position: 'relative',
                  background: payEnabled ? '#059669' : '#d1d5db',
                }}>
                  <div style={{ position: 'absolute', top: 2, left: payEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { name: '信用卡', icon: '💳', status: '支援' },
                  { name: 'LINE Pay', icon: '💚', status: '支援' },
                  { name: 'Apple Pay', icon: '🍎', status: '支援' },
                  { name: 'Google Pay', icon: '🔵', status: '支援' },
                  { name: '街口支付', icon: '🟡', status: '規劃中' },
                  { name: 'ATM 轉帳', icon: '🏧', status: '支援' },
                ].map((p, i) => (
                  <div key={i} style={{ padding: '12px', background: '#fafaf8', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: p.status === '規劃中' ? '#888' : '#059669', marginTop: 2 }}>{p.status}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
                📌 正式上線後需要申請綠界或藍新金流帳號完成串接
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
