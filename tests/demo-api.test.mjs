import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoAPI} from '../public/demo-api.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const request=async(api,path='api/management',method='GET',body)=>{const response=await api(path,{method,body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
const customer={name:'시연 등록',building:'시연 건물',address:'가상 주소',contact:'시연 담당',phone:'02-000-0000',status:'상담 중'};
test('Pages demo starts without login, persists edits and isolates project/browser storage',async()=>{
 const saved=storage();let api=createDemoAPI(saved,'project-a');assert.equal((await request(api,'api/me')).data.demo,true);
 assert.equal((await request(api,'api/management','POST',{entity:'customers',record:customer})).status,200);
 api=createDemoAPI(saved,'project-a');assert.equal((await request(api)).data.customers.length,4);
 assert.equal((await request(createDemoAPI(saved,'project-b'))).data.customers.length,3);
 assert.equal((await request(createDemoAPI(storage(),'project-a'))).data.customers.length,3);
 assert.equal((await request(api,'api/telemetry')).data.source,'simulation');assert.equal((await request(api,'api/users')).status,404);
});
test('viewer simulation prevents edits, reset restores examples and roles',async()=>{
 const api=createDemoAPI(storage());await request(api,'api/management','POST',{entity:'customers',record:customer});
 await request(api,'api/demo-role','POST',{role:'viewer'});assert.equal((await request(api,'api/me')).data.role,'user');assert.equal((await request(api,'api/management','POST',{entity:'customers',record:customer})).status,403);
 await request(api,'api/demo-reset','POST');assert.equal((await request(api)).data.customers.length,3);assert.equal((await request(api,'api/me')).data.role,'admin');
});
test('demo shares stock/billing validation and failed changes do not modify stored state',async()=>{
 const api=createDemoAPI(storage());const move={action:'stock-move',partId:'m1',type:'교체',quantity:2,unitPrice:25000,date:'2026-11-17',productId:'p1',ticketId:'t2',memo:'교체 시연'};
 assert.equal((await request(api,'api/management','POST',move)).data.parts[0].quantity,2);
 assert.equal((await request(api,'api/management','POST',{...move,quantity:5})).status,400);assert.equal((await request(api)).data.parts[0].quantity,2);
 const invalid=[customer,{...customer,status:'잘못된 상태'}];assert.equal((await request(api,'api/management','POST',{action:'import',system:'ERP',entity:'customers',records:invalid})).status,400);assert.equal((await request(api)).data.customers.length,3);
 let response=await request(api,'api/management','POST',{action:'bill-month',contractId:'k1',month:'2026-11'});const bill=response.data.ledger.bills[0];
 response=await request(api,'api/management','POST',{action:'receive-payment',billId:bill.id,amount:200000,date:'2026-11-17',method:'계좌이체',memo:'시연'});assert.equal(response.status,200);assert.equal(response.data.ledger.receipts[0].amount,200000);
});
test('storage quota failures report errors without silently losing the last saved data',async()=>{
 const saved=storage(),api=createDemoAPI(saved);await request(api,'api/management','POST',{entity:'customers',record:customer});saved.setItem=()=>{throw Error('QuotaExceededError');};const result=await request(api,'api/management','POST',{entity:'customers',record:customer});assert.equal(result.status,400);assert.match(result.data.error,/저장 공간/);assert.equal((await request(api)).data.customers.length,4);
});
