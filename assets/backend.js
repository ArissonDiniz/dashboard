let authEpoch=0;
let sellerProduction=null,sellerProductionError=false;
let db=null,dashboardSession=null,crmStates={},missingRows=[],snapshot=null,dataBusy=false,currentProfile=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function authMessage(s){document.getElementById('auth-message').textContent=s;}
function clearPrivateUI(){
 authEpoch++;
 sellerProduction=null;sellerProductionError=false;rawRows=[];missingRows=[];crmStates={};snapshot=null;dashboardSession=null;currentProfile=null;
 document.getElementById('admin-secret').textContent='';
 document.querySelectorAll('.toast').forEach(e=>e.remove());closeModal();
 document.querySelectorAll('dialog[open]').forEach(x=>x.close());
 if(typeof crm!=='undefined'){crm.open=false;crm.edit=null;crm.dirty=false;crm.historyToken++;document.getElementById('crm-rows').innerHTML='';document.getElementById('crm-editor').innerHTML='';}
 ['kg1','kg2','hero-st','meta-bars','rank-top','rank-rest','cursos-list','polo-table','mbody','admin-body'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='';});
 Object.values(charts).forEach(c=>c.destroy());charts={};
 document.getElementById('auth-screen').hidden=false;document.getElementById('auth-screen').inert=false;
 document.getElementById('app-shell').hidden=true;document.getElementById('app-shell').inert=true;
 document.getElementById('login-form').hidden=false;document.getElementById('password-form').hidden=true;
}
async function boot(){
 try{
  const cfg=window.APP_CONFIG;
  if(!cfg||cfg.supabaseUrl.includes('SEU_PROJETO')||cfg.supabaseKey.includes('SUA_CHAVE')){authMessage('Configure config.js com a URL e a chave pública do seu projeto Supabase.');return;}
  if(!window.supabase)throw Error('Não foi possível carregar o componente de login. Confira a conexão.');
  db=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')clearPrivateUI();});
  const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session)await enterSession();
 }catch(e){authMessage(e.message);}
}
async function login(e){
 e.preventDefault();const btn=document.getElementById('login-submit');btn.disabled=true;authMessage('Entrando...');
 try{if(!db)throw Error('Configure o projeto antes de entrar.');
  const {error}=await db.auth.signInWithPassword({email:document.getElementById('login-email').value.trim(),password:document.getElementById('login-password').value});
  document.getElementById('login-password').value='';if(error)throw Error('Não foi possível entrar. Confira o e-mail e a senha.');await enterSession();
 }catch(e){authMessage(e.message);}finally{btn.disabled=false;}
}
async function enterSession(){
 const {data:{user},error:uerr}=await db.auth.getUser();if(uerr||!user)throw Error('Sessão inválida.');
 const {data:p,error}=await db.from('profiles').select('*').eq('id',user.id).single();
 if(error||!p?.active){await logout();throw Error('Sua conta ainda não foi liberada ou foi desativada. Consulte o administrador.');}
 currentProfile=p;
 if(p.must_change_password||p.password_op){document.getElementById('login-form').hidden=true;document.getElementById('password-form').hidden=false;authMessage('Defina uma senha exclusiva para o dashboard antes de acessar os alunos. A senha provisória expira em 24 horas.');return;}
 document.getElementById('auth-screen').hidden=true;document.getElementById('app-shell').hidden=false;document.getElementById('app-shell').inert=false;
 document.getElementById('admin-button').hidden=p.role!=='admin';authMessage('');await fetchData();
}
async function logout(){if(db)await db.auth.signOut({scope:'local'});clearPrivateUI();authMessage('');}
function showPasswordChange(){document.getElementById('app-shell').hidden=true;document.getElementById('app-shell').inert=true;document.getElementById('auth-screen').hidden=false;document.getElementById('login-form').hidden=true;document.getElementById('password-form').hidden=false;authMessage('Trocar senha do dashboard.');}
async function edge(name,body){
 const {data,error}=await db.functions.invoke(name,{body});
 if(error){let msg=error.message;try{msg=(await error.context.json()).error||msg;}catch{}throw Error(msg);}
 if(data?.error)throw Error(data.error);return data;
}
async function changePassword(e){
 e.preventDefault();const btn=document.getElementById('password-submit');btn.disabled=true;
 const next=document.getElementById('new-password').value;
 try{if(next!==document.getElementById('confirm-password').value)throw Error('As novas senhas não conferem.');
 await edge('change-password',{current_password:document.getElementById('current-password').value,new_password:next});
 document.getElementById('password-form').reset();await logout();authMessage('Senha alterada. Entre novamente com sua nova senha.');
 }catch(e){authMessage(e.message);}finally{btn.disabled=false;}
}
function toLegacy(s){const p=snapshot.polos.find(p=>p.id===s.polo_id);return {
 _engagement:s.engagement_status??null,_credit:s.has_credit??null,_lastAccess:s.last_access_on??null,_accessSystem:s.last_access_system??null,_key:s.inscription_id,_missing:!s.present,_changedAt:s.last_seen_at,
 NOME:s.name,CODIGO_ALUNO:s.student_code,CODIGO_DA_INSCRICAO:s.inscription_id,CODIGO_DO_CURSO:s.course_code,NOME_DO_CURSO:s.course_name,NOME_DO_POLO:p?.name||s.polo_id,CODIGO_DO_POLO:s.polo_id,
 DATA_MATRICULA:s.enrolled_on,DATA_CANCELAMENTO:s.cancelled_on||'',PRIMEIRA_MENSALIDADE_COBRADA_PAGA:s.paid?'S':'N',DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA:s.paid_on||'',
 TELEFONE:s.phone,CELULAR:s.mobile,EMAIL:s.email,ESPECIALIZACAO_MATRICULOU:s.seller_name,ESPECIALIZACAO_MATRICULOU_CODIGO:s.seller_code};}
function stateFromDB(s){return s?{welcome:s.welcome_status||'Pendente',outcome:s.contact_outcome||'Não informado',promised:s.promised_payment_on||'',event:'record_update',status:s.status,notes:s.notes,lastContact:s.last_contact||'',nextContact:s.next_contact||'',author:s.author_name,updatedAt:s.updated_at,version:s.version}:Core.empty();}
async function fetchData(){
 if(dataBusy||typeof crm!=='undefined'&&crm.saving)return;
 if(typeof crm!=='undefined'&&crm.dirty&&!confirm('Descartar alterações não salvas e atualizar?')){document.getElementById('f-campaign').value=snapshot.campaign.id;return;}
 const epoch=authEpoch;dataBusy=true;document.getElementById('crm-dialog').inert=true;showLoading();
 try{
 const campaign=document.getElementById('f-campaign').value||APP_CONFIG.campaign;
 const {data,error}=await db.rpc('dashboard_snapshot',{p_campaign:campaign});if(epoch!==authEpoch)return;if(error)throw error;if(!data.campaign)throw Error('Campanha não encontrada.');
 snapshot=data;currentProfile=data.profile;document.getElementById('admin-button').hidden=currentProfile.role!=='admin';
 Object.keys(METAS).forEach(k=>delete METAS[k]);Object.keys(POLO_CFG).forEach(k=>delete POLO_CFG[k]);Object.keys(POLO_REG).forEach(k=>delete POLO_REG[k]);
 data.polos.forEach(p=>{POLO_CFG[p.name]={k:p.short_name,r:p.region};POLO_REG[p.short_name]=p.region;METAS[p.short_name]=data.goals.find(g=>g.polo_id===p.id)?.target||0;});
 const records=data.students.map(toLegacy);rawRows=records.filter(r=>!r._missing);missingRows=records.filter(r=>r._missing);crmStates=Object.create(null);data.followups.forEach(f=>crmStates[f.inscription_id]=stateFromDB(f));
 window.dashboardZone=data.campaign.timezone;
 dashboardSession={email:currentProfile.email,admin:currentProfile.role==='admin',zone:data.campaign.timezone,polos:data.polos.map(p=>p.name)};
 const camp=document.getElementById('f-campaign');camp.innerHTML=data.campaigns.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');camp.value=campaign;
 const ranking=await db.rpc('seller_production',{p_campaign:campaign});if(epoch!==authEpoch)return;
 sellerProduction=ranking.error?[]:(ranking.data||[]);sellerProductionError=!!ranking.error;
 lastLoad=new Date(data.loaded_at);_matriculaDateKey=undefined;finishLoad();
 document.getElementById('session-label').textContent=currentProfile.name+' · '+currentProfile.email+' · '+dashboardSession.zone;
 document.getElementById('load-error').hidden=true;document.getElementById('load-retry').hidden=true;
 if(typeof crm!=='undefined'&&crm.open){crm.dirty=false;crm.edit=null;crm.historyToken++;drawCRM();}
 }catch(e){
 // Authorization errors clear cached student data rather than retaining an old view.
 clearPrivateUI();authMessage('Não foi possível carregar os dados: '+e.message+'. Entre novamente ou consulte o administrador.');
 }finally{dataBusy=false;document.getElementById('crm-dialog').inert=false;hideLoading();}
}
async function rpc(method,...args){
 if(method==='getHistory'){
 let all=[],offset=0;
 for(;;){const {data,error}=await db.from('contact_history').select('id,state').eq('campaign_id',snapshot.campaign.id).eq('inscription_id',args[0]).order('id',{ascending:false}).range(offset,offset+499);if(error)throw error;all.push(...data);if(data.length<500)break;offset+=500;}
 return all.map(e=>({state:stateFromDB(e.state)}));
 }
 if(method==='saveContact'){
 const v=args[0],{data,error}=await db.rpc('save_acompanhamento',{p_campaign:snapshot.campaign.id,p_key:v.key,p_version:v.version,p_request:v.requestId,p_status:v.draft.status,p_notes:v.draft.notes,p_last:v.draft.lastContact||null,p_next:v.draft.nextContact||null,p_welcome:v.draft.welcome,p_outcome:v.draft.outcome,p_promised:v.draft.promised||null,p_event:v.draft.event});
 if(error)throw error;return {...data,state:stateFromDB(data.state)};
 }
 throw Error('Operação desconhecida.');
}
window.addEventListener('load',boot);
window.addEventListener('pagehide',()=>{document.querySelectorAll('input[type=password]').forEach(e=>e.value='');});
