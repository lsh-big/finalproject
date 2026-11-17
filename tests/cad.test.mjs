import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCad,validateCadDataset,validateCadRules,objectKey,parseBomCSV,makeCadBomCSV,csvCell,freshCadState} from '../public/cad-engine.js';
import {cadExample,defaultCadRules,exampleExternalBom} from '../public/cad-example.js';
import {createDemoAPI} from '../public/demo-api.js';
const clone=structuredClone;
const run=(data=cadExample,rules=defaultCadRules,external=exampleExternalBom)=>analyzeCad(data,rules,external);
function normal(){const data=clone(cadExample);data.files=data.files.slice(0,1);data.objects=data.objects.filter(o=>['10','27'].includes(o.handle)&&o.fileId==='demo-a');data.objects[0].attributes.DWG_NO='DEMO-001';return data;}
test('CAD virtual fixtures cover normal, missing, duplicate, exception, title and external BOM cases read-only',()=>{
 const before=JSON.stringify(cadExample);const result=run();assert.equal(result.dataset.source.kind,'virtual');assert.equal(result.issues.length,10);assert.equal(result.bom.length,5);assert.equal(result.excluded.length,3);assert.equal(result.exceptions.length,1);assert.equal(run(normal(),defaultCadRules,null).issues.length,0);assert.equal(JSON.stringify(cadExample),before);
 const dup=result.issues.find(i=>i.code==='duplicate');assert.equal(dup.objectKeys.length,2);assert.ok(!dup.objectKeys.includes(objectKey(cadExample.objects.find(o=>o.handle==='23'))));
 assert.ok(result.issues.some(i=>i.code==='required'&&i.handle==='25'));assert.ok(result.issues.some(i=>i.code==='title-required'&&i.handle==='10'));assert.ok(result.issues.some(i=>i.code==='title-block'&&i.fileId==='demo-b'&&i.position===null));assert.ok(result.issues.some(i=>i.code==='bom-mismatch'&&i.fileName===exampleExternalBom.fileName));
});
test('duplicate scope, case and block exceptions are explicit; original file plus handle identifies objects',()=>{
 const rules=clone(defaultCadRules);rules.duplicateExceptions=[];assert.equal(run(cadExample,rules,null).issues.find(i=>i.code==='duplicate').objectKeys.length,3);
 const data=clone(cadExample);data.objects.find(o=>o.fileId==='demo-b').attributes.TAG='km1';rules.duplicateScope='project';rules.caseSensitive=false;assert.equal(run(data,rules,null).issues.find(i=>i.code==='duplicate').objectKeys.length,4);
 assert.notEqual(objectKey(data.objects.find(o=>o.fileId==='demo-a'&&o.handle==='21')),objectKey(data.objects.find(o=>o.fileId==='demo-b'&&o.handle==='21')));
 const invalid=clone(data);invalid.objects.push(clone(invalid.objects[0]));assert.throws(()=>validateCadDataset(invalid),/핸들이 중복/);
});
test('tag mapping and title layout rules are validated without inferring missing attributes',()=>{
 const data=normal();for(const o of data.objects){o.attributes.COMPONENT_ID=o.attributes.TAG||'';delete o.attributes.TAG;}const rules=clone(defaultCadRules);rules.mapping.deviceNumber='COMPONENT_ID';assert.equal(run(data,rules,null).issues.length,0);
 rules.mapping.partNumber='constructor';const result=run(data,rules,null);assert.ok(result.issues.some(i=>i.code==='required'));assert.equal(result.bom.length,0);
 const missing=normal();missing.files[0].layouts.push('Layout1');assert.ok(run(missing,defaultCadRules,null).issues.some(i=>i.layout==='Layout1'&&i.code==='title-block'));
 assert.throws(()=>validateCadRules({...rules,mapping:{...rules.mapping,deviceNumber:''}}),/기기번호/);
 const bad=normal();bad.objects[0].position=[NaN,0,0];assert.throws(()=>validateCadDataset(bad),/삽입 위치/);
});
test('BOM uses configured count mode, excludes invalid quantities and keeps missing specs explicit',()=>{
 const rules={...clone(defaultCadRules),quantityMode:'attribute'};const result=run(cadExample,rules,null);assert.equal(result.bom.find(r=>r.partNumber==='CB-001').quantity,2);assert.equal(result.bom.find(r=>r.partNumber==='TB-001').quantity,3);assert.ok(result.issues.some(i=>i.code==='quantity'&&i.handle==='26'));
 const data=normal();data.objects.find(o=>o.handle==='27').attributes.SPEC='';assert.match(makeCadBomCSV(run(data,defaultCadRules,null)),/정보 없음/);
 for(const value of ['','0','-1','1.5','NaN','9007199254740992']){const d=normal();d.objects.find(o=>o.handle==='27').attributes.QTY=value;const r=run(d,rules,null);assert.equal(r.bom.length,0);assert.ok(r.issues.some(i=>i.code==='quantity'));}
});
test('CSV round trips quoted fields, aggregates external rows and guards spreadsheet formulas',()=>{
 const result=run();const csv=makeCadBomCSV(result);const external=parseBomCSV('\uFEFF'+csv,'roundtrip.csv');assert.ok(!run(cadExample,defaultCadRules,external).issues.some(i=>i.code==='bom-mismatch'));
 const parsed=parseBomCSV('품번,규격,수량\r\n"P,001","A""B\nC",2\r\n"P,001","A""B\nC",3','test.csv');assert.equal(parsed.rows[0].partNumber,'P,001');assert.equal(parsed.rows[0].spec,'A"B\nC');
 assert.throws(()=>parseBomCSV('품번,규격,수량\nP,A,1.5','bad.csv'),/수량/);assert.throws(()=>parseBomCSV('품번,規格,수량\nP,A,1','bad.csv'),/머리글/);assert.throws(()=>parseBomCSV('품번,규격,수량\n"P,A,1','bad.csv'),/닫히지/);
 for(const v of ['=1+1','+CMD','-CMD','@SUM(A1)',' =1+1'])assert.ok(csvCell(v).startsWith('"\''));
});
test('optional virtual number format does not enforce an unconfirmed company convention',()=>{
 const data=normal();data.objects.find(o=>o.handle==='27').attributes.TAG='-X:1';assert.ok(!run(data,defaultCadRules,null).issues.some(i=>i.code==='device-format'));assert.ok(run(data,{...defaultCadRules,enforceDeviceFormat:true},null).issues.some(i=>i.code==='device-format'));
});
test('CAD review status/history persist, stale issue IDs fail, rules reset reviews and viewer cannot write',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let api=createDemoAPI(storage,'cad-test');const call=async(body,path='api/management')=>{const r=await api(path,body?{method:'POST',body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
 let data=(await call()).data;const issue=run(data.cad.dataset,data.cad.rules,data.cad.externalBom).issues[0];
 assert.equal((await call({action:'cad-review',issueId:issue.id,status:'보류',note:'현장 도면 확인 필요'})).status,200);await call({action:'cad-review',issueId:issue.id,status:'확인 완료',note:'설계자 확인'});
 api=createDemoAPI(storage,'cad-test');data=(await call()).data;assert.equal(data.cad.reviews[issue.id].status,'확인 완료');assert.equal(data.cad.reviews[issue.id].history.length,2);assert.deepEqual(data.cad.dataset,cadExample);
 assert.equal((await call({action:'cad-review',issueId:'stale',status:'완료'})).status,400);
 assert.equal((await call({action:'cad-config',dataset:cadExample,rules:defaultCadRules,externalBom:null})).status,200);assert.deepEqual((await call()).data.cad.reviews,{});
 await call({role:'viewer'},'api/demo-role');assert.equal((await call({action:'cad-reset'})).status,403);
});
