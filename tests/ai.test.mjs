import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,createReport,detectPatterns,draftOverseas,findSimilar} from '../public/ai-engine.js';
import {generateData} from '../public/data.js';
const rows=generateData();
const product=rows.find(r=>r.cases.length>1);

test('support grounds facts in selected ledger and links authored demo sources',()=>{
  const a=answerQuestion({question:'통신 연결 문의와 이전 접수 이력',productId:product.id,rows});
  assert.equal(a.supported,true);assert.equal(a.product.id,product.id);assert.deepEqual(a.history,product.cases);
  assert.equal(a.sources[0].id,'DEMO-COM-01');assert.ok(a.summary.includes(String(product.cases.length)));
  assert.ok(a.similar.every(s=>s.product.id!==product.id&&s.case.type==='통신 연결'));
});
test('unknown questions and unavailable specifications do not invent answers',()=>{
  for(const question of ['오늘 식당 메뉴 문의','정격 속도와 통신 사양','안전 회로 우회 방법']){
    const a=answerQuestion({question,productId:product.id,rows});assert.equal(a.supported,false);assert.equal(a.sources.length,0);assert.equal(a.similar.length,0);
  }
  assert.throws(()=>answerQuestion({question:'통신',productId:'missing',rows}));
  assert.throws(()=>answerQuestion({question:' ',rows}));
});
test('history-only questions work without fabricating document citations',()=>{
  const a=answerQuestion({question:'이력 요약',productId:product.id,rows});assert.equal(a.supported,true);assert.equal(a.sources.length,0);assert.deepEqual(a.history,product.cases);
});
test('reports preserve unclassified text and never infer repairs or resolution',()=>{
  const input={product,notes:'증상: 통신 끊김\n현장 전화 기록만 수령',engineer:'담당자',date:'2026-10-31',visitStatus:'open'};
  const r=createReport(input);assert.deepEqual(r.sections.증상,['통신 끊김']);assert.deepEqual(r.unassigned,['현장 전화 기록만 수령']);assert.ok(r.missing.includes('조치'));assert.match(r.text,/미기재/);assert.equal(product.cases.length,rows.find(x=>x.id===product.id).cases.length);
  assert.throws(()=>createReport({...input,date:'2026-02-30'}));assert.throws(()=>createReport({...input,date:'2027-01-01'}));assert.throws(()=>createReport({...input,product:null}));
});
test('alerts use disjoint cohorts, product counts and explicit sample thresholds',()=>{
  const cohort=(prefix,date,count)=>Array.from({length:30},(_,i)=>({...product,id:`${prefix}-${i}`,productionDate:date,installDate:date,cases:i<count?[{age:5},{age:9}]:[]}));
  const result=detectPatterns([...cohort('old','2026-05-01',1),...cohort('new','2026-08-01',5)])[0];
  assert.equal(result.total,30);assert.equal(result.count,5);assert.equal(result.previous,1);assert.equal(result.alert,true);
  assert.equal(detectPatterns(cohort('small','2026-08-01',5).slice(0,10))[0].sufficient,false);
});
test('overseas templates support all three languages without mutating product records',()=>{
  for(const language of ['en','zh','ko']){const result=draftOverseas({product,type:'통신 연결',language});assert.ok(result.includes(product.id));assert.ok(result.includes(product.model));assert.ok(result.length>150);}
  assert.throws(()=>draftOverseas({product,type:'unknown',language:'en'}));
  assert.ok(findSimilar([],product,'통신 연결').length===0);
});
