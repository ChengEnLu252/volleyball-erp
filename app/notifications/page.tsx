'use client'

// ============================================================
// /notifications — 通知收件匣（階段 16）
// ============================================================
// 列出目前登入 user 的通知（新到舊）。
//   - 未讀：左側粉紅點 + 較深底色
//   - 點擊：標為已讀並跳轉 linkHref
//   - 「全部標為已讀」一鍵清未讀
// 泛用：之後 F3 對帳回報的通知會自動出現在這。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  listMyNotifications, markNotificationRead, markAllMyNotificationsRead,
  getMyUnreadNotificationCount, NOTIFICATION_TYPE_LABEL,
} from '@/data/api'
import { hydrateStore, useStoreSync } from '@/data/store'
import type { AppNotification, NotificationType } from '@/types'
import { COLORS, FONTS } from '@/components/theme/tokens'

const TYPE_ICON: Record<NotificationType, string> = {
  goal_submitted: '🎯',
  goal_confirmed: '✅',
  goal_returned:  '↩️',
  order_placed:   '🛒',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '剛剛'
  if (min < 60) return `${min} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function NotificationsPage() {
  const storeVersion = useStoreSync()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { hydrateStore(); setMounted(true) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo<AppNotification[]>(() => (mounted ? listMyNotifications() : []), [mounted, storeVersion])
  const unread = mounted ? getMyUnreadNotificationCount() : 0

  const onOpen = (n: AppNotification) => {
    if (!n.isRead) markNotificationRead(n.id)
    if (n.linkHref) router.push(n.linkHref)
  }

  if (!mounted) {
    return <div style={{ padding: 40, color: COLORS.ink500, fontSize: 14 }}>載入中…</div>
  }

  return (
    <div style={{ padding: 24, fontFamily: FONTS.sans, color: COLORS.ink900 }}>
      <style>{`@media(max-width:768px){.ntf-wrap{padding-top:64px !important}}`}</style>
      <div className="ntf-wrap">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔔 通知
            </h1>
            <p style={{ fontSize: 13, color: COLORS.ink500, margin: '5px 0 0' }}>
              {unread > 0 ? `${unread} 則未讀` : '沒有未讀通知'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAllMyNotificationsRead()}
              style={{
                padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', color: COLORS.pink600, background: COLORS.pink50,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              全部標為已讀
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: COLORS.ink300, fontSize: 14,
            background: COLORS.surface, borderRadius: 12, border: `1px dashed ${COLORS.border}`,
          }}>
            目前沒有任何通知
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => onOpen(n)}
                style={{
                  textAlign: 'left', width: '100%', cursor: n.linkHref ? 'pointer' : 'default',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '13px 16px', borderRadius: 11,
                  background: n.isRead ? COLORS.surface : COLORS.pink50,
                  border: `1px solid ${n.isRead ? COLORS.borderLight : COLORS.border}`,
                }}
              >
                {/* 未讀點 + icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>{TYPE_ICON[n.type]}</span>
                  {!n.isRead && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2, width: 8, height: 8,
                      borderRadius: 999, background: COLORS.pink500,
                      boxShadow: '0 0 6px rgba(255,45,138,0.6)',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, fontWeight: n.isRead ? 600 : 800, color: COLORS.ink900 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.ink300, whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.ink500, margin: '3px 0 0', lineHeight: 1.5 }}>
                    {n.body}
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: COLORS.surfaceTint, color: COLORS.ink500,
                  }}>{NOTIFICATION_TYPE_LABEL[n.type]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
