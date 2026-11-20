import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createManagement} from '../management-store.mjs';
import {initialData,modules,validateRecord} from '../public/management-schema.js';
import {documentVersions,findDocumentProducts} from '../public/document-domain.js';
test('management validates every module and relational integrity',()=>{
 for(const [entity,rows] of Object.entries(initialData))for(const row of rows)assert.ok(validateRecord(entity,row,initialData));
 assert.throws(()=>validateRecord('products',{...initialData.products[0],id:undefined},initialData),/제조번호/);
 assert.throws(()=>validateRecord('tickets',{...initialData.tickets[0],staffId:'missing'},initialData),/담당 기사/);
 assert.throws(()=>validateRecord('parts',{...initialData.parts[0],quantity:-1},initialData),/정수/);
 assert.throws(()=>validateRecord('inspections',{...initialData.inspections[0],date:'2026-02-30'},initialData),/예정일/);
 assert.throws(()=>validateRecord('contracts',{...initialData.contracts[0],endDate:'2025-01-01'},initialData),/종료일/);
});

test('approved documents persist by product and retain the registered revision history', async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'samil-documents-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'management.json');
 let handle=createManagement(file);
 const admin={role:'admin',canView:true,username:'tester'};
 const reader={role:'user',canView:true,username:'reader'};
 const call=async (method,input,user=admin)=>{
  let status,body;
  await handle({method},{writeHead(code){status=code;},end(text){body=JSON.parse(text);}},user,async()=>input);
  return {status,body};
 };
 const product={...initialData.products[0],orderNumber:'HS-2026-01'};
 await call('PATCH',{entity:'products',id:product.id,record:product});
 const approved={action:'approve-documents',productId:product.id,revision:'A',approvedOn:'2025-01-01',
  changeNote:'최초 승인',drawing:'https://example.com/drawing-a.pdf'};
 assert.equal((await call('POST',approved,reader)).status,403);
 assert.equal((await call('POST',{...approved,drawing:'javascript:1'})).status,400);
 const first=documentVersions((await call('POST',approved)).body,product.id)[0];
 const attach={action:'attach-documents',productId:product.id,currentId:first.id,
  bom:'https://example.com/bom-a.xlsx',certificate:'https://example.com/inspection-a.pdf'};
 assert.equal((await call('POST',attach)).status,200);
 assert.equal((await call('POST',attach)).status,400);
 assert.equal((await call('POST',{...approved,revision:'B'})).status,400);
 const next={...approved,currentId:first.id,revision:'B',approvedOn:'2025-01-02',
  changeNote:'문서 개정',drawing:'https://example.com/drawing-b.pdf'};
 const competing=await Promise.all([call('POST',next),call('POST',{...next,revision:'C'})]);
 assert.deepEqual(competing.map(response=>response.status).sort(),[200,400]);
 assert.equal((await call('DELETE',{entity:'products',id:product.id})).status,400);

 handle=createManagement(file);
 const saved=(await call('GET',{},reader)).body;
 assert.equal(findDocumentProducts(saved.products,' hs-2026-01 ')[0].id,product.id);
 assert.equal(findDocumentProducts(saved.products,product.serial)[0].id,product.id);
 const [current,previous]=documentVersions(saved,product.id);
 assert.equal(current.revision,'B');
 assert.equal(current.documents.bom,undefined);
 assert.equal(previous.revision,'A');
 assert.equal(previous.documents.certificate.url,attach.certificate);
 assert.equal(previous.documents.certificate.registeredBy,'tester');
});
test('management CRUD persists, restricts writes and prevents linked deletions',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'samil-management-'));const file=path.join(dir,'data.json');let handle=createManagement(file);
 const admin={role:'admin',canView:true};
 async function call(method,user=admin,input={}){let result,status;await handle({method},{writeHead(code){status=code;},end(text){result=JSON.parse(text);}},user,async()=>input);return {status,result};}
 try{
 assert.equal((await call('GET',null)).status,401);assert.equal((await call('GET',{role:'user',canView:false})).status,403);
 assert.equal((await call('GET',{role:'user',canView:true})).status,200);assert.equal((await call('POST',{role:'user',canView:true})).status,403);
 assert.equal((await call('DELETE',admin,{entity:'customers',id:'c1'})).status,400);
 for(const entity of Object.keys(modules)){
  const record={...initialData[entity][0]};if(entity==='products')record.serial='NEW-UNIQUE';if(entity==='parts')record.code='NEW-PART';
  let response=await call('POST',admin,{entity,record});assert.equal(response.status,200,entity);const added=response.result[entity].at(-1);assert.notEqual(added.id,record.id);
  response=await call('PATCH',admin,{entity,id:added.id,record:{...added}});assert.equal(response.status,200);
  response=await call('DELETE',admin,{entity,id:added.id});assert.equal(response.status,200);
 }
 assert.equal((await call('PATCH',admin,{entity:'parts',id:'m1',record:{...initialData.parts[0],quantity:25}})).status,400);
 assert.equal((await call('POST',admin,{action:'stock-move',partId:'m1',type:'구매',quantity:21,unitPrice:25000,date:'2026-11-17',memo:'테스트 구매'})).status,200);
 handle=createManagement(file);assert.equal((await call('GET')).result.parts[0].quantity,25);
 }finally{await rm(dir,{recursive:true,force:true});}
});
