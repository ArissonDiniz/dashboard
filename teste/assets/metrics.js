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
 const rows=ranked.map((d,i)=>{const goal=lookup.get(d.polo)||d;const tone=pct(goal)>=50?'var(--g)':pct(goal)>=25?'var(--warn)':'var(--r)';return '<tr style="--performance:'+tone+'"><td><span class="rank-position rank-place-'+Math.min(i+1,4)+'">'+(i+1)+'º</span></td><td><strong>'+esc(cap(d.polo))+'</strong><small class="rank-region">'+esc(d.reg)+'</small></td><td>'+d.total+'</td><td>'+d.ativos+'</td><td>'+badge(d.cancel,'pr2')+'</td><td>'+badge(d.paga,'pg')+'</td><td>'+badge(d.naoPaga,'pr2')+'</td><td>'+goal.meta+'</td><td>'+progress(goal)+'</td></tr>';}).join('');
 const total={paga:sum(acc,'paga'),meta:sum(acc,'meta')};
 document.getElementById('polo-table').innerHTML='<thead><tr>'+['#','Polo','Matrículas','Ativos','Cancelamentos','1ª paga','Sem pagamento','Meta','Progresso da campanha'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+rows+'<tr class="tr-tot"><td>—</td><td><strong>Total filtrado</strong></td>'+['total','ativos','cancel','paga','naoPaga'].map(k=>'<td>'+sum(data,k)+'</td>').join('')+'<td>'+total.meta+'</td><td>'+progress(total)+'</td></tr></tbody>';
}
