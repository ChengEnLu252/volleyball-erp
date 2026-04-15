import { redirect } from 'next/navigation'

export default function Home() {
  // 之後這裡會檢查登入狀態，未登入跳 /login
  redirect('/dashboard')
}
