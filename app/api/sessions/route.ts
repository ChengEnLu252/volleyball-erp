import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const venueId = searchParams.get('venueId')
  const date    = searchParams.get('date')
  // TODO: 查詢資料庫
  return NextResponse.json({ venueId, date, sessions: [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  // TODO: 寫入資料庫
  return NextResponse.json({ success: true, data: body }, { status: 201 })
}
