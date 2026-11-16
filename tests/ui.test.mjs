import test from 'node:test';
import assert from 'node:assert/strict';

test('all views, AI workflows, filters, search and product details execute',async()=>{
  const nodes=new Map();const handlers={};
  const node=(selector)=>{if(!nodes.has(selector))nodes.set(selector,{value:selector==='#period'||selector==='#factory'||selector==='#model'?'all':'',innerHTML:'',textContent:'',selectionStart:0,classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},focus(){},setSelectionRange(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
  globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{handlers[name]=fn;}};
  globalThis.window={scrollTo(){}};
  await import('../public/app.js');
  assert.match(node('#content').innerHTML,/1,800/);
  const nav=key=>handlers.click({target:{id:'',closest:sel=>sel.includes('data-page')?{dataset:{page:key}}:null}});
  assert.match(node('#content').innerHTML,/어떤 업무를 도와드릴까요/);
  assert.equal(node('#filterDrawer').hidden,true);
  for(const key of ['home','overview','quality','trace','service','risk','ai','data']){nav(key);assert.ok(node('#content').innerHTML.length>500,`${key} renders`);assert.doesNotMatch(node('#content').innerHTML,/NaN|undefined/);}
  const {aiState}=await import('../public/ai-workspace.js');
  handlers.click({target:{id:'',closest:sel=>sel==='[data-ai-action]'?{dataset:{aiAction:'support'}}:null}});
  assert.ok(aiState.answer?.sources.length);
  assert.match(node('#content').innerHTML,/기술지원 검토 결과/);
  const submit={preventDefault(){}};
  nav('ai');node('#ai-demo-product').onclick();assert.ok(aiState.productId);
  node('#ai-question').value='通信用途';
  node('#ai-question-form').onsubmit(submit);assert.match(node('#content').innerHTML,/기술지원 검토 결과/);
  node('#ai-question').value='통신 연결 이력을 확인해주세요';
  node('#ai-question-form').onsubmit(submit);assert.match(node('#content').innerHTML,/DEMO-COM-01/);
  assert.match(node('#content').innerHTML,new RegExp(aiState.productId));
  aiState.tab='report';nav('ai');
  node('#report-notes').value='증상: 통신 끊김\n확인: 접수 내역 수령\n현장 추가 회신 대기';node('#report-engineer').value='테스트';node('#report-date').value='2026-10-31';node('#report-status').value='open';
  node('#ai-report-form').onsubmit(submit);assert.ok(aiState.report);assert.match(node('#content').innerHTML,/미분류 메모/);assert.match(node('#content').innerHTML,/현장 추가 회신 대기/);
  aiState.tab='patterns';nav('ai');assert.match(node('#content').innerHTML,/표본|검토 알림/);
  aiState.tab='overseas';nav('ai');node('#overseas-language').value='zh';node('#overseas-type').value='통신 연결';node('#ai-overseas-form').onsubmit(submit);assert.match(node('#content').innerHTML,/演示模板/);
  node('#factory').value='한국 공장';node('#factory').onchange();assert.equal(aiState.answer,null);assert.equal(aiState.report,null);assert.equal(aiState.overseas,null);
  node('#factory').value='all';node('#factory').onchange();
  nav('trace');handlers.input({target:{id:'search',value:'SE-2026',selectionStart:7}});assert.match(node('#content').innerHTML,/SE-2026/);
  handlers.click({target:{id:'next',closest:()=>null}});assert.match(node('#content').innerHTML,/2 \/ /);
  const {generateData}=await import('../public/data.js');const id=generateData().find(r=>r.cases.length).id;
  handlers.click({target:{id:'',closest:sel=>sel==='[data-id]'?{dataset:{id}}:null}});assert.equal(node('#detail').open,true);assert.match(node('#detailContent').innerHTML,new RegExp(id));assert.match(node('#detailContent').innerHTML,/점검 지표/);
  node('#factory').value='한국 공장';node('#factory').onchange();assert.doesNotMatch(node('#content').innerHTML,/<td>중국 공장<\/td>/);
});
