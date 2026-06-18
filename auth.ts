// ============================================================
// auth.ts — Auth.js (NextAuth v5) 設定
// ------------------------------------------------------------
// 🔒 server-only：此檔 import prisma + bcrypt，只能在 server 端用。
//    client 端要登入/登出請用 next-auth/react 的 signIn()/signOut()，
//    不要 import 此檔。
//
// Round 4（shadow mode）：只把 session 基礎建設架好，現有 store 登入
//   閘門（components/LoginGate）仍照舊運作；行為不變。
//   Round 5 才把身分來源切到這裡。
//
// 帳號＝登入代號 username（User.username, unique）；密碼以 bcrypt 比對。
// ============================================================
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { deriveEffectiveRole, type EffectiveRole } from '@/data/permissions'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true, // 本機/自管主機需要；正式環境由 AUTH_URL 控制
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      // 帳號用「登入代號」而非 email（館主端較直覺）
      credentials: {
        username: { label: '登入代號', type: 'text' },
        password: { label: '密碼', type: 'password' },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === 'string' ? credentials.username.trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!username || !password) return null

        const user = await prisma.user.findUnique({ where: { username } })
        if (!user || !user.isActive) return null
        // 未通過老闆審核者不得登入（pending / rejected 一律擋）
        if (user.approvalStatus !== 'approved') return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        // 一併算出 effective role + 可見球館，放進 session（後端授權與前端 UX 都用）
        const venueRoles = await prisma.userVenueRole.findMany({ where: { userId: user.id } })
        const role: EffectiveRole = deriveEffectiveRole(
          user.globalRole,
          venueRoles.map((r) => ({ userId: r.userId, venueId: r.venueId, role: r.role })),
        )
        const visibleVenueIds: string[] | 'all' =
          role === 'owner' ? 'all'
          : role === 'none' ? []
          : Array.from(new Set(venueRoles.map((r) => r.venueId)))

        // 回傳值會進 jwt callback 的 user
        return {
          id: user.id, name: user.name, globalRole: user.globalRole,
          role, visibleVenueIds,
        }
      },
    }),
  ],
  callbacks: {
    // 登入當下把 userId / globalRole / role / visibleVenueIds 寫進 JWT
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string; globalRole: 'owner' | 'staff'
          role: EffectiveRole; visibleVenueIds: string[] | 'all'
        }
        token.userId = u.id
        token.globalRole = u.globalRole
        token.role = u.role
        token.visibleVenueIds = u.visibleVenueIds
      }
      return token
    },
    // 讓 server / client 取得的 session 帶上這些欄位
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as {
          id?: string; globalRole?: 'owner' | 'staff'
          role?: EffectiveRole; visibleVenueIds?: string[] | 'all'
        }
        su.id = token.userId as string
        su.globalRole = token.globalRole as 'owner' | 'staff'
        su.role = token.role as EffectiveRole
        su.visibleVenueIds = token.visibleVenueIds as string[] | 'all'
      }
      return session
    },
  },
})
