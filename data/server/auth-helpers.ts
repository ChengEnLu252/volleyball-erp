// ============================================================
// data/server/auth-helpers.ts — server 端取得登入者（server-only）
// ------------------------------------------------------------
// 給 server component / server action / 殼 用：拿目前 Auth.js session
// 的使用者。搭配 data/server/queries.ts 的 resolveUserScope() 做後端
// 強制授權。
//
// Round 4：已可用，但全站身分仍由 store 主導（shadow mode）。
// Round 5：LoginGate/RequireRole 切到以此為準。
// ============================================================
import 'server-only'
import { auth } from '@/auth'

export type SessionUser = {
  id: string
  name: string
  globalRole: 'owner' | 'staff'
}

/** 目前登入者（未登入回 null）。fail-closed：缺 id 一律當未登入。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const u = session?.user as { id?: string; name?: string | null; globalRole?: 'owner' | 'staff' } | undefined
  if (!u?.id || !u.globalRole) return null
  return { id: u.id, name: u.name ?? '', globalRole: u.globalRole }
}
