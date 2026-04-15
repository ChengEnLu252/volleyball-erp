'use client'

import { MOCK_CUSTOMERS } from '@/data/mock'

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

const SKILL_DESC: Record<string, string> = {
  'E':  '全新手', 'D': '運動新手', 'C': '系隊基礎',
  'B-': '簡單來回', 'B': '系隊先發', 'B+': '校隊替補',
  'A':  '校隊先發', 'S': '職業等級',
}

const NET_LABEL: Record<string, string> = {
  male: '男網', female: '女網', adjustable: '可調',
}

const MOCK_STATS: Record<string, { sessions: number; amount: number; lastVisit: string }> = {
  c1:  { sessions: 48, amount: 12000, lastVisit: '今日' },
  c2:  { sessions: 6,  amount: 1200,  lastVisit: '3天前' },
  c3:  { sessions: 92, amount: 25760, lastVisit: '今日' },
  c4:  { sessions: 12, amount: 2400,  lastVisit: '1週前' },
  c5:  { sessions: 67, amount: 16750, lastVisit: '今日' },
  c6:  { sessions: 130,amount: 39000, lastVisit: '2天前' },
  c7:  { sessions: 44, amount: 11000, lastVisit: '今日' },
  c8:  { sessions: 115,amount: 32200, lastVisit: '昨日' },
  c9:  { sessions: 3,  amount: 600,   lastVisit: '2週前' },
  c10: { sessions: 29, amount: 7250,  lastVisit: '昨日' },
}

export default function CustomersPage() {
  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.cust-wrap{padding-top:64px !important}}`}</style>
      <div className="cust-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>客戶資料</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>共 {MOCK_CUSTOMERS.length} 位客戶</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="搜尋姓名或電話..." style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, width: 200, outline: 'none' }} />
            <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}>
              <option>所有程度</option>
              {['S','A','B+','B','B-','C','D','E'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
            <div>客戶</div><div>程度</div><div>偏好網高</div><div style={{ textAlign: 'right' }}>參與場次</div><div style={{ textAlign: 'right' }}>累計消費</div><div style={{ textAlign: 'right' }}>最近參加</div>
          </div>

          {MOCK_CUSTOMERS.map(c => {
            const stat = MOCK_STATS[c.id]
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 80px 100px', padding: '14px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: c.skillLevel ? SKILL_COLOR[c.skillLevel].bg : '#f5f4f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    color: c.skillLevel ? SKILL_COLOR[c.skillLevel].text : '#888',
                  }}>
                    {c.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{c.phone}</div>
                  </div>
                </div>

                <div>
                  {c.skillLevel && (
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: SKILL_COLOR[c.skillLevel].bg, color: SKILL_COLOR[c.skillLevel].text }}>
                        {c.skillLevel}
                      </span>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{SKILL_DESC[c.skillLevel]}</div>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#555' }}>
                  {c.preferredNetHeight ? NET_LABEL[c.preferredNetHeight] : '—'}
                </div>

                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{stat.sessions} 場</div>

                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: stat.amount > 20000 ? '#7c3aed' : '#1a1917' }}>
                  ${stat.amount.toLocaleString()}
                </div>

                <div style={{ textAlign: 'right', fontSize: 12, color: stat.lastVisit === '今日' ? '#059669' : '#888', fontWeight: stat.lastVisit === '今日' ? 600 : 400 }}>
                  {stat.lastVisit}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
