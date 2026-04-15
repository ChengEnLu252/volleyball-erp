'use client'

import { useState } from 'react'

const AI_SUMMARY = [
  { icon: '📈', color: '#059669', bg: '#dcfce7', text: '飛翼館本週滿場率達 91%，建議將週五晚場價格從 $280 調升至 $300，預估可增加週收入約 $1,440。' },
  { icon: '⚠️', color: '#d97706', bg: '#fef3c7', text: '飛翼館今日商品贈送比例 42%，遠超標準值 20%，建議館主確認是否有異常贈送行為。' },
  { icon: '💡', color: '#2563eb', bg: '#dbeafe', text: 'Ace 館週間離峰時段報名率偏低，建議新增 $200 的 B- 入門場，吸引新客並提升平日收入。' },
  { icon: '🏐', color: '#7c3aed', bg: '#ede9fe', text: '週末下午 14:00 中階場回流率最高，建議每週固定開設至少 2 場。' },
]

type Message = { role: 'user' | 'assistant', content: string }

export default function AiSection() {
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.text }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '目前無法連線，請稍後再試。' }])
    } finally {
      setLoading(false)
    }
  }

  const bubbleStyle = (role: string): React.CSSProperties => ({
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    fontSize: 13,
    lineHeight: 1.6,
    background: role === 'user' ? '#1a1917' : '#f5f4f0',
    color: role === 'user' ? '#fff' : '#1a1917',
  })

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e6e0', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>🤖 AI 營運摘要</div>
          <button onClick={() => setChatOpen(true)} style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 8, border: 'none',
            background: '#1a1917', color: '#fff', cursor: 'pointer', fontWeight: 500,
          }}>
            問 AI 助理
          </button>
        </div>
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          {AI_SUMMARY.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: item.bg }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>

      {chatOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 440, height: 560, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ padding: '16px 20px', background: '#1a1917', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>🤖 AI 營運助理</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>詢問任何營運問題</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  你可以問我：<br /><br />
                  「哪間館今天最賺？」<br />
                  「建議調整哪個時段的價格？」<br />
                  「飛翼館贈送比例為什麼這麼高？」
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={bubbleStyle(msg.role)}>{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f5f4f0', fontSize: 13, color: '#888' }}>思考中...</div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0ede6', display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="輸入問題..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #e8e6e0', fontSize: 13, outline: 'none' }}
              />
              <button onClick={sendMessage} disabled={loading} style={{
                padding: '10px 16px', borderRadius: 10, border: 'none',
                background: loading ? '#ccc' : '#1a1917', color: '#fff',
                fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500,
              }}>
                送出
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
