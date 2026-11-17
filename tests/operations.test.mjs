import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createManagement} from '../management-store.mjs';
import {initialData} from '../public/management-schema.js';
import {checklistItems,telemetry} from '../operations-store.mjs';
import {preventiveItems} from '../public/operations-model.js';
const admin={role:'admin',username:'admin',canView:true};
const fieldInput=()=>({action:'field-report',productId:'p1',staffId:'s1',kind:'tickets',recordId:'t2',checks:Object.fromEntries(checklistItems.map(k=>[k,'양호'])),notes:'한글 현장 조치 기록',photos:[],complete:false});
async function workspace(run){const dir=await mkdtemp(path.join(tmpdir(),'samil-operations-'));const file=path.join(dir,'management.json');await writeFile(file,JSON.stringify(initialData));let handle=createManagement(file);const call=async(method,input={},user=admin,telemetryOnly=false)=>{let status,result;await handle({method,telemetryOnly},{writeHead(n){status=n;},end(t){result=JSON.parse(t);}},user,async()=>input);return {status,result};};try{await run(call,()=>{handle=createManagement(file);});}finally{await rm(dir,{recursive:true,force:true});}}
test('existing management data gains operations without losing records; field reports persist and update jobs',()=>workspace(async(call,restart)=>{
 let response=await call('GET');assert.equal(response.result.products.length,3);assert.deepEqual(response.result.ops.reports,[]);
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=';
 response=await call('POST',{...fieldInput(),photos:[photo]});assert.equal(response.status,200);assert.equal(response.result.tickets.find(t=>t.id==='t2').status,'처리 중');assert.equal(response.result.ops.reports[0].createdBy,'admin');
 restart();response=await call('GET');assert.equal(response.result.ops.reports[0].notes,'한글 현장 조치 기록');assert.equal(response.result.ops.reports[0].photos[0],photo);
 assert.equal((await call('DELETE',{entity:'tickets',id:'t2'})).status,400);
 assert.equal((await call('POST',{...fieldInput(),complete:true})).result.tickets.find(t=>t.id==='t2').status,'완료');
}));
test('field writes enforce view permissions, valid relationships, checklist and photo limits',()=>workspace(async(call)=>{
 assert.equal((await call('POST',fieldInput(),{role:'user',canView:true})).status,403);
 assert.equal((await call('GET',{},null,true)).status,401);
 assert.equal((await call('GET',{}, {role:'user',canView:true},true)).status,200);
 assert.equal((await call('POST',{...fieldInput(),productId:'p2'})).status,400);
 assert.equal((await call('POST',{...fieldInput(),checks:{}})).status,400);
 const input=fieldInput();input.checks.door='확인 필요';input.complete=true;assert.equal((await call('POST',input)).status,400);
 assert.equal((await call('POST',{...fieldInput(),photos:['data:image/svg+xml;base64,AAAA']})).status,400);
 assert.equal((await call('POST',{...fieldInput(),photos:['x'.repeat(700001)]})).status,400);
 assert.equal((await call('GET')).result.ops.reports.length,0);
}));
test('manual import is atomic, validated and audited; supplied IDs cannot bypass uniqueness',()=>workspace(async(call)=>{
 const good={name:'수동 고객',building:'수동 건물',address:'서울',contact:'김담당',phone:'02-000-0000',status:'상담 중'};
 let response=await call('POST',{action:'import',system:'ERP',entity:'customers',records:[good,{...good,status:'wrong'}]});assert.equal(response.status,400);assert.equal((await call('GET')).result.customers.length,3);
 response=await call('POST',{action:'import',system:'ERP',entity:'products',records:[initialData.products[0]]});assert.equal(response.status,400);
 response=await call('POST',{action:'import',system:'MAX',entity:'customers',records:[good]});assert.equal(response.status,400);
 response=await call('POST',{action:'import',system:'ERP',entity:'customers',records:[good]});assert.equal(response.status,200);assert.equal(response.result.customers.length,4);assert.equal(response.result.ops.imports[0].mode,'manual');assert.equal(response.result.ops.imports[0].count,1);
}));
test('telemetry is explicitly simulated, updates with time and exposes stale samples',()=>{
 const time=Date.parse('2026-11-17T03:00:00Z');const a=telemetry(initialData,time),b=telemetry(initialData,time+10000);assert.equal(a.source,'simulation');assert.equal(a.devices.length,3);assert.notEqual(a.devices[0].floor,b.devices[0].floor);assert.equal(a.devices[2].connected,false);assert.equal(a.devices[2].floor,null);assert.equal(time-Date.parse(a.devices[2].observedAt),600000);
});
test('preventive alerts use recorded facts and ignore future AS dates',()=>{
 const data=structuredClone(initialData);assert.equal(preventiveItems(data,'2026-11-17').length,0);
 data.tickets.push({...data.tickets[0],id:'repeat',productId:'p1',date:'2026-11-17'});data.inspections[0].date='2026-11-16';
 const row=preventiveItems(data,'2026-11-17').find(r=>r.product.id==='p1');assert.equal(row.recent,2);assert.equal(row.overdue,1);
 data.tickets.push({...data.tickets[0],id:'future',date:'2027-01-01',priority:'긴급'});assert.ok(!preventiveItems(data,'2026-11-17').some(r=>r.product.id==='p2'));
});
