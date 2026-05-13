import { NextResponse } from 'next/server'

const MOCK_RESPONSES: Record<string, string> = {
  default: '根據目前的營運數據，我有以下建議供您參考。',
}

const SMART_REPLIES = [
  { keywords: ['最賺', '收入', '哪間'],        reply: '根據今日數據，飛翼館收入最高（$10,800），滿場率達 91%。球魔方 2.0 排第二（$9,000）。建議重點複製飛翼館的場次配置到其他館。' },
  { keywords: ['贈送', '飛翼', '異常'],        reply: '飛翼館今日商品贈送比例 42%，遠超標準 20%。建議立即查詢今日哪位工作人員執行贈送操作，系統 Audit Log 可查到完整紀錄。' },
  { keywords: ['價格', '調整', '建議'],        reply: '根據歷史報名率分析：週末下午場（15:40–18:40）滿場率高達 88%，建議從 $280 調升至 $300；週間上午場滿場率僅 45%，建議降至 $200 吸引客源。' },
  { keywords: ['時段', '熱門', '滿場'],        reply: '最熱門時段是週末下午 15:40–18:40 與晚場 19:00–22:00，平均滿場率 88%。最冷門是平日午場 12:20–15:20，建議開設入門場或促銷活動。' },
  { keywords: ['未付', '收款', '催'],          reply: '目前有 7 人未付款，待收 $1,900。等待超過 2 小時的有：林小明（球魔方 2.0）、張志豪（Hibi 日日）。建議工讀生現場確認。' },
  { keywords: ['庫存', '飲料', '補貨'],        reply: 'Hibi 日日館運動飲料庫存剩 2 罐，低於安全水位 5 罐。建議本週內補貨至少 20 罐，避免假日場次缺貨。' },
  { keywords: ['Ace', '下滑', '改善'],         reply: 'Ace 2.0 本週收入較上週下降 18%。新開幕的 Ace 3.0 中和分館分散了部分客源，建議推出「兩館互通會員」吸引客流。' },
  { keywords: ['程度', 'B', '中階', '場次'],   reply: '根據報名資料，B 到 B+ 程度的客戶回流率最高（平均每月回訪 3.2 次）。建議每週固定開設至少 4 場中階場，這是最穩定的客群。' },
]

export async function POST(request: Request) {
  const { messages } = await request.json()
  const lastMessage = messages[messages.length - 1]?.content ?? ''

  await new Promise(r => setTimeout(r, 800))

  for (const item of SMART_REPLIES) {
    if (item.keywords.some(k => lastMessage.includes(k))) {
      return NextResponse.json({ text: item.reply })
    }
  }

  return NextResponse.json({
    text: '根據目前的營運數據，今日七館總收入 $52,400，出席 108 人。飛翼館表現最佳但商品贈送比例需注意。如需更具體的分析，請告訴我你想了解哪個面向。'
  })
}
