'use client'

// ============================================================
// app/book/cancel/page.tsx — 取消報名頁
// ============================================================
// 通用查詢頁（不知道用戶來自哪個館），所以不套 BookingShell。
// 用一個輕量的粉色卡片式 layout。
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
} from '@/components/booking/theme'

export default function CancelPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode]   = useState('')
  const [step, setStep]   = useState<'input' | 'confirm' | 'done'>('input')
  const [loading, setLoading] = useState(false)

  const MOCK_REG = {
    code: 'VB123456',
    venue: '飛翼排球館',
    sessionDate: '2026-04-18',
    startTime: '15:40',
    endTime: '18:40',
    amount: 280,
    hasAircon: true,
    acFee: 50,
    hoursUntilStart: 20,
  }

  async function search() {
    if (!phone || !code) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    setStep('confirm')
  }

  async function confirm() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setStep('done')
  }

  const isTooLate = MOCK_REG.hoursUntilStart < 12

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;700;900&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .booking-root {
          background: ${BOOKING_COLORS.bgPrimary};
          font-family: ${BOOKING_FONTS.body};
          color: ${BOOKING_COLORS.textPrimary};
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .booking-root *, .booking-root *::before, .booking-root *::after { box-sizing: border-box; }
        .booking-root input {
          width: 100%;
          padding: 12px 14px;
          border-radius: ${BOOKING_RADIUS.sm}px;
          border: 1px solid ${BOOKING_COLORS.border};
          background: ${BOOKING_COLORS.bgCard};
          font-size: 14px;
          color: ${BOOKING_COLORS.textPrimary};
          outline: none;
          font-family: ${BOOKING_FONTS.body};
          transition: border-color .15s, box-shadow .15s;
        }
        .booking-root input:focus {
          border-color: ${BOOKING_COLORS.pinkDeep};
          box-shadow: 0 0 0 3px ${BOOKING_COLORS.pinkSoft};
        }
        .booking-root input::placeholder { color: ${BOOKING_COLORS.textMuted}; }
        .booking-root button { font-family: inherit; cursor: pointer; }
      `}} />

      <div className="booking-root">
        <div style={{
          maxWidth: 460, margin: '0 auto',
          padding: '60px 20px 40px',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{
              fontSize: 11, letterSpacing: 3,
              color: BOOKING_COLORS.textMuted, marginBottom: 10,
              textTransform: 'uppercase',
            }}>
              Cancel Booking
            </div>
            <h1 style={{
              fontFamily: BOOKING_FONTS.display,
              fontSize: 30, fontWeight: 700, margin: 0,
              color: BOOKING_COLORS.textPrimary, letterSpacing: '-0.5px',
            }}>
              取消報名
            </h1>
          </div>

          {step === 'input' && (
            <div style={{
              background: BOOKING_COLORS.bgCard,
              borderRadius: BOOKING_RADIUS.card,
              padding: 28,
              border: `1px solid ${BOOKING_COLORS.borderLight}`,
              boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 8px 24px rgba(184, 100, 130, 0.05)',
            }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11.5, color: BOOKING_COLORS.textSecondary,
                  marginBottom: 6, letterSpacing: 0.5,
                }}>
                  報名電話
                </div>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="報名時填寫的電話" type="tel" />
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 11.5, color: BOOKING_COLORS.textSecondary,
                  marginBottom: 6, letterSpacing: 0.5,
                }}>
                  報名編號
                </div>
                <input value={code} onChange={e => setCode(e.target.value)}
                  placeholder="VBxxxxxx" />
              </div>
              <button onClick={search} disabled={loading || !phone || !code} style={{
                width: '100%', padding: '14px', borderRadius: BOOKING_RADIUS.md, border: 'none',
                background: loading || !phone || !code
                  ? BOOKING_COLORS.bgSecondary
                  : BOOKING_COLORS.pinkDeep,
                color: loading || !phone || !code ? BOOKING_COLORS.textMuted : '#fff',
                fontSize: 15, fontWeight: 700, letterSpacing: 1,
                boxShadow: (loading || !phone || !code) ? 'none' : '0 4px 14px rgba(201, 116, 147, 0.28)',
              }}>
                {loading ? '查詢中…' : '查詢報名'}
              </button>
              <div style={{
                marginTop: 16, fontSize: 11.5,
                color: BOOKING_COLORS.textMuted, textAlign: 'center', lineHeight: 1.8,
              }}>
                開場前 12 小時以上可免費取消<br />
                12 小時內須自行找人替補
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div style={{
                background: BOOKING_COLORS.bgCard,
                borderRadius: BOOKING_RADIUS.card,
                padding: '22px 24px',
                marginBottom: 12,
                border: `1px solid ${BOOKING_COLORS.borderLight}`,
              }}>
                <div style={{
                  fontSize: 11, color: BOOKING_COLORS.textMuted,
                  letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase',
                }}>
                  查詢到的報名紀錄
                </div>
                {[
                  { label: '球館',  value: MOCK_REG.venue },
                  { label: '日期',  value: MOCK_REG.sessionDate },
                  { label: '時段',  value: `${MOCK_REG.startTime}–${MOCK_REG.endTime}` },
                  { label: '應付',  value: `$${MOCK_REG.amount}${MOCK_REG.hasAircon ? ` + $${MOCK_REG.acFee} 冷氣` : ''}` },
                  { label: '距開場', value: `還有 ${MOCK_REG.hoursUntilStart} 小時` },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 0',
                    fontSize: 13.5,
                    borderBottom: i < arr.length - 1 ? `1px solid ${BOOKING_COLORS.borderLight}` : 'none',
                  }}>
                    <span style={{ color: BOOKING_COLORS.textMuted }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {isTooLate ? (
                <div style={{
                  background: BOOKING_COLORS.warnBg,
                  borderRadius: BOOKING_RADIUS.card,
                  padding: '18px 22px',
                  marginBottom: 12,
                  border: `1px solid #f5a8b5`,
                }}>
                  <div style={{
                    fontFamily: BOOKING_FONTS.display,
                    fontSize: 14, fontWeight: 700,
                    color: BOOKING_COLORS.warn, marginBottom: 8,
                  }}>
                    ⚠ 距開場不足 12 小時
                  </div>
                  <div style={{
                    fontSize: 12.5, color: BOOKING_COLORS.warn, lineHeight: 1.7,
                  }}>
                    此時段已無法免費取消。若您仍需取消，請自行找人替補後聯繫館方確認；
                    未找替補直接缺席將列入黑名單。
                  </div>
                </div>
              ) : (
                <div style={{
                  background: BOOKING_COLORS.okBg,
                  borderRadius: BOOKING_RADIUS.card,
                  padding: '14px 18px',
                  marginBottom: 12,
                  border: `1px solid #c5d8be`,
                }}>
                  <div style={{
                    fontSize: 13, color: BOOKING_COLORS.ok, lineHeight: 1.7,
                  }}>
                    ✓ 距開場超過 12 小時，可免費取消
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => setStep('input')} style={{
                  padding: '13px', borderRadius: BOOKING_RADIUS.md,
                  border: `1px solid ${BOOKING_COLORS.border}`,
                  background: BOOKING_COLORS.bgCard,
                  color: BOOKING_COLORS.textSecondary,
                  fontSize: 13.5, fontWeight: 600,
                }}>
                  返回
                </button>
                {!isTooLate && (
                  <button onClick={confirm} disabled={loading} style={{
                    padding: '13px', borderRadius: BOOKING_RADIUS.md, border: 'none',
                    background: BOOKING_COLORS.warn, color: '#fff',
                    fontSize: 13.5, fontWeight: 700, letterSpacing: 1,
                  }}>
                    {loading ? '取消中…' : '確認取消'}
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{
              background: BOOKING_COLORS.bgCard,
              borderRadius: BOOKING_RADIUS.card,
              padding: '40px 28px 32px',
              border: `1px solid ${BOOKING_COLORS.borderLight}`,
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 8px 24px rgba(184, 100, 130, 0.05)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: BOOKING_COLORS.okBg, color: BOOKING_COLORS.ok,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700,
              }}>
                ✓
              </div>
              <h2 style={{
                fontFamily: BOOKING_FONTS.display,
                fontSize: 22, fontWeight: 700, margin: '0 0 10px',
                color: BOOKING_COLORS.textPrimary, letterSpacing: '-0.5px',
              }}>
                已取消報名
              </h2>
              <p style={{
                fontSize: 13, color: BOOKING_COLORS.textSecondary,
                lineHeight: 1.8, margin: '0 0 22px',
              }}>
                您的報名已成功取消。<br />
                若有候補名單，系統將自動通知下一位。
              </p>
              <Link href="/" style={{
                display: 'inline-block', padding: '12px 28px',
                borderRadius: BOOKING_RADIUS.md,
                background: BOOKING_COLORS.pinkDeep, color: '#fff',
                textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
                letterSpacing: 1,
                boxShadow: '0 4px 14px rgba(201, 116, 147, 0.28)',
              }}>
                返回首頁
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
