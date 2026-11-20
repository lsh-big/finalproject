import {modules,initialData,validateRecord} from './management-schema.js';
import {normalizeOps,applyOps} from './operations-domain.js';
import {normalizeLedger,applyLedger,ledgerActions,guardLedgerEdit,guardLedgerDelete} from './ledger-domain.js';
import {freshCadState,applyCadAction} from './cad-engine.js';
import {applyDocumentAction,documentActions} from './document-domain.js';
export function normalizeManagement(data){data.cad??=freshCadState();data.documentPackages??=[];return normalizeLedger(normalizeOps(data));}
export function freshManagement(){return normalizeManagement(structuredClone(initialData));}
export function mutateManagement(data,input,user,method){
 if(!user||user.role!=='admin')throw Error('등록·수정·삭제는 관리자만 가능합니다.');
 if(!['POST','PATCH','DELETE'].includes(method))throw Error('지원하지 않는 요청입니다.');
 if(input.action){if(method!=='POST')throw Error('POST 요청이 필요합니다.');if(['cad-config','cad-reset','cad-review'].includes(input.action))applyCadAction(data,input,user);else if(ledgerActions.includes(input.action))applyLedger(data,input,user);else if(documentActions.includes(input.action))applyDocumentAction(data,input,user);else applyOps(data,input,user);return data;}
 const {entity,id}=input;if(!Object.hasOwn(modules,entity))throw Error('업무를 확인하세요.');
 const index=data[entity].findIndex(row=>row.id===id);
 if(method!=='POST'&&index<0)throw Error('이미 삭제된 항목입니다. 새로고침하세요.');
 if(method==='DELETE'){
  guardLedgerDelete(data,entity,id);
  if(entity==='products'&&data.documentPackages.some(record=>record.productId===id))throw Error('승인 문서 이력이 있는 제품은 삭제할 수 없습니다.');
  const reference={products:'productId',staff:'staffId',tickets:'recordId',inspections:'recordId'}[entity];
  if(reference&&data.ops.reports.some(r=>r[reference]===id&&(!['tickets','inspections'].includes(entity)||r.kind===entity)))throw Error('현장 조치 기록에서 사용 중입니다. 현장 기록을 먼저 정리하세요.');
  for(const [key,schema] of Object.entries(modules))for(const [field,,type] of schema.fields)if(type===entity&&data[key].some(row=>row[field]===id))throw Error('다른 업무에서 사용 중인 항목입니다. 연결된 기록을 먼저 정리하세요.');
  data[entity].splice(index,1);
 }else{
  const values={...input.record,id:method==='POST'?undefined:id};
  if(entity==='products'&&method==='PATCH'&&!Object.hasOwn(values,'orderNumber'))values.orderNumber=data.products[index].orderNumber;
  const record={...validateRecord(entity,values,data),id:method==='POST'?globalThis.crypto.randomUUID():id};
  if(method==='POST')data[entity].push(record);else{guardLedgerEdit(data,entity,id,record);data[entity][index]={...data[entity][index],...record};}
 }
 return data;
}
