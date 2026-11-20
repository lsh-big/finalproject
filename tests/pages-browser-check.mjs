import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const performance=JSON.parse(await readFile(new URL('../public/performance-public.json',import.meta.url),'utf8'));
const latestYear=performance.years.at(-1);
const targets=await fetch('http://127.0.0.1:9224/json').then(r=>r.json());
const target=targets.find(t=>t.type==='page');assert.ok(target);
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);}
const apiRequests=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/'))apiRequests.push(m.params.request.url);});
try{
 await send('Runtime.enable');await send('Network.enable');await send('Page.navigate',{url:'http://127.0.0.1:3020/finalproject/'});await until('document.querySelectorAll("#nav button").length===15');
 assert.ok(await evaluate('document.querySelector(".notice").innerText.includes("공개 시연")'));
 await evaluate("document.querySelector('[data-go=performance]').click()");
 await until(`document.querySelector('#performance-overview')?.textContent.includes('${latestYear}년')`);
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.industry-table tbody th b'), cell => cell.textContent)"),
  ['삼일엘텍', '대성아이디에스', '마운트지앤디', '대명엘리베이터(울산)']);
 assert.match(await evaluate("document.querySelector('#performance-source').textContent"),/OpenDART.*자료 확인일/);
 const receipt=Object.values(performance.records).find(company=>company[latestYear].receipt)[latestYear].receipt;
 assert.ok(await evaluate(`Array.from(document.querySelectorAll('.industry-table tbody a')).some(link=>new URL(link.href).searchParams.get('rcpNo')==='${receipt}')`));
 const marginAxis=await evaluate("document.querySelector('.industry-bar-axis').textContent");
 const comparisonYear=performance.years[0];
 await evaluate(`document.querySelector('#performance-year').value='${comparisonYear}';document.querySelector('#performance-year').dispatchEvent(new Event('change'))`);
 assert.ok(await evaluate(`document.querySelector('#performance-overview').textContent.includes('${comparisonYear}년')`));
 assert.equal(await evaluate("document.querySelector('.industry-bar-axis').textContent"),marginAxis);
 assert.ok(await evaluate("document.querySelector('#performance-trend').getContext('2d').getImageData(0,0,540,216).data.some(value=>value>0)"));
 await evaluate("document.querySelector('[data-go=documents]').click();document.querySelector('#document-query').value='sl-2026-001';document.querySelector('#document-search').requestSubmit()");
 assert.ok(await evaluate("document.querySelector('#document-results').innerText.includes('등록된 승인본이 없습니다')"));
 await evaluate(`document.querySelector('#document-approval-open').click();
   {const form=document.querySelector('#document-approval-form');for(const [name,value] of Object.entries({revision:'R1',drawing:'https://example.com/example.pdf',changeNote:'가상 승인'}))form.elements[name].value=value;form.requestSubmit();}`);
 await until("document.querySelector('.document-current strong')?.textContent==='R1'");
 assert.equal(await evaluate("document.querySelector('.document-current a').href"),'https://example.com/example.pdf');
 await evaluate(`document.querySelector('.document-attachment').open=true;
   {const form=document.querySelector('.document-attachment-form');form.elements.bom.value='https://example.com/example.csv';form.requestSubmit();}`);
 await until("document.querySelectorAll('.document-current a').length===2");
 for(const key of ['dashboard','customers','products','tickets','inspections','parts','staff','contracts','field','monitor','preventive','integrations']){await evaluate(`document.querySelector('[data-go=${key}]').click()`);assert.ok(await evaluate('document.querySelector("#content").innerHTML.length>300'));}
 await evaluate(`document.querySelector('[data-go=monitor]').click()`);await until('document.querySelectorAll(".device-card").length===3');
 await evaluate(`document.querySelector('[data-go=customers]').click();document.querySelector('#add').click();for(const [key,value] of Object.entries({name:'Pages 저장 검증',building:'가상 시연 건물',address:'가상 주소',contact:'가상 담당',phone:'02-000-0000',status:'상담 중'}))document.querySelector('#fields [name='+key+']').value=value;document.querySelector('#record-form').requestSubmit();`);await until('!document.querySelector("#editor").open');
 await send('Page.reload');await until('document.querySelectorAll("#nav button").length===15');assert.ok(await evaluate('document.querySelector("#content").innerText.includes("Pages 저장 검증")'));
 await evaluate('document.querySelector("#demo-role").click()');await until('document.querySelector("#identity")?.innerText.includes("조회 체험")');assert.equal(await evaluate('!!document.querySelector("#add")'),false);
 await evaluate('document.querySelector("#demo-role").click()');await until('document.querySelector("#identity")?.innerText.includes("관리 체험")');
 await evaluate(`document.querySelector('[data-go=parts]').click();document.querySelector('[data-ledger-action=stock-move][data-record=m1]').click();document.querySelector('#ledger-form [name=quantity]').value='2';document.querySelector('#ledger-form [name=memo]').value='Pages 구매 검증';document.querySelector('#ledger-form').requestSubmit();`);await until('!document.querySelector("#ledger-editor").open');assert.ok(await evaluate('document.querySelector(".ledger-panel").innerText.includes("Pages 구매 검증")'));
 await evaluate(`document.querySelector('[data-go=contracts]').click();document.querySelector('[data-ledger-action=bill-month][data-record=k1]').click();document.querySelector('#ledger-form [name=month]').value='2026-11';document.querySelector('#ledger-form').requestSubmit();`);await until('!document.querySelector("#ledger-editor").open');
 await evaluate(`document.querySelector('[data-ledger-action=receive-payment]').click();document.querySelector('#ledger-form [name=amount]').value='200000';document.querySelector('#ledger-form').requestSubmit();`);await until('!document.querySelector("#ledger-editor").open');assert.ok(await evaluate('document.querySelector(".ledger-panel").innerText.includes("부분 수금")'));
 await evaluate(`document.querySelector('[data-go=dashboard]').click()`);await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await mkdir('tests/artifacts',{recursive:true});let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('tests/artifacts/pages-demo-desktop.png',Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});for(const key of ['dashboard','parts','contracts','field','monitor','integrations','documents','performance']){await evaluate(`document.querySelector('[data-go=${key}]').click()`);assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Mobile overflow '+key);}
 await until("document.querySelectorAll('.industry-company-card').length===4");
 assert.ok(await evaluate("getComputedStyle(document.querySelector('.industry-company-cards')).display==='grid' && getComputedStyle(document.querySelector('#nav')).display==='none'"));
 await evaluate("document.querySelector('#performance-nav-toggle').click()");
 assert.ok(await evaluate("getComputedStyle(document.querySelector('#nav')).display!=='none'"));
 await send('Page.navigate',{url:'http://127.0.0.1:3020/finalproject/login.html'});await until('document.querySelector("main").innerText.includes("시연 시작하기")');assert.equal(await evaluate('!!document.querySelector("#login")'),false);
 await send('Page.navigate',{url:'http://127.0.0.1:3020/finalproject/legacy.html'});await until('document.querySelector("#content").innerText.includes("1,800")');
 await send('Page.navigate',{url:'http://127.0.0.1:3020/finalproject/'});await until('document.querySelectorAll("#nav button").length===15');
 await evaluate(`(async()=>{const {apiFetch}=await import('./client.js');await apiFetch('./api/demo-reset',{method:'POST'});location.reload();})()`);await until('document.querySelectorAll("#nav button").length===15');await evaluate(`document.querySelector('[data-go=customers]').click()`);assert.ok(!await evaluate('document.querySelector("#content").innerText.includes("Pages 저장 검증")'));
 assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);console.log('Pages browser QA passed: project subpath, 15 menus, local persistence, role switch, inventory, billing, legacy/login, reset, mobile, zero backend requests.');
 await send('Browser.close');
}finally{ws.close();}
