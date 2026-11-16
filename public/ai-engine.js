import {AS_OF, addDays} from './data.js';

// These are authored demonstration documents, not manufacturer instructions.
export const knowledge = [
  {id:'DEMO-COM-01',title:'통신 문의 접수 체크리스트',version:'시연 v1.0',type:'통신 연결',keywords:['통신','연결','끊김','communication','通信'],checks:['발생 시각·표시 메시지·발생 빈도를 기록합니다.','제어반·인버터 모델과 현장 문서 버전을 확인합니다.','이전 접수의 조치 내용과 재발 여부를 담당자에게 확인합니다.'],request:'발생 당시 메시지, 운행 상태, 최근 작업 여부',scope:'모든 모델 공통 접수용 · 모델별 정비 절차 아님'},
  {id:'DEMO-SET-02',title:'시운전 설정 문의 접수 체크리스트',version:'시연 v1.0',type:'시운전 설정',keywords:['시운전','설정','착상','진동','소음','commission','setting','调试'],checks:['증상 발생 조건과 설치·시운전 일자를 기록합니다.','현재 적용된 설정 문서와 승인 이력을 확보합니다.','변경 이력은 현장 담당자가 확인하고 기술팀에 전달합니다.'],request:'시운전 결과서, 증상 발생 조건, 승인된 설정 이력',scope:'모든 모델 공통 접수용 · 설정값 제공 안 함'},
  {id:'DEMO-DOOR-03',title:'도어 관련 문의 접수 체크리스트',version:'시연 v1.0',type:'도어 인터페이스',keywords:['도어','문이','문 열','문 닫','개폐','door','门'],checks:['발생 층·시점·빈도와 표시 메시지를 기록합니다.','도어 장치 모델과 설치 인수 기록을 확인합니다.','기존 접수와 동일한 증상인지 담당자가 확인합니다.'],request:'발생 층, 도어 장치 모델, 표시 메시지',scope:'모든 모델 공통 접수용 · 안전 회로 조작 안내 아님'},
  {id:'DEMO-PWR-04',title:'전원 관련 문의 접수 체크리스트',version:'시연 v1.0',type:'전원 품질',keywords:['전원','전압','접지','power','voltage','电源'],checks:['발생 시각과 현장 전원 이벤트 기록을 확보합니다.','기록된 측정 결과가 있다면 측정 시점·조건을 확인합니다.','현장 전기 담당자와 품질팀의 검토 요청을 작성합니다.'],request:'현장 전원 기록, 기존 점검 결과, 발생 시각',scope:'모든 모델 공통 접수용 · 전기 작업 지시 아님'},
];

function classify(text){
  const q=text.toLowerCase();
  return knowledge.map(doc=>({doc,matches:doc.keywords.filter(k=>q.includes(k))})).filter(x=>x.matches.length).sort((a,b)=>b.matches.length-a.matches.length);
}

export function findSimilar(rows,product,type){
  return rows.filter(r=>r.id!==product?.id).flatMap(r=>r.cases.filter(c=>!type||c.type===type).map(c=>({product:r,case:c,score:(r.model===product?.model?3:0)+(r.inverter===product?.inverter?2:0)+(c.type===type?4:0),reasons:[r.model===product?.model?'동일 제어반':null,r.inverter===product?.inverter?'동일 인버터':null,c.type===type?'동일 접수 유형':null].filter(Boolean)}))).sort((a,b)=>b.score-a.score||b.case.date.localeCompare(a.case.date)).slice(0,4);
}

export function answerQuestion({question,productId,rows}){
  const q=question.trim();
  if(!q)throw Error('질문을 입력하세요.');
  if(q.length>2000)throw Error('질문은 2,000자 이내로 입력하세요.');
  const product=productId?rows.find(r=>r.id===productId):null;
  if(productId&&!product)throw Error('선택 제품이 조회 범위에 없습니다. 필터 또는 제조번호를 확인하세요.');
  const unsupported=/인증|인증서|정격|적재|속도|사양|specification|certification|参数/.test(q);
  const unsafe=/우회|무력화|강제.*운행|안전.*해제|bypass/i.test(q);
  const matches=classify(q);
  const historyRequest=/이력|요약|반복|미종결|접수|history/.test(q);
  const type=matches[0]?.doc.type;
  const sources=unsafe||unsupported?[]:matches.slice(0,2).map(m=>m.doc);
  const supported=!unsafe&&!unsupported&&(sources.length>0||(product&&historyRequest));
  const cases=product?.cases||[];
  return {
    mode:'로컬 규칙·검색 시연',question:q,product,type,supported,
    summary:unsafe?'요청한 조작 안내는 제공하지 않습니다. 승인된 제조사 절차와 현장 책임자의 검토가 필요합니다.':unsupported?'실제 모델별 사양·인증 문서를 보유하지 않아 답변을 확정할 수 없습니다.':!supported?'질문을 뒷받침할 시연 문서를 찾지 못했습니다. 증상을 구체화하거나 제품을 선택해 이력 요약을 요청하세요.':product?`${product.id}의 등록 AS는 ${cases.length}건이며, 미종결 ${cases.filter(c=>!c.resolved).length}건입니다. ${type?`질문은 ‘${type}’ 접수 유형과 키워드가 일치합니다.`:'선택 제품의 등록 이력을 요약했습니다.'}`:`질문과 일치하는 ‘${type}’ 접수용 참고 자료를 찾았습니다. 제조번호를 선택하면 제품 이력과 함께 확인할 수 있습니다.`,
    facts:product?[`제어반 ${product.model} / 인버터 ${product.inverter}`,`생산 ${product.productionDate} · ${product.factory} · 공급 ${product.country}`,`설치 ${product.installDate||'미완료'} · 재작업 ${product.defective?'있음':'없음'}`]:[],
    history:product?cases:[],sources,
    checks:sources.flatMap(d=>d.checks),
    missing:unsafe?['현장 책임자와 승인된 안전 절차 확인']:unsupported?['제조사가 발행한 해당 모델의 최신 사양서·인증서']:sources.length?sources.map(d=>d.request):['제품 모델, 제조번호, 구체적인 증상과 발생 시각'],
    similar:supported?findSimilar(rows,product,type):[],
    basis:matches.map(x=>`${x.doc.id}: 키워드 ${x.matches.join(', ')}`),
  };
}

export function createReport({product,notes,engineer,date,visitStatus}){
  if(!product)throw Error('보고서를 작성할 제품을 선택하세요.');
  if(!notes.trim())throw Error('현장 메모를 입력하세요.');
  if(notes.length>5000||engineer.length>100)throw Error('메모는 5,000자, 담당자는 100자 이내로 입력하세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(Date.parse(date)).toISOString().slice(0,10)!==date||date<product.productionDate||date>AS_OF)throw Error('작성일은 생산일 이후, 시연 기준일 이내의 유효한 날짜여야 합니다.');
  const types=classify(notes).map(x=>x.doc.type);
  const sections={증상:[],확인:[],조치:[],미결:[]};const unassigned=[];
  for(const line of notes.split(/\n/).map(s=>s.trim()).filter(Boolean)){
    const match=line.match(/^(증상|확인|조치|미결)\s*[:：]\s*(.*)$/);
    if(match&&match[2])sections[match[1]].push(match[2]);else unassigned.push(line);
  }
  const list=values=>values.length?values.map(v=>`- ${v}`).join('\n'):'- 미기재 · 담당자 확인 필요';
  const text=`[가상 데이터 / 담당자 검토 전 초안]\nAS 현장 보고서\n\n제조번호: ${product.id}\n제어반: ${product.model}\n인버터: ${product.inverter}\n공급 국가: ${product.country}\n작성일: ${date}\n작성자: ${engineer.trim()||'미기재'}\n담당자 선택 상태: ${visitStatus==='closed'?'종결 검토 요청':'후속 확인 필요'}\n키워드 분류: ${types.join(', ')||'분류 미정'}\n\n1. 현장 증상\n${list(sections.증상)}\n\n2. 확인 사항\n${list(sections.확인)}\n\n3. 조치 내역\n${list(sections.조치)}\n\n4. 미결 및 후속 확인\n${list(sections.미결)}\n\n5. 원문 보존 / 미분류 메모\n${list(unassigned)}\n\n6. 기존 원장 참고\n- 등록 AS ${product.cases.length}건 / 미종결 ${product.cases.filter(c=>!c.resolved).length}건\n- 보고서 작성은 원장의 AS 상태를 변경하지 않습니다.\n\n본 초안은 입력 내용을 정리한 규칙 기반 시연 결과입니다. 수행하지 않은 작업과 원인은 추정하지 않습니다. 담당자 검토 후 사용하세요.`;
  return {text,types,sections,unassigned,missing:Object.entries(sections).filter(([,v])=>!v.length).map(([k])=>k)};
}

export function detectPatterns(rows){
  // Non-overlapping production cohorts; both receive at least 30 days observation.
  const recent=rows.filter(r=>r.productionDate>='2026-07-01'&&r.productionDate<='2026-09-30'&&r.installDate&&addDays(r.installDate,30)<=AS_OF);
  const baseline=rows.filter(r=>r.productionDate>='2026-04-01'&&r.productionDate<='2026-06-30'&&r.installDate&&addDays(r.installDate,30)<=AS_OF);
  const early=r=>r.cases.some(c=>c.age<=30);
  return [...new Set(rows.map(r=>r.inverter))].map(inverter=>{
    const a=recent.filter(r=>r.inverter===inverter),b=baseline.filter(r=>r.inverter===inverter);
    const count=a.filter(early).length,previous=b.filter(early).length;
    const rate=a.length?count/a.length:null,oldRate=b.length?previous/b.length:null;
    const sufficient=a.length>=20&&b.length>=20;
    const delta=rate!==null&&oldRate!==null?(rate-oldRate)*100:null;
    const alert=sufficient&&count>=3&&delta>=3;
    return {inverter,count,total:a.length,previous,previousTotal:b.length,rate,oldRate,delta,sufficient,alert};
  }).sort((a,b)=>(b.delta??-Infinity)-(a.delta??-Infinity));
}

export function draftOverseas({product,type,language}){
  if(!product)throw Error('제품을 선택하세요.');
  if(!['en','zh','ko'].includes(language)||!knowledge.some(k=>k.type===type))throw Error('언어와 문의 유형을 확인하세요.');
  const labels={'통신 연결':['communication issue','通信问题'],'시운전 설정':['commissioning query','调试咨询'],'도어 인터페이스':['door interface issue','门接口问题'],'전원 품질':['power supply query','电源咨询']};
  const [en,zh]=labels[type];
  if(language==='en')return `[DEMO TEMPLATE — REVIEW BEFORE SENDING]\nSubject: Technical support request / ${product.id}\n\nDear service partner,\nWe have prepared a draft for a ${en} concerning ${product.id} (${product.model} / ${product.inverter}).\nPlease provide the time of occurrence, displayed message, operating conditions, and previous service records.\nWe will review the available information before confirming the cause or corrective action.\nPlease follow approved manufacturer procedures and consult qualified personnel.\n\nThis template is not a diagnosis and has not been sent.`;
  if(language==='zh')return `[演示模板 — 发送前请审核]\n主题：技术支持请求 / ${product.id}\n\n服务合作伙伴您好：\n本草稿涉及 ${product.id}（${product.model} / ${product.inverter}）的${zh}。\n请提供发生时间、显示信息、运行条件和以往维修记录。\n我们将在审核资料后确认后续处理方案，不预先判定原因。\n请遵循制造商批准的程序，并由合格人员处理。\n\n本模板不是诊断结论，尚未发送。`;
  return `[시연 템플릿 — 발송 전 검토]\n제목: 기술지원 자료 요청 / ${product.id}\n\n${product.id} (${product.model} / ${product.inverter})의 ‘${type}’ 문의 검토를 위한 초안입니다.\n발생 시각, 표시 메시지, 운행 조건, 이전 점검 기록을 전달해 주세요.\n자료 검토 후 후속 대응을 확인하며 원인을 사전 확정하지 않습니다.\n승인된 제조사 절차와 유자격 담당자의 검토가 필요합니다.\n\n이 초안은 진단 결과가 아니며 외부로 발송되지 않았습니다.`;
}

// UI depends on this adapter. A future backend provider can implement the same contract.
export const demoProvider={answer:answerQuestion,report:createReport,patterns:detectPatterns,overseas:draftOverseas};
