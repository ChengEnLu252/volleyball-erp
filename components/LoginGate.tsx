'use client'

// ============================================================
// components/LoginGate.tsx — 階段 14：登入閘門 + 視覺改版
// ============================================================
// 業務邏輯 100% 保留（hydrate、isAuthenticated 檢查、selectedId、
// password 輸入、apiLogin、SSR-safe mount fallback）。僅前端視覺重寫。
// ============================================================

import { useEffect, useState } from 'react'
import { listAllUsers, login as apiLogin, isAuthenticated, getUserRoleLabel, getEffectiveRole } from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import { COLORS, FONTS } from './theme/tokens'
import QiuQiu from './QiuQiu'

function roleColor(userId: string): string {
  const role = getEffectiveRole(userId)
  if (role === 'owner')   return COLORS.roleOwner
  if (role === 'manager') return COLORS.roleManager
  if (role === 'staff')   return COLORS.roleStaff
  return COLORS.ink500
}

export default function LoginGate({ children }: { children: React.ReactNode }) {
  useStoreSync()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateStore()
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: COLORS.surfaceDeep, color: COLORS.ink500, fontSize: 14,
        fontFamily: FONTS.sans,
      }}>
        <span className="vop-mono" style={{ letterSpacing: '0.2em', color: COLORS.pink700 }}>
          LOADING<span style={{ opacity: 0.6 }}>...</span>
        </span>
      </div>
    )
  }

  if (!isAuthenticated()) {
    return <LoginCard />
  }

  return <>{children}</>
}


// ============================================================
// LoginCard — 粉紅運動科技風登入卡
// ============================================================

function LoginCard() {
  const users = listAllUsers()
  const [selectedId, setSelectedId] = useState<string>(users[0]?.id ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = () => {
    if (!selectedId) {
      setError('請選擇身份')
      return
    }
    if (!password) {
      setError('請輸入密碼')
      return
    }
    const ok = apiLogin(selectedId, password)
    if (!ok) {
      setError('密碼錯誤')
      setPassword('')
      return
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: `linear-gradient(135deg, ${COLORS.pink100} 0%, #ffd1de 50%, ${COLORS.surfaceDeep} 100%)`,
      backgroundImage:
        'linear-gradient(135deg, #ffe2ed 0%, #ffd1de 50%, #fdeef5 100%),' +
        'linear-gradient(rgba(255,45,138,0.03) 1px, transparent 1px),' +
        'radial-gradient(rgba(255,45,138,0.15) 0.8px, transparent 0.8px)',
      backgroundSize: '100% 100%, 100% 4px, 16px 16px',
      backgroundBlendMode: 'normal, multiply, multiply',
      fontFamily: FONTS.sans,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* —— 背景裝飾：大顆 watermark 球球 —— */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        opacity: 0.08, pointerEvents: 'none', transform: 'rotate(15deg)',
      }}>
        <QiuQiu variant="full" size={280} />
      </div>
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-30px',
        opacity: 0.07, pointerEvents: 'none', transform: 'rotate(-20deg)',
      }}>
        <QiuQiu variant="full" size={220} />
      </div>

      <div style={{
        width: '100%', maxWidth: 400,
        background: '#fff', borderRadius: 18,
        padding: '34px 30px 28px',
        boxShadow: '0 24px 60px -12px rgba(255,45,138,0.3), 0 0 0 1px rgba(255,45,138,0.1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* HUD 角落 */}
        <span style={{ position:'absolute', top:10, left:10, width:11, height:11, borderTop:`1.8px solid ${COLORS.pink500}`, borderLeft:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', top:10, right:10, width:11, height:11, borderTop:`1.8px solid ${COLORS.pink500}`, borderRight:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', bottom:10, left:10, width:11, height:11, borderBottom:`1.8px solid ${COLORS.pink500}`, borderLeft:`1.8px solid ${COLORS.pink500}` }} />
        <span style={{ position:'absolute', bottom:10, right:10, width:11, height:11, borderBottom:`1.8px solid ${COLORS.pink500}`, borderRight:`1.8px solid ${COLORS.pink500}` }} />

        {/* —— Logo + 球球 —— */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <QiuQiu variant="full" size={86} bob />
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, color: COLORS.ink900,
            letterSpacing: '-0.02em', marginTop: 4,
          }}>
            VolleyOps
          </div>
          <div className="vop-mono" style={{
            fontSize: 10, color: COLORS.pink700,
            letterSpacing: '0.18em', marginTop: 4, fontWeight: 700,
          }}>
            [ 排球場館管理系統 · v2.4.1 ]
          </div>
        </div>

        {/* —— 選擇身份 —— */}
        <div className="vop-mono" style={{
          fontSize: 10, color: COLORS.pink700,
          marginBottom: 8, fontWeight: 800, letterSpacing: '0.14em',
        }}>
          [ SELECT IDENTITY ]
        </div>

        <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
          {users.map(u => {
            const active = selectedId === u.id
            const label = getUserRoleLabel(u.id)
            const color = roleColor(u.id)
            return (
              <button
                key={u.id}
                onClick={() => { setSelectedId(u.id); setError('') }}
                style={{
                  textAlign: 'left',
                  padding: '11px 13px',
                  border: active ? `2px solid ${COLORS.pink500}` : `1.5px solid ${COLORS.pink100}`,
                  borderRadius: 10,
                  background: active ? COLORS.pink50 : '#fff',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: active ? '0 4px 14px -4px rgba(255,45,138,0.35)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 2, background: color,
                    boxShadow: active ? `0 0 8px ${color}` : 'none',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink900 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>{label}</div>
                  </div>
                </div>
                {active && (
                  <span style={{
                    color: COLORS.pink500, fontSize: 16, fontWeight: 700,
                  }}>✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* —— 密碼 —— */}
        <div className="vop-mono" style={{
          fontSize: 10, color: COLORS.pink700,
          marginBottom: 6, fontWeight: 800, letterSpacing: '0.14em',
        }}>
          [ PASSWORD ]
        </div>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
          placeholder="輸入 4 位數密碼"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '13px 14px', borderRadius: 10,
            border: error ? `1.5px solid ${COLORS.danger}` : `1.5px solid ${COLORS.pink100}`,
            fontSize: 16, outline: 'none',
            marginBottom: error ? 6 : 14,
            fontFamily: FONTS.mono,
            letterSpacing: '0.25em',
            color: COLORS.ink900,
            background: COLORS.pink50,
          }}
        />

        {error && (
          <div style={{
            fontSize: 12, color: COLORS.danger,
            marginBottom: 14, fontWeight: 600,
          }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          style={{
            width: '100%',
            padding: '13px 16px',
            background: `linear-gradient(95deg, ${COLORS.pink500} 0%, ${COLORS.pink400} 100%)`,
            color: '#fff',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.06em',
            boxShadow: '0 6px 18px -3px rgba(255,45,138,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
          登入 →
        </button>

        <div className="vop-mono" style={{
          marginTop: 16, padding: '9px 12px',
          background: COLORS.pink50,
          borderRadius: 9,
          border: `1px solid ${COLORS.pink100}`,
          fontSize: 10.5, color: COLORS.ink500,
          textAlign: 'center', letterSpacing: '0.06em',
        }}>
          💡 DEMO · 所有角色預設密碼皆為 <strong style={{ color: COLORS.pink500 }}>0000</strong>
        </div>
      </div>
    </div>
  )
}
