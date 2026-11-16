import {metrics} from './data.js';

export function icon(name){
  const paths={home:'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10',chat:'M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM7 10h10M7 14h6',report:'M7 3H4v18h16V3h-3M9 2h6v4H9ZM8 11h8M8 15h8M8 18h5',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',chart:'M3 3v18h19M7 16v-4M12 16V7M17 16v-8',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',check:'m4 12 5 5L20 6',factory:'M3 21V9l6 4V7l6 4V3h5v18ZM7 17h1M12 17h1M17 17h1',tool:'m14 6 4 4M5 20l-2-2L14 7a5 5 0 0 1 6-5l-3 3 2 2 3-3a5 5 0 0 1-5 6Z',alert:'M12 3 2 21h20ZM12 9v5M12 17v1',arrow:'M4 12h16m-6-6 6 6-6 6',data:'M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name]||paths.check).split('~').map(d=>`<path d="${d}"/>`).join('')}</svg>`;
}

const tasks=[
  {icon:'chat',title:'고장 문의 도우미',question:'어디서부터 확인해야 할지 모르겠어요',description:'증상을 입력하면 제품의 지난 AS와 참고 자료를 함께 찾아줍니다.',action:'예시 질문으로 시작',tab:'support',tone:'blue',preview:'증상 입력 → 이력·자료 찾기 → 확인 항목 안내'},
  {icon:'report',title:'AS 보고서 만들기',question:'현장 메모를 보고서로 정리하고 싶어요',description:'메모를 증상·확인·조치·남은 일로 나누고 보고서를 내려받습니다.',action:'샘플 메모로 체험',tab:'report',tone:'violet',preview:'현장 메모 → 보고서 초안 → 수정·다운로드'},
  {icon:'search',title:'제품 이력 찾기',question:'이 제품에 무슨 일이 있었나요?',description:'제조번호로 생산·설치·AS 기록을 한 번에 확인합니다.',action:'제품 목록 보기',page:'trace',tone:'teal',preview:'제품 선택 → 생산·설치·수리 기록 확인'},
  {icon:'tool',title:'아직 끝나지 않은 AS 보기',question:'어떤 접수부터 처리해야 하나요?',description:'처리가 끝나지 않은 접수와 같은 제품의 반복 문의를 확인합니다.',action:'AS 처리 현황 보기',page:'service',tone:'orange',preview:'접수 현황 → 처리 상태 → 제품 상세 이력'},
  {icon:'chart',title:'반복 문제 알아보기',question:'비슷한 문제가 늘고 있나요?',description:'이전 생산분과 비교해 설치 직후 AS가 늘어난 제품 조합을 살펴봅니다.',action:'반복 문제 확인',tab:'patterns',tone:'blue',preview:'이전·최근 비교 → 증가 여부 → 점검할 대상'},
  {icon:'globe',title:'해외 문의 답장 만들기',question:'해외 담당자에게 자료를 요청하고 싶어요',description:'제품 정보가 들어간 영어·중국어·한국어 요청 문안을 만듭니다.',action:'답장 초안 만들기',tab:'overseas',tone:'violet',preview:'언어·문의 선택 → 초안 → 수정·다운로드'},
];

export function homeView(rows){
  const m=metrics(rows),open=m.cases.filter(c=>!c.resolved).length;
  return `<section class="welcome-hero"><div class="welcome-copy"><span class="section-kicker">삼일엘텍 업무 도우미</span><h2>흩어진 제품 기록,<br><em>이제 한곳에서 쉽게.</em></h2><p>제품이 어떻게 만들어졌는지, 어디에 설치됐는지,<br>어떤 AS를 받았는지 연결해서 확인하세요.</p><button class="button primary hero-start" data-ai-action="support">${icon('chat')} 고장 문의 예시 체험하기 ${icon('arrow')}</button><small>처음이라면 이 버튼부터 눌러보세요. 예시 제품이 자동으로 선택됩니다.</small><a class="home-feature-jump" href="#task-start">전체 기능 바로 보기 ↓</a></div><div class="journey-visual" role="img" aria-label="공장 생산, 현장 설치, AS 기록을 제품 제조번호로 연결합니다"><div class="journey-caption">제품 한 대의 이야기를 연결합니다</div><div class="journey-chain"><div>${icon('factory')}<b>공장에서</b><span>생산·검사 기록</span></div><i>→</i><div>${icon('globe')}<b>설치 현장에서</b><span>설치 제품·국가</span></div><i>→</i><div>${icon('tool')}<b>AS 접수까지</b><span>증상·조치 기록</span></div></div><div class="journey-key">${icon('search')} 연결하는 기준 <b>제품 제조번호</b></div><div class="journey-result">${icon('check')} 필요한 기록을 한 번에 확인</div></div></section><div class="demo-explainer"><span class="badge warning">시연용 안내</span><p>실제 회사 자료가 아닌 <b>가상 제품 ${rows.length.toLocaleString('ko-KR')}대</b>로 체험합니다. AI 도우미는 API 없이 검색·규칙·예시 문장으로 작동합니다.</p></div><section class="task-section" id="task-start"><div class="section-heading"><div><span class="section-kicker">하고 싶은 일을 선택하세요</span><h2>어떤 업무를 도와드릴까요?</h2></div><span>버튼을 누르면 해당 기능으로 이동합니다</span></div><div class="task-grid">${tasks.map(t=>`<article class="task-card ${t.tone}"><div class="task-icon">${icon(t.icon)}</div><span class="task-question">${t.question}</span><h3>${t.title}</h3><p>${t.description}</p><div class="task-preview">${t.preview}</div><button class="task-link" ${t.tab?`data-ai-action="${t.tab}"`:`data-go="${t.page}"`}>${t.action} ${icon('arrow')}</button></article>`).join('')}</div></section><section class="home-management"><div class="section-heading"><div><span class="section-kicker">관리자·품질 담당자라면</span><h2>전체 상황도 바로 확인하세요</h2></div></div><div class="management-links"><button data-go="overview"><span class="management-icon">${icon('chart')}</span><span><b>전체 생산·설치 현황</b><small>생산 ${m.total.toLocaleString('ko-KR')}대 · 설치 완료 ${m.installed.toLocaleString('ko-KR')}대</small></span>${icon('arrow')}</button><button data-go="quality"><span class="management-icon">${icon('factory')}</span><span><b>공장·제품 품질 비교</b><small>재작업과 설치 후 AS를 비교합니다</small></span>${icon('arrow')}</button><button data-go="risk"><span class="management-icon">${icon('alert')}</span><span><b>먼저 점검할 제품</b><small>현재 미완료 AS ${open}건 · 점검 대상 확인</small></span>${icon('arrow')}</button></div></section><section class="first-steps"><h2>처음 사용하는 분께</h2><ol><li><b>01</b><div><strong>하고 싶은 일을 고르세요</strong><p>위의 기능 카드나 왼쪽 메뉴에서 시작합니다.</p></div></li><li><b>02</b><div><strong>예시로 먼저 체험하세요</strong><p>제조번호를 몰라도 ‘시연 제품 선택’으로 시작할 수 있습니다.</p></div></li><li><b>03</b><div><strong>결과를 확인하고 활용하세요</strong><p>제품 이력을 열어보거나 작성한 초안을 수정해 내려받습니다.</p></div></li></ol></section>`;
}

const guides={
  overview:{icon:'chart',title:'회사의 생산·설치 상황을 한눈에 보는 곳입니다.',text:'생산한 제품 수, 다시 작업한 제품 비율, 설치 완료 수, 설치 직후 AS 비율을 확인하세요.',steps:['큰 숫자로 전체 상황 확인','그래프로 월별·공장별 비교','제품 이력에서 상세 확인'],action:'제품 이력 찾아보기',page:'trace'},
  quality:{icon:'factory',title:'어떤 생산분을 더 살펴볼지 찾는 곳입니다.',text:'공장과 제품별로 재작업과 설치 후 AS를 비교합니다. 비율만 보지 말고 제품 수도 함께 확인하세요.',steps:['공장·제품별 숫자 비교','제품 수가 충분한지 확인','관련 제품 이력 검토'],action:'관련 제품 찾기',page:'trace'},
  trace:{icon:'search',title:'제품 한 대의 생산부터 AS까지 찾아보세요.',text:'제조번호는 제품 한 대를 구분하는 고유 번호입니다. 번호를 몰라도 예시 제품을 바로 열 수 있습니다.',steps:['번호·모델·국가로 검색','목록의 ‘기록 보기’ 선택','생산·설치·AS 순서로 확인'],action:'예시 제품 기록 열기',example:true},
  service:{icon:'tool',title:'접수된 AS와 아직 남은 일을 확인하세요.',text:'‘미종결’은 처리가 끝나지 않은 접수, ‘종결’은 처리가 끝난 접수입니다. 제조번호를 누르면 이전 기록도 볼 수 있습니다.',steps:['미완료 접수 수 확인','아래 목록에서 상태 확인','제조번호를 눌러 이력 보기'],action:'고장 문의 도우미 열기',tab:'support'},
  risk:{icon:'alert',title:'어떤 제품부터 살펴볼지 순서를 잡아줍니다.',text:'재작업 이력, 미완료 AS, 반복 접수가 있는 제품에 점수를 더합니다. 높은 점수는 먼저 확인할 이유가 많다는 뜻입니다.',steps:['위쪽 제품부터 확인','기록 보기로 이유 확인','담당자가 점검 여부 결정'],action:'예시 제품 기록 열기',example:true},
  data:{icon:'data',title:'회사 자료를 연결하기 전에 구조를 체험하세요.',text:'처음에는 자료를 올리지 않아도 됩니다. 현재 가상 데이터로 모든 기능을 써볼 수 있습니다.',steps:['필요하면 샘플 내려받기','같은 구조의 JSON 파일 선택','검증 후 화면에서 확인'],action:'처음 화면으로 돌아가기',page:'home'},
};

export function pageGuide(page){
  const g=guides[page];if(!g)return '';
  const glossary=['overview','quality','risk','service'].includes(page)?`<details class="plain-glossary"><summary>숫자와 용어가 어렵다면? 쉬운 설명 보기</summary><dl><dt>AS</dt><dd>설치 후 접수된 고장 문의, 점검 또는 조치 기록입니다.</dd><dt>재작업</dt><dd>생산 검사에서 문제가 발견되어 다시 작업한 경우입니다. 최종 출하 실패를 뜻하지는 않습니다.</dd><dt>설치 직후 AS 비율</dt><dd>설치 후 30일 안에 AS가 접수된 제품의 비율입니다. 30일이 모두 지난 제품만 비교합니다. 100대 중 3대면 3%입니다.</dd><dt>미종결 / 미완료</dt><dd>AS 처리가 아직 끝나지 않았다는 뜻입니다. 종결은 처리가 끝났다는 뜻입니다.</dd><dt>점검 점수</dt><dd>재작업·미완료 AS·반복 접수 이력에 따라 더한 점수입니다. 고장 확률이나 안전 등급은 아닙니다.</dd></dl></details>`:'';
  return `<section class="page-guide"><div class="guide-icon">${icon(g.icon)}</div><div class="guide-copy"><h2>${g.title}</h2><p>${g.text}</p><ol>${g.steps.map((s,i)=>`<li><span>${i+1}</span>${s}</li>`).join('')}</ol></div><button class="button" ${g.example?'id="example-product"':g.tab?`data-ai-action="${g.tab}"`:`data-go="${g.page}"`}>${g.action} →</button></section>${glossary}`;
}

export const aiGuides={
  support:['증상을 적으면, 참고할 기록을 찾아줍니다.','예시 제품 선택','질문 입력 또는 예시 선택','답변·참고 자료 확인'],
  report:['현장 메모를 보고서 형태로 정리합니다.','예시 제품 선택','메모 확인·수정 후 작성','초안 수정·다운로드'],
  patterns:['같은 종류의 문제가 늘었는지 비교합니다.','제품 조합별 비율 확인','이전·최근 수치 비교','증가한 경우 담당자 검토'],
  overseas:['해외 담당자에게 보낼 자료 요청 문안을 만듭니다.','예시 제품 선택','문의 유형·언어 선택','초안 수정·다운로드'],
};

export function aiHowTo(tab){const [title,...steps]=aiGuides[tab];return `<section class="ai-howto"><strong>${title}</strong><ol>${steps.map((s,i)=>`<li><span>${i+1}</span>${s}</li>`).join('')}</ol></section>`;}
