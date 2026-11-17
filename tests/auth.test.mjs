import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
test('server enforces administrator grants, revocation and persisted accounts',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'samil-auth-'));
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 let child;
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),BASE_PATH:'project',ADMIN_PASSWORD:'test-admin-password',AUTH_FILE:path.join(dir,'users.json')},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});};
 const stop=async()=>{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;};
 const call=(name,method='GET',body,cookie)=>fetch(`http://127.0.0.1:${port}/project/${name}`,{method,redirect:'manual',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const login=async(username,password)=>{const response=await call('api/login','POST',{username,password});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 try{await start();assert.equal((await call('')).status,302);assert.equal((await call('data.js')).status,401);
 assert.equal((await call('api/me')).status,401);assert.equal((await call('api/management')).status,401);
 assert.equal((await call('client.js')).status,200);assert.match(await (await call('runtime-config.js')).text(),/APP_MODE='server'/);
 assert.equal((await call('demo-api.js')).status,401);assert.equal((await call('management-schema.js')).status,401);
 const admin=await login('admin','test-admin-password');assert.equal((await call('api/users','POST',{username:'worker',password:'worker-password-123',canView:false},admin)).status,201);
 let worker=await login('worker','worker-password-123');assert.equal((await call('data.js','GET',null,worker)).status,403);assert.equal((await call('api/users','GET',null,worker)).status,403);
 const users=await (await call('api/users','GET',null,admin)).json();assert.ok(users.every(u=>!u.hash&&!u.salt));const id=users.find(u=>u.username==='worker').id;
 assert.equal((await call('api/users','PATCH',{id,canView:true},admin)).status,200);worker=await login('worker','worker-password-123');assert.equal((await call('data.js','GET',null,worker)).status,200);assert.equal((await call('admin.html','GET',null,worker)).status,403);
 assert.equal((await call('api/users','PATCH',{id,canView:false},admin)).status,200);assert.equal((await call('data.js','GET',null,worker)).status,401);
 await stop();await start();worker=await login('worker','worker-password-123');assert.equal((await call('data.js','GET',null,worker)).status,403);
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
