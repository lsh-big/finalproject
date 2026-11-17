import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createManagement} from '../management-store.mjs';
import {initialData,validateRecord} from '../public/management-schema.js';
import {monthlyTotals} from '../public/ledger-model.js';
const admin={username:'admin',role:'admin',canView:true};
async function workspace(run){const dir=await mkdtemp(path.join(tmpdir(),'samil-ledger-'));const file=path.join(dir,'data.json');await writeFile(file,JSON.stringify(initialData));let handle=createManagement(file);async function call(method='GET',input={},user=admin){let status,result;await handle({method},{writeHead(n){status=n;},end(text){result=JSON.parse(text);}},user,async()=>input);return {status,result};}try{await run(call,()=>{handle=createManagement(file);});}finally{await rm(dir,{recursive:true,force:true});}}
const move=(type,quantity,extra={})=>({action:'stock-move',partId:'m1',type,quantity,unitPrice:25000,date:'2026-11-17',memo:'검증 사유',...extra});
test('upgrade preserves existing stock and payment labels without inventing management IDs or receipts',()=>workspace(async(call)=>{const {result}=await call();assert.equal(result.parts[0].quantity,4);assert.equal(result.products[0].managementNumber,'');assert.equal(result.products[0].capacityKg,null);assert.equal(result.contracts[0].productId,'');assert.equal(result.contracts[0].legacyPayment,'수납 완료');assert.equal(result.ledger.receipts.length,0);assert.deepEqual(monthlyTotals(result,'2026-11'),{billed:0,paid:0,outstanding:0,count:0});}));
test('product identity uniqueness and contract customer/product relationship are checked',()=>workspace(async(call)=>{
 let data=(await call()).result;let record={...data.products[0],managementNumber:'LIFT-001',capacityKg:1000};assert.equal((await call('PATCH',{entity:'products',id:'p1',record})).status,200);
 data=(await call()).result;assert.throws(()=>validateRecord('products',{...data.products[1],managementNumber:'LIFT-001'},data),/관리번호/);assert.throws(()=>validateRecord('products',{...data.products[1],capacityKg:0},data),/용량/);
 assert.equal((await call('PATCH',{entity:'contracts',id:'k1',record:{...data.contracts[0],productId:'p2'}})).status,400);
 assert.equal((await call('PATCH',{entity:'contracts',id:'k1',record:{...data.contracts[0],productId:'p1'}})).status,200);
 assert.equal((await call('PATCH',{entity:'products',id:'p1',record:{...data.products[0],customerId:'c2'}})).status,400);
}));
test('stock purchase/use/replacement changes balances atomically, persists and can be reversed once',()=>workspace(async(call,restart)=>{
 let response=await call('POST',move('구매',6));assert.equal(response.status,200);assert.equal(response.result.parts[0].quantity,10);const purchase=response.result.ledger.stockMoves[0].id;
 response=await call('POST',move('교체',2,{productId:'p1',ticketId:'t2'}));assert.equal(response.status,200);assert.equal(response.result.parts[0].quantity,8);const replacement=response.result.ledger.stockMoves[0].id;
 assert.equal((await call('POST',move('사용',20,{productId:'p1'}))).status,400);assert.equal((await call('POST',move('사용',1,{productId:'p1',ticketId:'t1'}))).status,400);assert.equal((await call('POST',move('사용',1))).status,400);
 assert.equal((await call('POST',{action:'stock-reverse',id:replacement,memo:'교체 기록 오류'})).result.parts[0].quantity,10);
 assert.equal((await call('POST',{action:'stock-reverse',id:replacement,memo:'중복 취소'})).status,400);
 assert.equal((await call('POST',{action:'stock-reverse',id:purchase,memo:'구매 반품'})).result.parts[0].quantity,4);
 restart();response=await call();assert.equal(response.result.parts[0].quantity,4);assert.equal(response.result.ledger.stockMoves.length,4);
 assert.equal((await call('DELETE',{entity:'parts',id:'m1'})).status,400);assert.equal((await call('DELETE',{entity:'tickets',id:'t2'})).status,400);
}));
test('purchase reversal cannot make stock negative and parallel outflows cannot overspend inventory',()=>workspace(async(call)=>{
 let response=await call('POST',move('구매',2));const id=response.result.ledger.stockMoves[0].id;
 await call('POST',move('사용',5,{productId:'p1'}));assert.equal((await call('POST',{action:'stock-reverse',id,memo:'취소'})).status,400);
 const both=await Promise.all([call('POST',move('사용',1,{productId:'p1'})),call('POST',move('사용',1,{productId:'p1'}))]);assert.deepEqual(both.map(r=>r.status).sort(),[200,400]);assert.equal((await call()).result.parts[0].quantity,0);
}));
test('renewal retains old contract, creates linked next term and rejects overlap/duplicate renewal',()=>workspace(async(call,restart)=>{
 const input={action:'renew-contract',id:'k1',startDate:'2027-01-01',endDate:'2027-12-31',amount:700000,memo:'연간 갱신'};
 assert.equal((await call('POST',{...input,startDate:'2026-12-01'})).status,400);
 let response=await call('POST',input);assert.equal(response.status,200);const next=response.result.contracts.at(-1);assert.equal(next.previousContractId,'k1');assert.equal(next.amount,700000);assert.equal(response.result.contracts[0].endDate,'2026-12-31');assert.equal((await call('POST',input)).status,400);
 assert.equal((await call('DELETE',{entity:'contracts',id:next.id})).status,400);assert.equal((await call('PATCH',{entity:'contracts',id:'k1',record:{...response.result.contracts[0],amount:1}})).status,400);
 restart();assert.equal((await call()).result.ledger.renewals.length,1);
}));
test('monthly bills, partial payments, cancellation and month totals stay consistent',()=>workspace(async(call,restart)=>{
 const billInput={action:'bill-month',contractId:'k1',month:'2026-11'};assert.equal((await call('POST',{...billInput,month:'2027-01'})).status,400);
 let response=await call('POST',billInput);assert.equal(response.status,200);const bill=response.result.ledger.bills[0];assert.equal((await call('POST',billInput)).status,400);
 const payment={action:'receive-payment',billId:bill.id,amount:200000,date:'2026-11-17',method:'계좌이체',memo:'1차'};
 response=await call('POST',payment);const receipt=response.result.ledger.receipts[0];assert.deepEqual(monthlyTotals(response.result,'2026-11'),{billed:650000,paid:200000,outstanding:450000,count:1});
 assert.equal((await call('POST',{...payment,amount:500000})).status,400);
 response=await call('POST',{...payment,amount:450000});assert.equal(monthlyTotals(response.result,'2026-11').outstanding,0);
 response=await call('POST',{action:'void-payment',id:receipt.id,memo:'수금 착오'});assert.equal(monthlyTotals(response.result,'2026-11').outstanding,200000);assert.ok(response.result.ledger.receipts.find(r=>r.id===receipt.id).voidedAt);
 assert.equal((await call('POST',{action:'void-payment',id:receipt.id,memo:'중복 취소'})).status,400);
 assert.equal((await call('DELETE',{entity:'contracts',id:'k1'})).status,400);restart();assert.equal(monthlyTotals((await call()).result,'2026-11').paid,450000);
 assert.equal((await call('POST',{...billInput,month:'2026-12'})).status,200);assert.equal(monthlyTotals((await call()).result,'2026-12').paid,0);
}));
test('history write actions remain administrator-only',()=>workspace(async(call)=>{assert.equal((await call('POST',move('구매',1),{role:'user',canView:true})).status,403);assert.equal((await call('GET',{},null)).status,401);assert.equal((await call('GET',{}, {role:'user',canView:true})).status,200);}));

test('concurrent receipts cannot exceed a bill and invalid dates leave no ledger record',()=>workspace(async(call)=>{
 const created=await call('POST',{action:'bill-month',contractId:'k1',month:'2026-11'});const id=created.result.ledger.bills[0].id;
 const payment={action:'receive-payment',billId:id,amount:400000,date:'2026-11-17',method:'계좌이체',memo:''};
 assert.equal((await call('POST',{...payment,date:'2026-02-30'})).status,400);
 const results=await Promise.all([call('POST',payment),call('POST',payment)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.deepEqual(monthlyTotals((await call()).result,'2026-11'),{billed:650000,paid:400000,outstanding:250000,count:1});
}));
