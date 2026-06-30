'use server'

// ============================================================
// app/actions/notifications.ts — 通知收件匣（P2.3c，server actions）
// ------------------------------------------------------------
// 列出登入者的通知、標記已讀（只能操作自己的通知）。
// ============================================================

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/data/server/auth-helpers'
import { getNotificationsForUserAsync } from '@/data/server/queries'
import type { AppNotification } from '@/types'

export type NotificationsBundle = { ok: true; notifications: AppNotification[]; unread: number } | { ok: false }

export async function loadNotificationsAction(): Promise<NotificationsBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const notifications = await getNotificationsForUserAsync(me.id)
  return { ok: true, notifications, unread: notifications.filter((n) => !n.isRead).length }
}

export async function markNotificationReadAction(args: { id: string }): Promise<{ ok: boolean }> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  // 只能標記自己的通知
  const n = await prisma.appNotification.findUnique({ where: { id: args.id }, select: { recipientUserId: true } })
  if (!n || n.recipientUserId !== me.id) return { ok: false }
  await prisma.appNotification.update({ where: { id: args.id }, data: { isRead: true } })
  revalidatePath('/notifications')
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  await prisma.appNotification.updateMany({ where: { recipientUserId: me.id, isRead: false }, data: { isRead: true } })
  revalidatePath('/notifications')
  return { ok: true }
}
