'use client'

// 客戶頁畫面（client）。資料由 server 殼 (page.tsx) 以 props 傳入；
// 角色 scope 已在 server 端完成，這裡只做程度/搜尋的前端篩選。

import { useMemo, useState } from 'react'
import type { Customer } from '@/types'
import { skillRangeLabel, averageSkillLevel, type FourSkills } from '@/data/skill'

type Stat = { sessions: number; amount: number; lastVisit: string | null }

/** 客戶四項能力 → { 顯示標籤(區間/準確值), 顏色用單一級, 是否為四項平均 } */
function skillDisplay(c: Customer): { label: string | null; colorKey: string | null; isAverage: boolean } {
  const four: FourSkills = {
    attack: c.skillAttack ?? null, defense: c.skillDefense ?? null,
    setting: c.skillSetting ?? null, block: c.skillBlock ?? null,
  }
  const range = skillRangeLabel(four)
  if (range) return { label: range, colorKey: averageSkillLevel(four) ?? c.skillLevel, isAverage: true }
  return { label: c.skillLevel, colorKey: c.skillLevel, isAverage: false } // 舊資料回退
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

export default function CustomersClient({
  customers,
  stats,
}: {
  customers: Customer[]
  stats: Record<string, Stat>
}) {
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filtered = useMemo(() => {
    let result = customers
    if (selectedLevel !== 'all') {
      result = result.filter(c => c.skillLevel === selectedLevel)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
      )
    }
    return result
  }, [customers, selectedLevel, searchQuery])

  return (
    <div style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.cust-wrap{padding-top:64px !important}}`}</style>
      <div className="cust-wrap" style={{ paddingTop: 0 }}>

        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>客戶資料</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>共 {filtered.length} 位客戶</p>
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

          {filtered.map(c => {
            const stat = stats[c.id] ?? { sessions: 0, amount: 0, lastVisit: null }
            const skill = skillDisplay(c)
            const clr = skill.colorKey ? SKILL_COLOR[skill.colorKey] : null
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 80px 100px', padding: '14px 20px', borderTop: '1px solid #f5f4f0', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: clr ? clr.bg : '#f5f4f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    color: clr ? clr.text : '#888',
                  }}>
                    {c.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {c.name}
                      {c.isBanned ? (
                        <span title={c.banReason ?? '黑名單'} style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: '#fee2e2', color: '#991b1b' }}>
                          🚫 黑名單{c.owedAmount ? ` · 欠 $${c.owedAmount}` : ''}
                        </span>
                      ) : (c.activeViolations ?? 0) > 0 ? (
                        <span title="未解除違規" style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: '#fef3c7', color: '#92400e' }}>
                          違規 {c.activeViolations}/3
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{c.phone}</div>
                  </div>
                </div>

                <div>
                  {skill.label && clr && (
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: clr.bg, color: clr.text, whiteSpace: 'nowrap' }}>
                        {skill.label}
                      </span>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>
                        {skill.isAverage ? '四項平均' : (skill.label ? SKILL_DESC[skill.label] : '')}
                      </div>
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

                <div style={{ textAlign: 'right', fontSize: 12, color: formatRelativeDate(stat.lastVisit) === '今日' ? '#059669' : '#888', fontWeight: formatRelativeDate(stat.lastVisit) === '今日' ? 600 : 400 }}>
                  {formatRelativeDate(stat.lastVisit)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
