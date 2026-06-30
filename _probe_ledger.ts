import { prisma } from './lib/prisma'
async function main(){
  const ld = await prisma.ledgerDay.count()
  // 取一個有場次的近月：用最近場次推月份
  const last = await prisma.session.findFirst({ orderBy: { sessionDate: 'desc' }, select: { sessionDate: true, venueId: true, venue:{select:{name:true}} } })
  if (!last) { console.log('ledger_days=', ld, '無場次'); process.exit(0) }
  const d = last.sessionDate
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`
  const gte = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const lt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1))
  const vid = last.venueId
  const sess = await prisma.session.findMany({ where:{ venueId: vid, sessionDate:{gte,lt} }, select:{ sessionDate:true, registrations:{select:{payments:{select:{amount:true,status:true}}}} } })
  let paid=0, refund=0, days=new Set<string>()
  for(const s of sess){ days.add(s.sessionDate.toISOString().slice(0,10)); for(const r of s.registrations) for(const p of r.payments){ if(p.status==='paid'&&p.amount>0)paid+=p.amount; else if(p.amount<0)refund+=Math.abs(p.amount) } }
  const tx = await prisma.productTransaction.aggregate({ where:{ venueId:vid, type:'sale', operatedAt:{gte,lt} }, _sum:{ totalAmount:true } })
  console.log(`ledger_days(總)=${ld}`)
  console.log(`對帳樣本 ${last.venue?.name} ${ym}: 場次${sess.length}場/${days.size}天, 系統已收=$${paid.toLocaleString()}, 系統退款=$${refund.toLocaleString()}, 商品銷售=$${(tx._sum.totalAmount??0).toLocaleString()}`)
  process.exit(0)
}
main()
