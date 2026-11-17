import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createManagement} from './management-store.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(dir,'public');
const basePath=process.env.BASE_PATH?'/'+process.env.BASE_PATH.replace(/^\/+|\/+$/g,''):'';
const store=process.env.AUTH_FILE||path.join(dir,'.private','users.json');
const management=createManagement(process.env.MANAGEMENT_FILE||path.join(path.dirname(store),'management.json'));
const hash=(password,salt=randomBytes(16).toString('hex'))=>({salt,hash:scryptSync(password,salt,64).toString('hex')});
let users;
try{users=JSON.parse(await readFile(store,'utf8'));}catch(error){
  if(error.code!=='ENOENT')throw error;
  const password=process.env.ADMIN_PASSWORD;
  if(!password||password.length<12)throw Error('최초 실행 시 ADMIN_PASSWORD를 12자 이상으로 설정하세요.');
  users=[{id:randomBytes(16).toString('hex'),username:process.env.ADMIN_USER||'admin',role:'admin',canView:true,...hash(password)}];
  await mkdir(path.dirname(store),{recursive:true});await writeFile(store,JSON.stringify(users),{mode:0o600});
}
let saving=Promise.resolve();
function save(){const data=JSON.stringify(users);saving=saving.then(async()=>{await writeFile(store+'.tmp',data,{mode:0o600});await rename(store+'.tmp',store);});return saving;}
const sessions=new Map(),attempts=new Map();
const safe=u=>({id:u.id,username:u.username,role:u.role,canView:u.role==='admin'||u.canView});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(basePath){if(name===basePath){res.writeHead(302,{Location:basePath+'/'});return res.end();}if(!name.startsWith(basePath+'/'))return json(404,{});name=name.slice(basePath.length);}
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);
    const session=sessions.get(token);if(session&&session.expires<Date.now())sessions.delete(token);
    const user=session&&session.expires>Date.now()?users.find(u=>u.id===session.userId):null;
    const body=async()=>{const chunks=[];let size=0;const limit=name==='/api/management'?2*1024*1024:8192;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('요청이 너무 큽니다.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');};
    if(!['GET','HEAD'].includes(req.method)){
      if(req.headers.origin&&req.headers.origin!==`${process.env.COOKIE_SECURE==='true'?'https':'http'}://${req.headers.host}`)return json(403,{error:'허용되지 않은 요청입니다.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'JSON 요청이 필요합니다.'});
    }
    if(name==='/api/login'&&req.method==='POST'){
      const key=req.socket.remoteAddress;const limit=attempts.get(key);if(limit?.until>Date.now()&&limit.count>=10)return json(429,{error:'잠시 후 다시 로그인하세요.'});
      const data=await body();const found=users.find(u=>u.username===data.username);const derived=hash(String(data.password||''),found?.salt||'dummy').hash;
      if(!found||!timingSafeEqual(Buffer.from(derived,'hex'),Buffer.from(found.hash,'hex'))){const next=limit?.until>Date.now()?limit:{count:0,until:Date.now()+900000};next.count++;attempts.set(key,next);return json(401,{error:'아이디 또는 비밀번호를 확인하세요.'});}
      attempts.delete(key);if(token)sessions.delete(token);const id=randomBytes(32).toString('hex');sessions.set(id,{userId:found.id,expires:Date.now()+8*3600000});
      res.setHeader('Set-Cookie',`session=${id}; HttpOnly; SameSite=Strict; Path=${basePath||'/'}; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return json(200,safe(found));
    }
    if(name==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',`session=; HttpOnly; SameSite=Strict; Path=${basePath||'/'}; Max-Age=0`);return json(200,{});}
    if(name.startsWith('/api/')){
      if(name==='/api/management')return await management(req,res,user,body);
      if(name==='/api/telemetry'&&req.method==='GET'){req.telemetryOnly=true;return await management(req,res,user,body);}
      if(!user)return json(401,{error:'로그인이 필요합니다.'});
      if(name==='/api/me'&&req.method==='GET')return json(200,safe(user));
      if(name==='/api/users'){
        if(user.role!=='admin')return json(403,{error:'관리자만 권한을 관리할 수 있습니다.'});
        if(req.method==='GET')return json(200,users.map(safe));
        const data=await body();
        if(req.method==='POST'){
          if(typeof data.username!=='string'||! /^[a-zA-Z0-9_.@-]{3,80}$/.test(data.username)||typeof data.password!=='string'||data.password.length<12)return json(400,{error:'아이디는 영문·숫자 등 3~80자, 비밀번호는 12자 이상이어야 합니다.'});
          if(users.some(u=>u.username===data.username))return json(409,{error:'이미 존재하는 아이디입니다.'});
          users.push({id:randomBytes(16).toString('hex'),username:data.username,role:'user',canView:data.canView===true,...hash(data.password)});await save();return json(201,{});
        }
        if(req.method==='PATCH'){
          const target=users.find(u=>u.id===data.id);if(!target||target.role==='admin'||typeof data.canView!=='boolean')return json(400,{error:'변경할 사용자를 확인하세요.'});
          target.canView=data.canView;await save();for(const [key,value] of sessions)if(value.userId===target.id)sessions.delete(key);return json(200,{});
        }
      }
      return json(404,{});
    }
    if(!['GET','HEAD'].includes(req.method))return json(405,{});
    const open=['/login.html','/auth.js','/auth.css','/samil-logo.svg','/client.js','/runtime-config.js'].includes(name);
    if(!open&&(!user||(!user.canView&&user.role!=='admin'))){if(name==='/'||name.endsWith('.html')){res.writeHead(302,{Location:basePath+'/login.html'});return res.end();}return json(user?403:401,{error:'관리자가 부여한 조회 권한이 필요합니다.'});}
    if(name==='/admin.html'&&user?.role!=='admin')return json(403,{error:'관리자 전용 화면입니다.'});
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))return json(403,{});
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){json(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'찾을 수 없습니다.':'요청을 처리하지 못했습니다.'});}
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`SAMIL INSIGHT: http://localhost:${Number(process.env.PORT)||3000}${basePath}/`));
