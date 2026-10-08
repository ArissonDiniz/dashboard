/* Interface de acompanhamento. A autorização continua no Supabase. */
function metricIcon(type){const paths={total:'M8 3h8v4H8z M6 5H4v16h16V5h-2 M8 12h8 M8 16h5',ativos:'M8 12l3 3 5-6 M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18',paga:'M3 6h18v12H3z M3 10h18 M7 14h3',naoPaga:'M12 3L2 21h20z M12 9v5 M12 17v1',cancel:'M6 6l12 12 M6 18L18 6',meta:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18 M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8',conv:'M4 19V5 M4 19h16 M7 14l4-4 4 2 5-7',faltam:'M4 12h16 M15 7l5 5-5 5',metaT:'M5 4h14v17H5z M9 2h6v4H9z M8 10h8 M8 15h8',polosPag:'M3 21V9l9-6 9 6v12 M8 21v-6h8v6',destaque:'M7 3h10v7a5 5 0 0 1-10 0z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 15v6 M8 21h8'};return '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[type]||paths.total)+'"/></svg>';}
function promiseLate(r,t){const s=crmState(r);return !r._missing&&!crmCancelled(r)&&!Core.paid(r)&&!!s.promised&&s.promised<t;}
function renderWorkspace(data){
 const one=data.length===1,restricted=snapshot.polos.length===1&&currentProfile.role!=='admin';
 document.getElementById('content').classList.toggle('single-polo',one);
 document.getElementById('f-polo').hidden=restricted;document.getElementById('f-regiao').hidden=restricted;for(const id of ['f-polo','f-regiao']){const label=document.getElementById(id).previousElementSibling;if(label?.classList.contains('fl'))label.hidden=restricted;}
 if(restricted)document.getElementById('session-label').textContent=currentProfile.name+' · Polo '+snapshot.polos[0].name;
 renderPostSale();
}
const postSaleColumns=[['welcome_done','RECEPÇÃO CONCLUÍDA'],['welcome','RECEPÇÃO PENDENTE'],['today','RETORNOS HOJE'],['late','RETORNOS VENCIDOS'],['promise_today','PROMESSAS HOJE'],['promise','PROMESSAS VENCIDAS']];
function postSaleMatch(r,key,today){
 if(r._missing||crmCancelled(r))return false;
 const s=crmState(r);
 if(key==='welcome_done')return s.welcome==='Concluído';
 if(key==='welcome')return s.welcome==='Pendente'&&s.status!=='Contato inexistente';
 if(key==='welcome_attempt')return s.welcome==='Tentativa sem resposta'&&s.status!=='Contato inexistente';
 if(key==='today')return Core.due(s,today)==='today';
 if(key==='promise_today')return !Core.paid(r)&&s.promised===today;
 if(key==='unrecorded')return !crmStates[r._key];
 if(key==='late')return Core.due(s,today)==='late';
 if(key==='promise')return promiseLate(r,today);
 if(key==='promise_pending')return !Core.paid(r)&&!!s.promised;
 return false;
}
function openPostSale(key,index){
 if(dataBusy||crm.saving)return;
 if(crm.dirty&&!confirm('Descartar alterações não salvas e abrir esta lista?'))return;
 crm.dirty=false;crm.edit=null;openCRM('ativos',true);
 $c('polo').value=index<0?'TODOS':snapshot.polos[index].short_name;
 $c('priority').value=key;filterCRM();
}
function renderPostSale(){
 const t=crmToday(),rows=rawRows.filter(r=>scope(r)&&!crmCancelled(r)&&!r._missing);
 const polos=snapshot.polos.map((p,i)=>({...p,index:i})).filter(p=>scope({NOME_DO_POLO:p.name}));
 const button=(key,title,list,index,tile=false)=>{const n=list.filter(r=>postSaleMatch(r,key,t)).length,urgent=['late','promise'].includes(key)&&n>0;return '<button class="'+(tile?'post-sale-tile':'post-sale-count')+(urgent?' post-sale-urgent':'')+'" '+(n?'':'disabled')+' aria-label="'+esc(title+': '+n)+'" title="'+esc(title)+'" onclick="openPostSale(\''+key+'\','+index+')">'+(tile?'<span>'+esc(title)+'</span>':'')+'<strong>'+n+'</strong></button>';};
 if(polos.length===1){const p=polos[0];document.getElementById('work-queue').innerHTML='<div class="post-sale-polo">'+esc(cap(p.short_name))+'</div><div class="post-sale-tiles">'+postSaleColumns.map(([key,title])=>button(key,title,rows,p.index,true)).join('')+'</div>';return;}
 const line=(label,list,index)=>'<tr'+(index<0?' class="post-sale-total"':'')+'><th scope="row">'+esc(label)+'</th>'+postSaleColumns.map(([key,title])=>'<td>'+button(key,title,list,index)+'</td>').join('')+'</tr>';
 document.getElementById('work-queue').innerHTML='<div class="tw"><table class="pt"><thead><tr><th>Polo</th>'+postSaleColumns.map(([key,title])=>'<th>'+title+'</th>').join('')+'</tr></thead><tbody>'+polos.map(p=>line(cap(p.short_name),rows.filter(r=>r.CODIGO_DO_POLO===p.id),p.index)).join('')+(polos.length>1?line('Total',rows,-1):'')+'</tbody></table></div>';

}
function openQueue(key){openCRM('ativos',true);$c('priority').value=key;filterCRM();}
function compactLabels(r){let parts=[];if(Core.academicNote(r))parts.push('Indicação de nota');if(r._credit===true)parts.push('Aproveitamento');return (parts.length?'<small class="academic-line">'+esc(parts.join(' · '))+'</small>':'')+'<small class="academic-line last-access">Último acesso: '+esc(r._lastAccess?displayDate(r._lastAccess):'não informado no relatório')+'</small>'+dueLabel(r);}
function crmView(key){if(crm.edit){cancelEditCRM();if(crm.edit)return;}if(key!=='cancel'&&$c('status').value==='Cancelado')$c('status').value='';$c('payment').value=key==='welcome'?'ativos':key;$c('priority').value=key==='welcome'?'welcome':'';['academic','credit','due'].forEach(id=>$c(id).value='');filterCRM();}
function resetCRMFilters(){['search','status','priority','academic','credit','due','promise-month','promise-state'].forEach(id=>$c(id).value='');$c('polo').value='TODOS';$c('period').value='all';$c('payment').value='total';$c('order').value='priority';filterCRM();}
function syncCRMView(){const key=$c('priority').value==='welcome'?'welcome':$c('payment').value;document.querySelectorAll('[data-view]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.view===key)));const n=['academic','credit','due','priority','promise-month','promise-state'].filter(id=>$c(id).value).length;$c('filter-count').textContent=n?'('+n+' ativos)':'';$c('polo').parentElement.hidden=snapshot.polos.length===1;$c('quick').hidden=$c('payment').value!=='naoPaga';document.querySelectorAll('[data-quick]').forEach(e=>e.setAttribute('aria-pressed',String($c(e.dataset.quick).value===e.dataset.value)));}
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

const rankProductionRender=renderRankColab;
renderRankColab=function(rows){
 rankProductionRender(rows);
 if(sellerProductionError)document.getElementById('rank-top').textContent='Não foi possível carregar a produção completa.';
};
