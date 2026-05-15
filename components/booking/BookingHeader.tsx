'use client'

// ============================================================
// components/booking/BookingHeader.tsx — 新版 sticky header
// ============================================================
// 階段 13 新增。
//
// 對應舊系統的頂部 header：
//   左：館 logo（圓形 SVG，粉紅可愛運動風）
//   中：「場次預定」「我的預定」兩個 tab（pathname 自動 active）
//   右：未登入 → 綠色 LINE 登入鈕；已登入 → 圓形頭像 + 點下出登出 popup
//
// 跨 7 館共用，依 venueSlug 決定 tab 連結 prefix。
// ============================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { BOOKING_COLORS, BOOKING_FONTS, BOOKING_RADIUS } from './theme'
import { LineIcon } from './BookingShell'
import LineLoginModal, {
  getLineUser, clearLineUser, type LineUser,
} from './LineLoginModal'
import type { PublicVenueInfo } from '@/data/api'

interface Props {
  venueSlug: string
  venueInfo: PublicVenueInfo
  /** 標題（內頁可選傳，例如「2026/5/15 星期五」） */
  breadcrumb?: string
}

export default function BookingHeader({ venueSlug, venueInfo, breadcrumb }: Props) {
  const pathname = usePathname()
  const [lineUser, setLineUserState] = useState<LineUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setLineUserState(getLineUser())
  }, [pathname])  // 切頁時重讀（登入後跳轉會更新）

  // 點 header 外面要關 profile menu
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileBtnRef.current && !profileBtnRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) {
      document.addEventListener('mousedown', onClickOutside)
      return () => document.removeEventListener('mousedown', onClickOutside)
    }
  }, [profileMenuOpen])

  function handleLoginSuccess(user: LineUser) {
    setLineUserState(user)
    setLoginOpen(false)
  }

  function handleLogout() {
    clearLineUser()
    setLineUserState(null)
    setProfileMenuOpen(false)
  }

  // 判斷哪個 tab active
  const sessionHomePath = `/book/${venueSlug}`
  const myBookingsPath = `/book/${venueSlug}/me`
  // 「我的預定」只有完全匹配 me；其他都算「場次預定」
  const isMyBookings = pathname?.startsWith(myBookingsPath) ?? false
  const isSessionTab = !isMyBookings

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: BOOKING_COLORS.bgCard,
        borderBottom: `1px solid ${BOOKING_COLORS.borderLight}`,
        backdropFilter: 'saturate(160%) blur(8px)',
      }}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {/* Logo */}
          <Link
            href={sessionHomePath}
            aria-label={venueInfo.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <BrandLogo />
          </Link>

          {/* Tab nav */}
          <nav style={{
            flex: 1,
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
          }}>
            <TabButton href={sessionHomePath} active={isSessionTab}>場次預定</TabButton>
            <TabButton href={myBookingsPath} active={isMyBookings}>我的預定</TabButton>
          </nav>

          {/* 右：登入 / 用戶頭像 */}
          <div style={{ flexShrink: 0 }}>
            {lineUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  ref={profileBtnRef}
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  aria-label="用戶選單"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: BOOKING_COLORS.pinkSoft,
                    border: `2px solid ${BOOKING_COLORS.pinkBorder}`,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 700,
                    color: BOOKING_COLORS.pinkVividDeep,
                  }}
                >
                  {lineUser.pictureUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={lineUser.pictureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    lineUser.displayName.charAt(0) || '🏐'
                  )}
                </button>
                {profileMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 180,
                    background: BOOKING_COLORS.bgCard,
                    border: `1px solid ${BOOKING_COLORS.borderLight}`,
                    borderRadius: BOOKING_RADIUS.md,
                    boxShadow: '0 10px 30px rgba(120, 60, 80, 0.18)',
                    padding: 8,
                    zIndex: 60,
                  }}>
                    <div style={{
                      padding: '8px 10px 12px',
                      borderBottom: `1px solid ${BOOKING_COLORS.borderLight}`,
                      marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 11, color: BOOKING_COLORS.textMuted, marginBottom: 2 }}>
                        已登入
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: BOOKING_COLORS.textPrimary }}>
                        {lineUser.displayName}
                      </div>
                    </div>
                    <Link
                      href={myBookingsPath}
                      onClick={() => setProfileMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: BOOKING_COLORS.textPrimary,
                        textDecoration: 'none',
                      }}
                    >
                      我的預定
                    </Link>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: BOOKING_COLORS.warn,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      登出
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: BOOKING_COLORS.lineGreen,
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(6, 199, 85, 0.28)',
                }}
              >
                <LineIcon size={16} />
                登入
              </button>
            )}
          </div>
        </div>

        {/* 麵包屑 / 副標題（內頁用） */}
        {breadcrumb && (
          <div style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 16px 10px',
            fontSize: 11.5,
            color: BOOKING_COLORS.textMuted,
            letterSpacing: 0.5,
          }}>
            {breadcrumb}
          </div>
        )}
      </header>

      <LineLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab 按鈕
// ─────────────────────────────────────────────────────────────
function TabButton({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        background: active ? BOOKING_COLORS.pinkSoft : 'transparent',
        color: active ? BOOKING_COLORS.pinkVividDeep : BOOKING_COLORS.textSecondary,
        border: active ? `1px solid ${BOOKING_COLORS.pinkBorder}` : '1px solid transparent',
        transition: 'all .15s',
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// 品牌 Logo — 排球+翅膀小圖（粉紅可愛運動風 inline SVG）
// ─────────────────────────────────────────────────────────────
function BrandLogo() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${BOOKING_COLORS.pink}, ${BOOKING_COLORS.pinkVivid})`,
        boxShadow: '0 4px 12px rgba(255, 107, 157, 0.32)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
        {/* 排球外圈 */}
        <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.6" fill="#fff" />
        {/* 排球線條 */}
        <path d="M3 12 Q12 7 21 12" stroke={BOOKING_COLORS.pinkVividDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M12 3 Q9 12 12 21" stroke={BOOKING_COLORS.pinkVividDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M12 3 Q15 12 12 21" stroke={BOOKING_COLORS.pinkVividDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* 小翅膀（左右兩道弧） */}
        <path d="M2 9 Q5 8 7 10" stroke={BOOKING_COLORS.pinkVividDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M22 9 Q19 8 17 10" stroke={BOOKING_COLORS.pinkVividDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* 小愛心 (中央) */}
        <path
          d="M12 14.2 c -0.5 -0.6 -1.4 -0.6 -1.7 0.1 c -0.3 0.7 0.6 1.6 1.7 2.3 c 1.1 -0.7 2 -1.6 1.7 -2.3 c -0.3 -0.7 -1.2 -0.7 -1.7 -0.1 z"
          fill={BOOKING_COLORS.pinkVividDeep}
        />
      </svg>
    </span>
  )
}
