// CRM Comercial: leads e inscritos que ainda não fizeram matrícula.
// Usa db, currentProfile, snapshot e esc do painel principal.
(function(){
'use strict';
const ST={
  'Matrícula feita':{cls:'cc-s-mat',help:'Conta para você. Fica aguardando o relatório do portal confirmar.'},
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
function ativo(r){return !closed(r)&&r.status!=='Aguardando convalidação'&&r.status!=='Matrícula feita'&&!agendado(r);}
function travado(r){return !!cc.locks?.[r.pkey];}
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
  if(v==='conversa')return ativo(r)&&r.status==='Conversando';
  if(v==='retorno')return ativo(r)&&!!r.status&&r.status!=='Conversando'&&due(r);
  if(v==='semcontato')return ativo(r)&&!r.status&&!quente(r);
  if(v==='fila')return ativo(r)&&!travado(r)&&(r.status==='Conversando'||!r.status||due(r));
  if(v==='mat')return r.status==='Matrícula feita';
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
    const [{data,error},sum,lk]=await Promise.all([db.rpc('crm_list',{p_campaign:cc.campaign}),db.rpc('crm_summary',{p_campaign:cc.campaign}),db.rpc('crm_locks_of',{p_campaign:cc.campaign})]);
    if(error)throw error;
    cc.sum=sum.data||null;cc.locks=lk.data||{};
    novidades(data||[]);
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

// ---------- avisos de inscrito/lead novo ----------
function novidades(lista){
  const vistos=cc.vistos;cc.vistos=new Set(lista.map(r=>r.pkey));
  if(!vistos||cc.vistosCamp!==cc.campaign){cc.vistosCamp=cc.campaign;return;}
  const novos=lista.filter(r=>!vistos.has(r.pkey)&&quente(r));
  if(!novos.length)return;
  const ins=novos.filter(r=>r.kind==='inscrito'),lea=novos.filter(r=>r.kind==='lead');
  const abrir=r=>()=>{openCC();const go=()=>{const j=cc.rows.findIndex(x=>x.pkey===r.pkey);if(j>=0)ccOpen(j);};cc.loading?setTimeout(go,1500):go();};
  if(novos.length<=2)novos.forEach(r=>aviso((r.kind==='inscrito'?'Novo inscrito: ':'Novo lead: ')+primeiro(r.name),[curso(r.course),poloNome(r.polo_id)].filter(Boolean).join(' · '),{tipo:'novo',tempo:15000,acao:{label:'Chamar agora',fn:abrir(r)}}));
  else aviso('Chegaram '+novos.length+' pessoas novas',(ins.length?ins.length+' inscritos':'')+(ins.length&&lea.length?' e ':'')+(lea.length?lea.length+' leads':'')+' para chamar.',{tipo:'novo',tempo:15000,acao:{label:'Ver os novos',fn:()=>{openCC();cc.view='quente';render();}}});
}

// ---------- tela ----------
function counts(){
  const c={};['quente','inscrito','lead','hoje','agenda','conv','fim','conversa','retorno','semcontato','fila','mat'].forEach(v=>c[v]=cc.rows.filter(r=>inView(r,v)).length);return c;
}
function render(){
  const c=counts();
  document.querySelectorAll('#cc-tabs [data-v]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.v===cc.view);const k=b.querySelector('b');if(k)k.textContent=c[b.dataset.v];});
  const fila=c.fila,feitos=cc.sum?.meus_hoje||0,total=feitos+fila,pct=total?Math.round(feitos*100/total):100;
  const chip=(v,t)=>'<button type="button" class="cc-chip'+(cc.view===v?' cc-ativo':'')+'" data-v="'+v+'" onclick="ccView(this.dataset.v)"'+(c[v]?'':' disabled')+'><strong>'+c[v]+'</strong> '+t+'</button>';
  const mm=cc.sum?.minhas_matriculas||0,ma=cc.sum?.minhas_aguardando||0;
  $('meudia').innerHTML='<div class="cc-dia2"><div class="cc-dia-frase"><h3>Meu dia</h3>'+
    '<p class="cc-grande">'+(fila?'Você tem <strong>'+fila+'</strong> '+(fila===1?'pessoa':'pessoas')+' para chamar hoje':'Tudo em dia! Ninguém esperando contato agora.')+'</p>'+
    '<div class="cc-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Progresso do dia"><div style="width:'+pct+'%"></div></div>'+
    '<p class="cc-prog-txt"><strong>'+feitos+'</strong> '+(feitos===1?'contato feito':'contatos feitos')+' hoje · <strong>'+mm+'</strong> '+(mm===1?'matrícula sua':'matrículas suas')+(ma?' · <button type="button" class="cc-link" data-v="mat" onclick="ccView(this.dataset.v)">'+ma+' aguardando confirmação</button>':'')+'</p></div>'+
    '<div class="cc-dia-acao">'+(fila?'<button type="button" class="btn cc-comecar" onclick="ccComecar()">Começar atendimento</button><span>A próxima pessoa abre sozinha depois de salvar.</span>':'')+'</div></div>'+
    '<div class="cc-chips"><span>Na fila:</span>'+chip('conversa','conversando')+chip('quente','novos')+chip('retorno','retornos de hoje')+chip('semcontato','sem contato')+'</div>';
  const list=filtered(),pages=Math.max(1,Math.ceil(list.length/PAGE));cc.page=Math.min(cc.page,pages-1);
  const slice=list.slice(cc.page*PAGE,(cc.page+1)*PAGE);
  $('count').textContent=list.length+(list.length===1?' pessoa':' pessoas')+' nesta lista';
  $('rows').innerHTML=slice.length?slice.map(row).join(''):'<tr><td colspan="5" class="cc-vazio">'+(cc.rows.length?'Ninguém nesta lista com esses filtros.':'Nenhum lead ou inscrito ainda. Baixe as planilhas de leads e inscritos no Portal Comercial: o vigia envia sozinho.')+'</td></tr>';
  $('page').textContent='Página '+(cc.page+1)+' de '+pages;
  $('prev').disabled=cc.page===0;$('next').disabled=cc.page>=pages-1;
}
function placar(){
  const s=cc.sum;if(!s)return '';
  return '<div class="cc-placar"><div><strong>'+s.meus_hoje+'</strong><span>seus contatos hoje</span></div><div><strong>'+s.equipe_hoje+'</strong><span>da equipe hoje</span></div><div><strong>'+s.matriculas+'</strong><span>matrículas pelo CRM</span></div></div>';
}
window.ccComecar=function(){cc.view='fila';cc.feitos=new Set();$('ordem').value='prioridade';cc.page=0;render();const l=filtered();if(l.length)ccOpen(cc.rows.indexOf(l[0]));};
function card(v,n,t,urg){return '<button type="button" class="meudia-item'+(urg?' meudia-urgente':'')+(cc.view===v?' meudia-ativo':'')+'" onclick="ccView(\''+v+'\')"><strong>'+n+'</strong><span>'+t+'</span></button>';}
function tag(r){
  if(travado(r))return '<span class="cc-tag cc-lock">'+esc(primeiro(cc.locks[r.pkey]))+' está atendendo</span>';
  if(quente(r))return '<span class="cc-tag cc-hot-tag">'+(dias(r.created)===0?'Chegou hoje':'Novo')+'</span>';
  if(!r.status)return '<span class="cc-tag cc-s-new">Sem contato</span>';
  let t=r.status;if(r.status==='Retornar em outra data'&&r.next_contact)t='Retornar em '+br(r.next_contact);
  if(r.status==='Não atendeu')t='Não atendeu ('+r.attempts+'x)';
  return '<span class="cc-tag '+ST[r.status].cls+'">'+esc(t)+'</span>';
}
function row(r){
  const i=cc.rows.indexOf(r),d=dias(r.created),cs=curso(r.course);
  const sub=r.kind==='inscrito'?(r.offer||'Inscrito'):(r.origin||'Lead');
  const wa=r.mobile?'<a class="btn btn-sm cc-wa" href="'+waLink(r)+'" target="_blank" rel="noopener noreferrer" onclick="ccOpened('+i+')" aria-label="Chamar '+esc(primeiro(r.name))+' no WhatsApp">WhatsApp</a>':'';
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
  if(r.reinscrito)avisos.push('Já tinha se inscrito antes. Pergunte o que faltou da outra vez.');
  if(r.lead_key)avisos.push('Veio da lista de leads. O histórico de antes continua aqui.');
  if(!r.mobile)avisos.push('Sem celular válido na planilha.');
  const copia=(v,l)=>v?'<button type="button" class="cc-copy" data-v="'+esc(v)+'" onclick="ccCopy(this.dataset.v,this)" aria-label="Copiar '+l+'">Copiar</button>':'';
  const dados=[
    ['Celular',r.mobile?fone(r.mobile):'Não informado',r.mobile?copia(r.mobile,'celular'):''],
    r.inscription_id?['Código de inscrição',r.inscription_id,copia(r.inscription_id,'código de inscrição')]:null,
    r.cpf?['CPF',cpfFmt(r.cpf),copia(r.cpf,'CPF')]:null,
    ['Curso',cs||'Não informado',''],
    r.offer?['Forma de ingresso',r.offer,'']:null,
    !r.offer&&r.origin?['Origem',r.origin,'']:null,
    ['Polo',poloNome(r.polo_id),''],
    r.created?[r.kind==='inscrito'?'Inscrição em':'Cadastro em',br(r.created)+' ('+(dias(r.created)===0?'hoje':dias(r.created)===1?'ontem':'há '+dias(r.created)+' dias')+')','']:null
  ].filter(Boolean);
  const wa=r.mobile?'<a class="btn whatsapp-contact" href="'+waLink(r)+'" target="_blank" rel="noopener noreferrer">Chamar no WhatsApp com mensagem pronta</a>'+
    '<div class="cc-contato"><a class="btn btn-gh" href="tel:+55'+r.mobile+'">Ligar</a><button type="button" class="btn btn-gh" onclick="ccCopyMsg(this)">Copiar mensagem</button></div>'+
    '<details class="cc-preview"><summary>Ver a mensagem</summary><p>'+esc(mensagem(r))+'</p></details>':'';
  const btns=Object.keys(ST).filter(x=>x!=='Matrícula feita').map(s=>'<button type="button" class="cc-opt '+ST[s].cls+'" data-s="'+esc(s)+'" aria-pressed="false" onclick="ccPick(this)">'+esc(s)+'</button>').join('');
  return '<button class="btn btn-gh btn-sm drawer-close" onclick="ccClose()">Fechar ficha</button>'+
   '<h3>'+esc(r.name)+'</h3><p class="cc-kind">'+(r.kind==='inscrito'?'Inscrito':'Lead')+(r.status?' · '+tag(r):'')+'</p>'+
   (avisos.length?'<ul class="cc-avisos">'+avisos.map(a=>'<li>'+a+'</li>').join('')+'</ul>':'')+wa+
   (r.notes?'<p class="cc-ultima"><strong>Última anotação:</strong> '+esc(r.notes)+'</p>':'')+
   '<div class="cc-resultado"><h4>Como foi o contato?</h4><p class="crm-info">Escolha o resultado e clique em <strong>Salvar</strong> no rodapé.</p>'+
   '<label class="cc-nota">Anotação (opcional)<textarea id="cc-note" rows="2" maxlength="1000" placeholder="Ex.: pediu para ligar depois das 18h"></textarea></label>'+
   '<button type="button" class="cc-opt cc-opt-mat cc-s-mat" data-s="Matrícula feita" aria-pressed="false" onclick="ccPick(this)">✓ Matrícula feita</button>'+
   '<div class="cc-opts" role="group" aria-label="Resultado do contato">'+btns+'</div>'+
   '<div id="cc-date-wrap" class="cc-data" hidden><label>Retornar em<input id="cc-date" type="date" min="'+today()+'" value="'+addDays(today(),1)+'"></label></div>'+
   '<p id="cc-edit-msg" class="cc-msg" role="status" aria-live="polite"></p></div>'+
   '<h4>Dados para a matrícula</h4><dl class="cc-dados">'+dados.map(d=>'<div><dt>'+esc(d[0])+'</dt><dd>'+esc(d[1])+d[2]+'</dd></div>').join('')+'</dl>'+
   '<h4>Histórico</h4><div id="cc-hist" class="crm-info">Carregando...</div>'+
   '<div class="cc-rodape"><p id="cc-escolha">Escolha como foi o contato</p><button id="cc-save" class="btn" onclick="ccSaveEscolha()" disabled>Salvar e ir para o próximo</button></div>';
}
async function hist(r){
  const keys=[r.pkey];if(r.lead_key)keys.push(r.lead_key);
  try{
    const {data,error}=await db.rpc('crm_history_of',{p_campaign:cc.campaign,p_keys:keys});if(error)throw error;
    if(cc.edit!==r)return;
    $('hist').innerHTML=data?.length?'<ol class="cc-hist">'+data.map(h=>'<li><strong>'+esc(h.status)+(h.next_contact&&h.status==='Retornar em outra data'?' ('+br(h.next_contact)+')':'')+'</strong><span>'+esc(primeiro(h.actor_name))+', '+new Date(h.created_at).toLocaleString('pt-BR',{timeZone:'America/Rio_Branco',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(h.pkey!==r.pkey?' · quando era lead':'')+'</span>'+(h.note?'<p>'+esc(h.note)+'</p>':'')+'</li>').join('')+'</ol>':'Nenhum contato registrado ainda.';
  }catch(e){if(cc.edit===r)$('hist').textContent='Não foi possível carregar o histórico.';}
}

// ---------- em atendimento ----------
function trava(r,on){
  if(!r)return;db.rpc('crm_lock',{p_campaign:cc.campaign,p_pkey:r.pkey,p_on:on}).then(()=>{},()=>{});
  clearInterval(cc.hb);if(on)cc.hb=setInterval(()=>{if(cc.edit===r)db.rpc('crm_lock',{p_campaign:cc.campaign,p_pkey:r.pkey,p_on:true}).then(()=>{},()=>{});},60000);
}
async function atualizaTravas(){
  try{const {data}=await db.rpc('crm_locks_of',{p_campaign:cc.campaign});const novo=JSON.stringify(data||{});if(novo!==JSON.stringify(cc.locks||{})){cc.locks=data||{};render();}}catch{}
}
setInterval(()=>{if($('dialog')?.open&&!document.hidden&&cc.modo!=='painel'&&cc.modo!=='equipe')atualizaTravas();},30000);
window.addEventListener('beforeunload',()=>{if(cc.edit)trava(cc.edit,false);});

// ---------- ações globais ----------
window.openCC=function(){
  const d=$('dialog');montaModos();if(!d.open)d.showModal();cc.page=0;ccModo('atend');load();
};
window.closeCC=async function(){if(cc.saving)return;if(cc.edit&&!(await confirmLeave()))return;ccCloseEditor();$('dialog').close();};
async function confirmLeave(){const n=document.getElementById('cc-note');const dirty=(n&&n.value.trim())||document.querySelector('.cc-opt[aria-pressed=true]');return !dirty||await caixa('Você escolheu um resultado ou escreveu uma anotação e ainda não salvou.',{titulo:'Contato não salvo',ok:'Descartar',cancelar:'Voltar para a ficha',perigo:true});}
function ccCloseEditor(){if(cc.edit&&!cc.saving)trava(cc.edit,false);clearInterval(cc.hb);cc.edit=null;const e=$('editor');e.hidden=true;e.innerHTML='';}
window.ccView=function(v){cc.view=v;cc.feitos=new Set();cc.page=0;render();$('rows').closest('.tw').scrollIntoView({block:'start',behavior:'smooth'});};
window.ccFilter=function(){cc.page=0;render();};
window.ccReset=function(){['search','polo','curso','sit'].forEach(k=>$(k).value='');$('ordem').value='prioridade';ccFilter();};
window.ccPage=function(d){cc.page+=d;render();$('rows').closest('.tw').scrollIntoView({block:'start'});};
window.ccOpen=async function(i){
  const r=cc.rows[i];if(!r)return;if(cc.edit&&cc.edit!==r&&!(await confirmLeave()))return;
  if(travado(r)&&!(await caixa(primeiro(cc.locks[r.pkey])+' está atendendo '+primeiro(r.name)+' agora. Se abrir, vocês podem chamar a mesma pessoa.',{titulo:'Em atendimento',ok:'Abrir mesmo assim',cancelar:'Deixar com '+primeiro(cc.locks[r.pkey])})))return;
  if(cc.edit&&cc.edit!==r)trava(cc.edit,false);
  cc.edit=r;trava(r,true);const e=$('editor');e.innerHTML=ficha(r);e.hidden=false;e.scrollTop=0;e.querySelector('h3').setAttribute('tabindex','-1');e.querySelector('h3').focus();hist(r);
};
window.ccClose=async function(){if(!(await confirmLeave()))return;ccCloseEditor();};
window.ccOpened=function(i){/* abriu o WhatsApp pela lista: abre a ficha para registrar o resultado */setTimeout(()=>{if(cc.edit!==cc.rows[i])ccOpen(i);},300);};
window.ccPick=function(b){
  const s=b.dataset.s;
  document.querySelectorAll('.cc-opt').forEach(x=>x.setAttribute('aria-pressed',x===b));
  $('date-wrap').hidden=s!=='Retornar em outra data';if(s==='Retornar em outra data')$('date').focus();
  $('escolha').innerHTML='Resultado: <strong>'+esc(s)+'</strong>. '+esc(ST[s].help);
  $('save').disabled=false;$('save').textContent=s==='Lista negra'?'Colocar na lista negra e ir para o próximo':s==='Matrícula feita'?'Registrar matrícula e ir para o próximo':'Salvar e ir para o próximo';
};
window.ccSave=async function(s){
  const r=cc.edit;if(!r||cc.saving||!ST[s])return;
  const next=s==='Retornar em outra data'?$('date').value:null,note=$('note').value;
  if(s==='Retornar em outra data'&&(!next||next<today())){$('edit-msg').textContent='Escolha uma data de hoje em diante.';return;}
  if(s==='Lista negra'&&!(await caixa(r.name+' nunca mais vai aparecer no CRM, nem quando vier em planilha nova.',{titulo:'Colocar na lista negra?',ok:'Colocar na lista negra',perigo:true})))return;
  (cc.feitos=cc.feitos||new Set()).add(r.pkey);
  cc.saving=true;document.querySelectorAll('.cc-opt,#cc-save').forEach(x=>x.disabled=true);$('edit-msg').textContent='Salvando...';
  try{
    const {error}=await db.rpc('crm_save',{p_campaign:cc.campaign,p_pkey:r.pkey,p_status:s,p_next:next,p_note:note,p_version:r.fkey===r.pkey?r.version:0});
    if(error)throw error;
    cc.saving=false;clearInterval(cc.hb);cc.edit=null;$('editor').hidden=true;$('editor').innerHTML='';await load(true);msg('Contato de '+primeiro(r.name)+' salvo ('+s.toLowerCase()+').','ok');
    const prox=filtered().find(x=>!cc.feitos.has(x.pkey)),j=prox?cc.rows.indexOf(prox):-1;
    if(j>=0)ccOpen(j);else msg('Contato de '+primeiro(r.name)+' salvo. Essa lista acabou, parabéns!','ok');
  }catch(e){cc.saving=false;document.querySelectorAll('.cc-opt,#cc-save').forEach(x=>x.disabled=false);$('edit-msg').textContent='Não salvou: '+e.message;}
};
window.ccSaveEscolha=function(){const b=document.querySelector('.cc-opt[aria-pressed=true]');if(b)ccSave(b.dataset.s);};
window.ccCopyMsg=function(b){if(cc.edit)ccCopy(mensagem(cc.edit),b);};
// o próprio botão vira "✓ Copiado" por 2 segundos
window.ccCopy=async function(v,b){
  try{await navigator.clipboard.writeText(v);}catch{aviso('Não consegui copiar','Selecione e copie: '+v,{tipo:'erro',tempo:15000});return;}
  if(!b)return;clearTimeout(b._t);if(!b.dataset.txt)b.dataset.txt=b.textContent;
  b.textContent='✓ Copiado';b.classList.add('cc-copiado');
  b._t=setTimeout(()=>{b.textContent=b.dataset.txt;b.classList.remove('cc-copiado');},2000);
};

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dialog')?.open){e.preventDefault();if(cc.edit)ccClose();else closeCC();}});
// atualização automática a cada 2 minutos quando ninguém está editando
setInterval(()=>{
  if(document.hidden||cc.saving||typeof currentProfile==='undefined'||!currentProfile||document.getElementById('app-shell')?.hidden)return;
  if($('dialog')?.open&&!cc.edit)load(true);else silencioso();
},120000);
// com o CRM fechado ou com uma ficha aberta: só confere se chegou gente nova, sem mexer na tela
async function silencioso(){
  try{const camp=document.getElementById('f-campaign')?.value||APP_CONFIG.campaign;cc.campaign=cc.campaign||camp;
    const {data,error}=await db.rpc('crm_list',{p_campaign:camp});if(error)return;novidades(data||[]);
    if(!$('dialog')?.open)cc.rows=data||[];}catch{}
}
setTimeout(()=>{if(typeof currentProfile!=='undefined'&&currentProfile)silencioso();},8000);

// ---------- modos: Atendimento | Painel | Equipe ----------
function montaModos(){
  if($('modos'))return;
  const dlg=$('dialog'),ref=$('meudia');
  const nav=document.createElement('nav');nav.id='cc-modos';nav.className='cc-modos';nav.setAttribute('aria-label','Áreas do CRM');
  nav.innerHTML='<button type="button" data-m="atend" aria-pressed="true">Atendimento</button><button type="button" data-m="painel" aria-pressed="false">Painel</button>'+
    (currentProfile?.role==='admin'?'<button type="button" data-m="equipe" aria-pressed="false">Equipe</button>':'');
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)ccModo(b.dataset.m);});
  const atend=document.createElement('div');atend.id='cc-atend';
  ref.parentNode.insertBefore(nav,ref);ref.parentNode.insertBefore(atend,ref);
  [ref,$('tabs'),dlg.querySelector('.cc-filtros'),$('count'),dlg.querySelector('.tw'),dlg.querySelector('.cc-paginas')].forEach(el=>el&&atend.appendChild(el));
  const pn=document.createElement('div');pn.id='cc-painel';pn.hidden=true;atend.after(pn);
  const eq=document.createElement('div');eq.id='cc-equipe';eq.hidden=true;pn.after(eq);
  if(!$('tabs').querySelector('[data-v="mat"]')){const b=document.createElement('button');b.className='btn btn-gh';b.dataset.v='mat';b.innerHTML='Matrículas feitas<b></b>';b.onclick=()=>ccView('mat');$('tabs').appendChild(b);}
}
window.ccModo=function(m){
  cc.modo=m;document.querySelectorAll('#cc-modos [data-m]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  $('atend').hidden=m!=='atend';$('painel').hidden=m!=='painel';$('equipe').hidden=m!=='equipe';
  if(m==='painel')painel();if(m==='equipe')equipe();
};
function periodo(k){
  const t=today();
  if(k==='hoje')return [t,t];
  if(k==='ontem'){const y=addDays(t,-1);return [y,y];}
  if(k==='7')return [addDays(t,-6),t];
  if(k==='mes')return [t.slice(0,8)+'01',t];
  return [snapshot?.campaign?.starts_on||addDays(t,-180),t];
}
const NOMES_PER={hoje:'Hoje',ontem:'Ontem','7':'Últimos 7 dias',mes:'Este mês',sem:'Semestre todo'};
function seletorPeriodo(fn,atual,lista){return '<div class="cc-per" role="group" aria-label="Período">'+lista.map(k=>'<button type="button" data-p="'+k+'" aria-pressed="'+(k===atual)+'" onclick="'+fn+'(this.dataset.p)">'+NOMES_PER[k]+'</button>').join('')+'</div>';}
function barras(lista,rot,val,extra){
  const max=Math.max(1,...lista.map(val));
  return lista.length?'<ul class="cc-barras">'+lista.map(x=>'<li><span class="cc-b-rot">'+esc(rot(x))+'</span><span class="cc-b-trilho"><span style="width:'+Math.round(val(x)*100/max)+'%"></span></span><strong>'+val(x)+'</strong>'+(extra?'<span class="cc-b-extra">'+extra(x)+'</span>':'')+'</li>').join('')+'</ul>':'<p class="cc-muted">Nada neste período.</p>';
}

// Painel
async function painel(per){
  cc.pPer=per||cc.pPer||'mes';const [de,ate]=periodo(cc.pPer);const pl=cc.pPolo||'';
  const polos=[...new Set(cc.rows.map(r=>r.polo_id))].map(id=>[id,poloNome(id)||id]).sort((a,b)=>a[1].localeCompare(b[1]));
  const el=$('painel');el.innerHTML='<div class="cc-p-topo">'+seletorPeriodo('ccPainel',cc.pPer,['hoje','7','mes','sem'])+
    (polos.length>1?'<label class="cc-p-polo">Polo<select onchange="ccPainelPolo(this.value)"><option value="">Todos os polos</option>'+polos.map(p=>'<option value="'+esc(p[0])+'"'+(p[0]===pl?' selected':'')+'>'+esc(p[1])+'</option>').join('')+'</select></label>':'')+
    '</div><p class="cc-muted">Carregando...</p>';
  try{
    const {data:d,error}=await db.rpc('crm_dashboard',{p_campaign:cc.campaign,p_from:de,p_to:ate,p_polo:pl||null});if(error)throw error;
    const pessoas=d.leads+d.inscritos,pctc=pessoas?Math.round(d.contatados*100/pessoas):0;
    const h=d.horas_1o_contato;const tempo=h==null?'—':h<1?'menos de 1 h':h<48?Math.round(h)+' h':Math.round(h/24)+' dias';
    const k=(n,t,sub)=>'<div class="cc-kpi"><strong>'+n+'</strong><span>'+t+'</span>'+(sub?'<small>'+sub+'</small>':'')+'</div>';
    const res=Object.entries(d.por_resultado||{}).map(([s,n])=>({s,n})).sort((a,b)=>b.n-a.n);
    el.querySelector('.cc-muted').outerHTML='<p class="cc-p-legenda">'+NOMES_PER[cc.pPer]+' · '+(pl?esc(poloNome(pl)):'todos os polos do seu acesso')+'</p>'+
      '<div class="cc-kpis">'+k(d.matriculas,d.matriculas===1?'matrícula pelo CRM':'matrículas pelo CRM','confirmadas pelo relatório')+k(pessoas,'chegaram','leads '+d.leads+' · inscritos '+d.inscritos)+k(pctc+'%','receberam contato',d.contatados+' de '+pessoas)+k(tempo,'até o 1º contato','média')+k(d.contatos,d.contatos===1?'contato registrado':'contatos registrados','')+'</div>'+
      '<div class="cc-p-grade">'+
      '<section class="cc-p-card"><h4>Ranking de matrículas</h4>'+barras(d.ranking,x=>x.name||'Sem nome',x=>x.matriculas,x=>x.contatos+' contatos')+'</section>'+
      '<section class="cc-p-card"><h4>De onde vêm as matrículas</h4>'+barras(d.por_origem,x=>x.origem,x=>x.matriculas)+'</section>'+
      '<section class="cc-p-card"><h4>Por polo</h4>'+barras(d.por_polo,x=>poloNome(x.polo_id)||x.polo_id,x=>x.pessoas,x=>x.contatados+' contatados · '+x.matriculas+' matr.')+'</section>'+
      '<section class="cc-p-card"><h4>Resultado dos contatos</h4>'+barras(res,x=>x.s,x=>x.n)+'</section></div>';
  }catch(e){el.querySelector('.cc-muted').textContent='Não consegui carregar o painel: '+e.message;}
}
window.ccPainel=p=>painel(p);
window.ccPainelPolo=v=>{cc.pPolo=v;painel();};

// Equipe (só administrador)
async function equipe(per){
  cc.ePer=per||cc.ePer||'hoje';const [de,ate]=periodo(cc.ePer);
  const el=$('equipe');el.innerHTML='<div class="cc-p-topo">'+seletorPeriodo('ccEquipe',cc.ePer,['hoje','ontem','7','mes'])+'</div><p class="cc-muted">Carregando...</p>';
  try{
    const {data,error}=await db.rpc('crm_team',{p_campaign:cc.campaign,p_from:de,p_to:ate});if(error)throw error;
    cc.time=data||[];
    el.querySelector('.cc-muted').outerHTML=cc.time.length?'<p class="cc-p-legenda">'+NOMES_PER[cc.ePer]+'. Clique no nome para ver o que a pessoa fez.</p><div class="tw"><table class="pt cc-eq"><thead><tr><th>Consultor</th><th>Contatos</th><th>Conversando</th><th>Não atendeu</th><th>Retornos marcados</th><th>Convalidação</th><th>Encerrados</th><th>Matrículas</th></tr></thead><tbody>'+
      cc.time.map((t,i)=>'<tr><td><button type="button" class="cc-link cc-eq-nome" onclick="ccEquipeVer('+i+')">'+esc(t.name||'Sem nome')+'</button><span class="cc-sub">'+t.pessoas+' pessoas</span></td><td><strong>'+t.contatos+'</strong></td><td>'+t.conversando+'</td><td>'+t.nao_atendeu+'</td><td>'+t.retornos+'</td><td>'+t.convalidacao+'</td><td>'+t.encerrados+'</td><td><strong>'+t.matriculas+'</strong>'+(t.aguardando?'<span class="cc-sub">+'+t.aguardando+' aguardando</span>':'')+'</td></tr>').join('')+'</tbody></table></div><div id="cc-eq-det"></div>':'<p class="cc-p-legenda">Ninguém registrou contato neste período.</p>';
  }catch(e){el.querySelector('.cc-muted').textContent='Não consegui carregar a equipe: '+e.message;}
}
window.ccEquipe=p=>equipe(p);
window.ccEquipeVer=async function(i){
  const t=cc.time[i],[de,ate]=periodo(cc.ePer),el=$('eq-det');if(!t||!el)return;
  el.innerHTML='<h4>'+esc(t.name)+'</h4><p class="cc-muted">Carregando...</p>';
  try{const {data,error}=await db.rpc('crm_team_detail',{p_campaign:cc.campaign,p_actor:t.actor_id,p_from:de,p_to:ate});if(error)throw error;
    el.innerHTML='<h4>O que '+esc(primeiro(t.name))+' fez ('+NOMES_PER[cc.ePer].toLowerCase()+')</h4>'+(data.length?'<ol class="cc-hist">'+data.map(h=>'<li><strong>'+esc(h.name)+' · '+esc(h.status)+(h.next&&h.status==='Retornar em outra data'?' ('+br(h.next)+')':'')+'</strong><span>'+(h.kind==='inscrito'?'Inscrito':'Lead')+' · '+esc(poloNome(h.polo_id))+' · '+new Date(h.at).toLocaleString('pt-BR',{timeZone:'America/Rio_Branco',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</span>'+(h.note?'<p>'+esc(h.note)+'</p>':'')+'</li>').join('')+'</ol>':'<p class="cc-muted">Nada registrado.</p>');
    el.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(e){el.innerHTML='<p>Não consegui carregar: '+esc(e.message)+'</p>';}
};
})();
