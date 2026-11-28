// Áreas do painel (28/11/2026): menu fixo no topo com Visão geral, Acompanhamento e CRM.
// Acompanhamento e CRM deixam de ser janelas por cima do painel e viram telas inteiras.
// O endereço guarda a área (#acompanhamento, #crm), então recarregar volta para onde estava.
(function(){
'use strict';
const AREAS={
  acomp:{dlg:'crm-dialog',hash:'#acompanhamento',titulo:'Acompanhamento',sub:'Da matrícula ao 1º pagamento'},
  crm:{dlg:'cc-dialog',hash:'#crm',titulo:'CRM Comercial',sub:'Leads e inscritos até a matrícula'}
};
let atual='geral',trocando=false;

function nav(){
  let n=document.getElementById('areas-nav');if(n)return n;
  n=document.createElement('nav');n.id='areas-nav';n.setAttribute('aria-label','Áreas do painel');
  n.innerHTML='<div class="an-in">'+
    '<button type="button" data-a="geral"><span class="an-t">Visão geral</span><span class="an-s">Números do semestre</span></button>'+
    '<button type="button" data-a="crm"><span class="an-t">CRM Comercial <b class="an-n" id="an-n-crm" hidden></b></span><span class="an-s">'+AREAS.crm.sub+'</span></button>'+
    '<button type="button" data-a="acomp"><span class="an-t">Acompanhamento <b class="an-n" id="an-n-acomp" hidden></b></span><span class="an-s">'+AREAS.acomp.sub+'</span></button>'+
    '</div>';
  n.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b)ir(b.dataset.a);});
  const h=document.querySelector('.hdr');if(h)h.after(n);else document.body.prepend(n);marcar();return n;
}
function marcar(){
  document.querySelectorAll('#areas-nav [data-a]').forEach(b=>{const on=b.dataset.a===atual;b.setAttribute('aria-current',on?'page':'false');});
  document.documentElement.dataset.area=atual;
}
// janela modal vira tela inteira abaixo do menu
function paginar(id){
  const d=document.getElementById(id);if(!d)return;
  if(d.open&&d.matches(':modal')){d._ignora=true;d.close();d.show();}
  else if(!d.open)d.show();
  d.classList.add('area-pagina');d.scrollTop=0;
  d.classList.remove('area-entra');void d.offsetWidth;d.classList.add('area-entra');
}
async function sair(){
  if(atual==='acomp'&&document.getElementById('crm-dialog')?.open){await closeCRM();return !document.getElementById('crm-dialog').open;}
  if(atual==='crm'&&document.getElementById('cc-dialog')?.open){await closeCC();return !document.getElementById('cc-dialog').open;}
  return true;
}
async function ir(a){
  if(trocando||a===atual)return;trocando=true;
  try{
    if(!(await sair()))return;
    atual=a;marcar();
    history.replaceState(null,'',a==='geral'?location.pathname+location.search:AREAS[a].hash);
    if(a==='acomp')openCRM('total',true);
    if(a==='crm')openCC();
    if(a==='geral')window.scrollTo({top:0,behavior:'smooth'});else window.scrollTo(0,0);
  }finally{trocando=false;}
}
// abrir pelos botões antigos do painel também vira área
function envolver(){
  if(typeof openCRM==='function'&&!openCRM._area){const o=openCRM;openCRM=function(...x){const r=o.apply(this,x);atual='acomp';marcar();paginar('crm-dialog');if(location.hash!==AREAS.acomp.hash)history.replaceState(null,'',AREAS.acomp.hash);return r;};openCRM._area=1;}
  if(typeof window.openCC==='function'&&!window.openCC._area){const o=window.openCC;window.openCC=function(...x){const r=o.apply(this,x);atual='crm';marcar();paginar('cc-dialog');if(location.hash!==AREAS.crm.hash)history.replaceState(null,'',AREAS.crm.hash);return r;};window.openCC._area=1;}
  for(const k of Object.keys(AREAS)){const d=document.getElementById(AREAS[k].dlg);if(d&&!d._area){d._area=1;
    d.addEventListener('close',()=>{if(d._ignora){d._ignora=false;return;}if(d.open)return;d.classList.remove('area-pagina');if(atual===k&&!trocando){atual='geral';marcar();history.replaceState(null,'',location.pathname+location.search);}});}}
}
// Esc fecha só a ficha aberta; nunca a área inteira
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||atual==='geral')return;
  if(atual==='crm'&&!(typeof cc!=='undefined'&&cc.edit)){e.stopImmediatePropagation();e.preventDefault();}
},true);

// números no menu: calouros ainda sem o 1º pagamento
function badges(){
  try{const n=(rawRows||[]).filter(r=>!r._missing&&!Core.paid(r)&&!crmCancelled(r)).length;
    window.AREAS_badge('acomp',n,n+' calouros ainda sem o 1º pagamento');}catch{}
}
setInterval(badges,30000);
window.AREAS_badge=(k,v,t)=>{const b=document.getElementById('an-n-'+k);if(!b)return;b.hidden=!v;b.textContent=v>999?'999+':v;if(t)b.title=t;};

function iniciar(){
  if(typeof dashboardSession==='undefined'||!dashboardSession||!snapshot){setTimeout(iniciar,400);return;}
  nav();envolver();badges();
  const h=location.hash;
  if(h===AREAS.acomp.hash)ir('acomp');else if(h===AREAS.crm.hash)ir('crm');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
// depois de sair e entrar de novo
setInterval(()=>{if(typeof dashboardSession!=='undefined'&&dashboardSession&&!document.getElementById('areas-nav'))iniciar();
  if(typeof dashboardSession!=='undefined'&&!dashboardSession)document.getElementById('areas-nav')?.remove();},1500);
})();
