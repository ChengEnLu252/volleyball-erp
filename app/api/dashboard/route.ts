import { NextResponse } from 'next/server'
// import { getDashboard } from '@/lib/db'  ← 正式上線時換這個

export async function GET() {
  // TODO: 換成真實資料庫查詢
  return NextResponse.json({ message: 'dashboard API（開發中）' })
}
