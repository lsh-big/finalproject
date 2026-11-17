import {apiFetch,IS_DEMO} from './client.js';
if(IS_DEMO){
 document.querySelector('main').innerHTML='<div class="company-heading"><img src="./samil-logo.svg" alt="삼일엘텍 SAMIL 로고"><div><h1>SAMIL INSIGHT</h1><p>GitHub Pages 공개 시연</p></div></div><p>가상 데이터로 업무 기능을 체험하는 사이트입니다. 실제 로그인과 사용자 권한 관리는 제공하지 않습니다.</p><p>변경 내용은 이 브라우저에만 저장됩니다. 실제 고객 정보나 비밀번호를 입력하지 마세요.</p><a href="./" style="display:inline-block;padding:14px 20px;background:#172686;color:white;border-radius:7px">시연 시작하기 →</a>';
}else{

const $=s=>document.querySelector(s);
async function api(path,method='GET',body){const response=await apiFetch('./api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Error(value.error||'요청 실패');return value;}
function message(error){$('#message').textContent=error.message||error;}
async function logout(){await api('logout','POST',{});location.href='./login.html';}
$('#logout')?.addEventListener('click',logout);
$('#login')?.addEventListener('submit',async e=>{e.preventDefault();try{const form=new FormData(e.target);const user=await api('login','POST',Object.fromEntries(form));if(user.canView)location.href='./';else{message('조회 권한이 없습니다. 관리자에게 권한 부여를 요청하세요.');e.target.reset();}}catch(error){message(error);}});
async function list(){const users=await api('users');$('#users').replaceChildren();for(const user of users){const row=document.createElement('article');const text=document.createElement('span');text.textContent=`${user.username} · ${user.role==='admin'?'관리자':user.canView?'조회 허용':'조회 불가'}`;row.append(text);if(user.role!=='admin'){const button=document.createElement('button');button.textContent=user.canView?'권한 회수':'권한 부여';button.onclick=async()=>{try{await api('users','PATCH',{id:user.id,canView:!user.canView});await list();message('권한이 변경되었습니다. 해당 사용자는 다시 로그인해야 합니다.');}catch(error){message(error);}};row.append(button);}$('#users').append(row);}}
$('#create')?.addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.target);try{await api('users','POST',{username:form.get('username'),password:form.get('password'),canView:form.has('canView')});e.target.reset();await list();message('계정이 생성되었습니다.');}catch(error){message(error);}});
if($('#users'))list().catch(message);


}
