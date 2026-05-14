'use client'

// ============================================================
// app/book/[venue]/[date]/[sessionId]/page.tsx — 場次詳情 + 報名
// ============================================================
// 階段 12 改寫（從原 [venue]/[sessionId]/page.tsx 重構）。
//
// 流程：
//   1. 顯示場次完整資訊（時間 / 型態 / 費用拆分 / 容量 / 程度範圍 / 備註）
//   2. 用戶按 CTA → 跳出 LineLoginModal 確認登入
//   3. 登入後展開報名 form（單人，line user → 報名人）
//   4. 選付款方式（現金 / LINE Pay / 銀行轉帳，皆為「現場」）
//   5. 同意條款 → 確認報名 → 跳轉 confirmation
// ============================================================

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import {
  getVenueBySlug, getPublicSession,
} from '@/data/api'
import BookingShell from '@/components/booking/BookingShell'
import LineLoginModal, {
  getLineUser, clearLineUser, type LineUser,
} from '@/components/booking/LineLoginModal'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
  SESSION_TYPE_LABEL, SESSION_TYPE_TAG_COLOR,
  SKILL_OPTIONS, SKILL_DESCRIPTIONS,
} from '@/components/booking/theme'

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return `${m}/${d}（${WEEK_LABELS[date.getDay()]}）`
}

type PayMethod = 'cash' | 'linepay' | 'transfer'

interface SkillSelfRate {
  attack: string
  defense: string
  setting: string
  block: string
}

export default function SessionDetailPage({ params, searchParams }: {
  params: Promise<{ venue: string; date: string; sessionId: string }>
  searchParams: Promise<{ waitlist?: string }>
}) {
  const { venue, date, sessionId } = use(params)
  const { waitlist } = use(searchParams)
  const isWaitlist = waitlist === 'true'

  const venueInfo = getVenueBySlug(venue)
  if (!venueInfo) notFound()
  const session = getPublicSession(sessionId)
  if (!session) notFound()
  if (session.sessionDate !== date) notFound()

  const router = useRouter()

  // LINE 登入狀態
  const [lineUser, setLineUserState] = useState<LineUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    setLineUserState(getLineUser())
  }, [])

  // 報名表單狀態（要登入後才看得到）
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [skills, setSkills] = useState<SkillSelfRate>({
    attack: 'C', defense: 'C', setting: 'C', block: 'C',
  })
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [agreedSkill, setAgreedSkill] = useState(false)
  const [agreedCancel, setAgreedCancel] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const typeStyle = SESSION_TYPE_TAG_COLOR[session.sessionType] ?? { bg: BOOKING_COLORS.bgSecondary, text: BOOKING_COLORS.textSecondary }
  const totalPrice = session.courtFee + (session.hasAircon ? session.acFee : 0)

  function startBooking() {
    if (!lineUser) {
      setLoginOpen(true)
      return
    }
    // 已登入 → form 已展開，這個 callback 不會被叫到
  }

  function handleLoginSuccess(user: LineUser) {
    setLineUserState(user)
    setLoginOpen(false)
  }

  function handleLogout() {
    clearLineUser()
    setLineUserState(null)
  }

  async function submit() {
    if (!agreedSkill || !agreedCancel) {
      alert('請確認所有同意事項')
      return
    }
    if (!phone) {
      alert('請填寫聯絡電話')
      return
    }
    setSubmitting(true)
    // 階段 12 mock — 真實實作會 call addRegistration mutation + audit log
    await new Promise(r => setTimeout(r, 900))
    const qs = new URLSearchParams({
      venue, date, session: sessionId,
      method: payMethod,
      waitlist: String(isWaitlist),
      name: lineUser?.displayName ?? '',
    })
    router.push(`/book/confirmation?${qs.toString()}`)
  }

  return (
    <BookingShell
      venueSlug={venue}
      venueInfo={venueInfo}
      breadcrumb={`${formatDate(date)} · ${session.startTime}`}
      backHref={`/book/${venue}/${date}`}
    >
      {/* 場次標題卡 */}
      <section style={{
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        padding: '24px 24px 20px',
        marginBottom: 18,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
      }}>
        <div style={{
          fontSize: 11, color: BOOKING_COLORS.textMuted,
          letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase',
        }}>
          {isWaitlist ? 'Waitlist Booking' : 'Session Booking'}
        </div>

        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14,
        }}>
          <h2 style={{
            fontFamily: BOOKING_FONTS.display,
            fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.1,
            color: BOOKING_COLORS.textPrimary, letterSpacing: '-0.5px',
          }}>
            {session.startTime}–{session.endTime}
          </h2>
          <span style={{
            fontSize: 13, color: BOOKING_COLORS.textSecondary,
          }}>
            {formatDate(date)}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <Tag bg={typeStyle.bg} color={typeStyle.text}>
            {SESSION_TYPE_LABEL[session.sessionType]}
          </Tag>
          {session.court && (
            <Tag bg={BOOKING_COLORS.bgSecondary} color={BOOKING_COLORS.textSecondary}>{session.court}</Tag>
          )}
          {session.hasAircon && (
            <Tag bg={BOOKING_COLORS.airconBg} color={BOOKING_COLORS.aircon}>❄︎ 本場開冷氣</Tag>
          )}
          {(session.minSkillRequired || session.maxSkillAllowed) && (
            <Tag bg={BOOKING_COLORS.pinkSoft} color={BOOKING_COLORS.pinkDarker}>
              程度 · {session.minSkillRequired ?? '不限'} ~ {session.maxSkillAllowed ?? '不限'}
            </Tag>
          )}
        </div>

        {/* 費用拆分 */}
        <div style={{
          background: BOOKING_COLORS.bgSecondary,
          borderRadius: BOOKING_RADIUS.md,
          padding: '14px 16px',
        }}>
          <PriceRow label="球費" value={session.courtFee} />
          {session.hasAircon && (
            <PriceRow label="冷氣費（每位）" value={session.acFee} color={BOOKING_COLORS.aircon} />
          )}
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: `1px dashed ${BOOKING_COLORS.pinkBorder}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 12.5, color: BOOKING_COLORS.textSecondary }}>合計 (每位)</span>
            <span style={{
              fontFamily: BOOKING_FONTS.num,
              fontSize: 22, fontWeight: 700, color: BOOKING_COLORS.pinkDarker,
            }}>
              ${totalPrice}
            </span>
          </div>
        </div>

        {/* 容量資訊 */}
        <div style={{
          marginTop: 14, fontSize: 12.5, color: BOOKING_COLORS.textSecondary,
        }}>
          目前 <strong style={{ color: BOOKING_COLORS.textPrimary, fontFamily: BOOKING_FONTS.num }}>
            {session.currentCount} / {session.maxCapacity}
          </strong> 位
          {session.status === 'open' && (
            <> · 還可報名 <strong style={{ color: BOOKING_COLORS.pinkDeep }}>{session.maxCapacity - session.currentCount}</strong> 位</>
          )}
          {session.status === 'full' && !isWaitlist && (
            <span style={{ color: BOOKING_COLORS.warn, fontWeight: 600 }}> · 已額滿</span>
          )}
        </div>

        {session.notes && (
          <p style={{
            margin: '14px 0 0',
            padding: '10px 14px', borderRadius: BOOKING_RADIUS.sm,
            background: BOOKING_COLORS.bgPrimary,
            fontSize: 12.5, color: BOOKING_COLORS.textSecondary, lineHeight: 1.7,
            borderLeft: `3px solid ${BOOKING_COLORS.pinkBorder}`,
          }}>
            {session.notes}
          </p>
        )}

        {isWaitlist && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: BOOKING_COLORS.warnBg,
            borderRadius: BOOKING_RADIUS.sm,
            fontSize: 12.5, color: BOOKING_COLORS.warn, lineHeight: 1.7,
          }}>
            ⚡ 候補報名：若有人取消，將依候補順序由 LINE 通知您
          </div>
        )}
      </section>

      {/* 登入區 / 報名 form */}
      {!lineUser ? (
        <LoginPromptCard onClick={startBooking} isWaitlist={isWaitlist} />
      ) : (
        <BookingForm
          lineUser={lineUser}
          nickname={nickname}
          setNickname={setNickname}
          phone={phone}
          setPhone={setPhone}
          skills={skills}
          setSkills={setSkills}
          payMethod={payMethod}
          setPayMethod={setPayMethod}
          agreedSkill={agreedSkill}
          setAgreedSkill={setAgreedSkill}
          agreedCancel={agreedCancel}
          setAgreedCancel={setAgreedCancel}
          submitting={submitting}
          submit={submit}
          isWaitlist={isWaitlist}
          totalPrice={totalPrice}
          transferInfo={venueInfo.transferInfo}
          onLogout={handleLogout}
        />
      )}

      <LineLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleLoginSuccess} />
    </BookingShell>
  )
}


// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Tag({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11.5, padding: '3px 11px', borderRadius: 999,
      background: bg, color, fontWeight: 600, letterSpacing: 0.5,
    }}>
      {children}
    </span>
  )
}

function PriceRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0',
      fontSize: 13, color: BOOKING_COLORS.textSecondary,
    }}>
      <span>{label}</span>
      <span style={{
        fontFamily: BOOKING_FONTS.num, fontWeight: 600,
        color: color ?? BOOKING_COLORS.textPrimary,
      }}>
        ${value}
      </span>
    </div>
  )
}

function LoginPromptCard({ onClick, isWaitlist }: { onClick: () => void; isWaitlist: boolean }) {
  return (
    <section style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      padding: '34px 28px 30px',
      textAlign: 'center',
      border: `1px solid ${BOOKING_COLORS.borderLight}`,
    }}>
      <div style={{
        fontFamily: BOOKING_FONTS.display, fontSize: 18, fontWeight: 700,
        color: BOOKING_COLORS.textPrimary, marginBottom: 10,
      }}>
        {isWaitlist ? '準備好候補了嗎？' : '準備好開打了嗎？'}
      </div>
      <p style={{
        fontSize: 13, color: BOOKING_COLORS.textSecondary,
        lineHeight: 1.8, margin: '0 0 22px',
      }}>
        請先以 LINE 登入，確認您的身份後即可開始報名
      </p>
      <button onClick={onClick} style={{
        padding: '14px 32px', borderRadius: BOOKING_RADIUS.md,
        background: BOOKING_COLORS.pinkDeep, color: '#fff',
        border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        letterSpacing: 1,
        boxShadow: '0 4px 14px rgba(201, 116, 147, 0.28)',
      }}>
        以 LINE 登入並報名
      </button>
    </section>
  )
}


function BookingForm(props: {
  lineUser: LineUser
  nickname: string; setNickname: (v: string) => void
  phone: string; setPhone: (v: string) => void
  skills: SkillSelfRate; setSkills: (v: SkillSelfRate) => void
  payMethod: PayMethod; setPayMethod: (v: PayMethod) => void
  agreedSkill: boolean; setAgreedSkill: (v: boolean) => void
  agreedCancel: boolean; setAgreedCancel: (v: boolean) => void
  submitting: boolean
  submit: () => void
  isWaitlist: boolean
  totalPrice: number
  transferInfo: string
  onLogout: () => void
}) {
  const {
    lineUser, nickname, setNickname, phone, setPhone, skills, setSkills,
    payMethod, setPayMethod, agreedSkill, setAgreedSkill, agreedCancel, setAgreedCancel,
    submitting, submit, isWaitlist, totalPrice, transferInfo, onLogout,
  } = props

  return (
    <>
      {/* LINE 身份卡 */}
      <section style={{
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        padding: '14px 18px',
        marginBottom: 14,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: BOOKING_COLORS.lineGreen,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 14,
        }}>
          {lineUser.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, marginBottom: 2 }}>已登入</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>
            {lineUser.displayName}
          </div>
        </div>
        <button onClick={onLogout} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: BOOKING_COLORS.textMuted, cursor: 'pointer', padding: '4px 8px',
        }}>
          切換帳號
        </button>
      </section>

      {/* 聯絡資料 */}
      <FormSection title="聯絡資料">
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="聯絡電話" required>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="09xx-xxx-xxx" />
          </Field>
          <Field label="球場暱稱（選填）">
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="例：阿凱、小明" />
          </Field>
        </div>
      </FormSection>

      {/* 自評程度 */}
      <FormSection title="自評程度（四項技能）"
        hint={<>程度自評僅供配場參考，現場館長有最終評估權。<br />等級對照：{SKILL_DESCRIPTIONS[skills.attack]}</>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SkillField label="攻擊" value={skills.attack} onChange={v => setSkills({ ...skills, attack: v })} />
          <SkillField label="防守" value={skills.defense} onChange={v => setSkills({ ...skills, defense: v })} />
          <SkillField label="舉球" value={skills.setting} onChange={v => setSkills({ ...skills, setting: v })} />
          <SkillField label="攔網" value={skills.block} onChange={v => setSkills({ ...skills, block: v })} />
        </div>
      </FormSection>

      {/* 付款方式 */}
      <FormSection title="付款方式"
        hint="本系統不收線上付款。您將於現場以選擇的方式完成付款。">
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { key: 'cash' as const, label: '現場付現', icon: '💵', desc: '到場後付現金給工作人員' },
            { key: 'linepay' as const, label: '現場 LINE Pay', icon: '💚', desc: '到場後掃 QR Code 用 LINE Pay 付款' },
            { key: 'transfer' as const, label: '現場轉帳', icon: '🏦', desc: `到場後出示轉帳紀錄：${transferInfo}` },
          ].map(m => {
            const active = payMethod === m.key
            return (
              <button key={m.key} type="button" onClick={() => setPayMethod(m.key)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: BOOKING_RADIUS.md,
                border: `2px solid ${active ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.borderLight}`,
                background: active ? BOOKING_COLORS.pinkSoft : BOOKING_COLORS.bgCard,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all .15s',
              }}>
                <div style={{ fontSize: 22 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: BOOKING_COLORS.textSecondary, marginTop: 2 }}>
                    {m.desc}
                  </div>
                </div>
                {active && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: BOOKING_COLORS.pinkDeep, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>✓</div>
                )}
              </button>
            )
          })}
        </div>
      </FormSection>

      {/* 同意條款 */}
      <FormSection title="報名須知">
        <Checkbox checked={agreedSkill} onChange={setAgreedSkill}>
          我確認以上程度自評屬實。館長保有現場評估並調整程度的權力，若程度明顯不符，館長有權拒絕入場。
        </Checkbox>
        <Checkbox checked={agreedCancel} onChange={setAgreedCancel}>
          我了解取消規則：開場前 12 小時以上可免費取消；開場前 12 小時內取消須自行找人替補並通知館方，否則將列入黑名單，影響未來報名資格。
        </Checkbox>
      </FormSection>

      {/* 總計 + CTA */}
      <section style={{
        background: BOOKING_COLORS.bgSecondary,
        borderRadius: BOOKING_RADIUS.md,
        padding: '14px 18px',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 13, color: BOOKING_COLORS.textSecondary,
        }}>
          <span>應付（現場結帳）</span>
          <span style={{
            fontFamily: BOOKING_FONTS.num,
            fontSize: 20, fontWeight: 700, color: BOOKING_COLORS.pinkDarker,
          }}>
            ${totalPrice}
          </span>
        </div>
      </section>

      <button
        onClick={submit}
        disabled={submitting || !agreedSkill || !agreedCancel}
        style={{
          width: '100%', padding: '16px', borderRadius: BOOKING_RADIUS.md,
          background: submitting || !agreedSkill || !agreedCancel
            ? BOOKING_COLORS.bgSecondary
            : BOOKING_COLORS.pinkDeep,
          color: submitting || !agreedSkill || !agreedCancel
            ? BOOKING_COLORS.textMuted
            : '#fff',
          border: 'none', fontSize: 16, fontWeight: 700,
          cursor: submitting || !agreedSkill || !agreedCancel ? 'not-allowed' : 'pointer',
          letterSpacing: 2,
          boxShadow: (submitting || !agreedSkill || !agreedCancel)
            ? 'none'
            : '0 4px 14px rgba(201, 116, 147, 0.32)',
          transition: 'all .15s',
        }}
      >
        {submitting ? '送出中…' : isWaitlist ? '確認候補' : '確認報名'}
      </button>

      <p style={{
        fontSize: 11, color: BOOKING_COLORS.textMuted,
        textAlign: 'center', marginTop: 12,
      }}>
        送出後請保存確認頁面或截圖，作為報名憑證
      </p>
    </>
  )
}


function FormSection({ title, hint, children }: {
  title: string; hint?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      padding: '20px 22px',
      marginBottom: 14,
      border: `1px solid ${BOOKING_COLORS.borderLight}`,
    }}>
      <h3 style={{
        fontFamily: BOOKING_FONTS.display, fontSize: 15, fontWeight: 700,
        margin: '0 0 14px', color: BOOKING_COLORS.textPrimary,
      }}>
        {title}
      </h3>
      {children}
      {hint && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: `1px dashed ${BOOKING_COLORS.borderLight}`,
          fontSize: 11, color: BOOKING_COLORS.textMuted, lineHeight: 1.7,
        }}>
          {hint}
        </div>
      )}
    </section>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontSize: 11.5, color: BOOKING_COLORS.textSecondary,
        marginBottom: 6, letterSpacing: 0.5,
      }}>
        {label}{required && <span style={{ color: BOOKING_COLORS.warn, marginLeft: 4 }}>*</span>}
      </div>
      <FieldInputWrapper>{children}</FieldInputWrapper>
    </label>
  )
}

function FieldInputWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      // 包一層方便日後加 icon 等
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .booking-root input, .booking-root select {
          width: 100%;
          padding: 11px 14px;
          border-radius: ${BOOKING_RADIUS.sm}px;
          border: 1px solid ${BOOKING_COLORS.border};
          background: ${BOOKING_COLORS.bgCard};
          font-size: 14px;
          color: ${BOOKING_COLORS.textPrimary};
          outline: none;
          transition: border-color .15s, box-shadow .15s;
          font-family: ${BOOKING_FONTS.body};
        }
        .booking-root input:focus, .booking-root select:focus {
          border-color: ${BOOKING_COLORS.pinkDeep};
          box-shadow: 0 0 0 3px ${BOOKING_COLORS.pinkSoft};
        }
        .booking-root input::placeholder {
          color: ${BOOKING_COLORS.textMuted};
        }
      `}} />
      {children}
    </div>
  )
}

function SkillField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontSize: 11, color: BOOKING_COLORS.textSecondary,
        marginBottom: 5, letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  )
}

function Checkbox({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      width: '100%', textAlign: 'left',
      background: 'none', border: 'none', padding: '8px 0',
      cursor: 'pointer',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
        border: `2px solid ${checked ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.border}`,
        background: checked ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.bgCard,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 12, fontWeight: 700,
        transition: 'all .15s',
      }}>
        {checked && '✓'}
      </span>
      <span style={{
        fontSize: 12.5, color: BOOKING_COLORS.textSecondary, lineHeight: 1.7,
      }}>
        {children}
      </span>
    </button>
  )
}
