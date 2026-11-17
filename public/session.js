import {apiFetch,IS_DEMO} from './client.js';
const response=await apiFetch('./api/me',{cache:'no-store'});
if(!response.ok){location.replace('./login.html');}else{
 const user=await response.json();if(!user.canView)location.replace('./login.html');
 const tools=document.createElement('div');tools.style.cssText='position:fixed;bottom:12px;right:12px;z-index:1000;background:white;padding:10px;border:1px solid #ddd;border-radius:8px';
 const label=document.createElement('span');label.textContent=IS_DEMO?'공개 시연 · 가상 데이터 ':user.username+' ';tools.append(label);
 if(!IS_DEMO&&user.role==='admin'){const link=document.createElement('a');link.href='./admin.html';link.textContent='사용자 권한 관리 · ';tools.append(link);}
 const button=document.createElement('button');button.textContent=IS_DEMO?'통합 시연 화면':'로그아웃';button.onclick=async()=>{if(IS_DEMO){location.href='./';return;}await apiFetch('./api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.replace('./login.html');};tools.append(button);document.body.append(tools);
 const check=async()=>{try{const result=await apiFetch('./api/me',{cache:'no-store'});if(!result.ok||!(await result.json()).canView){document.body.replaceChildren();location.replace('./login.html');}}catch{document.body.replaceChildren();location.replace('./login.html');}};
 setInterval(check,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
}


