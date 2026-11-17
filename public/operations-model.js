export const extraPages={
 field:{title:'MMS 모바일 현장 업무',short:'MMS 현장 업무',icon:'▯',description:'현장 정보 조회부터 점검표와 조치 기록까지 한 번에 처리하세요.'},
 monitor:{title:'실시간 상태 모니터링',short:'실시간 관제',icon:'◉',description:'승강기별 상태와 수신 정보를 확인하고 고장 접수로 연결하세요.'},
 preventive:{title:'고장 분석 및 예방 정비',short:'분석·예방 정비',icon:'⌁',description:'접수 이력과 점검 일정에 근거한 점검 대상을 확인하세요.'},
 integrations:{title:'외부 시스템 연계',short:'시스템 연계',icon:'⇄',description:'ERP·HRTS·고객센터·MAX의 연계 준비와 수동 데이터 반영을 관리하세요.'}
};
export const fieldChecks=[['door','출입문 상태'],['level','층 정지 상태'],['button','버튼·표시기'],['lighting','조명 상태'],['communication','현장 통신 상태']];
export function preventiveItems(data,today){
 const end=Date.parse(today+'T23:59:59+09:00'),start=end-90*86400000;
 return data.products.flatMap(product=>{
  const recent=data.tickets.filter(t=>t.productId===product.id&&Date.parse(t.date+'T12:00:00+09:00')>=start&&Date.parse(t.date+'T12:00:00+09:00')<=end);
  const open=recent.filter(t=>t.status!=='완료');const overdue=data.inspections.filter(i=>i.productId===product.id&&i.status!=='완료'&&i.date<today);
  const reasons=[];if(product.status==='운행 중지')reasons.push('등록 상태: 운행 중지');if(recent.length>=2)reasons.push('최근 90일 AS '+recent.length+'건');if(overdue.length)reasons.push('예정일 경과 점검 '+overdue.length+'건');if(open.some(t=>t.priority==='긴급'))reasons.push('미완료 긴급 AS');
  return reasons.length?[{product,reasons,priority:product.status==='운행 중지'||open.some(t=>t.priority==='긴급')?'우선 확인':'점검 권장',recent:recent.length,open:open.length,overdue:overdue.length}]:[];
 }).sort((a,b)=>(b.priority==='우선 확인')-(a.priority==='우선 확인')||b.reasons.length-a.reasons.length);
}
