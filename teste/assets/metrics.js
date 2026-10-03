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
 const data=processData(rawRows),acc=cumulative();renderHero(acc);renderProj(acc);renderKPIs(data,acc);renderMetaBars(acc);renderStatusChart(data);renderNaoChart(data);renderDistChart(data);renderRankColab(rawRows);renderCursos(rawRows);renderTable(data);
 document.getElementById('metric-context').textContent=filterMode()==='events'?'Movimentação: matrícula pela data de entrada; pagamentos pela data do pagamento; cancelamentos pela data do cancelamento. Ativos, não pagantes e cursos referem-se às entradas do período.':'Matrículas do período: todos os indicadores operacionais analisam as mesmas entradas e sua situação atual.';
 document.getElementById('meta-context').textContent='Metas e projeção: acumulado da campanha, respeitando região e polo. O filtro de datas aplica-se à movimentação abaixo.';
 }catch(e){document.getElementById('filter-error').textContent=e.message;}
}
function renderHero(data){
 const pg=sum(data,'paga'),meta=sum(data,'meta'),po=document.getElementById('f-polo').value;
 document.getElementById('hero-sub').textContent=(snapshot?.campaign.name||'Campanha')+' · '+(po==='TODOS'?'Polos autorizados':cap(po))+' · Acumulado do relatório atual';
 document.getElementById('hero-st').innerHTML=[{v:sum(data,'total'),l:'Calouros acumulados'},{v:sum(data,'ativos'),l:'Ativos atuais'},{v:pg,l:'Pagamentos válidos para meta'},{v:meta,l:'Meta da campanha'},{v:meta?Math.round(pg/meta*100)+'%':'—',l:'Atingimento'},{v:snapshot.last_synced_at?new Date(snapshot.last_synced_at).toLocaleString('pt-BR',{timeZone:dashboardSession.zone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Sem importação',l:'Relatório atualizado · Acre'}].map(s=>`<div class="hs"><div class="hs-v">${esc(s.v)}</div><div class="hs-l">${esc(s.l)}</div></div>`).join('');
}
function renderProj(data){
 const c=snapshot.campaign,today=localToday(),cutoff=c.payment_ends_on||c.ends_on;
 const observed=snapshot.last_synced_at?Core.today(c.timezone,new Date(snapshot.last_synced_at)):today;
 const end=[today,observed,cutoff||today].sort()[0];
 const days=Math.max(1,Math.round((Date.parse(end)-Date.parse(c.starts_on))/86400000)+1);
 const paid=rawRows.filter(r=>scope(r)&&goalEligible(r)&&Core.dateOnly(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA)<=end).length;
 const remaining=Math.max(0,sum(data,'meta')-sum(data,'paga')),daily=paid/days;
 const left=cutoff?Math.max(0,Math.round((Date.parse(cutoff)-Date.parse(today))/86400000)):0;
 document.getElementById('pj-r').textContent=daily.toLocaleString('pt-BR',{maximumFractionDigits:2})+' pag./dia · '+days+' dias observados';
 document.getElementById('pj-f').textContent=remaining+' pagamentos · '+(left?Math.ceil(remaining/left)+'/dia necessários':'prazo encerrado');
 document.getElementById('pj-per').textContent='Matrículas até '+(c.ends_on||'—')+' · pagamentos até '+(cutoff||'—')+' · base até '+end;
 const forecast=daily>0?Core.plus(end,Math.ceil(remaining/daily)):null;
 document.getElementById('pj-d').textContent=remaining===0?'Meta atingida':today>cutoff?'Prazo encerrado':forecast?forecast.split('-').reverse().join('/')+(forecast>cutoff?' · após o prazo':''):'Sem ritmo para estimar';
}
function renderKPIs(data,acc){
 const tot=sum(data,'total'),pg=sum(data,'paga'),at=sum(data,'ativos'),np=sum(data,'naoPaga'),ca=sum(data,'cancel'),cp=sum(data,'cohortPaid'),mt=sum(acc,'meta'),ap=sum(acc,'paga');
 const activePaid=sum(data,'activePaid');const ratio=at?Math.round(activePaid/at*100):0,progress=mt?Math.round(ap/mt*100):0;const cohort=filterMode()==='cohort';
 const best=acc.filter(d=>d.meta>0).sort((a,b)=>b.paga/b.meta-a.paga/a.meta)[0];
 const k=(l,v,s,ic,c,mid,b=null)=>({l,v,s,ic,c,mid,b});
 const first=[k('Matrículas no período',tot,'entradas selecionadas','🎓','kb','total'),k('Ativos das entradas',at,'situação atual das entradas','✅','kg2c','ativos'),k(cohort?'Pagos das entradas':'Pagamentos no período',pg,'1ª cobrada = S · inclui cancelados','💰','ky','paga'),k('Não pagaram (ativos)',np,'entre as entradas selecionadas','⚠️','kr','naoPaga'),k('Progresso da meta',progress+'%',ap+' de '+mt+' · acumulado','🎯','ko','meta',progress),k(cohort?'Cancelados das entradas':'Cancelamentos no período',ca,cohort?'situação atual das entradas':'pela data do cancelamento','❌','kr','cancel')];
 const second=[k('Faltam para meta',Math.max(0,mt-ap),'pagamentos · acumulado','⏳','ko','faltam'),k('Conversão dos ativos',ratio+'%',activePaid+' ativos pagos ÷ '+at+' ativos','📈','kg2c','conv',ratio),k('Meta da campanha',mt,'polos selecionados · acumulado','📋','kw','metaT'),k('Polos com pagamentos',data.filter(d=>d.paga>0).length,'de '+data.length+' polos autorizados','🏫','kp','polosPag'),k('Polo destaque',best?cap(best.polo):'—','por atingimento acumulado','🏆','ky','destaque')];
 const render=(id,items)=>document.getElementById(id).innerHTML=items.map((x,i)=>`<div class="kpi ${x.c}" tabindex="0" role="button" aria-label="${esc(x.l)}" data-mid="${x.mid}" data-ml="${esc(x.l)}"><div class="kpi-top"><div class="kpi-ic">${x.ic}</div><span class="kpi-det">detalhes ▸</span></div><div class="kpi-l">${esc(x.l)}</div><div class="kpi-v" style="${typeof x.v==='string'&&x.v.length>7?'font-size:18px':''}">${esc(x.v)}</div><div class="kpi-s">${esc(x.s)}</div>${x.b!==null?`<div class="kpi-bw"><div class="kpi-bf" style="width:${Math.min(x.b,100)}%"></div></div>`:''}</div>`).join('');render('kg1',first);render('kg2',second);
}
function statusParts(){const list=rawRows.filter(r=>scope(r)&&noPeriodoEntrada(r));return [list.filter(r=>!Core.cancelled(r)&&Core.paid(r)).length,list.filter(r=>!Core.cancelled(r)&&!Core.paid(r)).length,list.filter(r=>Core.cancelled(r)&&Core.paid(r)).length,list.filter(r=>Core.cancelled(r)&&!Core.paid(r)).length];}
function renderStatusChart(data){
 const parts=statusParts(),labels=['Ativos pagos','Ativos não pagos','Cancelados pagos','Cancelados não pagos'],colors=['#16a34a','#dc2626','#2563eb','#8b5cf6'];
 document.getElementById('taxa-pag').textContent=(sum(data,'ativos')?Math.round(sum(data,'activePaid')/sum(data,'ativos')*100):0)+'%';
 document.getElementById('leg-st').innerHTML=labels.map((l,i)=>`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx2)"><span>${l}</span><strong>${parts[i]}</strong></div>`).join('');
 if(charts.st)charts.st.destroy();charts.st=new Chart(document.getElementById('ch-st'),{type:'doughnut',data:{labels,datasets:[{data:parts,backgroundColor:colors,borderWidth:2,borderColor:isDark?'#111318':'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false},tooltip:TO()}}});
}
function _buildExpandSt(canvas){const src=charts.st;window._mc=new Chart(canvas,{type:'doughnut',data:JSON.parse(JSON.stringify(src.data)),options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:TC()}},tooltip:TO()}}});}
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
 const acc=cumulative();const ratio=d=>{const a=acc.find(x=>x.polo===d.polo)||d;return a.meta?a.paga/a.meta:0;};data=[...data].sort((a,b)=>ratio(b)-ratio(a)||b.paga-a.paga||a.polo.localeCompare(b.polo));const cells=d=>{const a=acc.find(x=>x.polo===d.polo)||d,pct=a.meta?Math.round(a.paga/a.meta*100):0;return '<td>'+esc(cap(d.polo))+'</td><td>'+d.total+'</td><td>'+d.ativos+'</td><td>'+d.cancel+'</td><td>'+d.paga+'</td><td>'+d.naoPaga+'</td><td>'+a.paga+'</td><td>'+a.meta+'</td><td>'+pct+'%</td>';};
 document.getElementById('polo-table').innerHTML='<thead><tr>'+['Polo','Entradas','Ativos das entradas','Cancelamentos','Pagamentos','Não pagaram ativos','Pagos válidos para meta','Meta','Meta atingida'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+data.map(d=>'<tr>'+cells(d)+'</tr>').join('')+'<tr class="tr-tot"><td>Total</td>'+['total','ativos','cancel','paga','naoPaga'].map(k=>'<td>'+sum(data,k)+'</td>').join('')+'<td>'+sum(acc,'paga')+'</td><td>'+sum(acc,'meta')+'</td><td>'+(sum(acc,'meta')?Math.round(sum(acc,'paga')/sum(acc,'meta')*100):0)+'%</td></tr></tbody>';
}
