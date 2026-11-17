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
 assert.equal(await evaluate('document.querySelectorAll(".kpi").length'),4);
 for(const key of ['customers','products','tickets','inspections','parts','staff','contracts']){
  await evaluate(`document.querySelector('[data-go=${key}]').click()`);
  assert.ok(await evaluate('document.querySelectorAll("tbody tr").length>0'));
  await evaluate('document.querySelector("#add").click()');assert.equal(await evaluate('document.querySelector("#editor").open'),true);
  assert.ok(await evaluate('document.querySelectorAll("#fields input,#fields select,#fields textarea").length>=5'));
  await evaluate('document.querySelector("#cancel-editor").click()');
 }
 await evaluate(`document.querySelector('[data-go=customers]').click();document.querySelector('#add').click();`);
 await evaluate(`for(const [key,v] of Object.entries({name:'브라우저 검증 고객',building:'검증 건물',address:'서울 검증 주소',contact:'테스트 담당',phone:'02-000-9999',status:'관리 중'}))document.querySelector('[name='+key+']').value=v;document.querySelector('#record-form').requestSubmit();`);
 await until('!document.querySelector("#editor").open');assert.ok(await evaluate('document.querySelector("#content").innerText.includes("브라우저 검증 고객")'));
 await evaluate(`const row=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('브라우저 검증 고객'));row.querySelector('[data-delete]').click();document.querySelector('#accept-delete').click();`);
 await until('!document.querySelector("#confirm").open');
 await evaluate(`document.querySelector('[data-go=dashboard]').click()`);await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1120,deviceScaleFactor:1,mobile:false});
 await mkdir('tests/artifacts',{recursive:true});let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('tests/artifacts/management-desktop.png',Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'mobile page should not overflow');
 shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('tests/artifacts/management-mobile.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);console.log('Browser QA passed: 8 menus, 7 forms, create/delete, desktop/mobile, no runtime errors.');
}finally{ws.close();}
