import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {freshManagement,normalizeManagement,mutateManagement} from './public/management-domain.js';
import {telemetry} from './public/operations-domain.js';
export function createManagement(file){
 let queue=Promise.resolve();
 async function load(){try{return normalizeManagement(JSON.parse(await readFile(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;return freshManagement();}}
 return async function handle(req,res,user,body){
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  if(!user)return json(401,{error:'로그인이 필요합니다.'});if(user.role!=='admin'&&!user.canView)return json(403,{error:'조회 권한이 필요합니다.'});
  if(req.method==='GET'){await queue;const data=await load();return json(200,req.telemetryOnly?telemetry(data):data);}
  if(user.role!=='admin')return json(403,{error:'등록·수정·삭제는 관리자만 가능합니다.'});
  if(!['POST','PATCH','DELETE'].includes(req.method))return json(405,{error:'지원하지 않는 요청입니다.'});
  const input=await body();const operation=queue.then(async()=>{
   const data=mutateManagement(await load(),input,user,req.method);
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data,null,2),{mode:0o600});await rename(file+'.tmp',file);return data;
  });queue=operation.catch(()=>{});
  try{return json(200,await operation);}catch(error){return json(400,{error:error.message});}
 };
}
