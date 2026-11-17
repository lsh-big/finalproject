const randomUUID=()=>globalThis.crypto.randomUUID();
import {validateRecord} from './management-schema.js';
export function normalizeLedger(data){
 data.ledger??={};for(const key of ['stockMoves','renewals','bills','receipts'])data.ledger[key]??=[];
 for(const p of data.products){p.managementNumber??='';p.capacityKg??=null;}
 for(const c of data.contracts){c.productId??='';c.legacyPayment??=c.payment||'';}
 return data;
}
const whole=(v,label,zero=false)=>{if(v===''||v==null||!Number.isSafeInteger(Number(v))||Number(v)<(zero?0:1))throw Error(label+'을 올바른 정수로 입력하세요.');return Number(v);};
const text=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>2000)throw Error(label+'을 입력하세요.');return v.trim();};
const day=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('날짜를 확인하세요.');return v;};
export function received(data,billId){return data.ledger.receipts.filter(r=>r.billId===billId&&!r.voidedAt).reduce((sum,r)=>sum+r.amount,0);}
export const ledgerActions=['stock-move','stock-reverse','renew-contract','bill-month','receive-payment','void-payment'];
export function applyLedger(data,input,user){
 normalizeLedger(data);const now=new Date().toISOString(),audit={createdAt:now,createdBy:user.username};
 if(input.action==='stock-move'){
  const part=data.parts.find(p=>p.id===input.partId);if(!part)throw Error('부품을 확인하세요.');if(!['구매','사용','교체'].includes(input.type))throw Error('입출고 구분을 확인하세요.');
  const quantity=whole(input.quantity,'수량'),unitPrice=whole(input.unitPrice,'단가',true),date=day(input.date);const delta=input.type==='구매'?quantity:-quantity;
  if(!Number.isSafeInteger(part.quantity+delta)||!Number.isSafeInteger(quantity*unitPrice))throw Error('수량 또는 금액이 허용 범위를 초과했습니다.');
  if(part.quantity+delta<0)throw Error('재고가 부족합니다.');
  let productId='',ticketId='';if(input.type!=='구매'){const product=data.products.find(p=>p.id===input.productId);if(!product)throw Error('사용 또는 교체한 승강기를 선택하세요.');productId=product.id;if(input.ticketId){const ticket=data.tickets.find(t=>t.id===input.ticketId&&t.productId===productId);if(!ticket)throw Error('해당 승강기의 AS 기록을 선택하세요.');ticketId=ticket.id;}}
  const memo=text(input.memo,'구매처 또는 사용·교체 사유');part.quantity+=delta;data.ledger.stockMoves.unshift({id:randomUUID(),partId:part.id,type:input.type,quantity,delta,unitPrice,date,productId,ticketId,memo,balance:part.quantity,...audit});return;
 }
 if(input.action==='stock-reverse'){
  const old=data.ledger.stockMoves.find(r=>r.id===input.id);if(!old||old.reverses||data.ledger.stockMoves.some(r=>r.reverses===old.id))throw Error('취소 가능한 입출고 기록이 아닙니다.');
  const part=data.parts.find(p=>p.id===old.partId);if(!part||part.quantity-old.delta<0)throw Error('구매 취소에 필요한 재고가 부족합니다.');const memo=text(input.memo,'취소 사유');part.quantity-=old.delta;data.ledger.stockMoves.unshift({...old,id:randomUUID(),type:'취소',quantity:old.quantity,delta:-old.delta,balance:part.quantity,reverses:old.id,date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),memo,...audit});return;
 }
 if(input.action==='renew-contract'){
  const c=data.contracts.find(c=>c.id===input.id);if(!c)throw Error('계약을 확인하세요.');if(data.ledger.renewals.some(r=>r.previousId===c.id))throw Error('이미 갱신된 계약입니다. 가장 최근 계약을 갱신하세요.');const startDate=day(input.startDate),endDate=day(input.endDate),amount=whole(input.amount,'월 계약 금액',true);
  if(startDate<=c.endDate||endDate<startDate)throw Error('갱신 시작일은 기존 종료일 이후, 종료일은 갱신 시작일 이후여야 합니다.');
  const next={...validateRecord('contracts',{...c,startDate,endDate,amount,status:'유효'},data),id:randomUUID(),previousContractId:c.id,legacyPayment:''};
  const memo=text(input.memo,'갱신 메모');data.contracts.push(next);data.ledger.renewals.unshift({id:randomUUID(),previousId:c.id,nextId:next.id,oldStartDate:c.startDate,oldEndDate:c.endDate,startDate,endDate,oldAmount:c.amount,amount,memo,...audit});return;
 }
 if(input.action==='bill-month'){
  const c=data.contracts.find(c=>c.id===input.contractId);if(!c||c.status!=='유효')throw Error('유효한 계약을 선택하세요.');if(typeof input.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month))throw Error('청구월을 확인하세요.');
  const start=input.month+'-01',last=new Date(Date.UTC(Number(input.month.slice(0,4)),Number(input.month.slice(5)),0)).toISOString().slice(0,10);if(c.startDate>last||c.endDate<start)throw Error('계약 기간에 해당하는 월만 청구할 수 있습니다.');
  if(data.ledger.bills.some(b=>b.contractId===c.id&&b.month===input.month))throw Error('이미 청구된 계약·월입니다.');
  data.ledger.bills.unshift({id:randomUUID(),contractId:c.id,month:input.month,amount:c.amount,...audit});return;
 }
 if(input.action==='receive-payment'){
  const bill=data.ledger.bills.find(b=>b.id===input.billId);if(!bill)throw Error('청구 내역을 선택하세요.');const amount=whole(input.amount,'수금액');if(amount>bill.amount-received(data,bill.id))throw Error('미수 금액보다 많이 수금할 수 없습니다.');
  const date=day(input.date);if(!['계좌이체','카드','현금','기타'].includes(input.method))throw Error('수금 방법을 선택하세요.');const memo=typeof input.memo==='string'?input.memo.trim():'';if(memo.length>2000)throw Error('메모는 2000자 이내로 입력하세요.');data.ledger.receipts.unshift({id:randomUUID(),billId:bill.id,amount,date,method:input.method,memo,...audit});return;
 }
 if(input.action==='void-payment'){
  const receipt=data.ledger.receipts.find(r=>r.id===input.id);if(!receipt||receipt.voidedAt)throw Error('취소할 수금 기록을 확인하세요.');receipt.voidReason=text(input.memo,'취소 사유');receipt.voidedAt=now;receipt.voidedBy=user.username;return;
 }
 throw Error('지원하지 않는 이력 작업입니다.');
}
export function guardLedgerEdit(data,entity,id,record){
 if(entity==='parts'&&data.parts.find(p=>p.id===id).quantity!==record.quantity)throw Error('재고 수량 변경은 구매·사용·교체 등록으로 처리하세요.');
 if(entity==='contracts'&&(data.ledger.bills.some(b=>b.contractId===id)||data.ledger.renewals.some(r=>r.previousId===id||r.nextId===id))){const old=data.contracts.find(c=>c.id===id);if(['customerId','productId','startDate','endDate','amount'].some(k=>old[k]!==record[k]))throw Error('청구 또는 갱신 이력이 있는 계약의 고객·제품·기간·금액은 바꿀 수 없습니다. 계약 갱신으로 새 조건을 등록하세요.');}
 if(entity==='products'&&data.contracts.some(c=>c.productId===id&&c.customerId!==record.customerId))throw Error('승강기에 연결된 계약의 고객과 일치해야 합니다.');
}
export function guardLedgerDelete(data,entity,id){
 const linked=entity==='parts'?data.ledger.stockMoves.some(r=>r.partId===id):entity==='products'?data.ledger.stockMoves.some(r=>r.productId===id):entity==='tickets'?data.ledger.stockMoves.some(r=>r.ticketId===id):entity==='contracts'?data.ledger.bills.some(r=>r.contractId===id)||data.ledger.renewals.some(r=>r.previousId===id||r.nextId===id)||data.contracts.some(c=>c.previousContractId===id):false;
 if(linked)throw Error('구매·사용·교체·청구·갱신 이력이 있어 삭제할 수 없습니다.');
}

