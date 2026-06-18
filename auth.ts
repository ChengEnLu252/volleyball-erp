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

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        // 回傳值會進 jwt callback 的 user
        return { id: user.id, name: user.name, globalRole: user.globalRole }
      },
    }),
  ],
  callbacks: {
    // 登入當下把 userId / globalRole 寫進 JWT
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as { id: string }).id
        token.globalRole = (user as { globalRole: 'owner' | 'staff' }).globalRole
      }
      return token
    },
    // 讓 server 端 auth() 取得的 session 帶上 userId / globalRole
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.userId as string
        ;(session.user as { globalRole?: 'owner' | 'staff' }).globalRole =
          token.globalRole as 'owner' | 'staff'
      }
      return session
    },
  },
})
