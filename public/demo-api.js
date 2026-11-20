import {freshManagement,normalizeManagement,mutateManagement} from './management-domain.js';
import {telemetry} from './operations-domain.js';
export function createDemoAPI(storage,namespace='samil-pages-v1'){
 let queue=Promise.resolve(),ordersApi;const key=namespace+':data',roleKey=namespace+':role',ordersKey=namespace+':orders';
 const read=()=>{let saved;try{saved=storage.getItem(key);}catch{throw Error('브라우저 저장 공간에 접근할 수 없습니다. 브라우저 설정에서 사이트 저장을 허용하세요.');}if(!saved)return freshManagement();try{return normalizeManagement(JSON.parse(saved));}catch{throw Error('저장된 시연 데이터를 읽을 수 없습니다. 시연 초기화를 눌러 복원하세요.');}};
 const me=()=>{const canReviewOrders=storage.getItem(roleKey)!=='viewer';return {id:'demo',username:'공개 시연',role:canReviewOrders?'admin':'user',canView:true,canReviewOrders,demo:true};};
 const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
 return async function request(path,options={}){
  const name=path.replace(/^\.\//,'').replace(/^\//,''),method=options.method||'GET';
  try{
   if(name==='api/me')return response(200,me());
   if(name==='api/demo-role'&&method==='POST'){const {role}=JSON.parse(options.body||'{}');if(!['admin','viewer'].includes(role))throw Error('시연 역할을 확인하세요.');storage.setItem(roleKey,role);return response(200,me());}
   if(name==='api/demo-reset'&&method==='POST'){await queue;if(ordersApi)await (await ordersApi).reset();else storage.removeItem(ordersKey);storage.removeItem(key);storage.removeItem(roleKey);return response(200,{});}
   if(name==='api/logout')return response(200,{});
   if(name==='api/orders'||name.startsWith('api/orders/')){
    ordersApi??=import('./order-demo.js').then(({createDemoOrders})=>createDemoOrders(storage,ordersKey));
    return await (await ordersApi).request(name,options,me());
   }
   if(name==='api/management'||name==='api/telemetry'){
    if(method==='GET'){await queue;const data=read();return response(200,name==='api/telemetry'?telemetry(data):data);}
    if(name==='api/telemetry')return response(405,{error:'지원하지 않는 요청입니다.'});
    if(me().role!=='admin')return response(403,{error:'조회 체험 중입니다. 관리 체험으로 전환하세요.'});
    const input=JSON.parse(options.body||'{}');const result=queue.then(()=>{
     const data=mutateManagement(read(),input,me(),method);
     try{storage.setItem(key,JSON.stringify(data));}catch{throw Error('브라우저 저장 공간이 부족하거나 차단되었습니다. 사진 크기를 줄이거나 시연을 초기화하세요.');}
     return data;
    });queue=result.catch(()=>{});return response(200,await result);
   }
   return response(404,{error:'공개 시연에서는 실제 로그인과 사용자 권한 관리를 제공하지 않습니다.'});
  }catch(error){return response(400,{error:error.message});}
 };
}
let api;
export async function demoFetch(path,options){
 if(!api){const root=new URL('.',import.meta.url).pathname;api=createDemoAPI(globalThis.localStorage,'samil-pages-v1:'+root);}
 return api(path,options);
}
