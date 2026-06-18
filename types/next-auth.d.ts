// Auth.js (NextAuth v5) 型別擴充 —— session/JWT 帶上自訂欄位
import type { EffectiveRole } from '@/data/permissions'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      globalRole: 'owner' | 'staff'
      role: EffectiveRole
      visibleVenueIds: string[] | 'all'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    globalRole?: 'owner' | 'staff'
    role?: EffectiveRole
    visibleVenueIds?: string[] | 'all'
  }
}
