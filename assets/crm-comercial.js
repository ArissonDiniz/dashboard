// CRM Comercial: leads e inscritos que ainda não fizeram matrícula.
// Usa db, currentProfile, snapshot e esc do painel principal.
(function(){
'use strict';
const ST={
  'Não atendeu':{cls:'cc-s-wait',ico:'Não atendeu',help:'Volta para a lista amanhã.'},
  'Conversando':{cls:'cc-s-talk',ico:'Conversando',help:'Fica no topo da sua lista.'},
  'Aguardando convalidação':{cls:'cc-s-conv',ico:'Aguardando convalidação',help:'Vai para a aba Convalidação.'},
  'Retornar em outra data':{cls:'cc-s-date',ico:'Retornar em outra data',help:'Some da lista e volta na data escolhida.'},
  'Sem interesse no momento':{cls:'cc-s-off',ico:'Sem interesse no momento',help:'Sai da lista. Pode voltar em outro semestre.'},
  'Número inexistente':{cls:'cc-s-off',ico:'Número inexistente',help:'Sai da lista.'},
  'Lista negra':{cls:'cc-s-black',ico:'Lista negra',help:'Nunca mais aparece, nem em planilha nova.'}
};
const CLOSED=['Sem interesse no momento','Número inexistente','Lista negra'];
const PAGE=50;
const cc={rows:[],view:'inscrito',page:0,edit:null,saving:false,loading:false,campaign:null};
const $=id=>document.getElementById('cc-'+id);

function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Rio_Branco'}).format(new Date());}
function addDays(d,n){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
function br(d){if(!d)return '';const s=String(d).slice(0,10).split('-');return s[2]+'/'+s[1]+'/'+s[0];}
function dias(ts){if(!ts)return null;const a=new Date(String(ts).slice(0,10)+'T12:00:00Z'),b=new Date(today()+'T12:00:00Z');return Math.max(0,Math.round((b-a)/864e5));}
function primeiro(n){const p=String(n||'').trim().split(/\s+/)[0]||'';return p?p.charAt(0).toUpperCase()+p.slice(1).toLowerCase():'';}
function curso(c){return String(c||'').replace(/^Curso (Superior de Tecnologia|de Bacharelado|de Licenciatura|de Tecnologia|Superior)( em| de)?\s*/i,'').trim();}
function poloNome(id){const p=(snapshot?.polos||[]).find(p=>p.id===id);if(!p)return '';return String(p.name||'').replace(/\/(AC|RO|AM)\b/,'');}
function fone(m){return m&&m.length>=10?m.replace(/^(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3'):'';}
function cpfFmt(c){return c&&c.length===11?c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):'';}
function msg(t,kind){const m=$('message');m.textContent=t||'';m.className=kind?'cc-msg cc-msg-'+kind:'cc-msg';}

// ---------- regras de lista ----------
function due(r){return r.next_contact&&r.next_contact<=today();}
function agendado(r){return r.next_contact&&r.next_contact>today();}
function closed(r){return CLOSED.includes(r.status);}
function ativo(r){return !closed(r)&&r.status!=='Aguardando convalidação'&&!agendado(r);}
// novo: ainda sem contato e chegou há até 2 dias
function quente(r){const d=dias(r.created);return !r.status&&d!==null&&d<=2;}
function prioridade(r){
  if(r.status==='Conversando')return 0;
  if(due(r)&&r.status==='Retornar em outra data')return 1;
  if(quente(r))return 2;
  if(!r.status)return 3;
  if(due(r))return 4;
  return 5;
}
function inView(r,v){
  if(v==='inscrito'||v==='lead')return r.kind===v&&ativo(r);
  if(v==='quente')return ativo(r)&&quente(r);
  if(v==='hoje')return ativo(r)&&!!r.status&&(due(r)||r.status==='Conversando');
  if(v==='agenda')return r.status==='Retornar em outra data'&&!closed(r);
  if(v==='conv')return r.status==='Aguardando convalidação';
  if(v==='fim')return r.status==='Sem interesse no momento'||r.status==='Número inexistente';
  return true;
}
function filtered(){
  const q=($('search').value||'').trim().toLowerCase(),qd=q.replace(/\D/g,'');
  const polo=$('polo').value,cur=$('curso').value,sit=$('sit').value,ord=$('ordem').value;
  let out=cc.rows.filter(r=>inView(r,cc.view));
  if(polo)out=out.filter(r=>r.polo_id===polo);
  if(cur)out=out.filter(r=>curso(r.course)===cur);
  if(sit)out=out.filter(r=>(r.status||'Sem contato')===sit);
  if(q)out=out.filter(r=>String(r.name).toLowerCase().includes(q)||(qd.length>=3&&((r.cpf||'').includes(qd)||(r.mobile||'').includes(qd)||(r.inscription_id||'').includes(qd))));
  const t=r=>r.created?Date.parse(r.created):0;
  if(ord==='recentes')out.sort((a,b)=>t(b)-t(a));
  else if(ord==='antigos')out.sort((a,b)=>t(a)-t(b));
  else if(ord==='retorno')out.sort((a,b)=>String(a.next_contact||'9').localeCompare(String(b.next_contact||'9'))||t(b)-t(a));
  else out.sort((a,b)=>prioridade(a)-prioridade(b)||t(b)-t(a));
  return out;
}

// ---------- mensagem pronta ----------
function mensagem(r){
  const n=primeiro(r.name)||'tudo bem',c=primeiro(currentProfile?.name)||'equipe',p=poloNome(r.polo_id);
  const eu='Aqui é '+c+', do time comercial da UNIASSELVI'+(p?' polo '+p:'')+'.';
  const cs=curso(r.course),of=String(r.offer||'').toLowerCase(),orig=String(r.origin||'').toLowerCase();
  const alvo=r.kind==='inscrito'?'garantir sua vaga'+(cs?' em '+cs:''):'começar sua graduação neste semestre';
  if(r.status==='Aguardando convalidação')return 'Oi, '+n+'! '+eu+' Passando para saber se você já conseguiu separar o histórico para a análise das disciplinas. Assim que eu receber, já adianto sua matrícula. Qualquer dúvida, estou por aqui!';
  if(r.status==='Retornar em outra data')return 'Oi, '+n+'! '+eu+' Combinamos de conversar hoje, lembra? Podemos continuar de onde paramos'+(cs?' sobre '+cs:'')+'? Se preferir, me diga o melhor horário.';
  if(r.status==='Conversando')return 'Oi, '+n+'! '+eu+' Conseguiu pensar no que conversamos? Se quiser, já deixo tudo encaminhado para '+alvo+'. É só me responder por aqui.';
  if(r.status==='Não atendeu'&&r.attempts>=2)return 'Oi, '+n+'! '+eu+' Esta é minha última tentativa por aqui, para não te incomodar. Se ainda quiser '+alvo+', é só responder esta mensagem que eu te ajudo na hora. Um abraço!';
  if(r.status==='Não atendeu')return 'Oi, '+n+'! '+eu+' Tentei falar com você, mas acho que não deu certo. Ainda dá tempo de '+alvo+'. Qual é o melhor horário para conversarmos?';
  if(r.kind==='inscrito'){
    const oi='Oi, '+n+'! Tudo bem? '+eu+' ';
    const volta=r.reinscrito?'Que bom ter você de volta! ':'';
    if(of.includes('segunda'))return oi+volta+'Vi sua inscrição para a segunda graduação'+(cs?' em '+cs:'')+'. Como você já tem diploma, dá para aproveitar disciplinas e se formar mais rápido. Quer que eu te explique como fica no seu caso?';
    if(of.includes('transfer'))return oi+volta+'Vi que você quer transferir seu curso'+(cs?' de '+cs:'')+' para a UNIASSELVI. A gente analisa as disciplinas que você já cursou para você não perder nada. Pode me mandar seu histórico por aqui?';
    if(of.includes('enem'))return oi+volta+'Vi sua inscrição'+(cs?' em '+cs:'')+' usando a nota do ENEM. Com ela você entra sem precisar fazer vestibular! Posso te ajudar a finalizar a matrícula agora? Leva só alguns minutos.';
    if(of.includes('encceja'))return oi+volta+'Vi sua inscrição'+(cs?' em '+cs:'')+' com o certificado do ENCCEJA. Está tudo certo para você começar! Posso te ajudar a finalizar a matrícula agora?';
    return oi+(volta||'Que alegria ver sua inscrição'+(cs?' em '+cs:'')+'! ')+(volta&&cs?'Vi sua inscrição em '+cs+'. ':'')+'Falta bem pouquinho para você garantir sua vaga. Posso te ajudar a finalizar a matrícula agora? Leva só alguns minutos. 😊';
  }
  const oi='Oi, '+n+'! Tudo bem? '+eu+' ';
  if(orig.includes('abandono'))return oi+'Vi que você começou sua inscrição e não conseguiu terminar. Posso te ajudar a concluir? É rapidinho.';
  if(cs)return oi+'Vi que você se interessou pelo curso de '+cs+'. Posso te contar como funciona, o valor da mensalidade e as condições deste mês? 😊';
  if(orig.includes('enem'))return oi+'Vi que você quer usar sua nota do ENEM para entrar na faculdade. Com ela você entra sem vestibular! Qual curso você tem vontade de fazer?';
  if(orig.includes('indica'))return oi+'Você foi indicado por um amigo para estudar com a gente! Qual curso você tem vontade de fazer? Te conto todas as condições.';
  return oi+'Vi que você tem interesse em fazer uma graduação com a gente. Qual curso você tem vontade de fazer? Te conto como funciona e as condições deste mês. 😊';
}
function waLink(r){return r.mobile?'https://wa.me/55'+r.mobile+'?text='+encodeURIComponent(mensagem(r)):'';}

// ---------- carregar ----------
async function load(silent){
  if(cc.loading)return;cc.loading=true;
  if(!silent)msg('Carregando...');
  try{
    cc.campaign=document.getElementById('f-campaign')?.value||APP_CONFIG.campaign;
    const {data,error}=await db.rpc('crm_list',{p_campaign:cc.campaign});
    if(error)throw error;
    cc.rows=data||[];
    if(!cc.started){cc.started=true;if(cc.rows.some(r=>inView(r,'quente')))cc.view='quente';}
    fillSelects();render();if(!silent)msg('');
  }catch(e){msg('Não foi possível carregar o CRM: '+e.message,'erro');}
  finally{cc.loading=false;}
}
function fillSelects(){
  const keep=(id,opts,first)=>{const s=$(id),v=s.value;s.innerHTML='<option value="">'+first+'</option>'+opts.map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>').join('');if(opts.some(o=>o[0]===v))s.value=v;};
  const polos=[...new Set(cc.rows.map(r=>r.polo_id))].map(id=>[id,poloNome(id)||id]).sort((a,b)=>a[1].localeCompare(b[1]));
  keep('polo',polos,'Todos os polos');$('polo').closest('label').hidden=polos.length<2;
  const cursos=[...new Set(cc.rows.map(r=>curso(r.course)).filter(Boolean))].sort().map(c=>[c,c]);
  keep('curso',cursos,'Todos os cursos');
}

// ---------- tela ----------
function counts(){
  const c={};['quente','inscrito','lead','hoje','agenda','conv','fim'].forEach(v=>c[v]=cc.rows.filter(r=>inView(r,v)).length);return c;
}
function render(){
  const c=counts();
  document.querySelectorAll('#cc-tabs [data-v]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.v===cc.view);const k=b.querySelector('b');if(k)k.textContent=c[b.dataset.v];});
  const atrasados=cc.rows.filter(r=>ativo(r)&&r.status&&r.status!=='Conversando'&&due(r)).length;
  $('meudia').innerHTML='<div class="meudia-topo"><h3>Meu dia</h3><p>Primeiro quem está conversando com você. Depois os novos: quanto antes o contato, maior a chance de matrícula.</p></div><div class="meudia-grade">'+
    card('quente',c.quente,'Novos: chegaram há até 2 dias',c.quente>0)+
    card('hoje',c.hoje,'Retornos de hoje',atrasados>0)+
    card('agenda',c.agenda,'Retornos agendados',false)+
    card('conv',c.conv,'Aguardando convalidação',false)+'</div>';
  const list=filtered(),pages=Math.max(1,Math.ceil(list.length/PAGE));cc.page=Math.min(cc.page,pages-1);
  const slice=list.slice(cc.page*PAGE,(cc.page+1)*PAGE);
  $('count').textContent=list.length+(list.length===1?' pessoa':' pessoas')+' nesta lista';
  $('rows').innerHTML=slice.length?slice.map(row).join(''):'<tr><td colspan="5" class="cc-vazio">'+(cc.rows.length?'Ninguém nesta lista com esses filtros.':'Nenhum lead ou inscrito ainda. Clique em <strong>Enviar planilhas do portal</strong> para carregar.')+'</td></tr>';
  $('page').textContent='Página '+(cc.page+1)+' de '+pages;
  $('prev').disabled=cc.page===0;$('next').disabled=cc.page>=pages-1;
}
function card(v,n,t,urg){return '<button type="button" class="meudia-item'+(urg?' meudia-urgente':'')+(cc.view===v?' meudia-ativo':'')+'" onclick="ccView(\''+v+'\')"><strong>'+n+'</strong><span>'+t+'</span></button>';}
function tag(r){
  if(quente(r))return '<span class="cc-tag cc-hot-tag">'+(dias(r.created)===0?'Chegou hoje':'Novo')+'</span>';
  if(!r.status)return '<span class="cc-tag cc-s-new">Sem contato</span>';
  let t=r.status;if(r.status==='Retornar em outra data'&&r.next_contact)t='Retornar em '+br(r.next_contact);
  if(r.status==='Não atendeu')t='Não atendeu ('+r.attempts+'x)';
  return '<span class="cc-tag '+ST[r.status].cls+'">'+esc(t)+'</span>';
}
function row(r){
  const i=cc.rows.indexOf(r),d=dias(r.created),cs=curso(r.course);
  const sub=r.kind==='inscrito'?(r.offer||'Inscrito'):(r.origin||'Lead');
  const wa=r.mobile&&r.accepts_whats!==false?'<a class="btn btn-sm cc-wa" href="'+waLink(r)+'" target="_blank" rel="noopener noreferrer" onclick="ccOpened('+i+')" aria-label="Chamar '+esc(primeiro(r.name))+' no WhatsApp">WhatsApp</a>':'';
  return '<tr'+(quente(r)?' class="cc-hot"':'')+' onclick="if(!event.target.closest(\'a,button\'))ccOpen('+i+')"><td><strong>'+esc(r.name)+'</strong><span class="cc-sub">'+(r.kind==='inscrito'?'Inscrito':'Lead')+' · '+esc(sub)+'</span></td>'+
   '<td>'+(cs?esc(cs):'<span class="cc-muted">Curso não informado</span>')+'<span class="cc-sub">'+esc(poloNome(r.polo_id))+'</span></td>'+
   '<td class="cc-tempo">'+(d===null?'':(d===0?'Hoje':d===1?'Ontem':'Há '+d+' dias'))+'</td>'+
   '<td>'+tag(r)+(r.last_contact?'<span class="cc-sub">'+esc(primeiro(r.author)||'')+' em '+br(r.last_contact)+'</span>':'')+'</td>'+
   '<td class="cc-acoes">'+wa+'<button class="btn btn-gh btn-sm" onclick="ccOpen('+i+')">Abrir ficha</button></td></tr>';
}

// ---------- ficha ----------
function passo(r){
  if(r.status==='Aguardando convalidação')return ['Aguardando convalidação','Quando a análise sair, gere o contrato pelo código de inscrição.','conv'];
  if(r.kind==='inscrito')return ['Finalizar a matrícula','Gere o contrato no sistema com o código de inscrição e ajude no primeiro pagamento.','ins'];
  return [r.course?'Fazer a inscrição':'Descobrir o curso e fazer a inscrição','Ajude a pessoa a se inscrever pelo site ou faça a inscrição por ela.','lead'];
}
function ficha(r){
  const [t,s,k]=passo(r),i=cc.rows.indexOf(r),cs=curso(r.course);
  const avisos=[];
  if(r.accepts_whats===false)avisos.push('Marcou que <strong>não aceita WhatsApp</strong>. Prefira ligar.');
  if(r.reinscrito)avisos.push('Já tinha se inscrito antes. Pergunte o que faltou da outra vez.');
  if(r.lead_key)avisos.push('Veio da lista de leads. O histórico de antes continua aqui.');
  if(!r.mobile)avisos.push('Sem celular válido na planilha.');
  const copia=(v,l)=>v?'<button type="button" class="cc-copy" onclick="ccCopy(\''+esc(v)+'\',\''+l+'\')" aria-label="Copiar '+l+'">Copiar</button>':'';
  const dados=[
    ['Celular',r.mobile?fone(r.mobile):'Não informado',r.mobile?copia(r.mobile,'celular'):''],
    r.inscription_id?['Código de inscrição',r.inscription_id,copia(r.inscription_id,'código de inscrição')]:null,
    r.cpf?['CPF',cpfFmt(r.cpf),copia(r.cpf,'CPF')]:null,
    ['Curso',cs||'Não informado',''],
    r.offer?['Forma de ingresso',r.offer,'']:null,
    !r.offer&&r.origin?['Origem',r.origin,'']:null,
    ['Polo',poloNome(r.polo_id),''],
    r.created?[r.kind==='inscrito'?'Inscrição em':'Cadastro em',br(r.created)+' ('+(dias(r.created)===0?'hoje':'há '+dias(r.created)+' dias')+')','']:null
  ].filter(Boolean);
  const wa=r.mobile?'<a class="btn whatsapp-contact" href="'+waLink(r)+'" target="_blank" rel="noopener noreferrer" onclick="ccOpened('+i+')">Chamar no WhatsApp com mensagem pronta</a><details class="cc-preview"><summary>Ver a mensagem</summary><p>'+esc(mensagem(r))+'</p></details>':'';
  const btns=Object.keys(ST).map(s=>'<button type="button" class="cc-opt '+ST[s].cls+'" data-s="'+esc(s)+'" aria-pressed="false" onclick="ccPick(this)">'+esc(s)+'</button>').join('');
  return '<button class="btn btn-gh btn-sm drawer-close" onclick="ccClose()">Fechar ficha</button>'+
   '<h3>'+esc(r.name)+'</h3><p class="cc-kind">'+(r.kind==='inscrito'?'Inscrito':'Lead')+(r.status?' · '+tag(r):'')+'</p>'+
   '<div class="cc-passo cc-passo-'+k+'"><span>Próximo passo</span><strong>'+esc(t)+'</strong><p>'+esc(s)+'</p></div>'+
   (avisos.length?'<ul class="cc-avisos">'+avisos.map(a=>'<li>'+a+'</li>').join('')+'</ul>':'')+
   '<dl class="cc-dados">'+dados.map(d=>'<div><dt>'+esc(d[0])+'</dt><dd>'+esc(d[1])+d[2]+'</dd></div>').join('')+'</dl>'+wa+
   '<h4>Como foi o contato?</h4><div class="cc-opts" role="group" aria-label="Resultado do contato">'+btns+'</div>'+
   '<p id="cc-help" class="crm-info" aria-live="polite"></p>'+
   '<label id="cc-date-wrap" hidden>Retornar em<input id="cc-date" type="date" min="'+today()+'" value="'+addDays(today(),1)+'"></label>'+
   '<label>Anotação (opcional)<textarea id="cc-note" rows="3" maxlength="1000" placeholder="Ex.: pediu para ligar depois das 18h"></textarea></label>'+
   '<p id="cc-edit-msg" class="cc-msg" role="status"></p>'+
   '<button id="cc-save" class="btn" onclick="ccSave()" disabled>Salvar</button>'+
   (r.notes?'<p class="crm-info"><strong>Última anotação:</strong> '+esc(r.notes)+'</p>':'')+
   '<h4>Histórico</h4><div id="cc-hist" class="crm-info">Carregando...</div>';
}
async function hist(r){
  const keys=[r.pkey];if(r.lead_key)keys.push(r.lead_key);
  try{
    const {data,error}=await db.rpc('crm_history_of',{p_campaign:cc.campaign,p_keys:keys});if(error)throw error;
    if(cc.edit!==r)return;
    $('hist').innerHTML=data?.length?'<ol class="cc-hist">'+data.map(h=>'<li><strong>'+esc(h.status)+(h.next_contact&&h.status==='Retornar em outra data'?' ('+br(h.next_contact)+')':'')+'</strong><span>'+esc(primeiro(h.actor_name))+', '+new Date(h.created_at).toLocaleString('pt-BR',{timeZone:'America/Rio_Branco',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(h.pkey!==r.pkey?' · quando era lead':'')+'</span>'+(h.note?'<p>'+esc(h.note)+'</p>':'')+'</li>').join('')+'</ol>':'Nenhum contato registrado ainda.';
  }catch(e){if(cc.edit===r)$('hist').textContent='Não foi possível carregar o histórico.';}
}

// ---------- ações globais ----------
window.openCC=function(){
  const d=$('dialog');if(!d.open)d.showModal();cc.page=0;load();
};
window.closeCC=function(){if(cc.saving)return;if(cc.edit&&!confirmLeave())return;ccCloseEditor();$('dialog').close();};
function confirmLeave(){const n=document.getElementById('cc-note');const dirty=(n&&n.value.trim())||document.querySelector('.cc-opt[aria-pressed=true]');return !dirty||confirm('Descartar o contato que você não salvou?');}
function ccCloseEditor(){cc.edit=null;const e=$('editor');e.hidden=true;e.innerHTML='';}
window.ccView=function(v){cc.view=v;cc.page=0;render();$('rows').closest('.tw').scrollIntoView({block:'start',behavior:'smooth'});};
window.ccFilter=function(){cc.page=0;render();};
window.ccReset=function(){['search','polo','curso','sit'].forEach(k=>$(k).value='');$('ordem').value='prioridade';ccFilter();};
window.ccPage=function(d){cc.page+=d;render();$('rows').closest('.tw').scrollIntoView({block:'start'});};
window.ccOpen=function(i){
  const r=cc.rows[i];if(!r)return;if(cc.edit&&cc.edit!==r&&!confirmLeave())return;
  cc.edit=r;const e=$('editor');e.innerHTML=ficha(r);e.hidden=false;e.scrollTop=0;e.querySelector('h3').setAttribute('tabindex','-1');e.querySelector('h3').focus();hist(r);
};
window.ccClose=function(){if(!confirmLeave())return;ccCloseEditor();};
window.ccOpened=function(i){/* abriu o WhatsApp: abre a ficha para registrar o resultado */setTimeout(()=>{if(cc.edit!==cc.rows[i])ccOpen(i);},300);};
window.ccPick=function(b){
  document.querySelectorAll('.cc-opt').forEach(x=>x.setAttribute('aria-pressed',x===b));
  const s=b.dataset.s;$('help').textContent=ST[s].help;$('date-wrap').hidden=s!=='Retornar em outra data';$('save').disabled=false;
  $('save').textContent=s==='Lista negra'?'Colocar na lista negra':'Salvar';
};
window.ccSave=async function(){
  const r=cc.edit,b=document.querySelector('.cc-opt[aria-pressed=true]');if(!r||!b||cc.saving)return;
  const s=b.dataset.s,next=s==='Retornar em outra data'?$('date').value:null,note=$('note').value;
  if(s==='Retornar em outra data'&&(!next||next<today())){$('edit-msg').textContent='Escolha uma data de hoje em diante.';return;}
  if(s==='Lista negra'&&!confirm(r.name+' nunca mais vai aparecer no CRM, nem em planilhas novas. Confirmar?'))return;
  cc.saving=true;$('save').disabled=true;$('edit-msg').textContent='Salvando...';
  try{
    const {error}=await db.rpc('crm_save',{p_campaign:cc.campaign,p_pkey:r.pkey,p_status:s,p_next:next,p_note:note,p_version:r.fkey===r.pkey?r.version:0});
    if(error)throw error;
    cc.saving=false;ccCloseEditor();await load(true);msg(primeiro(r.name)+': '+s.toLowerCase()+' salvo.','ok');
  }catch(e){cc.saving=false;$('save').disabled=false;$('edit-msg').textContent='Não salvou: '+e.message;}
};
window.ccCopy=async function(v,l){try{await navigator.clipboard.writeText(v);msg(l.charAt(0).toUpperCase()+l.slice(1)+' copiado.','ok');}catch{prompt('Copie o '+l+':',v);}};

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dialog')?.open){e.preventDefault();if(cc.edit)ccClose();else closeCC();}});
// atualização automática a cada 2 minutos quando ninguém está editando
setInterval(()=>{if($('dialog')?.open&&!cc.edit&&!cc.saving&&!document.hidden)load(true);},120000);
})();
