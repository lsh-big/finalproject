export function collected(data,billId){return data.ledger.receipts.filter(r=>r.billId===billId&&!r.voidedAt).reduce((s,r)=>s+r.amount,0);}
export function monthlyTotals(data,month){const bills=data.ledger.bills.filter(b=>b.month===month),billed=bills.reduce((s,b)=>s+b.amount,0),paid=bills.reduce((s,b)=>s+collected(data,b.id),0);return {billed,paid,outstanding:billed-paid,count:bills.length};}
