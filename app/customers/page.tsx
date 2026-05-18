'use client'

import { listCustomers, listRegistrations, listSessions, getCurrentVisibleVenueIds } from '@/data/api'
import { useStoreSync } from '@/data/store'
import { useEffect, useMemo, useState } from 'react'

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

const SKILL_DESC: Record<string, string> = {
  'E':  '全新手', 'D': '運動新手', 'C': '系隊基礎',
  'B-': '簡單來回', 'B': '系隊先發', 'B+': '校隊替補',
  'A':  '校隊先發', 'S': '職業等級',
}

const NET_LABEL: Record<string, string> = {
  male: '男網', female: '女網', adjustable: '可調',
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00Z')
  const days = Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return '今日'
  if (days === 1) return '昨日'
  if (days < 7)   return `${days}天前`
  if (days < 14)  return '1週前'
  if (days < 60)  return `${Math.floor(days / 7)}週前`
  return `${Math.floor(days / 30)}月前`
}

export default function CustomersPage() {
  const storeVersion = useStoreSync()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // 使用者選擇的篩選條件
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => mounted ? getCurrentVisibleVenueIds() : 'all', [mounted, storeVersion])

  // 客戶本身沒綁館 — 過濾條件：有 registration 在 visible venue 的 session
  const customers = useMemo(() => {
    const all = listCustomers()

    // (1) 角色可見範圍
    let result: typeof all
    if (visible === 'all') {
      result = all
    } else {
      const visibleSessionIds = new Set(
        listSessions()
          .filter(s => visible.includes(s.venueId))
          .map(s => s.id),
      )
      const visibleCustomerIds = new Set(
        listRegistrations()
          .filter(r => visibleSessionIds.has(r.sessionId))
          .map(r => r.customerId),
      )
      result = all.filter(c => visibleCustomerIds.has(c.id))
    }

    // (2) 程度篩選（精確比對）
    if (selectedLevel !== 'all') {
      result = result.filter(c => c.skillLevel === selectedLevel)
    }

    // (3) 搜尋（姓名 / 電話 — 任一命中即可）
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
      )
    }

    return result
  }, [visible, selectedLevel, searchQuery])

  const stats = useMemo(() => {
    const allRegs = listRegistrations()
    const sessionMap = new Map(listSessions().map(s => [s.id, s]))
    const m = new Map<string, { sessions: number; amount: number; lastVisit: string }>()
    for (const c of customers) {
      const myRegs = allRegs.filter(r => r.customerId === c.id && r.status === 'attended')
      const lastDate = myRegs
        .map(r => sessionMap.get(r.sessionId)?.sessionDate ?? '')
        .filter(Boolean)
        .sort()
        .pop() ?? null
      m.set(c.id, {
        sessions: myRegs.length,
        amount: myRegs.reduce((s, r) => s + (r.paidAmount ?? 0), 0),
        lastVisit: formatRelativeDate(lastDate),
      })
    }
    return m
  }, [customers])

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.cust-wrap{padding-top:64px !important}}`}</style>
      <div className="cust-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>客戶資料</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>共 {customers.length} 位客戶</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="搜尋姓名或電話..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, width: 200, outline: 'none' }}
            />
            <select
              value={selectedLevel}
              onChange={e => setSelectedLevel(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', background: '#fff', fontSize: 13 }}
            >
              <option value="all">所有程度</option>
              {['S*','S','A+','A','B+','B','B-','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 80px 100px', padding: '10px 20px', background: '#fafaf8', fontSize: 11, color: '#aaa', fontWeight: 500, gap: 12 }}>
            <div>客戶</div><div>程度</div><div>偏好網高</div><div style={{ textAlign: 'right' }}>參與場次</div><div style={{ textAlign: 'right' }}>累計消費</div><div style={{ textAlign: 'right' }}>最近參加</div>
          </div>

          {customers.map(c => {
            const stat = stats.get(c.id) ?? { sessions: 0, amount: 0, lastVisit: '—' }
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
