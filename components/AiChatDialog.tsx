'use client'

// ============================================================
// components/AiChatDialog.tsx — AI 助理對話視窗
// ============================================================
// 從原 AiSection.tsx 拆出，使其可被 dashboard 的精簡卡片
// 與 /ai-summary 完整頁面共用。
// ============================================================

import { useState } from 'react'
import { COLORS } from './theme/tokens'

type Message = { role: 'user' | 'assistant', content: string }

interface Props {
  open: boolean
  onClose: () => void
  /** 顯示在歡迎詞下方的範例問題（可選） */
  sampleQuestions?: string[]
}

export default function AiChatDialog({ open, onClose, sampleQuestions }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const userMsg: Message = { role: 'user', content }
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
    background: role === 'user'
      ? `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`
      : COLORS.pink50,
    color: role === 'user' ? '#fff' : COLORS.ink900,
    boxShadow: role === 'user'
      ? '0 2px 8px -2px rgba(255,45,138,0.4)'
      : 'none',
    fontWeight: role === 'user' ? 600 : 500,
  })

  const defaultSamples = [
    '「哪間館今天最賺？」',
    '「建議調整哪個時段的價格？」',
    '「飛翼館贈送比例為什麼這麼高？」',
  ]
  const samples = sampleQuestions ?? defaultSamples

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(45,27,46,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: 20,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, height: 560,
          background: '#fff', borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.12)',
          overflow: 'hidden',
        }}>

        <div style={{
          padding: '14px 20px',
          background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>🤖 AI 營運助理</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: 600 }}>
              詢問任何營運問題
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              width: 28, height: 28, borderRadius: 8, fontWeight: 800,
            }}>×</button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
          background: COLORS.surfaceTint,
        }}>
          {messages.length === 0 && (
            <div style={{
              color: COLORS.ink500, fontSize: 13, textAlign: 'center',
              marginTop: 40, lineHeight: 2,
              fontWeight: 500,
            }}>
              <div style={{ marginBottom: 12, fontWeight: 700, color: COLORS.ink700 }}>
                你可以問我：
              </div>
              {samples.map((q, i) => (
                <div
                  key={i}
                  onClick={() => sendMessage(q.replace(/[「」]/g, ''))}
                  style={{
                    display: 'inline-block',
                    margin: '4px 6px',
                    padding: '7px 12px',
                    borderRadius: 99,
                    background: '#fff',
                    border: `1px solid ${COLORS.pink200}`,
                    cursor: 'pointer',
                    color: COLORS.pink700,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                  {q}
                </div>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={bubbleStyle(msg.role)}>{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                background: COLORS.pink50, fontSize: 13, color: COLORS.ink500,
                fontWeight: 500,
              }}>思考中...</div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${COLORS.pink100}`,
          display: 'flex', gap: 8, background: '#fff',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="輸入問題..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${COLORS.pink200}`,
              fontSize: 13, outline: 'none',
              fontWeight: 600,
              color: COLORS.ink900,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: loading
                ? COLORS.ink300
                : `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
              color: '#fff', fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              boxShadow: loading ? 'none' : '0 4px 12px -2px rgba(255,45,138,0.45)',
            }}>
            送出
          </button>
        </div>

      </div>
    </div>
  )
}
