
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


