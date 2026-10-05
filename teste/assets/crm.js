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
 const state=Core.dueState(r,crmToday()),d=Core.expectedDue(r),date=d?d.split('-').reverse().join('/'):'';
 if(state==='overdue')tags.push(tag('Vencido há '+Math.round((Date.parse(crmToday())-Date.parse(d))/86400000)+' dias · previsto '+date,'tag-overdue'));
 if(state==='today')tags.push(tag('Vence hoje · previsto','tag-today'));
 if(state==='future')tags.push(tag('A vencer · previsto '+date,'tag-future'));
 if(state==='unknown')tags.push(tag('Vencimento previsto indisponível'));
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
