import {cadExample,defaultCadRules,exampleExternalBom} from './cad-example.js';
const fields=['deviceNumber','partNumber','spec','quantity','siteName','drawingNumber'];
export const cadLabels={deviceNumber:'기기번호',partNumber:'품번',spec:'규격',quantity:'수량',siteName:'현장명',drawingNumber:'도면번호'};
export const objectKey=o=>JSON.stringify([o.fileId,o.handle]);
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const string=(v,label,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error(label+'을 확인하세요.');return v;};
export function validateCadDataset(value){
 if(value?.schemaVersion!==1||!Array.isArray(value.files)||!value.files.length||value.files.length>50||!Array.isArray(value.objects)||value.objects.length>10000)throw Error('schemaVersion 1, 도면 1~50개와 객체 최대 10,000개의 JSON이 필요합니다.');
 const files=value.files.map(f=>{if(!f||!Array.isArray(f.layouts)||!f.layouts.length||f.layouts.length>100)throw Error('파일별 검사할 배치를 지정하세요.');return {id:string(f.id,'파일 ID',100),name:string(f.name,'파일명',255),layouts:f.layouts.map(l=>string(l,'배치명',100))};});
 if(files.some(f=>!f.id.trim()||!f.name.trim()||f.layouts.some(l=>!l.trim())||new Set(f.layouts).size!==f.layouts.length)||new Set(files.map(f=>f.id)).size!==files.length)throw Error('파일 ID·파일명·배치가 비어 있거나 중복되었습니다.');
 const seen=new Set();const objects=value.objects.map(o=>{
  if(!o||typeof o!=='object'||typeof o.blockName!=='string')throw Error('객체의 블록명을 확인하세요.');
  const file=files.find(f=>f.id===o.fileId);if(!file||!file.layouts.includes(o.layout)||typeof o.handle!=='string'||! /^[A-Fa-f0-9]{1,32}$/.test(o.handle)||!o.blockName?.trim())throw Error('객체의 파일·배치·핸들·블록명을 확인하세요.');
  if(!Array.isArray(o.position)||o.position.length!==3||o.position.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('삽입 위치는 유한한 숫자 [x,y,z]가 필요합니다.');
  if(!o.attributes||typeof o.attributes!=='object'||Array.isArray(o.attributes)||Object.keys(o.attributes).length>200)throw Error('속성 태그·값을 확인하세요.');
  const attributes=Object.fromEntries(Object.entries(o.attributes).map(([k,v])=>[string(k,'태그',100),string(v,'속성값')]));
  const result={fileId:file.id,handle:o.handle.toUpperCase(),layout:o.layout,blockName:string(o.blockName,'블록명',255),position:[...o.position],attributes};
  const key=objectKey(result);if(seen.has(key))throw Error('동일 파일의 객체 핸들이 중복되었습니다.');seen.add(key);return result;
 });
 const source={kind:value.source?.kind==='virtual'?'virtual':'extracted',description:typeof value.source?.description==='string'?value.source.description.slice(0,2000):'외부에서 제공한 추출 데이터. 추출 범위와 회사 규칙은 확인이 필요합니다.'};
 return {schemaVersion:1,source,files,objects};
}
export function validateCadRules(value){
 if(!value||typeof value.mapping!=='object'||!value.mapping)throw Error('속성 태그 연결을 확인하세요.');
 const mapping=Object.fromEntries(fields.map(k=>[k,string(value.mapping[k]??'','매핑 태그',100).trim()]));
 const list=(name,allowed)=>{if(!Array.isArray(value[name])||value[name].length>100||value[name].some(v=>typeof v!=='string'||!v.trim()||v.length>255||allowed&&!allowed.includes(v)))throw Error('검사 규칙 '+name+'을 확인하세요.');return [...new Set(value[name])];};
 const required=list('required',['deviceNumber','partNumber','spec']),titleRequired=list('titleRequired',['siteName','drawingNumber']);
 for(const key of [...required,...titleRequired,'partNumber','deviceNumber'])if(!mapping[key])throw Error(cadLabels[key]+' 태그를 연결하세요.');
 if(!['drawing','project'].includes(value.duplicateScope)||!['instances','attribute'].includes(value.quantityMode))throw Error('중복 검사 범위 또는 수량 집계 기준을 확인하세요.');
 if(value.quantityMode==='attribute'&&!mapping.quantity)throw Error('수량 속성 태그를 연결하세요.');
 const devicePrefixes=list('devicePrefixes');if(devicePrefixes.some(p=>! /^[A-Za-z]+$/.test(p)))throw Error('가상 번호 접두사는 영문으로 입력하세요.');
 if(value.enforceDeviceFormat&&!devicePrefixes.length)throw Error('가상 번호 검사 접두사를 입력하세요.');
 return {mapping,required,titleRequired,titleBlocks:list('titleBlocks'),excludedBlocks:list('excludedBlocks'),duplicateExceptions:list('duplicateExceptions'),duplicateScope:value.duplicateScope,quantityMode:value.quantityMode,caseSensitive:value.caseSensitive!==false,enforceDeviceFormat:value.enforceDeviceFormat===true,devicePrefixes};
}
export function validateExternalBom(value){
 if(value===null)return null;if(!value||!Array.isArray(value.rows)||value.rows.length>10000)throw Error('외부 부품표 형식을 확인하세요.');
 return {fileName:string(value.fileName,'부품표 파일명',255),rows:value.rows.map(r=>{if(!r||typeof r.partNumber!=='string'||!r.partNumber.trim()||typeof r.spec!=='string'||!Number.isSafeInteger(r.quantity)||r.quantity<0)throw Error('외부 부품표의 품번·규격·0 이상 정수 수량을 확인하세요.');return {partNumber:string(r.partNumber,'품번').trim(),spec:string(r.spec,'규격').trim(),quantity:r.quantity};})};
}
export function freshCadState(){return {dataset:structuredClone(cadExample),rules:structuredClone(defaultCadRules),externalBom:structuredClone(exampleExternalBom),reviews:{}};}
export function cadValue(object,rules,field){const tag=rules.mapping[field];return tag&&Object.hasOwn(object.attributes,tag)?String(object.attributes[tag]).trim():'';}
export function analyzeCad(rawDataset,rawRules,rawExternal=null){
 const dataset=validateCadDataset(rawDataset),rules=validateCadRules(rawRules),external=validateExternalBom(rawExternal);const issues=[],groups=new Map(),excluded=[],exceptions=[];
 const signature=hash(JSON.stringify({dataset,rules,external}));
 const issue=(code,message,objects=[],file=null,layout='')=>{
  const first=objects[0];const f=first?dataset.files.find(f=>f.id===first.fileId):file;
  const ref={code,message,fileId:f?.id||'',fileName:f?.name||external?.fileName||'정보 없음',layout:first?.layout||layout,handle:first?.handle||'',deviceNumber:first?cadValue(first,rules,'deviceNumber')||'정보 없음':'정보 없음',position:first?[...first.position]:null,objectKeys:objects.map(objectKey)};
  ref.id=signature+':'+issues.length;issues.push(ref);
 };
 const components=dataset.objects.filter(o=>!rules.titleBlocks.includes(o.blockName)&&!rules.excludedBlocks.includes(o.blockName));
 for(const o of dataset.objects){if(rules.titleBlocks.includes(o.blockName)||rules.excludedBlocks.includes(o.blockName)){excluded.push({object:o,reason:rules.titleBlocks.includes(o.blockName)?'표제란':'집계 제외 블록'});continue;}
  for(const key of rules.required)if(!cadValue(o,rules,key))issue('required','필수 '+cadLabels[key]+' 정보 없음 (태그: '+rules.mapping[key]+')',[o]);
  const device=cadValue(o,rules,'deviceNumber');if(rules.enforceDeviceFormat&&device){const match=/^([A-Za-z]+)([0-9]+)$/.exec(device);if(!match||!rules.devicePrefixes.includes(match[1]))issue('device-format','가상 예제 번호 규칙(설정한 영문 접두사+숫자)에 맞지 않습니다.',[o]);}
  const part=cadValue(o,rules,'partNumber'),spec=cadValue(o,rules,'spec');let qty=1;
  if(rules.quantityMode==='attribute'){const text=cadValue(o,rules,'quantity');qty=Number(text);if(!/^[0-9]+$/.test(text)||!Number.isSafeInteger(qty)||qty<=0){issue('quantity','수량 속성이 없거나 1 이상의 정수가 아닙니다. 부품표 집계에서 제외했습니다.',[o]);excluded.push({object:o,reason:'수량 정보 없음 또는 잘못된 수량'});continue;}}
  if(!part){excluded.push({object:o,reason:'품번 정보 없음'});continue;}
  const key=JSON.stringify([part,spec]);const group=groups.get(key)||{partNumber:part,spec,quantity:0,objects:[]};if(!Number.isSafeInteger(group.quantity+qty))throw Error('부품표 수량 합계가 허용 범위를 초과했습니다.');group.quantity+=qty;group.objects.push(o);groups.set(key,group);
 }
 const numbered=new Map();for(const o of components){const device=cadValue(o,rules,'deviceNumber');if(!device)continue;if(rules.duplicateExceptions.includes(o.blockName)){exceptions.push({object:o,reason:'중복 검사 예외 블록: '+o.blockName});continue;}const scope=rules.duplicateScope==='drawing'?o.fileId:'project';const key=JSON.stringify([scope,rules.caseSensitive?device:device.toUpperCase()]);const list=numbered.get(key)||[];list.push(o);numbered.set(key,list);}
 for(const list of numbered.values())if(list.length>1)issue('duplicate','기기번호 중복 후보 '+list.length+'개. 설정한 예외 블록은 중복 계산에서 제외했습니다.',list);
 for(const file of dataset.files)for(const layout of file.layouts){const titles=dataset.objects.filter(o=>o.fileId===file.id&&o.layout===layout&&rules.titleBlocks.includes(o.blockName));if(!titles.length&&rules.titleRequired.length)issue('title-block','설정한 표제란 블록이 없습니다. 표제란 구조를 확인하세요.',[],file,layout);for(const t of titles)for(const key of rules.titleRequired)if(!cadValue(t,rules,key))issue('title-required','표제란 '+cadLabels[key]+' 정보 없음 (태그: '+rules.mapping[key]+')',[t]);}
 if(external){const externalGroups=new Map();for(const row of external.rows){const key=JSON.stringify([row.partNumber,row.spec]);const qty=(externalGroups.get(key)||0)+row.quantity;if(!Number.isSafeInteger(qty))throw Error('외부 부품표 수량 합계가 너무 큽니다.');externalGroups.set(key,qty);}for(const key of new Set([...groups.keys(),...externalGroups.keys()])){const group=groups.get(key),actual=group?.quantity||0,expected=externalGroups.get(key)||0;if(actual!==expected){const [part,spec]=JSON.parse(key);issue('bom-mismatch',`품번 ${part} / 규격 ${spec||'정보 없음'}: 도면 집계 ${actual}, 외부 부품표 ${expected}.`,group?.objects||[]);}}}
 return {signature,dataset,rules,issues,bom:[...groups.values()].sort((a,b)=>a.partNumber.localeCompare(b.partNumber)||a.spec.localeCompare(b.spec)),excluded,exceptions,components};
}
export function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@\-]/.test(text)||/^[\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function makeCadBomCSV(result){return [['품번','규격','수량','원본 파일','원본 파일 ID','원본 핸들'],...result.bom.map(row=>[row.partNumber,row.spec||'정보 없음',row.quantity,[...new Set(row.objects.map(o=>result.dataset.files.find(f=>f.id===o.fileId).name))].join(' | '),[...new Set(row.objects.map(o=>o.fileId))].join(' | '),row.objects.map(o=>o.fileId+':'+o.handle).join(' | ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function parseBomCSV(text,fileName){
 const input=text.replace(/^\uFEFF/,''),rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c==='"'){if(cell||closed)throw Error('CSV 따옴표 위치를 확인하세요.');quoted=true;continue;}if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&input[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}continue;}if(closed)throw Error('CSV 닫는 따옴표 뒤에 구분자가 필요합니다.');cell+=c;}
 if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');if(cell||row.length){row.push(cell);if(row.some(v=>v.trim()))rows.push(row);}const headers=rows.shift()?.map(h=>h.trim());if(!headers||!['품번','규격','수량'].every(h=>headers.includes(h))||new Set(headers).size!==headers.length)throw Error('CSV 머리글에 품번, 규격, 수량이 필요합니다.');
 return validateExternalBom({fileName,rows:rows.map((r,i)=>{if(r.length!==headers.length)throw Error((i+2)+'행 열 개수가 맞지 않습니다.');const v=Object.fromEntries(headers.map((h,j)=>[h,r[j]]));if(!/^[0-9]+$/.test(v['수량'].trim()))throw Error((i+2)+'행 수량은 0 이상 정수여야 합니다.');return {partNumber:v['품번'],spec:v['규격']==='정보 없음'?'':v['규격'],quantity:Number(v['수량'])};})});
}
export function applyCadAction(data,input,user){
 data.cad??=freshCadState();
 if(input.action==='cad-config'){
  const dataset=validateCadDataset(input.dataset),rules=validateCadRules(input.rules),externalBom=validateExternalBom(input.externalBom??null);analyzeCad(dataset,rules,externalBom);data.cad={dataset,rules,externalBom,reviews:{}};return;
 }
 if(input.action==='cad-reset'){data.cad=freshCadState();return;}
 if(input.action==='cad-review'){
  const result=analyzeCad(data.cad.dataset,data.cad.rules,data.cad.externalBom);if(!result.issues.some(i=>i.id===input.issueId)||!['미확인','확인 완료','보류','오탐'].includes(input.status))throw Error('검사 항목 또는 검토 상태를 확인하세요.');
  const note=typeof input.note==='string'?input.note.trim():'';if(note.length>2000)throw Error('검토 메모는 2000자 이내로 입력하세요.');
  const old=data.cad.reviews[input.issueId];data.cad.reviews[input.issueId]={status:input.status,note,updatedAt:new Date().toISOString(),updatedBy:user.username,history:[...(old?.history||[]),{status:input.status,note,at:new Date().toISOString(),by:user.username}]};return;
 }
 throw Error('지원하지 않는 도면 검토 작업입니다.');
}
