'use client'

import { useState } from 'react'

const MOCK_LOGS = [
  { id: 1, time: '16:23', user: '工讀生小明', venue: '飛翼',  action: 'ADD_PRODUCT_GIFT',    target: '運動飲料 x3',     detail: '贈送給林小明',   color: '#9d174d', bg: '#fce7f3', label: '商品贈送' },
  { id: 2, time: '15:48', user: '王館主',    venue: '球魔方', action: 'UPDATE_PAYMENT',      target: '林小明 $250',     detail: '現金 → 已付清',  color: '#1e40af', bg: '#dbeafe', label: '付款更新' },
  { id: 3, time: '15:30', user: '工讀生小明', venue: '飛翼',  action: 'ADD_PRODUCT_GIFT',    target: '運動飲料 x2',     detail: '回饋活動',       color: '#9d174d', bg: '#fce7f3', label: '商品贈送' },
  { id: 4, time: '14:55', user: '工讀生小明', venue: '日日',  action: 'ADD_PAYMENT',         target: '張志豪 $200',     detail: '現金收款',       color: '#166534', bg: '#dcfce7', label: '新增付款' },
  { id: 5, time: '14:23', user: '李小芳',    venue: 'Ace',   action: 'UPDATE_SESSION',      target: '10:00 男網純男場', detail: '名額 16→18',    color: '#92400e', bg: '#fef3c7', label: '場次調整' },
  { id: 6, time: '13:10', user: '王館主',    venue: '飛翼',  action: 'ADD_PRODUCT_GIFT',    target: '運動飲料 x2',     detail: '回饋活動',       color: '#9d174d', bg: '#fce7f3', label: '商品贈送' },
  { id: 7, time: '12:30', user: '工讀生小明', venue: '球魔方', action: 'ADD_PRODUCT_SALE',   target: '護膝 x1 $280',   detail: '賣給王大偉',     color: '#166534', bg: '#dcfce7', label: '商品販售' },
  { id: 8, time: '11:45', user: '李小芳',    venue: 'Ace',   action: 'CANCEL_REGISTRATION', target: '陳美玲',          detail: '客戶取消報名',   color: '#6b7280', bg: '#f3f4f6', label: '取消報名' },
  { id: 9, time: '10:20', user: '王館主',    venue: '球魔方', action: 'UPDATE_SESSION',      target: '14:00 女網混排場', detail: '價格 $200→$220', color: '#92400e', bg: '#fef3c7', label: '場次調整' },
  { id: 10,time: '09:05', user: '陳老闆',    venue: '日日',  action: 'ADJUST_STOCK',        target: '運動飲料 +20',    detail: '補貨入庫',       color: '#1e40af', bg: '#dbeafe', label: '庫存調整' },
]

export default function AuditPage() {
  const [filter, setFilter] = useState('all')
  const [venue,  setVenue]  = useState('all')

  const filtered = MOCK_LOGS.filter(l => {
    if (venue !== 'all' && l.venue !== venue) return false
    if (filter === 'gift' && l.action !== 'ADD_PRODUCT_GIFT') return false
    if (filter === 'payment' && !l.action.includes('PAYMENT')) return false
    if (filter === 'session' && l.action !== 'UPDATE_SESSION') return false
    return true
  })

  const giftCount = MOCK_LOGS.filter(l => l.action === 'ADD_PRODUCT_GIFT').length

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.audit-wrap{padding-top:64px !important}}`}</style>
      <div className="audit-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>操作紀錄</h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>所有人員操作的完整稽核記錄</p>
        </div>

        {giftCount >= 3 && (
          <div style={{ background: '#fce7f3', border: '1px solid #f0abcd', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: 13, color: '#9d174d' }}>
              <strong>今日商品贈送次數偏高（{giftCount} 次）</strong>，建議館主確認是否有異常操作。
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={venue} onChange={e => setVenue(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}>
            <option value="all">所有球館</option>
            {['球魔方','Ace','飛翼','日日','Playone'].map(v => <option key={v}>{v}</option>)}
          </select>
          {[
            { key: 'all',     label: '全部' },
            { key: 'gift',    label: '商品贈送' },
            { key: 'payment', label: '付款紀錄' },
            { key: 'session', label: '場次調整' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: filter === f.key ? '#1a1917' : '#fff',
              color: filter === f.key ? '#fff' : '#555',
              borderColor: filter === f.key ? '#1a1917' : '#e8e6e0',
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 90px 80px 100px 1fr 140px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
            <div>時間</div><div>操作人員</div><div>球館</div><div>類型</div><div>操作內容</div><div>備註</div>
          </div>
          {filtered.map(log => (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '60px 90px 80px 100px 1fr 140px', padding: '13px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{log.time}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{log.user}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{log.venue}</div>
              <div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: log.bg, color: log.color, fontWeight: 500 }}>
                  {log.label}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{log.target}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{log.detail}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              沒有符合條件的紀錄
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
