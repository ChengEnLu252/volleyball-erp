// Auth.js (NextAuth v5) route handler。
// bcrypt 需 Node runtime（不可 edge）。
export const runtime = 'nodejs'

import { handlers } from '@/auth'

export const { GET, POST } = handlers
