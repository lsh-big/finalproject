import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const targets=await fetch('http://127.0.0.1:9224/json').then(r=>r.json());
const target=targets.find(t=>t.type==='page');assert.ok(target);
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);}
try{
 await send('Runtime.enable');await until('!!document.querySelector("#login")');
 await evaluate(`document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='1234';document.querySelector('#login').requestSubmit();`);
 await until('document.querySelectorAll("#nav button").length===13');
 for(const key of ['field','monitor','preventive','integrations']){await evaluate(`document.querySelector('[data-go=${key}]').click()`);assert.ok(await evaluate('document.querySelector("#content").innerHTML.length>500'));assert.ok(!await evaluate('document.querySelector("#content").innerText.includes("undefined")'));}
 await evaluate(`document.querySelector('[data-go=monitor]').click()`);await until('document.querySelectorAll(".device-card").length===3');assert.ok(await evaluate('document.querySelector("#content").innerText.includes("시연 모드")'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await mkdir('tests/artifacts',{recursive:true});let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('tests/artifacts/operations-monitor.png',Buffer.from(shot.data,'base64'));
 await evaluate(`document.querySelector('[data-go=integrations]').click();document.querySelector('#import-example').click();document.querySelector('#import-validate').click();`);
 assert.equal(await evaluate('document.querySelector("#import-apply").disabled'),false);
 await evaluate(`document.querySelector('#import-apply').click()`);await until('document.querySelector("#content").innerText.includes("수동 반영")&&document.querySelector("#import-json").value===""');
 await evaluate(`(async()=>{const data=await fetch('./api/management').then(r=>r.json());const c=data.customers.find(c=>c.name==='연계 예시 고객');if(!c)throw Error('Import did not save');const r=await fetch('./api/management',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:'customers',id:c.id})});if(!r.ok)throw Error('Cleanup failed');})()`);
 await evaluate(`(async()=>{const data=await fetch('./api/management').then(r=>r.json());const r=await fetch('./api/management',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:'tickets',record:{productId:data.products[0].id,date:'2026-11-17',symptom:'브라우저 현장 검증',priority:'보통',staffId:data.staff[0].id,status:'접수',notes:''}})});const saved=await r.json();window.qaTicketId=saved.tickets.at(-1).id;document.querySelector('#refresh').click();})()`);
 await evaluate(`document.querySelector('[data-go=field]').click()`);await until('!!document.querySelector("#field-form")');
 await evaluate(`document.querySelector('#field-job').value='tickets:'+window.qaTicketId;for(const key of ['door','level','button','lighting','communication'])document.querySelector('#field-form [name='+key+']').value='양호';document.querySelector('#field-form [name=notes]').value='브라우저 검증 조치 기록';document.querySelector('#field-form').requestSubmit();`);
 await until('document.querySelector(".report-list").innerText.includes("브라우저 검증 조치 기록")');
 await evaluate(`(async()=>{const data=await fetch('./api/management').then(r=>r.json());const report=data.ops.reports.find(r=>r.recordId===window.qaTicketId);for(const input of [{action:'delete-report',id:report.id},{entity:'tickets',id:window.qaTicketId}]){const r=await fetch('./api/management',{method:input.action?'POST':'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});if(!r.ok)throw Error('Cleanup failed');}})()`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const key of ['field','monitor','preventive','integrations']){await evaluate(`document.querySelector('[data-go=${key}]').click()`);assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Mobile overflow: '+key);}
 await evaluate(`document.querySelector('[data-go=field]').click()`);shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('tests/artifacts/operations-field-mobile.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);console.log('Operations browser QA passed: 13 menus, telemetry, import, field report persistence, four mobile layouts.');
}finally{ws.close();}
