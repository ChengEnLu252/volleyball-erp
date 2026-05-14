'use client'

// ============================================================
// app/book/confirmation/page.tsx — 報名成功頁
// ============================================================
// 階段 12 改寫為粉色風 + 三選付款 + 單人報名。
// QS: venue, date, session, method, waitlist, name
// ============================================================

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { getVenueBySlug, getPublicSession } from '@/data/api'
import BookingShell, { LineIcon } from '@/components/booking/BookingShell'
import {
  BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS,
} from '@/components/booking/theme'

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return `${m}/${d}（${WEEK_LABELS[date.getDay()]}）`
}

function methodLabel(m: string): { label: string; icon: string; hint: string } {
  if (m === 'cash')     return { label: '現場付現',     icon: '💵', hint: '到場後付現金給工作人員' }
  if (m === 'linepay')  return { label: '現場 LINE Pay', icon: '💚', hint: '到場後掃 QR Code 用 LINE Pay 付款' }
  if (m === 'transfer') return { label: '現場轉帳',     icon: '🏦', hint: '到場後出示轉帳紀錄給工作人員' }
  return { label: m, icon: '·', hint: '' }
}

function ConfirmationContent() {
  const params   = useSearchParams()
  const venue    = params.get('venue')    ?? 'flywing'
  const date     = params.get('date')     ?? ''
  const sessionId = params.get('session') ?? ''
  const method   = params.get('method')   ?? 'cash'
  const waitlist = params.get('waitlist') === 'true'
  const name     = params.get('name')     ?? ''

  const venueInfo = getVenueBySlug(venue)
  const session   = sessionId ? getPublicSession(sessionId) : null
  const code      = `VB${Date.now().toString().slice(-6)}`
  const pay       = methodLabel(method)

  // venueInfo 不存在時 fallback：純白訊息
  if (!venueInfo) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BOOKING_COLORS.textSecondary }}>
        場館資料不存在
      </div>
    )
  }

  const totalPrice = session ? session.courtFee + (session.hasAircon ? session.acFee : 0) : null

  return (
    <BookingShell
      venueSlug={venue}
      venueInfo={venueInfo}
      breadcrumb={waitlist ? '候補確認' : '報名成功'}
      backHref={`/book/${venue}`}
    >
      {/* 成功圖示 */}
      <section style={{ textAlign: 'center', marginTop: 24, marginBottom: 26 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: waitlist ? BOOKING_COLORS.warnBg : BOOKING_COLORS.okBg,
          color: waitlist ? BOOKING_COLORS.warn : BOOKING_COLORS.ok,
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 700,
        }}>
          {waitlist ? '⏳' : '✓'}
        </div>
        <h1 style={{
          fontFamily: BOOKING_FONTS.display,
          fontSize: 26, fontWeight: 700, margin: '0 0 8px',
          color: BOOKING_COLORS.textPrimary, letterSpacing: '-0.5px',
        }}>
          {waitlist ? '候補登記完成' : '報名成功'}
        </h1>
        <p style={{
          fontSize: 13, color: BOOKING_COLORS.textSecondary,
          lineHeight: 1.7, margin: 0,
        }}>
          {waitlist
            ? '若有空位，我們會透過 LINE 通知您'
            : '請截圖保存此頁面，作為到場時的報名憑證'}
        </p>
      </section>

      {/* 報名編號卡 */}
      <section style={{
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        padding: '24px 24px 18px',
        marginBottom: 14,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10.5, letterSpacing: 2,
          color: BOOKING_COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase',
        }}>
          Booking Reference
        </div>
        <div style={{
          fontFamily: BOOKING_FONTS.num,
          fontSize: 28, fontWeight: 700, letterSpacing: 4,
          color: BOOKING_COLORS.pinkDarker,
        }}>
          {code}
        </div>
      </section>

      {/* 場次資訊 */}
      {session && (
        <section style={{
          background: BOOKING_COLORS.bgCard,
          borderRadius: BOOKING_RADIUS.card,
          padding: '18px 22px',
          marginBottom: 14,
          border: `1px solid ${BOOKING_COLORS.borderLight}`,
        }}>
          {[
            { label: '球館',     value: venueInfo.name },
            { label: '報名人',   value: name || '—' },
            { label: '日期',     value: date ? formatDate(date) : '—' },
            { label: '時段',     value: `${session.startTime}–${session.endTime}` },
            ...(session.court ? [{ label: '場地', value: session.court }] : []),
            { label: '冷氣',     value: session.hasAircon ? '本場開冷氣' : '不開冷氣' },
            { label: '應付金額', value: totalPrice !== null ? `$${totalPrice}` : '—' },
            { label: '狀態',     value: waitlist ? '候補中' : '已確認' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 0',
              fontSize: 13.5,
              borderBottom: i < arr.length - 1 ? `1px solid ${BOOKING_COLORS.borderLight}` : 'none',
            }}>
              <span style={{ color: BOOKING_COLORS.textMuted }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>
                {row.value}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* 付款方式提示 */}
      <section style={{
        background: BOOKING_COLORS.pinkSoft,
        borderRadius: BOOKING_RADIUS.card,
        padding: '18px 22px',
        marginBottom: 14,
        border: `1px solid ${BOOKING_COLORS.pinkBorder}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
        }}>
          <div style={{ fontSize: 26 }}>{pay.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: BOOKING_COLORS.pinkDarker, marginBottom: 2, letterSpacing: 0.5 }}>付款方式</div>
            <div style={{
              fontFamily: BOOKING_FONTS.display, fontSize: 15, fontWeight: 700,
              color: BOOKING_COLORS.textPrimary,
            }}>
              {pay.label}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 12.5, color: BOOKING_COLORS.textSecondary,
          lineHeight: 1.7,
        }}>
          {pay.hint}
        </div>
        {method === 'transfer' && (
          <div style={{
            marginTop: 10, padding: '10px 12px',
            background: BOOKING_COLORS.bgCard, borderRadius: BOOKING_RADIUS.sm,
            fontSize: 12, color: BOOKING_COLORS.textPrimary, lineHeight: 1.7,
          }}>
            <strong style={{ color: BOOKING_COLORS.pinkDarker }}>轉帳資訊</strong><br />
            {venueInfo.transferInfo}<br />
            轉帳備註：{code}
          </div>
        )}
      </section>

      {/* 取消規則提醒 */}
      <section style={{
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        padding: '18px 22px',
        marginBottom: 18,
        border: `1px solid ${BOOKING_COLORS.borderLight}`,
      }}>
        <h3 style={{
          fontFamily: BOOKING_FONTS.display, fontSize: 14, fontWeight: 700,
          margin: '0 0 10px', color: BOOKING_COLORS.textPrimary,
        }}>
          取消規則提醒
        </h3>
        <ul style={{
          margin: 0, paddingLeft: 18,
          fontSize: 12.5, color: BOOKING_COLORS.textSecondary, lineHeight: 1.9,
        }}>
          <li>開場前 12 小時以上：可免費取消</li>
          <li>開場前 12 小時內：需自行找替補並通知館方</li>
          <li>未找替補直接缺席：列入黑名單，影響未來報名資格</li>
        </ul>
      </section>

      {/* LINE 加好友提示 */}
      <section style={{
        marginBottom: 18,
        padding: '16px 18px',
        background: BOOKING_COLORS.bgCard,
        borderRadius: BOOKING_RADIUS.card,
        border: `1px dashed ${BOOKING_COLORS.pinkBorder}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: BOOKING_FONTS.display, fontSize: 13.5, fontWeight: 700,
            color: BOOKING_COLORS.textPrimary, marginBottom: 4,
          }}>
            加入官方 LINE 接收通知
          </div>
          <div style={{ fontSize: 11.5, color: BOOKING_COLORS.textMuted, lineHeight: 1.6 }}>
            場次變動或候補通知都會由此發送
          </div>
        </div>
        <a href={venueInfo.lineOfficialUrl} target="_blank" rel="noopener noreferrer" style={{
          background: BOOKING_COLORS.lineGreen, color: '#fff',
          padding: '8px 14px', borderRadius: BOOKING_RADIUS.pill,
          fontSize: 12, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          textDecoration: 'none',
        }}>
          <LineIcon size={16} />
          加入
        </a>
      </section>

      {/* 動作按鈕 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Link href="/book/cancel" style={{
          padding: '13px', borderRadius: BOOKING_RADIUS.md,
          border: `1px solid ${BOOKING_COLORS.border}`,
          background: BOOKING_COLORS.bgCard,
          color: BOOKING_COLORS.textSecondary,
          textAlign: 'center', textDecoration: 'none',
          fontSize: 13.5, fontWeight: 600,
        }}>
          取消報名
        </Link>
        <Link href={`/book/${venue}`} style={{
          padding: '13px', borderRadius: BOOKING_RADIUS.md,
          background: BOOKING_COLORS.pinkDeep,
          color: '#fff',
          textAlign: 'center', textDecoration: 'none',
          fontSize: 13.5, fontWeight: 700,
          letterSpacing: 1,
          boxShadow: '0 4px 14px rgba(201, 116, 147, 0.28)',
        }}>
          回到首頁
        </Link>
      </div>
    </BookingShell>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div style={{
        padding: 60, textAlign: 'center',
        color: BOOKING_COLORS.textSecondary,
        fontFamily: BOOKING_FONTS.body,
      }}>
        載入中…
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
