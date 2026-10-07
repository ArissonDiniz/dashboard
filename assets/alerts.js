// Consulta leve de revisões. Nunca recarrega nem descarta um rascunho automaticamente.
const updateNotice={baseline:null,newData:false,error:false,latestReport:null,busy:false,lastCheck:0};
function updateSignature(value){return value?JSON.stringify(Object.keys(value).sort().map(k=>[k,value[k]])):null;}
function reportFreshness(reportAt,now=Date.now(),hours=24){const ms=Date.parse(reportAt);if(!Number.isFinite(ms))return 'missing';return now-ms>=hours*3600000?'stale':'fresh';}
function resetUpdateNotice(){Object.assign(updateNotice,{baseline:null,newData:false,error:false,latestReport:null,busy:false,lastCheck:0});for(const id of ['update-notice','crm-update-notice']){const e=document.getElementById(id);if(e){e.hidden=true;e.textContent='';}}}
function acceptUpdateSnapshot(){updateNotice.baseline=updateSignature(snapshot?.updates);updateNotice.latestReport=snapshot?.last_synced_at;updateNotice.newData=false;updateNotice.error=false;updateNotice.lastCheck=Date.now();renderUpdateNotice();}
function acceptLocalFollowup(){
 if(snapshot?.updates){snapshot.updates.followups=String(Object.values(crmStates).reduce((sum,s)=>sum+(Number(s.version)||0),0));updateNotice.baseline=updateSignature(snapshot.updates);}
}
function renderUpdateNotice(){
 const hours=Number(window.APP_CONFIG?.reportStaleHours)||24,freshness=reportFreshness(updateNotice.latestReport||snapshot?.last_synced_at,Date.now(),hours),messages=[];
 if(!dashboardSession){resetUpdateNotice();return;}
 if(updateNotice.newData)messages.push('Há atualizações disponíveis. Clique em Atualizar dados para carregar a versão mais recente.');
 if(freshness==='stale')messages.push('O relatório está há mais de '+hours+' horas sem sincronizar. '+(currentProfile?.role==='admin'?'Sincronize a nova extração pelo Sheets.':'Solicite uma nova sincronização ao administrador.'));
 if(freshness==='missing')messages.push('Ainda não há relatório sincronizado para esta campanha.');
 if(updateNotice.error)messages.push('Não foi possível verificar novas atualizações. Confira sua conexão e tente novamente.');
 for(const id of ['update-notice','crm-update-notice']){const e=document.getElementById(id);if(!e)continue;e.hidden=!messages.length;e.innerHTML=messages.length?'<div>'+messages.map(m=>'<p>'+esc(m)+'</p>').join('')+'</div>'+(updateNotice.newData?'<button class="btn btn-gh" onclick="fetchData()">Atualizar dados</button>':'')+(updateNotice.error?'<button class="btn btn-gh" onclick="checkDashboardUpdates(true)">Verificar novamente</button>':''):'';}
}
async function checkDashboardUpdates(force=false){
 if(!db||!snapshot||!dashboardSession||dataBusy||updateNotice.busy||document.hidden||(!force&&Date.now()-updateNotice.lastCheck<60000))return;
 const epoch=authEpoch,campaign=snapshot.campaign.id;updateNotice.busy=true;updateNotice.lastCheck=Date.now();
 try{const {data,error}=await db.rpc('dashboard_updates',{p_campaign:campaign});if(epoch!==authEpoch||snapshot?.campaign.id!==campaign)return;if(error)throw error;
 updateNotice.error=false;updateNotice.latestReport=data.report_at;updateNotice.newData=updateNotice.baseline!==updateSignature(data);renderUpdateNotice();
 }catch(e){if(epoch===authEpoch&&snapshot?.campaign.id===campaign){updateNotice.error=true;renderUpdateNotice();}}
 finally{if(epoch===authEpoch)updateNotice.busy=false;}
}
setInterval(()=>{if(dashboardSession&&!document.hidden){renderUpdateNotice();checkDashboardUpdates();}},120000);
window.addEventListener('focus',()=>checkDashboardUpdates());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDashboardUpdates();});
