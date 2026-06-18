// 自助註冊頁（公開）。server 端取球館清單 → 傳給 client 表單。
import { getActiveVenuesPublic } from '@/data/server/queries'
import RegisterForm from './RegisterForm'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const venues = await getActiveVenuesPublic()
  return <RegisterForm venues={venues} />
}
