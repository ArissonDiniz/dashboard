// Configuração PÚBLICA: somente URL e chave publishable/anon. Nunca use service_role aqui.
window.APP_CONFIG = Object.freeze({
  supabaseUrl: 'https://ylaqhnlbrtarnpxpamkd.supabase.co',
  supabaseKey: 'sb_publishable_5alOV1WiFpzVNgDzBDGn_w_xG0Vm3c_',
  campaign: '2026.2'
});

;
/* Regras compartilhadas e testáveis. Datas civis no fuso da campanha. */
(function(root){
 const clean=v=>String(v??'').trim();
 const statuses=['Não contatado','Contatado','Aguardando retorno','Retornar depois'];
 const empty=()=>({welcome:'Pendente',outcome:'Não informado',promised:'',event:'record_update',status:statuses[0],notes:'',lastContact:'',nextContact:'',author:'',updatedAt:'',version:0});
 const cancelled=r=>!['','nan','none','nat','null'].includes(clean(r.DATA_CANCELAMENTO).toLowerCase());
 const paid=r=>clean(r.PRIMEIRA_MENSALIDADE_COBRADA_PAGA)==='S';
 function dateOnly(v){const s=clean(v);if(!s)return null;let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/),d=m?m[1]+'-'+m[2]+'-'+m[3]:null;if(!d){m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)d=m[3]+'-'+m[2]+'-'+m[1];}return d&&dateValid(d)?d:null;}
 function dateValid(s){return !s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
 function today(zone,now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
 function plus(d,n){return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
 function range(period,t,from='',to=''){
  if(period==='all')return {from:null,to:null};if(period==='today')return {from:t,to:t};
  if(period==='week'){const dow=new Date(t+'T12:00:00Z').getUTCDay()||7;return{from:plus(t,1-dow),to:plus(t,7-dow)};}
  if(period==='month')return{from:t.slice(0,7)+'-01',to:plus(t.slice(0,7)+'-01',32).slice(0,7)+'-01',exclusiveTo:true};
  if(period==='year')return{from:t.slice(0,4)+'-01-01',to:t.slice(0,4)+'-12-31'};
  if(!dateValid(from)||!dateValid(to)||from&&to&&from>to)throw Error('Confira o intervalo: a data inicial deve ser anterior ou igual à final.');
  return {from:from||null,to:to||null};
 }
 function inRange(value,range){if(!range.from&&!range.to)return true;const d=dateOnly(value);return !!d&&(!range.from||d>=range.from)&&(!range.to||(range.exclusiveTo?d<range.to:d<=range.to));}
 function metric(r,type,range,mode='events'){
  if(r._missing)return type==='missing';if(type==='missing')return false;
  const entered=inRange(r.DATA_MATRICULA,range);
  if(type==='paga')return paid(r)&&(mode==='cohort'?entered:inRange(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA,range));
  if(type==='cancel')return cancelled(r)&&(mode==='cohort'?entered:inRange(r.DATA_CANCELAMENTO,range));
  if(!entered)return false;
  if(type==='ativos')return !cancelled(r);if(type==='naoPaga')return !cancelled(r)&&!paid(r);return true;
 }
 function draft(d,t){
  if(!statuses.includes(d.status)||typeof d.notes!=='string'||d.notes.length>6000)throw Error('Confira status e observações (máximo de 6.000 caracteres).');
  if(!dateValid(d.lastContact)||!dateValid(d.nextContact)||d.lastContact>t)throw Error('Confira as datas; último contato não pode ser futuro.');
  if(d.status!=='Não contatado'&&!d.lastContact)throw Error('Informe a data do último contato.');
  if(d.status==='Retornar depois'&&!d.nextContact)throw Error('Informe a data de retorno.');
  if(d.nextContact&&d.lastContact&&d.nextContact<d.lastContact)throw Error('Retorno anterior ao contato.');return d;
 }
 const due=(s,t)=>s.nextContact?(s.nextContact<t?'late':s.nextContact===t?'today':'future'):'none';
 const idle=(s,t,n)=>!s.lastContact||(Date.parse(t)-Date.parse(s.lastContact))/86400000>=n;
 function priority(a,b,t){const rank=s=>({late:0,today:1,future:3,none:s.status==='Não contatado'?2:4})[due(s,t)];return rank(a)-rank(b)||(a.nextContact||'9999').localeCompare(b.nextContact||'9999')||(a.lastContact||'').localeCompare(b.lastContact||'');}
 function goalEligible(r,c){const enrolled=dateOnly(r.DATA_MATRICULA),payment=dateOnly(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA);return !r._missing&&paid(r)&&!!enrolled&&!!payment&&enrolled>=c.starts_on&&(!c.ends_on||enrolled<=c.ends_on)&&payment>=c.starts_on&&(!(c.payment_ends_on||c.ends_on)||payment<=(c.payment_ends_on||c.ends_on))&&(c.include_cancelled_paid_in_goal!==false||!cancelled(r));}
 function academicNote(r){return clean(r._engagement)==='Nota disciplina (data)';}
 function expectedDue(r){const d=dateOnly(r.DATA_MATRICULA);if(!d)return null;const y=Number(d.slice(0,4)),m=Number(d.slice(5,7));return m===6?y+'-08-10':(y+(m===12?1:0))+'-'+String(m%12+1).padStart(2,'0')+'-10';}
 function dueState(r,t){if(r._missing||cancelled(r)||paid(r))return 'na';const d=expectedDue(r);return !d?'unknown':d<t?'overdue':d===t?'today':'future';}
 const core={academicNote,expectedDue,dueState,goalEligible,clean,statuses,empty,cancelled,paid,dateOnly,dateValid,today,plus,range,inRange,metric,draft,due,idle,priority};
 root.Core=core;if(typeof module!=='undefined')module.exports=core;
})(typeof window!=='undefined'?window:globalThis);

;

// ══════════════ CONFIG ══════════════


// Metas por polo
const METAS={};
const POLO_CFG={};
const POLO_REG={};
const PC=['#FFD600','#22c55e','#3b82f6','#f97316','#a855f7','#06b6d4','#ec4899','#84cc16','#f59e0b'];
const MEDALS=['','',''];
const SISTEMA=['sistema leo','leo web','leo app'];

let rawRows=[],charts={},lastLoad=null,rankExpanded=false,isDark=true;
// Amarelo vivo tem baixo contraste em fundo claro — nesses casos usamos um dourado mais escuro
function warnColor(){return isDark?'#FFD600':'#735400';}
let _toastCount=0;

// ══════ SPARKS ══════
document.addEventListener('click',e=>{
  for(let i=0;i<8;i++){
    const s=document.createElement('div');s.className='spark';
    const angle=(360/8)*i*(Math.PI/180),dist=28+Math.random()*28,sz=3+Math.random()*4;
    s.style.cssText=`left:${e.clientX}px;top:${e.clientY}px;width:${sz}px;height:${sz}px;background:${Math.random()>.5?'#FFD600':'#fff'};--sx:${Math.cos(angle)*dist}px;--sy:${Math.sin(angle)*dist}px;animation-duration:${.4+Math.random()*.3}s`;
    document.body.appendChild(s);setTimeout(()=>s.remove(),700);
  }
});

// ══════ RIPPLE ══════
document.addEventListener('click',e=>{
  const b=e.target.closest('.btn');if(!b)return;
  const r=document.createElement('span');r.className='ripple';
  const rc=b.getBoundingClientRect(),sz=Math.max(rc.width,rc.height)*2;
  r.style.cssText=`width:${sz}px;height:${sz}px;left:${e.clientX-rc.left-sz/2}px;top:${e.clientY-rc.top-sz/2}px`;
  b.appendChild(r);setTimeout(()=>r.remove(),550);
});

// ══════ CLOCK ══════
(()=>{
  const D=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const M=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const tick=()=>{
    const n=new Date(),zone=window.dashboardZone||'America/Rio_Branco';
    document.getElementById('ck-t').textContent=n.toLocaleTimeString('pt-BR',{timeZone:zone});
    document.getElementById('ck-d').textContent=n.toLocaleDateString('pt-BR',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'});
  };
  tick();setInterval(tick,1000);
})();

// ══════ TEMA ══════
function toggleTheme(){
  isDark=!isDark;
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  document.getElementById('theme-btn').textContent=isDark?' Dark':' Light';
  if(rawRows.length)renderAll();
  showToast(isDark?'':'',isDark?'Modo escuro ativado':'Modo claro ativado','','info');
}

// ══════ TOAST ══════
function showToast(ic,title,msg,type='info'){
  if(_toastCount>=3)return; // max 3 simultâneos
  _toastCount++;
  const c=document.getElementById('toast-c');
  const t=document.createElement('div');t.className='toast';
  const colors={success:'#22c55e',warning:'#f97316',danger:'#ef4444',info:'#FFD600',pay:'#22c55e'};
  const col=colors[type]||colors.info;
  t.innerHTML=`<div class="t-ic">${ic}</div><div class="t-body">
    <div class="t-title">${title}</div>${msg?`<div class="t-msg">${msg}</div>`:''}
    <div class="t-bar"><div class="t-bf" style="background:${col}"></div></div></div>`;
  t.style.borderLeftColor=col;t.style.borderLeftWidth='3px';
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>{t.remove();_toastCount=Math.max(0,_toastCount-1);},350);},5000);
}

// ══════ FETCH ══════
async function refreshData(e){if(e)e.stopPropagation();await fetchData();}
// ══════ POLO KEY ══════
function getPoloInfo(row){
  const n=(row['NOME_DO_POLO']||'').trim();
  if(POLO_CFG[n])return POLO_CFG[n];
  const nl=n.toLowerCase();
  const f=Object.entries(POLO_CFG).find(([k])=>k.toLowerCase()===nl);
  if(f)return f[1];
  return{k:n.toUpperCase(),r:'?'};
}
function getPoloKey(r){return getPoloInfo(r).k;}

// ══════ PARSE DATA — ROBUSTO ══════
// Google Sheets CSV exporta "2026-06-03 00:00:00"
// Criamos data LOCAL: new Date(ano, mes-1, dia)
function parseDateStr(raw){
  if(!raw||raw==='nan'||raw==='None'||raw==='null'||!raw.trim())return null;
  const s=raw.trim();
  // YYYY-MM-DD (com ou sem hora: "2026-06-03" ou "2026-06-03 00:00:00")
  const m1=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m1){const d=new Date(+m1[1],+m1[2]-1,+m1[3],12,0,0,0);if(!isNaN(d))return d;}
  // DD/MM/YYYY
  const m2=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m2){const d=new Date(+m2[3],+m2[2]-1,+m2[1],12,0,0,0);if(!isNaN(d))return d;}
  // MM/DD/YYYY (fallback)
  const m3=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m3){const d=new Date(+m3[3],+m3[1]-1,+m3[2],12,0,0,0);if(!isNaN(d))return d;}
  return null;
}
function parseDatePag(row){return parseDateStr(row['DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA']||'');}
// Debug: expor no console para diagnóstico
window._debugDates=()=>{
  const rows=rawRows.filter(r=>(r['PRIMEIRA_MENSALIDADE_COBRADA_PAGA']||'').trim()==='S');
  const{from,to}=getDateRange();
  console.group('DEBUG pagamentos');
  console.log('Período:',from?from.toLocaleDateString('pt-BR'):'—','até',to?to.toLocaleDateString('pt-BR'):'—');
  rows.forEach(r=>{
    const d=parseDatePag(r);
    const raw=r['DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA'];
    const ok=d&&(!from||d>=from)&&(!to||d<=to);
    console.log(raw,'→',d?d.toLocaleDateString('pt-BR'):'ERRO','| no período:',ok,'| polo:',r['NOME_DO_POLO']);
  });
  console.groupEnd();
};

// ══════ FILTRO PERÍODO ══════

function onRegiaoChange(){
  const reg=document.getElementById('f-regiao').value;
  const sel=document.getElementById('f-polo');
  const prev=sel.value;
  sel.innerHTML='<option value="TODOS">Todos os polos</option>';
  const polos=[...new Set(rawRows.map(r=>{const i=getPoloInfo(r);if(reg!=='TODOS'&&i.r!==reg)return null;return i.k;}))].filter(Boolean).sort();
  polos.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=cap(p)+(POLO_REG[p]?' ('+POLO_REG[p]+')':'');sel.appendChild(o)});
  if(polos.includes(prev))sel.value=prev;
  renderAll();
}

// Retorna {from, to} como datas LOCAIS




// ══════ DATA DE MATRÍCULA (ENTRADA) — detecta automaticamente a coluna na planilha ══════
// Assim o filtro de período passa a valer para TODAS as métricas (total, ativos, cancelados,
// pagos e não pagos), não só para "1ª mensalidade paga".
let _matriculaDateKey;
function getMatriculaDateKey(){
  if(_matriculaDateKey!==undefined)return _matriculaDateKey;
  if(!rawRows.length){_matriculaDateKey=null;return null;}
  const keys=Object.keys(rawRows[0]);
  const candidates=keys.filter(k=>/^DATA/i.test(k)&&/MATRICUL/i.test(k)&&!/CANCEL/i.test(k)&&!/MENSALIDADE/i.test(k));
  _matriculaDateKey=candidates[0]||null;
  if(!_matriculaDateKey)console.warn('Coluna de data de matrícula não encontrada — o filtro de período afetará apenas "1ª mensalidade paga".');
  return _matriculaDateKey;
}
function getMatriculaDate(row){
  const key=getMatriculaDateKey();
  if(!key)return null;
  return parseDateStr(row[key]||'');
}
// Retorna true se o aluno "entrou" (matriculou-se) dentro do período selecionado no filtro


function periodLabel(){
  const v=document.getElementById('f-period').value;
  const labels={all:'Todo o período',today:'Hoje',week:'Esta semana',month:'Este mês',year:'Este ano',custom:'Personalizado'};
  if(v!=='custom')return labels[v]||v;
  const f=document.getElementById('f-from').value,t=document.getElementById('f-to').value;
  return f&&t?f.split('-').reverse().join('/')+' → '+t.split('-').reverse().join('/'):'Personalizado';
}

// ══════ PROCESS — filtra por polo/região e considera período ══════




function getCursos(rows){
  const mp=Object.create(null);
  const reg=document.getElementById('f-regiao').value;
  const polo=document.getElementById('f-polo').value;
  rows.forEach(r=>{
    if(!noPeriodoEntrada(r))return;
    const inf=getPoloInfo(r);
    if(reg!=='TODOS'&&inf.r!==reg)return;
    if(polo!=='TODOS'&&inf.k!==polo)return;
    const c=(r['NOME_DO_CURSO']||'').trim();if(!c)return;
    if(!mp[c])mp[c]={nome:c,total:0};mp[c].total++;
  });
  return Object.values(mp).sort((a,b)=>b.total-a.total);
}

function sum(a,k){return a.reduce((s,b)=>s+(b[k]||0),0)}
function cap(s){return(s||'').split(' ').map(w=>w?w[0].toUpperCase()+w.slice(1).toLowerCase():w).join(' ')}

// ══════ META LABEL + VALOR — respeita filtro ══════
function metaLabel(){
  const polo=document.getElementById('f-polo').value;
  const reg=document.getElementById('f-regiao').value;
  if(polo!=='TODOS')return 'Meta de '+cap(polo);
  if(reg!=='TODOS'){const rn={AC:'Acre · AC',RO:'Rondônia · RO',AM:'Amazonas · AM'};return 'Meta — '+rn[reg];}
  return 'Meta total da rede';
}

// ══════ FINISH LOAD ══════
function finishLoad(){
  // Guardar o polo selecionado antes de recriar o select
  const selPolo=document.getElementById('f-polo');
  const prevPolo=selPolo.value||'TODOS';
  const reg=document.getElementById('f-regiao').value||'TODOS';

  // Popular polos sem alterar região/período selecionados
  const polos=Object.keys(METAS).filter(Boolean).sort();
  selPolo.innerHTML='<option value="TODOS">Todos os polos</option>';
  polos.filter(p=>reg==='TODOS'||POLO_REG[p]===reg).forEach(p=>{
    const o=document.createElement('option');o.value=p;
    o.textContent=cap(p)+(POLO_REG[p]?' ('+POLO_REG[p]+')':'');
    selPolo.appendChild(o);
  });
  // Restaurar polo se ainda existir
  if([...selPolo.options].some(o=>o.value===prevPolo))selPolo.value=prevPolo;

  document.getElementById('hero-sec').style.display='block';

  document.getElementById('filters').style.display='flex';
  showContent();renderAll();
  // Toasts iniciais
  setTimeout(()=>{
    if(!dashboardSession)return;
    const data=processData(rawRows);
    const pg=sum(data,'paga');
    if(pg>0){showToast('','Pagamentos registrados',pg+' pagamento'+(pg!==1?'s':'')+' confirmado'+(pg!==1?'s':'')+' no período atual.','pay');}
    // Verificar se o último pagamento foi há mais de 3 dias
    const pagRows=rawRows.filter(r=>(r['PRIMEIRA_MENSALIDADE_COBRADA_PAGA']||'').trim()==='S');
    if(pagRows.length){
      const dates=pagRows.map(r=>parseDatePag(r)).filter(Boolean).sort((a,b)=>b-a);
      if(dates.length){
        const diff=Math.round((new Date()-dates[0])/(86400000));
        if(diff>=3)setTimeout(()=>dashboardSession&&showToast('','Atenção','Último pagamento há '+diff+' dia'+(diff!==1?'s':'')+'. Acione os colaboradores!','warning'),1500);
      }
    }
  },1000);
}

// ══════ RENDER ALL ══════


// ══════ HERO ══════


// ══════ PROJEÇÃO ══════


// ══════ KPIs ══════


// ══════ MODAL — detalhes dos KPIs ══════
function openModal(type,title){if(['total','ativos','paga','naoPaga','cancel'].includes(type))openCRM(type);}

// botão detalhes dos KPIs usa onclick direto no elemento

// ══════ EXPANDIR GRÁFICOS — recria com dados ao vivo ══════
function expandMetaBars(){
  document.getElementById('mbox').className='mbox mbox-big';
  document.getElementById('mtitle').textContent='Progresso da meta · linha de chegada por polo';
  const src=document.getElementById('meta-bars');
  document.getElementById('mbody').innerHTML=`<div style="padding:8px 0;max-height:600px;overflow-y:auto">${src.innerHTML}</div>`;
  document.getElementById('modal').style.display='flex';
}

function expandChart(canvasId,titulo,chartKey){
  document.getElementById('mbox').className='mbox mbox-big';
  document.getElementById('mtitle').textContent=titulo;
  // Criar canvas novo dentro do modal
  const wrap=document.createElement('div');
  wrap.style.cssText='position:relative;height:520px;width:100%';
  const nc=document.createElement('canvas');
  nc.id='modal-cv';
  wrap.appendChild(nc);
  document.getElementById('mbody').innerHTML='';
  document.getElementById('mbody').appendChild(wrap);
  // Recriar o gráfico com dados atuais no canvas novo
  const data=processData(rawRows);
  if(window._mc){window._mc.destroy();window._mc=null;}
  if(chartKey==='st')     _buildExpandSt(nc,data);
  else if(chartKey==='nao')   _buildExpandNao(nc,data);
  else if(chartKey==='dist')  _buildExpandDist(nc,data);
  document.getElementById('modal').style.display='flex';
}


function _buildExpandNao(nc,data){
  const s=[...data].filter(d=>d.total>0).sort((a,b)=>b.naoPaga-a.naoPaga);
  window._mc=new Chart(nc,{type:'bar',
    data:{labels:s.map(d=>cap(d.polo)),datasets:[{label:'Não pagaram',data:s.map(d=>d.naoPaga),backgroundColor:s.map((_,i)=>PC[i%PC.length]+'99'),borderColor:s.map((_,i)=>PC[i%PC.length]),borderWidth:1,borderRadius:6,maxBarThickness:40}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:TO()},
      scales:{x:{ticks:{color:TC(),font:{size:12}},grid:{color:GC()},beginAtZero:true},y:{ticks:{color:TC(),font:{size:12,family:'Inter'}},grid:{display:false}}}}
  });
}
function _buildExpandDist(nc,data){
  const r=data.filter(d=>d.total>0);
  window._mc=new Chart(nc,{type:'pie',
    data:{labels:r.map(d=>cap(d.polo)),datasets:[{data:r.map(d=>d.total),backgroundColor:PC.slice(0,r.length).map(c=>c+'aa'),borderColor:isDark?'#0c0d11':'#fff',borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'right',labels:{color:isDark?'#aaa':'#555',font:{family:'Inter',size:12},boxWidth:12,padding:10}},tooltip:TO()}}
  });
}
function closeModal(){
  document.getElementById('modal').style.display='none';
  if(window._mc){window._mc.destroy();window._mc=null;}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

// ══ EXPORTAR LISTA DE ALUNOS ══


// ══════ CHART OPTS ══════
function TO(){
  return{backgroundColor:isDark?'#14151a':'#fff',
    borderColor:isDark?'rgba(255,214,0,.18)':'rgba(0,0,0,.15)',borderWidth:1,
    titleColor:isDark?'#fff':'#111',bodyColor:isDark?'#888':'#555',
    padding:11,cornerRadius:9,
    titleFont:{family:'Inter',weight:'700',size:12},bodyFont:{family:'Inter',size:11}};
}
function GC(){return isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.07)';}


// ══════ BARRAS META ══════
function renderMetaBars(data){
  const relevant=data.filter(d=>d.total>0||d.paga>0||d.meta>0);
  if(!relevant.length){document.getElementById('meta-bars').innerHTML='<div style="color:var(--tx3);font-size:12px">Sem dados.</div>';return;}
  const html=relevant.map((d,i)=>{
    const pct=d.meta>0?Math.round(d.paga/d.meta*100):0;
    const color=pct>=50?PC[i%PC.length]:pct>=20?'#f97316':'#ef4444';
    const faltam=Math.max(0,d.meta-d.paga);
    const gradient=`linear-gradient(90deg,${color}99,${color})`;
    return `<div class="mb-item" data-performance="${pct>=50?'high':pct>=25?'middle':'low'}">
      <div class="mb-header">
        <span class="mb-polo">${esc(cap(d.polo))}</span>
        <span class="mb-vals">${d.paga}/${d.meta||'—'} &nbsp;
          <strong style="color:${color}">${pct}%</strong>
          ${d.meta>0?'<span style="color:var(--tx3);font-size:9px"> META</span>':''}
        </span>
      </div>
      <div class="mb-track">
        ${d.meta>0?'<div class="mb-goal-line"></div>':''}
        <div class="mb-fill" style="width:${Math.min(pct,100)}%;background:${gradient}"></div>
      </div>
      <div class="mb-sub">
        ${d.meta>0&&faltam>0
          ?`Faltam <strong style="color:${color}">${faltam}</strong> pagamento${faltam!==1?'s':''} para a meta`
          :d.meta>0?'<strong style="color:#22c55e"> Meta atingida!</strong>'
          :'<span style="color:var(--tx3)">Sem meta definida</span>'}
      </div>
    </div>`;
  }).join('');
  document.getElementById('meta-bars').innerHTML=html;
}

// ══════ STATUS CHART ══════


// ══════ NÃO PAGOU ══════
function renderNaoChart(data){
  const s=[...data].filter(d=>d.total>0).sort((a,b)=>b.naoPaga-a.naoPaga);
  if(charts.nao)charts.nao.destroy();
  charts.nao=new Chart(document.getElementById('ch-nao'),{type:'bar',
    data:{labels:s.map(d=>cap(d.polo)),datasets:[{label:'Não pagaram',data:s.map(d=>d.naoPaga),
      backgroundColor:s.map((_,i)=>PC[i%PC.length]+'77'),borderColor:s.map((_,i)=>PC[i%PC.length]),
      borderWidth:1,borderRadius:4,maxBarThickness:18}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:TO()},
      scales:{x:{ticks:{color:TC(),font:{size:10}},grid:{color:GC()},beginAtZero:true},
        y:{ticks:{color:TC(),font:{size:10,family:'Inter'}},grid:{display:false}}}}
  });
}

// ══════ DISTRIBUIÇÃO ══════
function renderDistChart(data){
  const r=data.filter(d=>d.total>0);
  if(charts.dist)charts.dist.destroy();
  charts.dist=new Chart(document.getElementById('ch-dist'),{type:'pie',
    data:{labels:r.map(d=>cap(d.polo)),datasets:[{data:r.map(d=>d.total),
      backgroundColor:PC.slice(0,r.length).map(c=>c+'aa'),borderColor:isDark?'#0c0d11':'#fff',borderWidth:3}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{color:TC(),font:{size:9,family:'Inter'},boxWidth:7,padding:6}},tooltip:TO()}}
  });
}

// ══════ RANK ══════
function renderRankColab(rows){
  const colabs=getColabs(rows);
  const maxP=Math.max(...colabs.map(c=>c.paga),1);
  const TOP=5;
  function mkItem(c,i){
    const medal='';
    const color=i===0?warnColor():i===1?'#c0c0c0':i===2?'#cd7f32':PC[i%PC.length];
    return `<div class="ritem">
      ${medal?`<div class="rmed">${medal}</div>`:`<div class="rnum">${i+1}º</div>`}
      <div class="rinfo">
        <div class="rname">${esc(c.nome)}</div>
        <div class="rpolo">${c.polo||'—'}</div>
        <div class="rbg"><div class="rbf" style="width:${Math.round(c.paga/maxP*100)}%;background:${color}"></div></div>
      </div>
      <div style="text-align:right">
        <div class="rbadge" style="background:${i===0?'rgba(255,214,0,.1)':'rgba(128,128,128,.08)'};color:${color};border:1px solid ${color}22">
          ${c.paga} pago${c.paga!==1?'s':''}
        </div>
        <div style="font-size:9px;color:var(--tx3);margin-top:3px">${c.total} matrícula${c.total!==1?'s':''}</div>
      </div>
    </div>`;
  }
  if(!colabs.length){document.getElementById('rank-top').innerHTML='<div style="color:var(--tx3);font-size:12px;padding:12px">Sem dados no período/filtro selecionado.</div>';document.getElementById('rank-more-btn').style.display='none';return;}
  document.getElementById('rank-top').innerHTML=colabs.slice(0,TOP).map((c,i)=>mkItem(c,i)).join('');
  document.getElementById('rank-rest').innerHTML=colabs.slice(TOP).map((c,i)=>mkItem(c,i+TOP)).join('');
  const rest=colabs.slice(TOP).length;
  const btn=document.getElementById('rank-more-btn');
  if(rest>0){btn.style.display='flex';document.getElementById('rank-rest').className='rmore-hidden'+(rankExpanded?' open':'');document.getElementById('rmi').textContent=rankExpanded?'▲':'▼';document.getElementById('rmtx').textContent=rankExpanded?'Recolher':'Ver mais '+rest+' colaborador'+(rest!==1?'es':'');}
  else btn.style.display='none';
}
function toggleRankMore(){
  rankExpanded=!rankExpanded;
  document.getElementById('rank-rest').className='rmore-hidden'+(rankExpanded?' open':'');
  document.getElementById('rmi').textContent=rankExpanded?'▲':'▼';
  const n=document.getElementById('rank-rest').children.length;
  document.getElementById('rmtx').textContent=rankExpanded?'Recolher':'Ver mais '+n+' colaborador'+(n!==1?'es':'');
}

// ══════ CURSOS ══════
function renderCursos(rows){
  const cursos=getCursos(rows);
  const maxT=Math.max(...cursos.map(c=>c.total),1);
  if(!cursos.length){document.getElementById('cursos-list').innerHTML='<div style="color:var(--tx3);font-size:12px">Sem dados.</div>';return;}
  const top=cursos.slice(0,5);
  const bot=cursos.length>5?cursos.slice(-3).filter(c=>c.total<(top[top.length-1]?.total||999)):[];
  const tC=[warnColor(),'#22c55e','#3b82f6','#a855f7','#06b6d4'];
  const mkci=(c,i,col)=>`<div class="ci"><div class="ci-rank">${i+1}º</div>
    <div class="ci-name" title="${esc(c.nome)}">${esc(c.nome)}</div>
    <div class="ci-bg"><div class="ci-f" style="width:${Math.round(c.total/maxT*100)}%;background:${col}"></div></div>
    <div class="ci-n" style="color:${col}">${c.total}</div></div>`;
  let html=`<div class="curso-sec"><div class="curso-sec-label"> Mais vendidos</div>${top.map((c,i)=>mkci(c,i,tC[i]||'#555')).join('')}</div>`;
  if(bot.length)html+=`<div class="curso-sec"><div class="curso-sec-label"> Menos vendidos</div>${bot.map((c,i)=>mkci(c,cursos.length-bot.length+i,'#ef4444')).join('')}</div>`;
  document.getElementById('cursos-list').innerHTML=html;
}

// ══════ TABLE ══════


// ══════ UI ══════
function showLoading(){['content','filters','hero-sec','proj-bar'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none'});document.getElementById('loading').style.display='flex';}
function hideLoading(){document.getElementById('loading').style.display='none'}
function showContent(){hideLoading();document.getElementById('content').style.display='block'}

// ══════ BOOT ══════
// Listener para cliques nos KPIs
document.addEventListener('click', function(e){
  var kpi = e.target.closest('.kpi[data-mid]');
  if(kpi){
    var mid = kpi.getAttribute('data-mid');
    var ml  = kpi.getAttribute('data-ml');
    openModal(mid, ml);
  }
});



;
let authEpoch=0;
let db=null,dashboardSession=null,crmStates={},missingRows=[],snapshot=null,dataBusy=false,currentProfile=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function authMessage(s){document.getElementById('auth-message').textContent=s;}
function clearPrivateUI(){
 authEpoch++;
 rawRows=[];missingRows=[];crmStates={};snapshot=null;dashboardSession=null;currentProfile=null;
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

;
function filterMode(){return document.getElementById('f-mode').value;}
function localToday(){return Core.today(dashboardSession?.zone||'America/Rio_Branco');}
function getDateRange(){return Core.range(document.getElementById('f-period').value,localToday(),document.getElementById('f-from').value,document.getElementById('f-to').value);}
function scope(r){const p=getPoloInfo(r),reg=document.getElementById('f-regiao').value,po=document.getElementById('f-polo').value;return(reg==='TODOS'||p.r===reg)&&(po==='TODOS'||p.k===po);}
function matchesMetric(r,type){return scope(r)&&Core.metric(r,type,getDateRange(),filterMode());}
function pagouNoPeriodo(r){return Core.metric(r,'paga',getDateRange(),filterMode());}
function noPeriodoEntrada(r){return Core.inRange(r.DATA_MATRICULA,getDateRange());}
function goalEligible(r){return Core.goalEligible(r,snapshot.campaign);}
function cumulative(){return processData(rawRows,true).map(d=>({...d,paga:d.goalPaid}));}
function processData(rows,all=false){
 const mp=Object.create(null),range=all?{from:null,to:null}:getDateRange();
 Object.keys(METAS).forEach(p=>{if(scope({NOME_DO_POLO:snapshot?.polos.find(x=>x.short_name===p)?.name||p}))mp[p]={polo:p,reg:POLO_REG[p],total:0,ativos:0,cancel:0,paga:0,naoPaga:0,cohortPaid:0,activePaid:0,goalPaid:0,cohortCancel:0,meta:METAS[p]};});
 rows.filter(scope).forEach(r=>{const p=getPoloInfo(r),d=mp[p.k]??={polo:p.k,reg:p.r,total:0,ativos:0,cancel:0,paga:0,naoPaga:0,cohortPaid:0,activePaid:0,goalPaid:0,cohortCancel:0,meta:0};
 ['total','ativos','cancel','paga','naoPaga'].forEach(k=>{if(Core.metric(r,k,range,filterMode()))d[k]++;});
 if(goalEligible(r))d.goalPaid++;
 if(Core.inRange(r.DATA_MATRICULA,range)){if(Core.paid(r)&&!Core.cancelled(r))d.activePaid++;if(Core.paid(r))d.cohortPaid++;if(Core.cancelled(r))d.cohortCancel++;}
 });return Object.values(mp);
}
function renderAll(){
 try{getDateRange();document.getElementById('filter-error').textContent='';
 const data=processData(rawRows),acc=cumulative();renderHero(acc);renderKPIs(data,acc);renderMetaBars(acc);renderRankColab(rawRows);renderCursos(rawRows);renderTable(data);if(typeof renderWorkspace==='function')renderWorkspace(data);
 document.getElementById('metric-context').textContent=filterMode()==='events'?'Movimentação: matrícula pela data de entrada; pagamentos pela data do pagamento; cancelamentos pela data do cancelamento. Ativos, não pagantes e cursos referem-se às entradas do período.':'Matrículas do período: todos os indicadores operacionais analisam as mesmas entradas e sua situação atual.';
 document.getElementById('meta-context').textContent='A meta usa o acumulado da campanha. Região e polo também filtram a meta.';
 document.getElementById('campaign-deadline').textContent='Matrículas até '+displayDate(snapshot.campaign.ends_on)+' · pagamentos até '+displayDate(snapshot.campaign.payment_ends_on||snapshot.campaign.ends_on);
 }catch(e){document.getElementById('filter-error').textContent=e.message;}
}
function renderHero(data){
 const pg=sum(data,'paga'),meta=sum(data,'meta'),po=document.getElementById('f-polo').value;
 const visiblePolos=data.map(d=>cap(d.polo));document.getElementById('hero-polo').textContent=po!=='TODOS'?'Polo '+cap(po):visiblePolos.length===1?'Polo '+visiblePolos[0]:currentProfile?.role==='admin'?'Visão da rede':'Polos: '+visiblePolos.join(' · ');
 document.getElementById('hero-sub').textContent=(snapshot?.campaign.name||'Campanha')+' · '+(po==='TODOS'?'Polos autorizados':cap(po));
 document.getElementById('hero-st').innerHTML=[{v:pg+' / '+meta,l:'Pagamentos na meta'},{v:snapshot.last_synced_at?new Date(snapshot.last_synced_at).toLocaleString('pt-BR',{timeZone:dashboardSession.zone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sem importação',l:'Relatório atualizado · Acre'}].map(s=>`<div class="hs"><div class="hs-v">${esc(s.v)}</div><div class="hs-l">${esc(s.l)}</div></div>`).join('');
}
function renderKPIs(data,acc){
 const tot=sum(data,'total'),pg=sum(data,'paga'),at=sum(data,'ativos'),np=sum(data,'naoPaga'),ca=sum(data,'cancel'),cp=sum(data,'cohortPaid'),mt=sum(acc,'meta'),ap=sum(acc,'paga');
 const activePaid=sum(data,'activePaid');const ratio=at?Math.round(activePaid/at*100):0,progress=mt?Math.round(ap/mt*100):0;const cohort=filterMode()==='cohort';
 const best=acc.filter(d=>d.meta>0).sort((a,b)=>b.paga/b.meta-a.paga/a.meta)[0];
 const k=(l,v,s,ic,c,mid,b=null)=>({l,v,s,ic,c,mid,b});
 const first=[k('Matrículas geradas',tot,'no período','','kb','total'),k('Matrículas ativas',at,'dos matriculados no período','','kg2c','ativos'),k('1ª mensalidade paga',pg,'inclui cancelados pagos','','ky','paga'),k('Ativos sem pagamento',np,'dos matriculados no período','','kr','naoPaga'),k('Progresso da meta',progress+'%',ap+' de '+mt+' · acumulado','','ko','meta',progress),k(cohort?'Cancelados das entradas':'Cancelamentos no período',ca,cohort?'dos matriculados no período':'pela data do cancelamento','','kr','cancel')];
 const second=[k('Faltam para meta',Math.max(0,mt-ap),'pagamentos · acumulado','⏳','ko','faltam'),k('Conversão dos ativos',ratio+'%',activePaid+' ativos pagos ÷ '+at+' ativos','','kg2c','conv',ratio),k('Meta da campanha',mt,'polos selecionados · acumulado','','kw','metaT'),k('Polos com pagamentos',data.filter(d=>d.paga>0).length,'de '+data.length+' polos autorizados','','kp','polosPag'),k('Polo destaque',best?cap(best.polo):'—','por atingimento acumulado','','ky','destaque')];
 const render=(id,items)=>document.getElementById(id).innerHTML=items.map((x,i)=>`<div class="kpi ${x.c}" style="animation-delay:${i*.05}s" tabindex="0" role="button" aria-label="${esc(x.l)}" data-mid="${x.mid}" data-ml="${esc(x.l)}"><div class="kpi-top"><div class="kpi-ic">${metricIcon(x.mid)}</div><span class="kpi-det">detalhes ▸</span></div><div class="kpi-l">${esc(x.l)}</div><div class="kpi-v" style="${typeof x.v==='string'&&x.v.length>7?'font-size:18px':''}">${esc(x.v)}</div><div class="kpi-s">${esc(x.s)}</div>${x.b!==null?`<div class="kpi-bw"><div class="kpi-bf" style="width:${Math.min(x.b,100)}%"></div></div>`:''}</div>`).join('');render('kg1',first);render('kg2',second.filter(x=>['faltam','conv'].includes(x.mid)));
}
function statusParts(){const list=rawRows.filter(r=>scope(r)&&noPeriodoEntrada(r));return [list.filter(r=>!Core.cancelled(r)&&Core.paid(r)).length,list.filter(r=>!Core.cancelled(r)&&!Core.paid(r)).length,list.filter(r=>Core.cancelled(r)&&Core.paid(r)).length,list.filter(r=>Core.cancelled(r)&&!Core.paid(r)).length];}
function getColabs(rows){const mp=new Map();rows.filter(scope).forEach(r=>{const name=r.ESPECIALIZACAO_MATRICULOU;if(!name||SISTEMA.some(s=>name.toLowerCase().includes(s)))return;const code=r.ESPECIALIZACAO_MATRICULOU_CODIGO||name,key=code+'|'+r.CODIGO_DO_POLO;const c=mp.get(key)||{nome:name,polo:cap(getPoloKey(r)),total:0,paga:0};if(noPeriodoEntrada(r))c.total++;if(pagouNoPeriodo(r))c.paga++;mp.set(key,c);});return [...mp.values()].filter(c=>c.total||c.paga).sort((a,b)=>b.paga-a.paga||b.total-a.total);}
function TC(){return isDark?'#b5bbc8':'#4b5563';}
function onPeriodChange(){document.getElementById('custom-dates').style.display=document.getElementById('f-period').value==='custom'?'flex':'none';renderAll();}
const oldOpenModal=openModal;
openModal=function(type,title){
 if(['meta','faltam','metaT','destaque','conv','polosPag'].includes(type)){
  const data=type==='conv'||type==='polosPag'?processData(rawRows):cumulative();
  document.getElementById('mbox').className='mbox';document.getElementById('mtitle').textContent=title;
  document.getElementById('mbody').innerHTML=data.filter(d=>type!=='polosPag'||d.paga>0).map(d=>{
   const val=type==='conv'?(d.ativos?Math.round(d.activePaid/d.ativos*100):0)+'% · '+d.activePaid+'/'+d.ativos:type==='metaT'?d.meta:type==='faltam'?Math.max(0,d.meta-d.paga):type==='polosPag'?d.paga:d.paga+'/'+d.meta;
   return '<div class="mrow"><span>'+esc(cap(d.polo))+'</span><strong>'+esc(val)+'</strong></div>';
  }).join('');document.getElementById('modal').style.display='flex';return;
 }
 oldOpenModal(type,title);
};
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.kpi[data-mid]')){e.preventDefault();e.target.click();}});
function renderTable(data){
 const acc=cumulative(),lookup=new Map(acc.map(d=>[d.polo,d]));
 const pct=d=>d.meta?Math.round(d.paga/d.meta*100):0;
 const progress=d=>{const n=pct(d),c=n>=50?'var(--g)':n>=25?'var(--warn)':'var(--r)';return d.meta?'<div class="pw"><div class="pb"><div class="pf" style="width:'+Math.min(n,100)+'%;background:'+c+'"></div></div><div class="pp" style="color:'+c+'">'+n+'%</div></div>':'Sem meta';};
 const badge=(v,c)=>'<span class="pl '+(v?c:'px')+'">'+v+'</span>';
 const ranked=[...data].sort((a,b)=>{const x=lookup.get(a.polo)||a,y=lookup.get(b.polo)||b;return (y.meta?y.paga/y.meta:0)-(x.meta?x.paga/x.meta:0)||b.paga-a.paga;});
 const rows=ranked.map((d,i)=>{const goal=lookup.get(d.polo)||d;const tone=pct(goal)>=50?'var(--g)':pct(goal)>=25?'var(--warn)':'var(--r)';return '<tr data-performance="'+(pct(goal)>=50?'high':pct(goal)>=25?'middle':'low')+'" style="--performance:'+tone+'"><td><span class="rank-position rank-place-'+Math.min(i+1,4)+'">'+(i+1)+'º</span></td><td><strong>'+esc(cap(d.polo))+'</strong><small class="rank-region">'+esc(d.reg)+'</small></td><td>'+d.total+'</td><td>'+d.ativos+'</td><td>'+badge(d.cancel,'pr2')+'</td><td>'+badge(d.paga,'pg')+'</td><td>'+badge(d.naoPaga,'pr2')+'</td><td>'+goal.meta+'</td><td>'+progress(goal)+'</td></tr>';}).join('');
 const total={paga:sum(acc,'paga'),meta:sum(acc,'meta')};
 document.getElementById('polo-table').innerHTML='<thead><tr>'+['#','Polo','Matrículas','Ativos','Cancelamentos','1ª paga','Sem pagamento','Meta','Progresso da campanha'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+rows+'<tr class="tr-tot"><td>—</td><td><strong>Total filtrado</strong></td>'+['total','ativos','cancel','paga','naoPaga'].map(k=>'<td>'+sum(data,k)+'</td>').join('')+'<td>'+total.meta+'</td><td>'+progress(total)+'</td></tr></tbody>';
}

;
const crm={open:false,dirty:false,edit:null,visible:[],page:0,saving:false,requestId:null,requestBody:null,historyToken:0};
const $c=id=>document.getElementById('crm-'+id);
function crmToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:dashboardSession?.zone||'America/Rio_Branco',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function crmState(r){return crmStates[r._key]||Core.empty();}
function paymentLabel(r){return r._missing?'Ausente do relatório':(Core.paid(r)?'Pago':'Não pago')+(Core.cancelled(r)?' · cancelado':' · ativo');}
function contactTag(s){return '<span class="crm-tag crm-s'+Core.statuses.indexOf(s.status)+'">'+esc(s.status)+'</span>';}
function messageCRM(text){$c('message').textContent=text;const note=$c('editor-message');if(note)note.textContent=text;}
function openCRM(tipo,all=false){
  if(dataBusy)return;
  if(!dashboardSession){alert('Carregue os dados pelo aplicativo publicado primeiro.');return;}
  crm.open=true;crm.page=0;$c('period').value=all?'all':'selected';['academic','credit','due'].forEach(id=>$c(id).value='');$c('payment').value=tipo;$c('search').value='';$c('status').value='';$c('priority').value='';
  const polos=[...new Set([...rawRows,...missingRows].map(getPoloKey))].sort();
  $c('polo').innerHTML='<option value="TODOS">Todos dentro do filtro principal</option>'+polos.map(p=>'<option value="'+esc(p)+'">'+esc(cap(p))+'</option>').join('');
  drawCRM();if(!$c('dialog').open)$c('dialog').showModal();
}
function closeCRM(){if(crm.saving)return;if(crm.dirty&&!confirm('Descartar alterações não salvas?'))return;crm.open=false;crm.dirty=false;crm.edit=null;crm.historyToken++;$c('dialog').close();}
$c('dialog').addEventListener('cancel',e=>{e.preventDefault();closeCRM();});
window.addEventListener('beforeunload',e=>{if(crm.dirty){e.preventDefault();e.returnValue='';}});
function filterCRM(){crm.page=0;drawCRM(false);}
function crmPage(d){crm.page+=d;drawCRM(false);}
function drawCRM(resetEditor=true){
  if(!crm.open)return;
  const tipo=$c('payment').value, query=$c('search').value.trim().toLocaleLowerCase('pt-BR'),polo=$c('polo').value,status=$c('status').value,priority=$c('priority').value;
  const days=Math.max(1,Math.min(3650,Number($c('days').value)||7)),today=crmToday();
  const all=$c('period').value==='all'||['today','late','welcome','idle','promise'].includes(priority);
  const base=(tipo==='missing'?missingRows:rawRows).filter(r=>scope(r)&&Core.metric(r,tipo,all?{from:null,to:null}:getDateRange(),filterMode()));
  crm.visible=base.filter(r=>{
    const s=crmState(r);
    if(polo!=='TODOS'&&getPoloKey(r)!==polo)return false;
    if(query&&!((r.NOME||'')+' '+(r.CODIGO_ALUNO||'')+' '+r._key).toLocaleLowerCase('pt-BR').includes(query))return false;
    if(!matchesLabels(r,today))return false;
    if(status&&s.status!==status)return false;
    if(priority==='welcome'&&s.welcome==='Concluído')return false;
    if(priority==='promise'&&!promiseLate(r,today))return false;
    if(priority==='new'&&s.status!=='Não contatado')return false;
    if(['today','late'].includes(priority)&&Core.due(s,today)!==priority)return false;
    if(priority==='idle'&&(r._missing||Core.paid(r)||Core.cancelled(r)||!Core.idle(s,today,days)))return false;
    return true;
  }).sort((a,b)=>($c('order').value==='priority'?Core.priority(crmState(a),crmState(b),today):0)||(a.NOME||'').localeCompare(b.NOME||'','pt-BR'));
  const pages=Math.max(1,Math.ceil(crm.visible.length/50));crm.page=Math.max(0,Math.min(pages-1,crm.page));
  $c('context').textContent=(all?'Toda a campanha':periodLabel())+' · '+document.getElementById('f-polo').selectedOptions[0].textContent;
  $c('count').textContent=crm.visible.length+' alunos encontrados';
  if(typeof syncCRMView==='function')syncCRMView();
  $c('page').textContent='Página '+(crm.page+1)+' de '+pages;
  $c('rows').innerHTML=crm.visible.slice(crm.page*50,crm.page*50+50).map((r,i)=>{
    const s=crmState(r),due=Core.due(s,today),label=due==='late'?' · ATRASADO':due==='today'?' · HOJE':'';
    return '<tr><td><strong>'+esc(r.NOME)+'</strong><br>'+esc(r.CODIGO_ALUNO||r._key)+'</td><td>'+esc(r.NOME_DO_CURSO)+'<br>'+esc(r.NOME_DO_POLO)+'</td><td>'+esc(paymentLabel(r))+compactLabels(r)+contactTag(s)+'</td><td>'+esc(displayDate(s.lastContact))+'</td><td style="color:'+(due==='late'?'var(--r)':due==='today'?'var(--o)':'inherit')+'">'+esc(displayDate(s.nextContact)+label)+'</td><td><button class="btn btn-sm btn-gh" onclick="editCRM('+ (crm.page*50+i)+')">Atender</button></td></tr>';
  }).join('')||'<tr><td colspan="6">Nenhum aluno encontrado com estes filtros.</td></tr>';
  if(resetEditor&&!crm.edit)$c('editor').hidden=true;
}
async function editCRM(index){
  if(crm.saving)return;if(crm.dirty&&!confirm('Descartar alterações não salvas?'))return;
  const r=crm.visible[index];crm.edit=r;crm.dirty=false;crm.requestId=null;crm.requestBody=null;
  const token=++crm.historyToken;messageCRM('Carregando histórico...');$c('editor').hidden=true;
  try{const history=await rpc('getHistory',r._key);if(token!==crm.historyToken||!crm.open)return;
    if(history.length)crmStates[r._key]=history[0].state;else delete crmStates[r._key];
    drawEditor(r,history);messageCRM('');
  }catch(e){if(token===crm.historyToken)messageCRM(e.message);}
}
function drawEditor(r,history){
  const s=crmState(r);crm.editVersion=s.version;
  $c('editor').hidden=false;
  $c('editor').innerHTML='<button class="btn btn-gh drawer-close" onclick="cancelEditCRM()">Fechar ficha</button><h3 tabindex="-1">'+esc(r.NOME)+'</h3>'+studentLabels(r)+'<p class="crm-info">Matrícula: '+esc(r.CODIGO_ALUNO)+' · Inscrição: '+esc(r._key)+'<br>Entrada: '+esc(r.DATA_MATRICULA)+' · Pagamento: '+esc(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA||'—')+' · Cancelamento: '+esc(r.DATA_CANCELAMENTO||'—')+' · '+esc(paymentLabel(r))+'<br>Telefone: '+esc(r.CELULAR||r.TELEFONE||'—')+' · E-mail: '+esc(r.EMAIL||'—')+'<br>Registro será atribuído a '+esc(dashboardSession.email)+'</p>'+whatsappContact(r)+
    '<div id="crm-editor-message" role="status" aria-live="polite"></div><form id="crm-form">'+followupFields(s)+'<div class="crm-bar"><label>Status<select id="crm-edit-status">'+Core.statuses.map(v=>'<option'+(v===s.status?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><label>Último contato<input type="date" id="crm-last" max="'+crmToday()+'" value="'+esc(s.lastContact)+'"></label><label>Próximo contato<input type="date" id="crm-next" value="'+esc(s.nextContact)+'"></label></div><label>Observações<textarea id="crm-notes" maxlength="6000">'+esc(s.notes)+'</textarea></label><div class="crm-bar"><button type="submit" id="crm-save" class="btn">Salvar atendimento</button><button type="button" class="btn btn-gh" onclick="cancelEditCRM()">Fechar atendimento</button></div></form><div id="crm-conflict"></div><details><summary>Histórico de contatos e alterações ('+history.length+')</summary>'+history.map(e=>'<div class="crm-history"><strong>Versão '+e.state.version+' · '+esc(e.state.updatedAt)+' · '+esc(e.state.author)+'</strong><br>'+esc(e.state.status)+' · Boas-vindas: '+esc(e.state.welcome)+' · Resultado: '+esc(e.state.outcome)+' · Promessa: '+esc(e.state.promised||'—')+' · Último: '+esc(e.state.lastContact||'—')+' · Retorno: '+esc(e.state.nextContact||'—')+'<br>'+esc(e.state.notes)+'</div>').join('')+'</details>';
  $c('form').addEventListener('input',()=>{crm.dirty=true;});
  $c('form').addEventListener('submit',e=>{e.preventDefault();saveCRM();});
  $c('editor').scrollTop=0;$c('editor').querySelector('h3').focus();
}
function cancelEditCRM(){if(crm.saving)return;if(crm.dirty&&!confirm('Descartar alterações não salvas?'))return;crm.dirty=false;crm.edit=null;crm.historyToken++;$c('editor').hidden=true;messageCRM('');}
async function saveCRM(){
  if(crm.saving||!crm.edit)return;
  let draft;try{draft=Core.draft({status:$c('edit-status').value,notes:$c('notes').value,lastContact:$c('last').value,nextContact:$c('next').value,welcome:$c('welcome').value,outcome:$c('outcome').value,promised:$c('promised').value,event:$c('event').value},crmToday());if(draft.outcome==='Prometeu pagamento'&&!draft.promised)throw Error('Informe a data prometida de pagamento.');if(draft.event==='contact'&&!draft.lastContact)throw Error('Informe a data do contato');}catch(e){messageCRM(e.message);return;}
  const body=JSON.stringify({key:crm.edit._key,version:crm.editVersion,draft});
  if(body!==crm.requestBody){crm.requestId=crypto.randomUUID();crm.requestBody=body;}
  crm.saving=true;crm.dirty=true;$c('form').querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=true);messageCRM('Salvando...');
  try{
    const result=await rpc('saveContact',{...JSON.parse(body),requestId:crm.requestId});
    if(!result.ok){
      crmStates[crm.edit._key]=result.state;crm.conflict=result.state;
      $c('conflict').innerHTML='<div class="crm-conflict">Outro colaborador salvou uma alteração. Seu rascunho permanece no formulário. Compare antes de salvar uma nova versão.<br><br>Registro atual: '+esc(result.state.author)+' · '+esc(result.state.updatedAt)+'<br>'+esc(result.state.status)+' · Último: '+esc(result.state.lastContact)+' · Retorno: '+esc(result.state.nextContact)+'<br>'+esc(result.state.notes)+'<br><br><button class="btn btn-gh btn-sm" type="button" onclick="reviewConflictCRM()">Revisei: manter meu rascunho para uma nova versão</button></div>';
      messageCRM('Conflito detectado. Nenhuma alteração sua foi gravada.');
    }else{
      crmStates[crm.edit._key]=result.state;crm.editVersion=result.state.version;crm.dirty=false;crm.requestBody=null;
      $c('conflict').innerHTML='';drawCRM(false);if(typeof renderWorkspace==='function')renderWorkspace(processData(rawRows));messageCRM(' Atendimento salvo e compartilhado. Versão '+result.state.version+'.');
      const key=crm.edit._key,token=++crm.historyToken;
      try{const history=await rpc('getHistory',key);if(token===crm.historyToken&&!crm.dirty&&crm.edit?._key===key)drawEditor(crm.edit,history);}catch(e){messageCRM(' Salvo. Histórico indisponível agora: '+e.message);}
    }
  }catch(e){messageCRM('Não foi possível confirmar o salvamento: '+e.message+' Seu rascunho foi mantido. Tente salvar novamente.');}
  finally{crm.saving=false;if($c('form'))$c('form').querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=false);}
}
function reviewConflictCRM(){crm.editVersion=crm.conflict.version;crm.requestBody=null;$c('conflict').textContent='Rascunho mantido. Ajuste o texto para incorporar as duas alterações e clique em Salvar atendimento.';messageCRM('Revisão habilitada; nada salvo ainda.');}
function exportCRM(format="xlsx"){
  const data=crm.visible.map(r=>{const s=crmState(r);return {'Nome':r.NOME,'Matrícula':r.CODIGO_ALUNO,'Chave':r._key,'Curso':r.NOME_DO_CURSO,'Polo':r.NOME_DO_POLO,'Situação':paymentLabel(r),'Telefone':r.CELULAR||r.TELEFONE,'Indicação de nota':Core.academicNote(r)?'Sim':'Sem indicação no relatório','Aproveitamento':r._credit===true?'S':r._credit===false?'N':'Não informado','Último acesso':r._lastAccess||'','Vencimento previsto':Core.dueState(r,crmToday())==='na'?'':Core.expectedDue(r)||'','Situação vencimento previsto':Core.dueState(r,crmToday()),'Data matrícula':r.DATA_MATRICULA,'Data pagamento':r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA,'Boas-vindas':s.welcome,'Resultado contato':s.outcome,'Pagamento prometido':s.promised,'Status':s.status,'Observações':s.notes,'Último contato':s.lastContact,'Próximo contato':s.nextContact,'Responsável':s.author,'Atualizado em':s.updatedAt};});
  if(!data.length){messageCRM('Nenhum aluno para exportar.');return;}
  if(format==='csv'){
    const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    const keys=Object.keys(data[0]);const csv='\ufeff'+[keys.map(cell).join(';'),...data.map(r=>keys.map(k=>cell(r[k])).join(';'))].join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='acompanhamento_'+crmToday()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
  }
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Acompanhamento');XLSX.writeFile(wb,'acompanhamento_'+crmToday()+'.xlsx');
}

function followupFields(s){const select=(id,label,values,value)=>'<label>'+label+'<select id="crm-'+id+'">'+values.map(x=>'<option'+(x===value?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';return '<div class="crm-bar">'+select('welcome','Boas-vindas',['Pendente','Tentativa sem resposta','Concluído'],s.welcome)+select('outcome','Resultado do contato',['Não informado','Sem resposta','Conversou','Prometeu pagamento','Precisa de suporte'],s.outcome)+'<label>Pagamento prometido<input type="date" id="crm-promised" value="'+esc(s.promised)+'"></label><label>Tipo de registro<select id="crm-event"><option value="record_update">Atualização cadastral / anotação</option><option value="contact">Contato realizado / tentativa</option></select></label></div>';}

function matchesLabels(r,today){const academic=$c('academic').value,credit=$c('credit').value,due=$c('due').value;
 if(academic==='yes'&&!Core.academicNote(r)||academic==='no'&&Core.academicNote(r))return false;
 if(credit==='yes'&&r._credit!==true||credit==='no'&&r._credit!==false||credit==='unknown'&&r._credit!=null)return false;
 return !due||Core.dueState(r,today)===due;
}
function studentLabels(r){const tags=[];const tag=(s,c='')=>'<span class="crm-tag '+c+'">'+esc(s)+'</span>';
 if(Core.academicNote(r))tags.push(tag('Com indicação de nota','tag-academic'));
 if(r._credit===true)tags.push(tag('Com aproveitamento','tag-academic'));
 if(r._lastAccess)tags.push(tag('Último acesso: '+r._lastAccess.split('-').reverse().join('/')));
 const dueTag=dueLabel(r);if(dueTag)tags.push(dueTag);
 return tags.length?'<div class="student-labels">'+tags.join(' ')+'</div>':'';
}

// Somente números brasileiros completos; nunca inventar DDD ou nono dígito.
function whatsappNumber(value){
 const raw=String(value||'').trim();if(!raw||!/^[+\d\s().-]+$/.test(raw))return null;
 let n=raw.replace(/\D/g,'');if(n.startsWith('0055'))n=n.slice(2);
 if((n.length===12||n.length===13)&&n.startsWith('55'))n=n.slice(2);
 const ddds=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
 if(!ddds.has(n.slice(0,2))||!(/^[1-9]\d[2-9]\d{7}$/.test(n)||/^[1-9]\d9\d{8}$/.test(n)))return null;
 return '55'+n;
}
function whatsappContact(r){
 const n=whatsappNumber(r.CELULAR)||whatsappNumber(r.TELEFONE);
 return n?'<a class="btn whatsapp-contact" href="https://wa.me/'+n+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Abrir WhatsApp · +'+n+'</a>':'<p class="crm-info">WhatsApp indisponível: confira o telefone com DDD no relatório.</p>';
}

function dueLabel(r,today=crmToday()){
 const state=Core.dueState(r,today);if(state==='na')return '';
 const date=displayDate(Core.expectedDue(r));
 const labels={overdue:['Vencido','tag-overdue'],today:['Vence hoje','tag-today'],future:['A vencer','tag-future'],unknown:['Vencimento previsto indisponível','']};
 const [label,style]=labels[state]||labels.unknown;
 return '<span class="crm-tag due-label '+style+'">'+esc(label)+(state==='unknown'?'':'<br><span>Vencimento previsto: '+esc(date)+'</span>')+'</span>';
}

;
let adminData=null,adminBusy=false;
function adminMsg(s){document.getElementById('admin-message').textContent=s;}
function closeAdmin(){if(adminBusy)return;document.getElementById('admin-secret').textContent='';document.getElementById('admin-secret').hidden=true;document.getElementById('admin-dialog').close();}
document.getElementById('admin-dialog').addEventListener('cancel',e=>{e.preventDefault();closeAdmin();});
async function openAdmin(){
 if(currentProfile?.role!=='admin')return;
 document.getElementById('admin-dialog').showModal();await loadAdmin();
}
async function loadAdmin(){
 const epoch=authEpoch;adminMsg('Carregando...');try{const result=await edge('manage-users',{action:'list'});if(epoch!==authEpoch)return;adminData=result;drawAdmin();adminMsg('');}catch(e){adminMsg(e.message);}
}
function drawAdmin(){
 const users=adminData.users;
 document.getElementById('admin-body').innerHTML='<div class="admin-grid"><section><h3>Colaboradores e administradores</h3><p class="context">Cada pessoa usa sua própria conta. Administradores veem todos os polos.</p><div class="account-bar"><button class="btn" onclick="editUser()">Novo usuário</button><button class="btn btn-gh" onclick="loadAdmin()">Atualizar</button></div>'+users.map((u,i)=>'<div class="account-bar"><span><strong>'+esc(u.name)+'</strong><br>'+esc(u.email)+'<br>'+esc((u.role==='admin'?'Administrador':'Colaborador')+' · '+(u.active?'Ativo':'Desativado')+(u.must_change_password?' · Deve trocar senha':''))+'</span><button class="btn btn-gh btn-sm" onclick="editUser('+i+')" '+(u.id===currentProfile.id?'disabled':'')+'>Editar</button><button class="btn btn-gh btn-sm" onclick="resetUser('+i+')" '+(u.id===currentProfile.id||!u.active?'disabled':'')+'>Nova senha provisória</button><button class="btn btn-gh btn-sm delete-access" onclick="confirmDeleteUser('+i+')" '+(u.id===currentProfile.id?'disabled':'')+'>Excluir acesso</button></div>').join('')+'</section><section id="admin-editor"><p>Selecione Novo usuário ou Editar.</p></section></div><section><h3>Metas · '+esc(snapshot.campaign.name)+'</h3>'+snapshot.polos.map(p=>{const g=snapshot.goals.find(g=>g.polo_id===p.id);return g?'<form class="admin-goal" onsubmit="saveGoal(event,\''+esc(p.id)+'\','+g.version+')"><span>'+esc(p.short_name)+'</span><label>Meta<input aria-label="Meta '+esc(p.short_name)+'" name="target" type="number" min="0" max="1000000" value="'+g.target+'" required></label><button class="btn btn-gh btn-sm">Salvar</button></form>':'';}).join('')+'</section><section><h3>Últimas 10 importações</h3>'+adminData.imports.map(b=>'<p class="context">'+esc(b.imported_at)+' · '+esc(b.campaign_id)+' · '+b.result.rows+' linhas · '+b.result.new+' novos · '+b.result.became_paid+' passaram a pagos · '+b.result.missing+' ausentes</p>').join('')+'</section><section><h3>Últimas 50 ações administrativas</h3>'+adminData.audit.map(a=>'<p class="context">'+esc(a.created_at)+' · '+esc(users.find(u=>u.id===a.actor_id)?.name||a.actor_id)+' · '+esc(a.action)+' · '+esc(a.target_id)+'</p>').join('')+'<button class="btn btn-gh" onclick="backupData()">Baixar backup dos dados e históricos</button><p class="context">Guarde em local privado. O backup contém dados pessoais; não o envie ao GitHub.</p></section>';
}
function editUser(index){
 const u=index===undefined?null:adminData.users[index],assigned=adminData.memberships.filter(m=>m.user_id===u?.id).map(m=>m.polo_id);
 document.getElementById('admin-editor').innerHTML='<h3>'+(u?'Editar conta':'Cadastrar conta')+'</h3><form id="user-form"><label>Nome<input name="name" maxlength="120" value="'+esc(u?.name||'')+'" required></label><label>E-mail<input name="email" type="email" value="'+esc(u?.email||'')+'" '+(u?'disabled':'required')+'></label><label>Perfil<select name="role"><option value="collaborator">Colaborador</option><option value="admin" '+(u?.role==='admin'?'selected':'')+'>Administrador · todos os polos</option></select></label><p class="context">Selecione os polos do colaborador. Administradores têm acesso a todos.</p><div class="admin-polos">'+snapshot.polos.map(p=>'<label><input type="checkbox" name="polos" value="'+esc(p.id)+'" '+(assigned.includes(p.id)?'checked':'')+'> '+esc(p.short_name)+'</label>').join('')+'</div>'+(u?'<label><input type="checkbox" name="active" '+(u.active?'checked':'')+'> Conta ativa</label>':'')+'<button class="btn">'+(u?'Salvar alterações':'Criar e gerar senha provisória')+'</button></form>';
 document.getElementById('user-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);await adminAction(async()=>{const b={action:u?'edit':'create',id:u?.id,version:u?.version,name:f.get('name'),email:f.get('email'),role:f.get('role'),polos:f.getAll('polos'),active:f.has('active')};const result=await edge('manage-users',b);await loadAdmin();showTemporary(result);adminMsg('Cadastro salvo.');});};
}
function showTemporary(r){if(!r.temporary_password)return;const e=document.getElementById('admin-secret');e.hidden=false;e.textContent='Acesso criado para '+r.email+'\nSenha provisória: '+r.temporary_password+'\nExpira em 24 horas. Copie e entregue de forma privada à pessoa. Ao fechar este painel, a senha deixa de ser exibida.';}
async function adminAction(fn){if(adminBusy)return;adminBusy=true;document.getElementById('admin-body').inert=true;adminMsg('Salvando...');try{await fn();}catch(e){adminMsg(e.message);}finally{adminBusy=false;document.getElementById('admin-body').inert=false;}}
async function resetUser(i){const u=adminData.users[i];if(!confirm('Gerar nova senha provisória para '+u.name+'? O acesso atual será bloqueado até a troca.'))return;await adminAction(async()=>{const r=await edge('manage-users',{action:'reset',id:u.id});await loadAdmin();showTemporary(r);adminMsg('Senha provisória gerada.');});}
async function saveGoal(e,polo,version){e.preventDefault();const target=Number(new FormData(e.currentTarget).get('target'));await adminAction(async()=>{const {error}=await db.rpc('save_goal',{p_campaign:snapshot.campaign.id,p_polo:polo,p_target:target,p_version:version});if(error)throw error;await fetchData();drawAdmin();adminMsg('Meta salva.');});}
async function allRows(table){let result=[],offset=0;for(;;){let q=db.from(table).select('*');const orders={students:['campaign_id','inscription_id'],followups:['campaign_id','inscription_id'],goals:['campaign_id','polo_id'],user_polos:['user_id','polo_id']};for(const col of orders[table]||['id'])q=q.order(col);const {data,error}=await q.range(offset,offset+499);if(error)throw error;result.push(...data);if(data.length<500)return result;offset+=500;}}
async function backupData(){await adminAction(async()=>{const data={format:'uniasselvi-backup-v1',exported_at:new Date().toISOString()};for(const table of ['campaigns','polos','goals','students','followups','contact_history','profiles','user_polos','import_batches','admin_audit'])data[table]=await allRows(table);data.profiles.forEach(p=>{delete p.password_op;delete p.password_op_at;});const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='backup-dashboard-'+localToday()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);adminMsg('Backup baixado. Contas de autenticação e senhas não fazem parte deste arquivo.');});}
const drawAdminBase=drawAdmin;
drawAdmin=function(){drawAdminBase();document.getElementById('admin-body').insertAdjacentHTML('afterbegin','<section><h3>Campanhas e prazos</h3><p class="context">A meta geral é a soma das metas dos polos. Uma nova campanha mantém os dados e históricos anteriores separados.</p><div class="account-bar"><button class="btn btn-gh" onclick="editCampaign(false)">Editar campanha atual</button><button class="btn btn-gh" onclick="editCampaign(true)">Nova campanha</button></div><div id="campaign-editor"></div></section>');};
function editCampaign(fresh){const c=fresh?{id:'',name:'',starts_on:'',ends_on:'',payment_ends_on:'',version:0,include_cancelled_paid_in_goal:true}:snapshot.campaign;
 document.getElementById('campaign-editor').innerHTML=`<form id="campaign-form"><label>Semestre (ex.: 2027.1)<input name="id" value="${esc(c.id)}" pattern="[0-9]{4}\\.[12]" required ${fresh?'':'readonly'}></label><label>Nome<input name="name" value="${esc(c.name)}" maxlength="120" required></label><label>Início das matrículas<input type="date" name="start" value="${esc(c.starts_on)}" required></label><label>Fim das matrículas<input type="date" name="end" value="${esc(c.ends_on)}" required></label><label>Prazo final dos pagamentos<input type="date" name="payment" value="${esc(c.payment_ends_on)}" required></label><label><input type="checkbox" name="cancelled" ${c.include_cancelled_paid_in_goal?'checked':''}> Contar cancelados pagos na meta (o total de pagos continua incluindo todos)</label><button class="btn">Salvar campanha</button></form>`;
 document.getElementById('campaign-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await adminAction(async()=>{const id=f.get('id');const {error}=await db.rpc('save_campaign',{p_id:id,p_name:f.get('name'),p_start:f.get('start'),p_end:f.get('end'),p_payment_end:f.get('payment'),p_version:c.version,p_include_cancelled:f.has('cancelled')});if(error)throw error;await fetchData();document.getElementById('f-campaign').value=id;await fetchData();drawAdmin();adminMsg(fresh?'Campanha criada. Preencha as metas dos polos. Antes de sincronizar o relatório novo, altere CAMPAIGN_ID nas propriedades do Apps Script para '+id+'.':'Campanha atualizada.');});};
}

function confirmDeleteUser(i){
 const u=adminData.users[i];if(!u||u.id===currentProfile.id||adminBusy)return;
 document.getElementById('admin-editor').innerHTML='<h3>Excluir acesso</h3><p class="context">Excluir o acesso de <strong>'+esc(u.name)+'</strong> ('+esc(u.email)+')? A conta sairá desta lista e não poderá acessar o dashboard. Os atendimentos e a identificação do autor serão preservados. O cadastro será mantido para preservar o histórico, e o e-mail continuará reservado.</p><form id="delete-access-form"><label>Digite delete para confirmar<input name="confirmation" autocomplete="off" spellcheck="false" required pattern="delete"></label><button class="btn delete-access" type="submit">Confirmar exclusão</button><button class="btn btn-gh" type="button" onclick="drawAdmin()">Cancelar</button></form>';
 document.getElementById('delete-access-form').onsubmit=async e=>{e.preventDefault();const confirmation=new FormData(e.currentTarget).get('confirmation');if(confirmation!=='delete'){adminMsg('Digite delete exatamente para confirmar.');return;}await adminAction(async()=>{await edge('manage-users',{action:'delete',id:u.id,version:u.version,confirmation});await loadAdmin();adminMsg('Acesso excluído. Histórico de atendimentos preservado.');});};
 document.getElementById('admin-editor').scrollIntoView({behavior:'smooth',block:'nearest'});
}

;
/* Interface de acompanhamento. A autorização continua no Supabase. */
function metricIcon(type){const paths={total:'M8 3h8v4H8z M6 5H4v16h16V5h-2 M8 12h8 M8 16h5',ativos:'M8 12l3 3 5-6 M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18',paga:'M3 6h18v12H3z M3 10h18 M7 14h3',naoPaga:'M12 3L2 21h20z M12 9v5 M12 17v1',cancel:'M6 6l12 12 M6 18L18 6',meta:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18 M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8',conv:'M4 19V5 M4 19h16 M7 14l4-4 4 2 5-7',faltam:'M4 12h16 M15 7l5 5-5 5',metaT:'M5 4h14v17H5z M9 2h6v4H9z M8 10h8 M8 15h8',polosPag:'M3 21V9l9-6 9 6v12 M8 21v-6h8v6',destaque:'M7 3h10v7a5 5 0 0 1-10 0z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 15v6 M8 21h8'};return '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[type]||paths.total)+'"/></svg>';}
function promiseLate(r,t){const s=crmState(r);return !r._missing&&!Core.cancelled(r)&&!Core.paid(r)&&!!s.promised&&s.promised<t;}
function renderWorkspace(data){
 const one=data.length===1,restricted=snapshot.polos.length===1&&currentProfile.role!=='admin';
 document.getElementById('content').classList.toggle('single-polo',one);
 document.getElementById('f-polo').hidden=restricted;document.getElementById('f-regiao').hidden=restricted;for(const id of ['f-polo','f-regiao']){const label=document.getElementById(id).previousElementSibling;if(label?.classList.contains('fl'))label.hidden=restricted;}
 if(restricted)document.getElementById('session-label').textContent=currentProfile.name+' · Polo '+snapshot.polos[0].name;
 const rows=rawRows.filter(scope),t=crmToday();
 const items=[['welcome','Boas-vindas pendentes',r=>!Core.cancelled(r)&&crmState(r).welcome!=='Concluído'],['today','Retornos hoje',r=>!Core.cancelled(r)&&Core.due(crmState(r),t)==='today'],['late','Retornos atrasados',r=>!Core.cancelled(r)&&Core.due(crmState(r),t)==='late'],['promise','Promessas vencidas',r=>promiseLate(r,t)]];
 document.getElementById('work-queue').innerHTML=items.map(([key,title,fn])=>'<button class="queue-item" onclick="openQueue(\''+key+'\')"><strong>'+rows.filter(fn).length+'</strong><span>'+title+'</span><small>Ver alunos</small></button>').join('');
}
function openQueue(key){openCRM('ativos',true);$c('priority').value=key;filterCRM();}
function compactLabels(r){let parts=[];if(Core.academicNote(r))parts.push('Indicação de nota');if(r._credit===true)parts.push('Aproveitamento');return (parts.length?'<small class="academic-line">'+esc(parts.join(' · '))+'</small>':'')+'<small class="academic-line last-access">Último acesso: '+esc(r._lastAccess?displayDate(r._lastAccess):'não informado no relatório')+'</small>'+dueLabel(r);}
function crmView(key){if(crm.edit){cancelEditCRM();if(crm.edit)return;}$c('payment').value=key==='welcome'?'ativos':key;$c('priority').value=key==='welcome'?'welcome':'';['academic','credit','due'].forEach(id=>$c(id).value='');filterCRM();}
function resetCRMFilters(){['search','status','priority','academic','credit','due'].forEach(id=>$c(id).value='');$c('polo').value='TODOS';$c('period').value='all';$c('payment').value='total';$c('order').value='priority';filterCRM();}
function syncCRMView(){const key=$c('priority').value==='welcome'?'welcome':$c('payment').value;document.querySelectorAll('[data-view]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.view===key)));const n=['academic','credit','due','priority'].filter(id=>$c(id).value).length;$c('filter-count').textContent=n?'('+n+' ativos)':'';$c('polo').parentElement.hidden=snapshot.polos.length===1;$c('quick').hidden=$c('payment').value!=='naoPaga';document.querySelectorAll('[data-quick]').forEach(e=>e.setAttribute('aria-pressed',String($c(e.dataset.quick).value===e.dataset.value)));}
function rankJump(end){const el=document.getElementById('rank-scroll');if(end&&!rankExpanded&&document.getElementById('rank-rest').children.length)toggleRankMore();el.scrollTo({top:end?el.scrollHeight:0,behavior:'smooth'});}
const originalRankToggle=toggleRankMore;
toggleRankMore=function(){originalRankToggle();document.getElementById('rank-more-btn').setAttribute('aria-expanded',String(rankExpanded));if(!rankExpanded)rankJump(false);};
const originalRankRender=renderRankColab;
renderRankColab=function(rows){document.getElementById('rank-rest').innerHTML='';originalRankRender(rows);document.getElementById('rank-more-btn').setAttribute('aria-expanded',String(rankExpanded));document.getElementById('rank-rest').classList.toggle('open',rankExpanded);};
let detailPolos=[];
openModal=function(type,title){
 const operational=['total','ativos','paga','naoPaga','cancel'];let data=['meta','faltam','metaT','destaque'].includes(type)?cumulative():processData(rawRows);
 const numeric=d=>operational.includes(type)?d[type]:type==='conv'?(d.ativos?d.activePaid/d.ativos*100:0):type==='metaT'?d.meta:type==='faltam'?Math.max(0,d.meta-d.paga):type==='polosPag'?d.paga:(d.meta?d.paga/d.meta*100:0);
 data=[...data].sort((a,b)=>numeric(b)-numeric(a));detailPolos=data.map(d=>d.polo);const max=Math.max(...data.map(numeric),1);
 const color={total:'var(--bl)',ativos:'var(--g)',paga:'var(--y)',naoPaga:'var(--r)',cancel:'var(--r)',faltam:'var(--o)',conv:'var(--g)'}[type]||'var(--y)';
 const labels={total:'Matrículas geradas',ativos:'Matrículas ativas',paga:'1ª mensalidade paga',naoPaga:'Ativos sem pagamento',cancel:'Cancelamentos',conv:'Conversão dos ativos',meta:'Progresso da meta',faltam:'Faltam para meta',metaT:'Metas por polo',polosPag:'Polos com pagamentos',destaque:'Atingimento por polo'};
 document.getElementById('mtitle').textContent=labels[type]||title;document.getElementById('mbox').className='mbox';
 const desc=operational.includes(type)||['conv','polosPag'].includes(type)?periodLabel()+' · '+(filterMode()==='events'?'Movimentação':'Matrículas do período'):'Acumulado da campanha';
 document.getElementById('mbody').innerHTML='<p class="context">'+esc(desc)+'</p>'+data.map((d,i)=>{if(type==='polosPag'&&!d.paga)return '';let val=operational.includes(type)?d[type]:type==='conv'?(d.ativos?Math.round(d.activePaid/d.ativos*100):0)+'% · '+d.activePaid+'/'+d.ativos:type==='metaT'?d.meta:type==='faltam'?Math.max(0,d.meta-d.paga):type==='polosPag'?d.paga:(d.meta?Math.round(d.paga/d.meta*100):0)+'% · '+d.paga+'/'+d.meta;const pct=['meta','conv','destaque'].includes(type)?Math.min(numeric(d),100):Math.round(numeric(d)/max*100);return '<div class="mrow detail-row"><div class="detail-info"><div class="mname">'+esc(cap(d.polo))+'</div><div class="mprog"><div class="mpb"><div class="mpf" style="width:'+pct+'%;background:'+color+'"></div></div></div></div><div class="mval" style="color:'+color+'">'+esc(val)+'</div>'+(operational.includes(type)?'<button class="btn btn-gh btn-sm" onclick="detailStudents(\''+type+'\','+i+')">Ver alunos</button>':'')+'</div>' ;}).join('');document.getElementById('modal').style.display='flex';
};
function detailStudents(type,index){const polo=detailPolos[index];closeModal();openCRM(type);$c('polo').value=polo;filterCRM();}

function displayDate(d){return d?d.split('-').reverse().join('/'):'—';}
function quickFilter(id,value){$c(id).value=$c(id).value===value?'':value;filterCRM();}

function crmJump(end){
 const el=$c('dialog');el.scrollTo({top:end?el.scrollHeight:0,behavior:'smooth'});
}
