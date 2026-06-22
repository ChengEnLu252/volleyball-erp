'use client'

// ============================================================
// components/LoginGate.tsx — Round 5：真登入閘門（Auth.js session）
// ============================================================
// 改動重點：
//   - 不再列出所有人員（隱私）→ 改成一般「帳號(登入代號)+密碼」登入框
//   - 登入狀態以 Auth.js session 為準（取代 store 假登入）
//   - 登入後把 session 使用者灌進 store 覆蓋層（syncSessionUser），
//     讓既有同步讀取一致反映真身分；同步好之前一律擋住（fail-closed）
//   - 提供「註冊」入口（/register）
// ============================================================

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { syncSessionUser } from '@/data/api'
import { hydrateStore, useStoreSync, getSessionUserOverride } from '@/data/store'
import { COLORS, FONTS } from './theme/tokens'
import QiuQiu from './QiuQiu'

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  useStoreSync()

  // 資料 store（GENERATED + localStorage diff）仍是頁面資料來源 → 開機 hydrate 一次
  useEffect(() => { hydrateStore() }, [])

  // session → store 覆蓋層
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      syncSessionUser({
        id: session.user.id,
        name: session.user.name ?? '',
        globalRole: session.user.globalRole,
        role: session.user.role,
        visibleVenueIds: session.user.visibleVenueIds,
      })
    } else if (status === 'unauthenticated') {
      syncSessionUser(null)
    }
  }, [status, session])

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unauthenticated') return <LoginCard />

  // authenticated：等覆蓋層灌好再放行（fail-closed，避免身分未就緒就 render）
  const override = getSessionUserOverride()
  if (!override || override.id !== session?.user?.id) return <LoadingScreen />

  return <>{children}</>
}


function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: COLORS.surfaceDeep, color: COLORS.ink500, fontSize: 14, fontFamily: FONTS.sans,
    }}>
      <span className="vop-mono" style={{ letterSpacing: '0.2em', color: COLORS.pink700 }}>
        LOADING<span style={{ opacity: 0.6 }}>...</span>
      </span>
    </div>
  )
}


// ============================================================
// LoginCard — 帳號 + 密碼 登入卡（無人員清單）
// ============================================================

function LoginCard() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    if (!username.trim()) { setError('請輸入帳號（登入代號）'); return }
    if (!password) { setError('請輸入密碼'); return }
    setBusy(true)
    setError('')
    const res = await signIn('credentials', { username: username.trim(), password, redirect: false })
    if (res?.error) {
      setError('登入失敗：帳號或密碼錯誤，或帳號尚未通過老闆審核')
      setPassword('')
      setBusy(false)
      return
    }
    // 成功 → 重新載入到總覽，確保 session 狀態乾淨
    window.location.assign('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backgroundImage:
        'linear-gradient(135deg, #ffe2ed 0%, #ffd1de 50%, #fdeef5 100%),' +
        'linear-gradient(rgba(255,45,138,0.03) 1px, transparent 1px),' +
        'radial-gradient(rgba(255,45,138,0.15) 0.8px, transparent 0.8px)',
      backgroundSize: '100% 100%, 100% 4px, 16px 16px',
      backgroundBlendMode: 'normal, multiply, multiply',
      fontFamily: FONTS.sans, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-40px', right: '-40px', opacity: 0.08, pointerEvents: 'none', transform: 'rotate(15deg)' }}>
        <QiuQiu variant="full" size={280} />
      </div>
      <div style={{ position: 'absolute', bottom: '-60px', left: '-30px', opacity: 0.07, pointerEvents: 'none', transform: 'rotate(-20deg)' }}>
        <QiuQiu variant="full" size={220} />
      </div>

      <div style={{
        width: '100%', maxWidth: 400, background: '#fff', borderRadius: 18, padding: '34px 30px 28px',
        boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.1)',
        position: 'relative', zIndex: 1,
      }}>
        <span style={{ position:'absolute', top:10, left:10, width:11, height:11, borderTop:`1.8px solid ${COLORS.pink500}`, borderLeft:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', top:10, right:10, width:11, height:11, borderTop:`1.8px solid ${COLORS.pink500}`, borderRight:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', bottom:10, left:10, width:11, height:11, borderBottom:`1.8px solid ${COLORS.pink500}`, borderLeft:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', bottom:10, right:10, width:11, height:11, borderBottom:`1.8px solid ${COLORS.pink500}`, borderRight:`1.8px solid ${COLORS.pink500}` }} />

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <QiuQiu variant="full" size={86} bob />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: COLORS.ink900, letterSpacing: '-0.01em', marginTop: 4 }}>
            多爾森健康有限公司
          </div>
          <div className="vop-mono" style={{ fontSize: 11, color: COLORS.pink700, letterSpacing: '0.18em', marginTop: 4, fontWeight: 700 }}>
            [ ERP 系統 ]
          </div>
        </div>

        {/* —— 帳號 —— */}
        <div className="vop-mono" style={{ fontSize: 10, color: COLORS.pink700, marginBottom: 6, fontWeight: 800, letterSpacing: '0.14em' }}>
          [ 帳號 ]
        </div>
        <input
          type="text"
          value={username}
          onChange={e => { setUsername(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          placeholder="登入代號"
          autoFocus
          autoComplete="username"
          style={inputStyle(false)}
        />

        {/* —— 密碼 —— */}
        <div className="vop-mono" style={{ fontSize: 10, color: COLORS.pink700, marginBottom: 6, marginTop: 14, fontWeight: 800, letterSpacing: '0.14em' }}>
          [ 密碼 ]
        </div>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          placeholder="輸入密碼"
          autoComplete="current-password"
          style={inputStyle(!!error)}
        />

        {error && (
          <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 8, fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={busy}
          style={{
            width: '100%', marginTop: 18, padding: '13px 16px',
            background: busy ? COLORS.ink200 : `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800,
            cursor: busy ? 'default' : 'pointer', letterSpacing: '0.06em',
            boxShadow: '0 6px 18px -3px rgba(255,45,138,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
          {busy ? '登入中…' : '登入 →'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: COLORS.ink500 }}>
          還沒有帳號？
          <Link href="/register" style={{ color: COLORS.pink600, fontWeight: 700, marginLeft: 4 }}>
            申請註冊
          </Link>
        </div>
      </div>
    </div>
  )
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 10,
    border: hasError ? `1.5px solid ${COLORS.danger}` : `1.5px solid ${COLORS.pink100}`,
    fontSize: 16, outline: 'none', fontFamily: FONTS.sans, color: COLORS.ink900, background: COLORS.pink50,
  }
}
