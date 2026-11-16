// Optional real-browser QA. Start local server and an Edge/Chrome instance with
// --headless --no-sandbox --remote-debugging-port=9223 and an isolated profile.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const baseURL=process.env.DEMO_URL||'http://localhost:3000/';
const targets=await fetch('http://localhost:9223/json').then(r=>r.json());
const target=targets.find(t=>t.type==='page'&&t.url.startsWith('http://localhost:'));
assert.ok(target,'Open the local demo in the QA browser first.');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let sequence=0;const pending=new Map(),exceptions=[];
ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timeout);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text+' '+(message.params.exceptionDetails.exception?.description||''));};
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(Error(`Timed out: ${method}`));},10000);pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const text=()=>evaluate('document.querySelector("#content").innerText');
async function screenshot(name){const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await mkdir('tests/artifacts',{recursive:true});await writeFile(`tests/artifacts/${name}.png`,Buffer.from(result.data,'base64'));}

try{
  await send('Runtime.enable');
  const startURL=new URL(baseURL);startURL.searchParams.set('qa',Date.now());startURL.hash='home';
  await send('Page.navigate',{url:startURL.href});
  let ready=false;
  for(let attempt=0;attempt<40&&!ready;attempt++){
    await new Promise(resolve=>setTimeout(resolve,100));
    try{ready=await evaluate('document.readyState!=="loading"&&document.querySelectorAll("#nav button").length===8');}catch{}
  }
  assert.ok(ready,'Application did not finish loading');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await click('[data-page="home"]');
  assert.equal(await evaluate('document.querySelectorAll(".task-card").length'),6);
  assert.equal(await evaluate('document.querySelector("#filterDrawer").hidden'),true);
  await screenshot('home-desktop');
  await click('.hero-start');
  assert.match(await text(),/기술지원 검토 결과/);
  assert.match(await text(),/DEMO-COM-01/);
  assert.ok(await evaluate('document.querySelector("#ai-product").value'));
  await screenshot('support-desktop');
  await click('[data-ai-tab="report"]');
  await click('#ai-report-form button[type="submit"]');
  assert.match(await evaluate('document.querySelector("#report-output").value'),/AS 현장 보고서/);
  await click('[data-ai-tab="patterns"]');
  assert.match(await text(),/증가 기준|제품 수가 부족/);
  await click('[data-ai-tab="overseas"]');
  await click('#ai-overseas-form button[type="submit"]');
  assert.match(await evaluate('document.querySelector("#overseas-output").value'),/Technical support/);
  await screenshot('ai-desktop');
  await click('[data-page="trace"]');
  await click('#example-product');
  assert.equal(await evaluate('document.querySelector("#detail").open'),true);
  await click('#closeDetail');
  await evaluate('document.querySelector("#search").value="NO-SUCH-PRODUCT";document.querySelector("#search").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.match(await text(),/조건에 맞는 제품이 없습니다/);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const page of ['home','overview','quality','trace','service','risk','ai','data']){
    await click(`[data-page="${page}"]`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,`${page}: mobile horizontal overflow`);
  }
  await click('[data-page="home"]');
  await evaluate('window.scrollTo(0,0)');
  await screenshot('home-mobile');
  assert.deepEqual(exceptions,[],'Browser runtime exceptions');
  console.log('PASS: real browser desktop/mobile, 6 task cards, AI answers/reports/tabs, example history, empty search, 8 routes without horizontal overflow.');
}finally{ws.close();}
