import {demoProvider,knowledge} from './ai-engine.js';
import {AS_OF} from './data.js';
import {aiHowTo} from './easy-ui.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=value=>value===null?'—':`${(value*100).toFixed(1)}%`;
const tabs=[['support','✦','고장 문의하기','증상에 맞는 기록·자료 찾기'],['report','▤','보고서 만들기','현장 메모를 보고서로 정리'],['patterns','⌁','반복 문제 확인','이전보다 AS가 늘었는지 비교'],['overseas','◎','해외 답장 만들기','영어·중국어 요청 문안 작성']];
const samples=[['통신 문의','통신 연결이 간헐적으로 끊깁니다. 이전 접수와 참고할 자료를 찾아주세요.'],['제품 이력','이 제품의 AS 이력을 요약하고 반복 접수와 미완료 내용을 알려주세요.'],['도어 문의','도어 개폐 관련 문의입니다. 어떤 정보를 추가로 확인해야 하나요?'],['근거 부족','이 모델의 정격 속도와 인증 번호를 알려주세요.']];
export const aiState={tab:'support',productId:'',question:'',answer:null,report:null,reportForm:{notes:'증상: 간헐적으로 통신 관련 메시지가 표시됨\n확인: 현장 담당자로부터 발생 시각과 이전 점검 기록 수령\n조치: 기술팀에 로그 검토 요청\n미결: 현장 재확인 일정 협의 필요',engineer:'시연 담당자',date:AS_OF,visitStatus:'open'},overseas:null,language:'en',type:'통신 연결'};

function productSelect(rows){
  return `<label class="ai-field">어떤 제품을 살펴볼까요?<select id="ai-product"><option value="">번호를 몰라도 ‘예시 제품 자동 선택’으로 시작하세요</option>${rows.map(r=>`<option value="${escape(r.id)}" ${r.id===aiState.productId?'selected':''}>${escape(r.id)} · ${escape(r.model)} · AS ${r.cases.length}건</option>`).join('')}</select></label>`;
}

function answerMarkup(result){
  if(!result)return `<div class="ai-welcome"><div class="ai-orb">✦</div><h2>현장 기록과 문서를 함께 찾는 기술지원</h2><p>제품을 선택하고 질문하거나 아래 예시를 눌러보세요.<br>근거 문서, 유사 AS 이력, 추가 확인 항목을 함께 보여줍니다.</p><div class="sample-grid">${samples.map(([label,q],i)=>`<button class="ai-sample" data-ai-sample="${i}"><b>${label} →</b><span>${escape(q)}</span></button>`).join('')}</div></div>`;
  return `<article class="ai-answer"><div class="ai-answer-heading"><span class="ai-orb small">✦</span><div><strong>기술지원 검토 결과</strong><small>${escape(result.mode)} · ${result.supported?'참고 자료 찾음':'답변 범위 제한'}</small></div><span class="badge ${result.supported?'success':'warning'}">${result.supported?'참고자료 있음':'추가 확인 필요'}</span></div><div class="ai-question">${escape(result.question)}</div><p class="ai-summary">${escape(result.summary)}</p>${result.facts.length?`<h3>제품 기록에서 확인한 제품 정보</h3><ul>${result.facts.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>`:''}${result.product?`<h3>해당 제품 AS 이력</h3><div class="ai-history">${result.history.map(c=>`<div><b>${escape(c.date)} · ${escape(c.type)}</b><span>${escape(c.action)} · ${c.resolved?'종결':'미완료'}</span></div>`).join('')||'<p>등록된 AS 이력이 없습니다. 무고장을 보증하는 의미는 아닙니다.</p>'}</div><button class="table-link" data-id="${escape(result.product.id)}">전체 제품 이력 열기 →</button>`:''}${result.checks.length?`<h3>담당자에게 전달할 확인 항목</h3><ol>${result.checks.map(s=>`<li>${escape(s)}</li>`).join('')}</ol>`:''}<h3>추가로 필요한 정보</h3><ul>${result.missing.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><div class="ai-review-note">원인 확정·설정 변경·안전 판단은 수행하지 않습니다. 승인된 자료와 현장 담당자의 확인을 거쳐 사용하세요.</div><details><summary>검색 근거 및 동작 방식</summary><p>질문 키워드와 접수 유형을 규칙으로 연결합니다. 의미 이해 모델이나 확률 기반 신뢰도가 아닙니다.</p>${result.basis.map(s=>`<p>${escape(s)}</p>`).join('')}<p>등록 이력: ${result.product?escape(result.product.id):'제품 미선택'} · 기준일 ${AS_OF}</p></details></article>`;
}

function sourcesMarkup(result){
  if(!result)return `<section class="ai-side-card"><h3>어떤 자료를 참고하나요?</h3><p>제조사 공식 문서가 아닌 자체 작성 가상 접수 체크리스트입니다.</p>${knowledge.map(d=>`<details><summary>${escape(d.title)}</summary><p>${escape(d.id)} · ${escape(d.version)}</p><ul>${d.checks.map(c=>`<li>${escape(c)}</li>`).join('')}</ul><p>${escape(d.scope)}</p></details>`).join('')}</section>`;
  return `<section class="ai-side-card"><h3>연결된 문서 ${result.sources.length}건</h3>${result.sources.map(d=>`<details open><summary>${escape(d.title)}</summary><p>${escape(d.id)} · ${escape(d.version)}</p><ul>${d.checks.map(c=>`<li>${escape(c)}</li>`).join('')}</ul><p>${escape(d.scope)}</p><span class="badge warning">가상 문서</span></details>`).join('')||'<p>인용 가능한 시연 문서가 없습니다.</p>'}</section><section class="ai-side-card"><h3>유사 접수 사례 ${result.similar.length}건</h3><p>유형·모델·인버터 일치 기준 정렬. 유사 사례의 조치가 현재 제품의 해법을 보장하지 않습니다.</p>${result.similar.map(s=>`<article class="similar-case"><button class="table-link" data-id="${escape(s.product.id)}">${escape(s.product.id)} →</button><b>${escape(s.case.type)} · ${escape(s.case.date)}</b><p>${escape(s.case.action)} · ${s.case.resolved?'종결':'미완료'}</p><small>${escape(s.reasons.join(' · ')||'접수일 기준 참고 사례')}</small></article>`).join('')||'<p>조회 범위에서 사례를 찾지 못했습니다.</p>'}</section>`;
}

function support(rows){return `<div class="ai-work-grid"><section class="panel ai-conversation">${answerMarkup(aiState.answer)}<form id="ai-question-form" class="ai-composer"><label for="ai-question">② 증상을 적거나 예시 질문을 골라주세요</label><textarea id="ai-question" maxlength="2000" rows="3" placeholder="예: 선택 제품의 통신 관련 AS 이력과 추가 확인 항목을 알려줘">${escape(aiState.question)}</textarea><div><small>외부 전송 없음 · 키워드 검색 + 원장 집계</small><button class="button primary" type="submit">③ 참고할 기록과 자료 찾기</button></div><p class="ai-error" id="ai-error" role="status"></p></form></section><aside>${sourcesMarkup(aiState.answer)}</aside></div>`;}

function reportView(){const form=aiState.reportForm;return `<div class="ai-work-grid"><section class="panel"><div class="panel-heading"><h2>② 현장 메모를 확인하고 보고서를 만드세요</h2><p>‘증상:’, ‘확인:’, ‘조치:’, ‘미결:’로 시작하는 줄을 해당 항목에 정리합니다.</p></div><form id="ai-report-form" class="ai-form"><div class="ai-two-fields"><label class="ai-field">작성 담당자<input id="report-engineer" maxlength="100" value="${escape(form.engineer)}"></label><label class="ai-field">작성일<input id="report-date" type="date" max="${AS_OF}" value="${escape(form.date)}" required></label></div><label class="ai-field">현장 메모<textarea id="report-notes" maxlength="5000" rows="9" required>${escape(form.notes)}</textarea></label><label class="ai-field">담당자 선택 상태<select id="report-status"><option value="open" ${form.visitStatus==='open'?'selected':''}>후속 확인 필요</option><option value="closed" ${form.visitStatus==='closed'?'selected':''}>종결 검토 요청</option></select></label><div class="ai-form-actions"><button class="button primary" type="submit">③ 메모를 보고서로 정리하기</button><button class="button" type="button" id="report-reset">시연 메모 채우기</button></div><p id="ai-error" class="ai-error" role="status"></p></form><div class="note">음성 인식·자동 번역·생성형 모델은 연결하지 않았습니다. 분류하지 못한 문장은 원문 보존 항목에 남깁니다.</div></section><section class="panel"><div class="panel-heading"><h2>검토용 보고서 초안</h2><p>작성 결과를 편집한 후 텍스트로 내려받을 수 있습니다.</p></div>${aiState.report?`<div class="ai-form"><div class="ai-review-note">미기재 항목: ${escape(aiState.report.missing.join(', ')||'없음')} · 입력 내용의 사실 여부는 담당자가 검토해야 합니다.</div><textarea id="report-output" class="ai-output" rows="24" aria-label="편집 가능한 보고서 초안">${escape(aiState.report.text)}</textarea><button class="button primary" id="report-download">↓ 편집한 보고서 다운로드</button></div>`:'<div class="ai-empty">제품을 선택하고 현장 메모를 정리하면<br>여기에 검토용 보고서가 표시됩니다.</div>'}</section></div>`;}

function patternsView(rows){const signals=demoProvider.patterns(rows);return `<div class="method-banner"><strong>단순 증가 규칙으로 조기 경보 흐름을 시연합니다.</strong><p>최근 생산분 2026.07—09와 이전 생산분 2026.04—06의 설치 초기 AS율을 비교합니다. 각 제품은 설치 후 30일 관찰이 완료되어야 합니다. 두 집단 각 20대 이상 · 최근 AS 제품 3대 이상 · 3%p 이상 증가 시 ‘검토 알림’입니다.</p></div><div class="ai-signal-grid">${signals.map(s=>`<article class="panel signal-card"><div class="signal-heading"><h3>${escape(s.inverter)}</h3><span class="badge ${s.alert?'warning':s.sufficient?'success':''}">${s.alert?'검토 알림':s.sufficient?'설정한 증가 기준에 해당 없음':'비교할 제품 수가 부족함'}</span></div><div class="signal-rate">${percent(s.rate)}<small>최근 생산분 초기 AS율</small></div><div class="signal-comparison"><div><span>최근 생산분</span><b>${s.count} / ${s.total}대</b></div><div><span>이전 생산분</span><b>${s.previous} / ${s.previousTotal}대 · ${percent(s.oldRate)}</b></div><div><span>차이</span><b>${s.delta===null?'—':`${s.delta>=0?'+':''}${s.delta.toFixed(1)}%p`}</b></div></div><p>${s.alert?'해당 조합의 접수 내용과 생산·설치 조건을 우선 확인하세요.':s.sufficient?'현재 설정한 증가 알림 기준에 해당하지 않습니다.':'필터를 넓히거나 더 많은 관찰 이력을 확보하세요.'}</p></article>`).join('')||'<div class="ai-empty">분석할 제품이 없습니다.</div>'}</div><section class="panel"><div class="panel-heading"><h2>알림 후의 업무 흐름</h2><p>알림은 불량 원인 확정이나 통계적으로 확정된 결과을 의미하지 않습니다.</p></div><div class="roadmap"><article><span>01</span><h3>기록 검증</h3><p>접수 누락·분류 오류와 중복 제조번호를 확인합니다.</p></article><article><span>02</span><h3>조건 비교</h3><p>공장·제품 구성·국가·설치 조건의 차이를 검토합니다.</p></article><article><span>03</span><h3>담당자 조사</h3><p>품질 담당자가 원인 후보를 검증하고 확인된 내용만 공유합니다.</p></article><article><span>04</span><h3>개선 후 평가</h3><p>후속 생산분에서 같은 지표를 추적하고 효과를 검증합니다.</p></article></div></section>`;}

function overseasView(){return `<div class="ai-work-grid"><section class="panel"><div class="panel-heading"><h2>해외 기술문의 답변 초안</h2><p>검토된 고정 문장을 선택 언어로 구성하는 템플릿 시연입니다. 자유 입력 번역은 아닙니다.</p></div><form id="ai-overseas-form" class="ai-form"><label class="ai-field">문의 유형<select id="overseas-type">${knowledge.map(d=>`<option ${aiState.type===d.type?'selected':''}>${escape(d.type)}</option>`).join('')}</select></label><label class="ai-field">초안 언어<select id="overseas-language"><option value="en" ${aiState.language==='en'?'selected':''}>English · 영어</option><option value="zh" ${aiState.language==='zh'?'selected':''}>简体中文 · 중국어</option><option value="ko" ${aiState.language==='ko'?'selected':''}>한국어</option></select></label><div class="note">제조번호·모델과 추가 요청 자료를 포함합니다. 원인이나 수행하지 않은 조치를 확정하지 않으며 이메일은 발송하지 않습니다.</div><button class="button primary" type="submit">문의 대응 초안 만들기</button><p id="ai-error" class="ai-error" role="status"></p></form></section><section class="panel"><div class="panel-heading"><h2>발송 전 검토용 초안</h2><p>담당자가 편집·검토한 뒤 별도 업무 도구에서 사용하세요.</p></div>${aiState.overseas?`<div class="ai-form"><textarea id="overseas-output" class="ai-output" rows="18" aria-label="편집 가능한 해외 문의 초안">${escape(aiState.overseas)}</textarea><button class="button primary" id="overseas-download">↓ 편집한 초안 다운로드</button></div>`:'<div class="ai-empty">제품과 언어를 선택하면<br>기술지원 자료 요청 초안을 작성합니다.</div>'}</section></div>`;}

export function renderAI(rows){
  if(aiState.productId&&!rows.some(r=>r.id===aiState.productId)){aiState.productId='';clearResults();}
  const selected=rows.find(r=>r.id===aiState.productId);
  return `<section class="ai-hero"><div><div class="eyebrow">어려운 업무, 예시로 먼저 체험해보세요</div><h2>무엇을 도와드릴까요?</h2><p>아래에서 필요한 일을 고르세요. 각 기능마다 사용 순서를 안내해드립니다.</p></div><div class="ai-mode"><span class="pulse"></span> 외부 AI 연결 전 시연<small>가상 자료와 검색·규칙으로 동작합니다</small></div></section><div class="ai-tabs" role="tablist" aria-label="도움받을 업무 선택">${tabs.map(([id,icon,label,desc])=>`<button role="tab" aria-selected="${aiState.tab===id}" data-ai-tab="${id}" class="${aiState.tab===id?'active':''}"><b>${icon} ${label}</b><small>${desc}</small></button>`).join('')}</div>${aiHowTo(aiState.tab)}${aiState.tab==='patterns'?'':`<div class="ai-context">${productSelect(rows)}<button class="button ${selected?'':'primary'}" id="ai-demo-product">${selected?'다른 예시 제품 고르기':'① 예시 제품 자동 선택'}</button><div><span class="badge ${selected?'success':'warning'}">${selected?'✓ 제품 선택 완료':'먼저 제품을 선택하세요'}</span><p>${selected?'이 제품의 기록으로 아래 작업을 진행합니다.':'제조번호를 몰라도 자동 선택으로 체험할 수 있습니다.'}</p></div></div>`}${({support,report:reportView,patterns:patternsView,overseas:overseasView}[aiState.tab])(rows)}<details class="ai-technical-details"><summary>시연 방식과 실제 AI 도입 안내</summary><p>현재는 외부 AI에 연결되지 않았으며 질문과 자료는 브라우저 안에서 검색·규칙·예시 문장으로 처리합니다. 참고 문서는 자체 작성한 가상 자료입니다. 실제 도입 시 회사 문서 검증, 서버 측 AI 연결, 사용자 권한과 답변 평가를 추가해야 합니다.</p></details>`;
}

function clearResults(){aiState.answer=null;aiState.report=null;aiState.overseas=null;}
export function invalidateAI(){clearResults();}
export function startAIExperience(tab,rows){
  aiState.tab=tab;
  aiState.productId=[...rows].sort((a,b)=>b.cases.length-a.cases.length)[0]?.id||'';
  clearResults();
  if(tab==='support'){
    aiState.question=samples[0][1];
    aiState.answer=demoProvider.answer({question:aiState.question,productId:aiState.productId,rows});
  }
}
export function bindAI({rows,rerender,download}){
  const $=s=>document.querySelector(s);
  const saveDrafts=()=>{
    if(aiState.tab==='support')aiState.question=$('#ai-question').value;
    if(aiState.tab==='report'){aiState.reportForm={notes:$('#report-notes').value,engineer:$('#report-engineer').value,date:$('#report-date').value,visitStatus:$('#report-status').value};if(aiState.report)aiState.report.text=$('#report-output').value;}
    if(aiState.tab==='overseas'){aiState.language=$('#overseas-language').value;aiState.type=$('#overseas-type').value;if(aiState.overseas)aiState.overseas=$('#overseas-output').value;}
  };
  document.querySelectorAll('[data-ai-tab]').forEach(button=>button.onclick=()=>{saveDrafts();aiState.tab=button.dataset.aiTab;rerender();});
  if(aiState.tab!=='patterns')$('#ai-demo-product').onclick=()=>{saveDrafts();const candidates=[...rows].sort((a,b)=>b.cases.length-a.cases.length);const current=candidates.findIndex(r=>r.id===aiState.productId);const selected=candidates[(current+1)%Math.max(1,candidates.length)];aiState.productId=selected?.id||'';clearResults();rerender();};
  if(aiState.tab!=='patterns')$('#ai-product').onchange=e=>{saveDrafts();aiState.productId=e.target.value;clearResults();rerender();};
  const attempt=fn=>{try{fn();rerender();}catch(error){$('#ai-error').textContent=error.message;}};
  const product=()=>rows.find(r=>r.id===aiState.productId);
  if(aiState.tab==='support'){
    $('#ai-question').oninput=e=>{aiState.question=e.target.value;};
    $('#ai-question-form').onsubmit=e=>{e.preventDefault();saveDrafts();attempt(()=>{aiState.answer=demoProvider.answer({question:aiState.question,productId:aiState.productId,rows});});};
    document.querySelectorAll('[data-ai-sample]').forEach(button=>button.onclick=()=>{aiState.question=samples[Number(button.dataset.aiSample)][1];attempt(()=>{aiState.answer=demoProvider.answer({question:aiState.question,productId:aiState.productId,rows});});});
  }
  if(aiState.tab==='report'){
    for(const [id,key] of [['report-notes','notes'],['report-engineer','engineer'],['report-date','date'],['report-status','visitStatus']])$('#'+id).oninput=e=>{aiState.reportForm[key]=e.target.value;};
    if(aiState.report)$('#report-output').oninput=e=>{aiState.report.text=e.target.value;};
    $('#ai-report-form').onsubmit=e=>{e.preventDefault();saveDrafts();attempt(()=>{aiState.report=demoProvider.report({product:product(),...aiState.reportForm});});};
    $('#report-reset').onclick=()=>{aiState.reportForm.notes='증상: 간헐적으로 통신 관련 메시지가 표시됨\n확인: 현장 담당자로부터 발생 시각과 이전 점검 기록 수령\n조치: 기술팀에 로그 검토 요청\n미결: 현장 재확인 일정 협의 필요';aiState.report=null;rerender();};
    if(aiState.report)$('#report-download').onclick=()=>download(`AS-draft-${product().id}.txt`,$('#report-output').value,'text/plain;charset=utf-8');
  }
  if(aiState.tab==='overseas'){
    for(const [id,key] of [['overseas-language','language'],['overseas-type','type']])$('#'+id).onchange=e=>{aiState[key]=e.target.value;aiState.overseas=null;rerender();};
    if(aiState.overseas)$('#overseas-output').oninput=e=>{aiState.overseas=e.target.value;};
    $('#ai-overseas-form').onsubmit=e=>{e.preventDefault();saveDrafts();attempt(()=>{aiState.overseas=demoProvider.overseas({product:product(),type:aiState.type,language:aiState.language});});};
    if(aiState.overseas)$('#overseas-download').onclick=()=>download(`support-draft-${product().id}-${aiState.language}.txt`,$('#overseas-output').value,'text/plain;charset=utf-8');
  }
}
