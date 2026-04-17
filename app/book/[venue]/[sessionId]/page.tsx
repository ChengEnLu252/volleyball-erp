'use client'

import { use, useState } from 'react'
import { VENUE_BY_SLUG, MOCK_PUBLIC_SESSIONS } from '@/data/mock'

const SKILL_OPTIONS = ['E','D','C','B','B+','A','A+','S','S*'] as const
const SKILL_DESC: Record<string, string> = {
  'E': 'E — 完全新手',
  'D': 'D — 知道動作但無法完整執行',
  'C': 'C — 可做出連貫動作',
  'B': 'B — 系隊先發程度',
  'B+': 'B+ — 普通系隊頂尖',
  'A': 'A — 一般組校隊先發',
  'A+': 'A+ — 一般組校隊頂尖',
  'S': 'S — 公開組等級',
  'S*': 'S* — 職業等級',
}

type Player = {
  name: string
  phone: string
  nickname: string
  attack: string
  defense: string
  setting: string
  block: string
}

const emptyPlayer = (): Player => ({ name: '', phone: '', nickname: '', attack: 'C', defense: 'C', setting: 'C', block: 'C' })

function SkillSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid #e8e6e0', fontSize: 13, background: '#fff', outline: 'none',
      }}>
        {SKILL_OPTIONS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  )
}

export default function BookingPage({ params, searchParams }: {
  params: Promise<{ venue: string; sessionId: string }>
  searchParams: Promise<{ waitlist?: string }>
}) {
  const { venue, sessionId } = use(params)
  const { waitlist } = use(searchParams)
  const isWaitlist = waitlist === 'true'

  const venueInfo = VENUE_BY_SLUG[venue]
  const session = MOCK_PUBLIC_SESSIONS.find(s => s.id === sessionId) ?? MOCK_PUBLIC_SESSIONS[0]

  const [players, setPlayers] = useState<Player[]>([emptyPlayer()])
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash')
  const [agreed, setAgreed] = useState(false)
  const [skillAgreed, setSkillAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function addPlayer() {
    if (players.length >= 6) return
    setPlayers([...players, emptyPlayer()])
  }

  function removePlayer(i: number) {
    if (players.length <= 1) return
    setPlayers(players.filter((_, idx) => idx !== i))
  }

  function updatePlayer(i: number, field: keyof Player, value: string) {
    setPlayers(players.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  async function submit() {
    if (!agreed || !skillAgreed) return alert('請確認所有同意事項')
    if (players.some(p => !p.name || !p.phone)) return alert('請填寫所有報名者的姓名和電話')
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1200))
    window.location.href = `/book/confirmation?venue=${venue}&session=${sessionId}&count=${players.length}&method=${payMethod}&waitlist=${isWaitlist}`
  }

  const SESSION_TYPE_LABEL: Record<string, string> = {
    male_only: '男網純男', male_mixed: '男網混排', male_position: '男網專位',
    female_only: '女網純女', female_mixed: '女網混排', female_position: '女網專位',
    rental: '包場',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0' }}>
      <div style={{ background: '#1a1917', color: '#fff', padding: '16px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={`/book/${venue}`} style={{ color: '#888', textDecoration: 'none', fontSize: 20 }}>‹</a>
          <div>
            <div style={{ fontSize: 11, color: '#888' }}>{venueInfo?.name}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {isWaitlist ? '候補報名' : '立即報名'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>

        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid #e8e6e0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{session.startTime} – {session.endTime}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {SESSION_TYPE_LABEL[session.sessionType]}
                {session.minSkillRequired ? ` · ${session.minSkillRequired} 以上` : ' · 不限程度'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>${session.price}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>/ 人</div>
            </div>
          </div>
          {isWaitlist && (
            <div style={{ marginTop: 10, background: '#fef3c7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
              ⚡ 候補報名：有人取消時將依序通知您
            </div>
          )}
        </div>

        {players.map((player, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px', marginBottom: 10, border: '1px solid #e8e6e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {i === 0 ? '報名者（代表人）' : `第 ${i + 1} 位`}
              </div>
              {i > 0 && (
                <button onClick={() => removePlayer(i)} style={{ background: 'none', border: 'none', color: '#e85d3a', fontSize: 13, cursor: 'pointer' }}>移除</button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>姓名 *</div>
                <input value={player.name} onChange={e => updatePlayer(i, 'name', e.target.value)}
                  placeholder="請輸入真實姓名" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>電話 *</div>
                <input value={player.phone} onChange={e => updatePlayer(i, 'phone', e.target.value)}
                  placeholder="09xx-xxx-xxx" type="tel" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>外號（選填）</div>
              <input value={player.nickname} onChange={e => updatePlayer(i, 'nickname', e.target.value)}
                placeholder="球場上大家叫你什麼" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ background: '#f8f7f5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: '#555' }}>自評程度（四項技能）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <SkillSelect label="攻擊" value={player.attack}  onChange={v => updatePlayer(i, 'attack',  v)} />
                <SkillSelect label="防守" value={player.defense} onChange={v => updatePlayer(i, 'defense', v)} />
                <SkillSelect label="舉球" value={player.setting} onChange={v => updatePlayer(i, 'setting', v)} />
                <SkillSelect label="攔網" value={player.block}   onChange={v => updatePlayer(i, 'block',   v)} />
              </div>
              <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                {SKILL_DESC[player.attack]} ← 攻擊參考
              </div>
            </div>
          </div>
        ))}

        {players.length < 6 && (
          <button onClick={addPlayer} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: '2px dashed #e8e6e0',
            background: 'transparent', fontSize: 14, color: '#888', cursor: 'pointer', marginBottom: 14,
          }}>
            + 新增報名者（最多 6 人）
          </button>
        )}

        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', marginBottom: 14, border: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>付款方式</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'cash',     label: '現場付款', desc: '到場後付現金給工作人員', icon: '💵' },
              { key: 'transfer', label: '銀行轉帳', desc: `轉至 ${venueInfo?.transferInfo ?? '---'}`, icon: '🏦' },
            ].map(m => (
              <div key={m.key} onClick={() => setPayMethod(m.key as 'cash' | 'transfer')} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${payMethod === m.key ? '#1a1917' : '#e8e6e0'}`,
                background: payMethod === m.key ? '#1a1917' : '#fff',
                color: payMethod === m.key ? '#fff' : '#1a1917',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 11, opacity: .7, marginTop: 3, lineHeight: 1.4 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', marginBottom: 14, border: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>報名須知</div>
          {[
            {
              key: 'skill',
              state: skillAgreed,
              set: setSkillAgreed,
              text: `我確認以上所有報名者的程度自評屬實。館長保有現場評估並調整程度的權力，若程度明顯不符，館長有權拒絕入場。`,
            },
            {
              key: 'cancel',
              state: agreed,
              set: setAgreed,
              text: `我了解取消規則：開場前 12 小時以上可免費取消；開場前 12 小時內取消須自行找人替補並通知館方，否則將列入黑名單，影響未來報名資格。`,
            },
          ].map(item => (
            <div key={item.key} onClick={() => item.set(!item.state)} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, border: `2px solid ${item.state ? '#1a1917' : '#d1d5db'}`,
                background: item.state ? '#1a1917' : '#fff', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.state && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{item.text}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#f8f7f5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#888' }}>報名人數</span>
            <span style={{ fontWeight: 600 }}>{players.length} 人</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>預計費用</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>${session.price * players.length}</span>
          </div>
        </div>

        <button onClick={submit} disabled={submitting || !agreed || !skillAgreed} style={{
          width: '100%', padding: '16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          background: submitting || !agreed || !skillAgreed ? '#ccc' : '#1a1917',
          color: '#fff', transition: 'background .2s',
        }}>
          {submitting ? '送出中...' : isWaitlist ? '確認候補報名' : `確認報名（${players.length} 人）`}
        </button>
        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 10 }}>
          送出後請保存此頁面或截圖，作為報名憑證
        </div>
      </div>
    </div>
  )
}
