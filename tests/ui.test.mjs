import test from 'node:test';
import assert from 'node:assert/strict';

test('all six views, filters, search, pagination and product details execute',async()=>{
  const nodes=new Map();const handlers={};
  const node=(selector)=>{if(!nodes.has(selector))nodes.set(selector,{value:selector==='#period'||selector==='#factory'||selector==='#model'?'all':'',innerHTML:'',textContent:'',selectionStart:0,classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},focus(){},setSelectionRange(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
  globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{handlers[name]=fn;}};
  globalThis.window={scrollTo(){}};
  await import('../public/app.js');
  assert.match(node('#content').innerHTML,/1,800/);
  const nav=key=>handlers.click({target:{id:'',closest:sel=>sel.includes('data-page')?{dataset:{page:key}}:null}});
  for(const key of ['overview','quality','trace','service','risk','data']){nav(key);assert.ok(node('#content').innerHTML.length>500,`${key} renders`);assert.doesNotMatch(node('#content').innerHTML,/NaN|undefined/);}
  nav('trace');handlers.input({target:{id:'search',value:'SE-2026',selectionStart:7}});assert.match(node('#content').innerHTML,/SE-2026/);
  handlers.click({target:{id:'next',closest:()=>null}});assert.match(node('#content').innerHTML,/2 \/ /);
  const {generateData}=await import('../public/data.js');const id=generateData().find(r=>r.cases.length).id;
  handlers.click({target:{id:'',closest:sel=>sel==='[data-id]'?{dataset:{id}}:null}});assert.equal(node('#detail').open,true);assert.match(node('#detailContent').innerHTML,new RegExp(id));assert.match(node('#detailContent').innerHTML,/점검 지표/);
  node('#factory').value='한국 공장';node('#factory').onchange();assert.doesNotMatch(node('#content').innerHTML,/<td>중국 공장<\/td>/);
});
