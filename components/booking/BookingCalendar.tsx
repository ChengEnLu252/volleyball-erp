'use client'

// ============================================================
// components/booking/BookingCalendar.tsx
// ============================================================
// 客戶端報名頁首頁的「漂亮月曆」。
//
// 功能：
//   - 顯示當月 + 可前後翻月（限制最遠不超過今日 +60 天）
//   - 有場次的日期：粉色底 + 小數字標示「剩 N 位 / 開 N 場」
//   - 沒場次的日期：disabled，只顯示日期
//   - 今日：粉邊框 + 標示「今日」
//   - 點擊日期 → navigate 到 /book/[venue]/[date]
//
// 設計：日式柔感，月份大字 (serif)，週名小字 (sans-serif)，
//      日期格圓角 + hover 粉影。
// ============================================================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'

interface DateInfo {
  date: string
  sessionCount: number
  openSessionCount: number
  remainingSeats: number
}

interface Props {
  venueSlug: string
  /** 從 listBookingDatesWithSessions() 拿到 */
  availableDates: DateInfo[]
  /** 最遠可預訂日期（含），預設今日 +60 天 */
  maxDate?: string
}

// 日期 helper（純 UTC YYYY-MM-DD，避免時區飄）
function pad(n: number) { return n.toString().padStart(2, '0') }
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function ymd(y: number, m: number, d: number): string { return `${y}-${pad(m)}-${pad(d)}` }
function daysInMonth(y: number, m: number): number { return new Date(y, m, 0).getDate() }
/** 該月 1 號是週幾（0 = Sun, 6 = Sat） */
function firstDayOfWeek(y: number, m: number): number { return new Date(y, m - 1, 1).getDay() }

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_LABELS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


export default function BookingCalendar({ venueSlug, availableDates, maxDate }: Props) {
  const todayStr = today()
  const [y, mNum] = todayStr.split('-').map(Number)
  const [viewYear, setViewYear] = useState(y!)
  const [viewMonth, setViewMonth] = useState(mNum!)

  const datesMap = useMemo(() => {
    const map = new Map<string, DateInfo>()
    for (const d of availableDates) map.set(d.date, d)
    return map
  }, [availableDates])

  // 計算這個月有沒有「上一頁 / 下一頁」可走
  const canGoBack = useMemo(() => {
    // 不允許看比今日早的月份
    if (viewYear > y!) return true
    if (viewYear === y! && viewMonth > mNum!) return true
    return false
  }, [viewYear, viewMonth, y, mNum])

  const maxYM = useMemo(() => {
    const m = maxDate ?? availableDates[availableDates.length - 1]?.date ?? todayStr
    const [yy, mm] = m.split('-').map(Number)
    return { year: yy!, month: mm! }
  }, [maxDate, availableDates, todayStr])

  const canGoForward = useMemo(() => {
    if (viewYear < maxYM.year) return true
    if (viewYear === maxYM.year && viewMonth < maxYM.month) return true
    return false
  }, [viewYear, viewMonth, maxYM])

  function prevMonth() {
    if (!canGoBack) return
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (!canGoForward) return
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1) }
    else setViewMonth(viewMonth + 1)
  }

  // 計算當月格子
  const total = daysInMonth(viewYear, viewMonth)
  const offset = firstDayOfWeek(viewYear, viewMonth)
  const cells: Array<{ day: number; dateStr: string } | null> = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push({ day: d, dateStr: ymd(viewYear, viewMonth, d) })

  return (
    <div style={{
      background: BOOKING_COLORS.bgCard,
      borderRadius: BOOKING_RADIUS.card,
      padding: '24px 22px 28px',
      border: `1px solid ${BOOKING_COLORS.borderLight}`,
      boxShadow: '0 1px 3px rgba(184, 100, 130, 0.04), 0 8px 24px rgba(184, 100, 130, 0.05)',
    }}>
      {/* Header — 月份切換 */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18,
      }}>
        <div>
          <div style={{
            fontFamily: BOOKING_FONTS.display, fontSize: 30, fontWeight: 700,
            color: BOOKING_COLORS.textPrimary, lineHeight: 1, letterSpacing: '-0.5px',
          }}>
            {viewYear}<span style={{ fontSize: 16, color: BOOKING_COLORS.textSecondary, fontWeight: 500, marginLeft: 8 }}>{MONTH_LABELS_EN[viewMonth - 1]}</span>
          </div>
          <div style={{
            fontSize: 12, color: BOOKING_COLORS.textMuted, marginTop: 6, letterSpacing: 1,
          }}>
            選擇您想報名的日期
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <ArrowBtn onClick={prevMonth} disabled={!canGoBack} direction="prev" />
          <ArrowBtn onClick={nextMonth} disabled={!canGoForward} direction="next" />
        </div>
      </div>

      {/* Week header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8,
      }}>
        {WEEK_LABELS.map((w, i) => (
          <div key={w} style={{
            textAlign: 'center', fontSize: 11,
            color: (i === 0 || i === 6) ? BOOKING_COLORS.pinkDeep : BOOKING_COLORS.textMuted,
            padding: '4px 0', letterSpacing: 1,
            fontWeight: (i === 0 || i === 6) ? 600 : 400,
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
      }}>
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} />
          const info = datesMap.get(cell.dateStr)
          const isToday = cell.dateStr === todayStr
          const isPast = cell.dateStr < todayStr
          const hasSession = info && info.sessionCount > 0
          const isOpen = info && info.openSessionCount > 0
          const disabled = isPast || !hasSession

          // 樣式
          let bg = 'transparent'
          let textColor: string = BOOKING_COLORS.textPrimary
          let border = '1px solid transparent'
          let cursor: 'pointer' | 'default' = 'default'

          if (disabled) {
            textColor = BOOKING_COLORS.textMuted
            bg = 'transparent'
          } else if (isOpen) {
            bg = BOOKING_COLORS.pinkSoft
            textColor = BOOKING_COLORS.pinkDarker
            cursor = 'pointer'
            border = `1px solid ${BOOKING_COLORS.pinkBorder}`
          } else {
            // 有場次但全滿
            bg = BOOKING_COLORS.bgSecondary
            textColor = BOOKING_COLORS.textSecondary
            cursor = 'pointer'
          }

          if (isToday && !disabled) {
            border = `1.5px solid ${BOOKING_COLORS.pinkDeep}`
          } else if (isToday) {
            border = `1px dashed ${BOOKING_COLORS.pinkBorder}`
          }

          const cellInner = (
            <div style={{
              aspectRatio: '1 / 1.1',
              borderRadius: BOOKING_RADIUS.md,
              background: bg,
              border,
              padding: '6px 4px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              cursor,
              transition: 'transform .15s, box-shadow .15s, background .15s',
              opacity: disabled ? 0.4 : 1,
            }}
            className={!disabled ? 'booking-cal-cell' : undefined}>
              <div style={{
                fontFamily: BOOKING_FONTS.num,
                fontSize: 15, fontWeight: isToday ? 700 : 500,
                textAlign: 'center', color: textColor, lineHeight: 1.2,
              }}>
                {cell.day}
              </div>
              {hasSession && (
                <div style={{
                  fontSize: 9.5, textAlign: 'center', color: textColor,
                  fontWeight: 500, lineHeight: 1.2, letterSpacing: 0,
                }}>
                  {isOpen ? (
                    <>
                      <span style={{
                        display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
                        background: BOOKING_COLORS.pinkDeep, marginRight: 3,
                        verticalAlign: 'middle',
                      }} />
                      剩 {info.remainingSeats}
                    </>
                  ) : '已額滿'}
                </div>
              )}
            </div>
          )

          if (disabled) return <div key={cell.dateStr}>{cellInner}</div>

          return (
            <Link key={cell.dateStr} href={`/book/${venueSlug}/${cell.dateStr}`} style={{ textDecoration: 'none' }}>
              {cellInner}
            </Link>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginTop: 18, paddingTop: 14,
        borderTop: `1px dashed ${BOOKING_COLORS.borderLight}`,
        fontSize: 11, color: BOOKING_COLORS.textMuted,
      }}>
        <LegendDot color={BOOKING_COLORS.pinkSoft} border={BOOKING_COLORS.pinkBorder} label="有場次可報名" />
        <LegendDot color={BOOKING_COLORS.bgSecondary} border="transparent" label="已額滿" />
        <span style={{
          padding: '2px 8px', borderRadius: 6, border: `1.5px solid ${BOOKING_COLORS.pinkDeep}`,
          fontSize: 10, color: BOOKING_COLORS.pinkDeep, fontWeight: 600,
        }}>
          今日
        </span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .booking-cal-cell:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(201, 116, 147, 0.18);
        }
      `}} />
    </div>
  )
}


function ArrowBtn({ onClick, disabled, direction }: {
  onClick: () => void; disabled: boolean; direction: 'prev' | 'next'
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={direction === 'prev' ? '上個月' : '下個月'} style={{
      width: 36, height: 36, borderRadius: 10,
      background: disabled ? 'transparent' : BOOKING_COLORS.pinkSoft,
      border: `1px solid ${disabled ? BOOKING_COLORS.borderLight : BOOKING_COLORS.pinkBorder}`,
      color: disabled ? BOOKING_COLORS.textMuted : BOOKING_COLORS.pinkDeep,
      fontSize: 18, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all .15s',
    }}>
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

function LegendDot({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 12, height: 12, borderRadius: 4,
        background: color, border: `1px solid ${border}`,
      }} />
      {label}
    </span>
  )
}
