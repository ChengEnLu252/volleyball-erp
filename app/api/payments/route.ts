import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ payments: [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  // TODO: 記錄付款，同時觸發 audit log
  return NextResponse.json({ success: true, data: body }, { status: 201 })
}
