import {modules,validateRecord} from './management-schema.js';
const randomUUID=()=>globalThis.crypto.randomUUID();
export const checklistItems=['door','level','button','lighting','communication'];
export function normalizeOps(data){data.ops??={};data.ops.reports??=[];data.ops.imports??=[];return data;}
export function telemetry(data,now=Date.now()){
 return {source:'simulation',generatedAt:new Date(now).toISOString(),intervalSeconds:10,devices:data.products.map((p,i)=>{
  const phase=Math.floor(now/10000)+i;const disconnected=i%4===2;
  return {productId:p.id,connected:!disconnected,floor:disconnected?null:1+phase%Math.max(1,p.floors),direction:disconnected?'수신 중단':phase%2?'상행':'하행',temperature:disconnected?null:i%4===1?68+phase%3:38+phase%5,vibration:disconnected?null:Number((0.8+(phase%7)/10).toFixed(1)),door:disconnected?'미확인':phase%3===0?'열림':'닫힘',alert:disconnected?'통신 수신 중단':i%4===1?'온도 확인 필요':'정상',observedAt:new Date(now-(disconnected?600000:0)).toISOString()};})};
}
export function applyOps(data,input,user){
 normalizeOps(data);
 if(input.action==='field-report'){
  const {productId,staffId,kind,recordId,checks,notes,photos=[]}=input;
  if(!data.products.some(p=>p.id===productId)||!data.staff.some(p=>p.id===staffId))throw Error('제품과 담당 기사를 확인하세요.');
  if(!['tickets','inspections'].includes(kind))throw Error('업무 종류를 확인하세요.');
  const record=data[kind].find(r=>r.id===recordId&&r.productId===productId);if(!record)throw Error('연결할 AS 또는 점검 기록을 확인하세요.');
  if(!checks||checklistItems.some(key=>!['양호','확인 필요','해당 없음'].includes(checks[key])))throw Error('모든 현장 확인 항목을 작성하세요.');
  if(typeof notes!=='string'||!notes.trim()||notes.length>2000)throw Error('조치 내용은 1~2000자로 입력하세요.');
  if(!Array.isArray(photos)||photos.length>2||photos.some(p=>typeof p!=='string'||p.length>700000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p)))throw Error('사진은 JPEG·PNG·WebP 형식으로 2장, 장당 500KB 이하로 첨부하세요.');
  if(input.complete===true&&checklistItems.some(key=>checks[key]==='확인 필요'))throw Error('확인 필요 항목이 남아 있습니다. 조치 기록만 저장하거나 확인 결과를 갱신하세요.');
  const report={id:randomUUID(),productId,staffId,kind,recordId,checks:Object.fromEntries(checklistItems.map(k=>[k,checks[k]])),notes:notes.trim(),photos,createdAt:new Date().toISOString(),createdBy:user.username,complete:input.complete===true};
  data.ops.reports.unshift(report);record.staffId=staffId;if(kind==='tickets')record.notes=notes.trim();else record.result=notes.trim();record.status=input.complete===true?'완료':'진행 중';if(kind==='tickets'&&!input.complete)record.status='처리 중';return;
 }
 if(input.action==='delete-report'){
  const index=data.ops.reports.findIndex(r=>r.id===input.id);if(index<0)throw Error('현장 기록을 찾을 수 없습니다.');data.ops.reports.splice(index,1);return;
 }
 if(input.action==='import'){
  const {system,entity,records}=input;if(!['ERP','HRTS','고객센터','MAX'].includes(system))throw Error('연계 시스템을 확인하세요.');
  const allowed={ERP:['customers','products','parts','contracts'],HRTS:['tickets'],'고객센터':['tickets'],MAX:['tickets']};
  if(!allowed[system].includes(entity)||!Array.isArray(records)||!records.length||records.length>100)throw Error('지원 업무와 1~100건의 데이터를 확인하세요.');
  for(const item of records){const record={...validateRecord(entity,{...item,id:undefined},data),id:randomUUID()};data[entity].push(record);}
  data.ops.imports.unshift({id:randomUUID(),system,entity,count:records.length,createdAt:new Date().toISOString(),createdBy:user.username,mode:'manual'});return;
 }
 throw Error('지원하지 않는 작업입니다.');
}

