'use server'

// ============================================================
// app/actions/booking-overview.ts — 報名熱度看板載入（讀真 DB）
// ------------------------------------------------------------
// 取代 data/api 的 getVenueBookingOverview（讀記憶體）→ 查真 DB，
// 讓客戶報名 / 館長增減場次即時反映在熱度看板。需登入（ERP 內頁）。
// ============================================================

import { getSessionUser } from '@/data/server/auth-helpers'
import { resolveUserScope, getVenuesForUserAsync, getBookingOverviewAsync } from '@/data/server/queries'
import type { PublicSession } from '@/data/api'

export type BookingOverviewBundle = {
  ok: true
  venues: { id: string; name: string }[]
  venueId: string
  overview: {
    totalSessions: number; totalRegistrations: number; totalRemainingSeats: number; totalCapacity: number
    byDate: Array<{ date: string; sessions: PublicSession[] }>
  } | null
} | { ok: false }

export async function loadBookingOverviewAction(args: { venueId?: string }): Promise<BookingOverviewBundle> {
  const me = await getSessionUser()
  if (!me) return { ok: false }
  const scope = await resolveUserScope(me.id)
  if (!scope || scope.role === 'none') return { ok: false }

  const venues = (await getVenuesForUserAsync(scope)).filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name }))
  const venueId = venues.find((v) => v.id === args.venueId)?.id ?? venues[0]?.id ?? ''
  const overview = venueId ? await getBookingOverviewAsync(venueId, 14) : null
  return { ok: true, venues, venueId, overview }
}
