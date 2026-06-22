'use client'

// 註冊表單（client）：姓名 / 登入代號 / 密碼 / 職位 / 球館 → registerUser action。
// 成功後顯示「等待老闆審核」。

import { useState } from 'react'
import Link from 'next/link'
import { registerUser } from '@/app/actions/auth'
import { COLORS, FONTS } from '@/components/theme/tokens'
import QiuQiu from '@/components/QiuQiu'

type Venue = { id: string; name: string }

export default function RegisterForm({ venues }: { venues: Venue[] }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [position, setPosition] = useState<'manager' | 'staff'>('staff')
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async () => {
    setError('')
    if (password !== confirm) { setError('兩次密碼不一致'); return }
    if (!venueId) { setError('請選擇球館'); return }
    setBusy(true)
    const res = await registerUser({ name, username, password, position, venueId })
    if (!res.ok) { setError(res.error); setBusy(false); return }
    setDone(true)
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <QiuQiu variant="full" size={72} bob />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink900, marginTop: 4 }}>
            {done ? '註冊已送出' : '申請註冊'}
          </div>
          <div className="vop-mono" style={{ fontSize: 10, color: COLORS.pink700, letterSpacing: '0.16em', marginTop: 4, fontWeight: 700 }}>
            [ 多爾森健康有限公司 · ERP 系統 ]
          </div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: COLORS.pink50, border: `1px solid ${COLORS.pink100}`, borderRadius: 12,
              padding: '20px 18px', color: COLORS.ink700, fontSize: 14, lineHeight: 1.7,
            }}>
              ✅ 已送出申請，請<strong style={{ color: COLORS.pink600 }}>等待老闆審核通過</strong>後再登入。<br />
              你的登入代號：<strong>{username}</strong>
            </div>
            <Link href="/dashboard" style={{ ...primaryBtn, display: 'block', marginTop: 18, textDecoration: 'none', textAlign: 'center' }}>
              回登入頁
            </Link>
          </div>
        ) : (
          <>
            <Field label="姓名">
              <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="你的姓名" autoComplete="name" />
            </Field>
            <Field label="登入代號（帳號）">
              <input style={input} value={username} onChange={e => setUsername(e.target.value)} placeholder="英數，3–50 字" autoComplete="username" />
            </Field>
            <Field label="密碼">
              <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 4 碼" autoComplete="new-password" />
            </Field>
            <Field label="確認密碼">
              <input style={input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="再輸入一次" autoComplete="new-password" />
            </Field>
            <Field label="職位">
              <div style={{ display: 'flex', gap: 8 }}>
                {([['manager', '館長'], ['staff', '工讀生']] as const).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setPosition(val)} style={{
                    flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: position === val ? `2px solid ${COLORS.pink500}` : `1.5px solid ${COLORS.pink100}`,
                    background: position === val ? COLORS.pink50 : '#fff',
                    color: position === val ? COLORS.pink600 : COLORS.ink700,
                  }}>{lbl}</button>
                ))}
              </div>
            </Field>
            <Field label="所屬球館">
              <select style={input} value={venueId} onChange={e => setVenueId(e.target.value)}>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>

            {error && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4, fontWeight: 600 }}>⚠ {error}</div>}

            <button onClick={onSubmit} disabled={busy} style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '送出中…' : '送出申請'}
            </button>
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: COLORS.ink500 }}>
              已經有帳號？
              <Link href="/dashboard" style={{ color: COLORS.pink600, fontWeight: 700, marginLeft: 4 }}>回登入</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="vop-mono" style={{ fontSize: 10, color: COLORS.pink700, marginBottom: 5, fontWeight: 800, letterSpacing: '0.12em' }}>
        [ {label} ]
      </div>
      {children}
    </div>
  )
}

const shell: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  background: 'linear-gradient(135deg, #ffe2ed 0%, #ffd1de 50%, #fdeef5 100%)',
  fontFamily: FONTS.sans,
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, padding: '30px 28px 26px',
  boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.1)',
}
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10,
  border: `1.5px solid ${COLORS.pink100}`, fontSize: 15, outline: 'none',
  fontFamily: FONTS.sans, color: COLORS.ink900, background: COLORS.pink50,
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 16px',
  background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
  color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800,
  cursor: 'pointer', letterSpacing: '0.06em',
  boxShadow: '0 6px 18px -3px rgba(255,45,138,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
}
