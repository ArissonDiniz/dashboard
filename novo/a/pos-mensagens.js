// Acompanhamento (pós-venda): mensagens do WhatsApp com versões editáveis, no mesmo esquema do CRM Comercial.
// Ficam na mesma tabela do CRM (crm_templates), com chaves começando por "pv_".
(function(){
'use strict';
const SIT=[
  ['pv_nao_pagou','Não pagou: primeiro contato'],
  ['pv_sem_resp','Não pagou: sem resposta'],
  ['pv_prometeu','Prometeu pagamento'],
  ['pv_convalidacao','Aguardando convalidação'],
  ['pv_boas_vindas','Pagou: boas-vindas'],
  ['pv_recepcao','Recepção agendada no polo'],
  ['pv_cancelou','Cancelou: convite para voltar']
];
const V=(titulo,texto)=>({titulo,texto});
const PADRAO={
  pv_nao_pagou:[
    V('Acolhedora','Oi, {nome}! Tudo bem? {apresentacao} Que bom ter você com a gente em {curso}! Vi que a sua primeira mensalidade ainda está em aberto{vencimento}. Quer que eu te mande o boleto ou te ajude com alguma dúvida?'),
    V('Curta','Oi, {nome}! {apresentacao} Sua primeira mensalidade ainda está em aberto{vencimento}. Posso te mandar o boleto por aqui?'),
    V('Com pergunta','Oi, {nome}, tudo bem? {apresentacao} Passando para saber se ficou alguma dúvida sobre o pagamento da primeira mensalidade. Me conta que eu resolvo com você.')
  ],
  pv_sem_resp:[
    V('Lembrete leve','Oi, {nome}! Passando de novo por aqui, conseguiu ver minha mensagem? Sua primeira mensalidade ainda está em aberto e eu posso te ajudar a resolver rapidinho.'),
    V('Curta','Oi, {nome}, tudo bem? Viu minha mensagem? Estou por aqui para te ajudar com a primeira mensalidade.'),
    V('Com pergunta','Oi, {nome}! Sei que a rotina é corrida. Prefere que eu te explique por áudio ou por mensagem? Assim fica mais fácil garantir sua vaga em {curso}.')
  ],
  pv_prometeu:[
    V('Lembrando o combinado','Oi, {nome}! {apresentacao} Passando para lembrar do pagamento da primeira mensalidade que combinamos{prometido}. Precisa que eu te mande o boleto de novo?'),
    V('Curta','Oi, {nome}! Conseguiu fazer o pagamento que combinamos? Se precisar do boleto, me avisa.')
  ],
  pv_convalidacao:[
    V('Pedindo histórico','Oi, {nome}! {apresentacao} Conseguiu separar o histórico para a análise das disciplinas? Assim que chegar, eu adianto tudo para você.'),
    V('Curta','Oi, {nome}! Conseguiu o histórico para a convalidação? Pode mandar por aqui mesmo.')
  ],
  pv_boas_vindas:[
    V('Boas-vindas','Oi, {nome}! {apresentacao} Seja muito bem-vindo(a) à UNIASSELVI! Passando para saber como estão as primeiras aulas de {curso} e se você conseguiu acessar o AVA certinho. Qualquer dúvida, é só me chamar.'),
    V('Convite para o polo','Oi, {nome}! {apresentacao} Que alegria ter você com a gente! Queremos te receber aqui no polo para apresentar tudo e tirar suas dúvidas. Qual o melhor dia para você passar aqui?'),
    V('Curta','Oi, {nome}! Bem-vindo(a) à UNIASSELVI! Conseguiu acessar o AVA? Se precisar de ajuda, estou por aqui.')
  ],
  pv_recepcao:[
    V('Lembrete da visita','Oi, {nome}! {apresentacao} Passando para lembrar da sua visita aqui no polo para a recepção. Estamos te esperando! Se precisar mudar o dia, me avisa.'),
    V('Curta','Oi, {nome}! Lembrete: sua recepção aqui no polo {polo} está marcada. Te esperamos!')
  ],
  pv_cancelou:[
    V('Porta aberta','Oi, {nome}! {apresentacao} Vi que você cancelou sua matrícula em {curso}. Aconteceu alguma coisa em que eu possa ajudar? Se quiser voltar, a gente resolve juntos.'),
    V('Curta','Oi, {nome}! Ainda dá tempo de voltar para {curso}. Quer conversar sobre isso?')
  ]
};
const MARCAS=[['{nome}','primeiro nome do aluno'],['{consultor}','seu primeiro nome'],['{polo}','nome do polo'],['{curso}','curso do aluno'],['{apresentacao}','“Aqui é Ana, do polo UNIASSELVI Rio Branco.”'],['{vencimento}','“, com vencimento em 10/12” (some quando não há data)'],['{prometido}','“para 05/12” (data que o aluno prometeu; some quando não há)']];

const F=window.MsgFab(SIT,PADRAO,MARCAS,c=>({nome:'Maria',consultor:c,polo:'Rio Branco',curso:'Pedagogia',apresentacao:'Aqui é '+c+', do polo UNIASSELVI Rio Branco.',vencimento:', com vencimento em 10/12',prometido:' para 05/12'}));

function situacao(r){
  const s=crmState(r),tipo=tipoAluno(r);
  if(tipo==='cancelado')return 'pv_cancelou';
  if(s.welcome==='Agendada')return 'pv_recepcao';
  if(tipo!=='naoPagou')return 'pv_boas_vindas';
  if(s.status==='Aguardando convalidação')return 'pv_convalidacao';
  if(s.outcome==='Prometeu pagamento')return 'pv_prometeu';
  if(s.outcome==='Sem resposta'||s.welcome==='Tentativa sem resposta')return 'pv_sem_resp';
  return 'pv_nao_pagou';
}
const prim=v=>{const p=String(v||'').trim().split(/\s+/)[0]||'';return p?p.charAt(0).toUpperCase()+p.slice(1).toLowerCase():'';};
const ddmm=d=>d?String(d).slice(8,10)+'/'+String(d).slice(5,7):'';
function sugerida(r){const n=F.versoes(situacao(r)).length||1;return (crmState(r).version||0)%n;}
function mensagem(r,iv){
  const c=prim(currentProfile?.name)||'equipe',p=cap(getPoloKey(r)||'');
  const lista=F.versoes(situacao(r)),v=lista[iv??sugerida(r)]||lista[0];
  const curso=String(r.NOME_DO_CURSO||'').trim().toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g,m=>m.toLowerCase());
  const venc=Core.paid(r)?'':ddmm(Core.expectedDue(r));
  return F.preencher(v?.texto||'',{nome:prim(r.NOME)||'tudo bem',consultor:c,polo:p,curso,
    apresentacao:'Aqui é '+c+', do polo UNIASSELVI'+(p?' '+p:'')+'.',vencimento:venc?', com vencimento em '+venc:'',prometido:crmState(r).promised?' para '+ddmm(crmState(r).promised):''});
}

// ---------- ficha: escolher versão, editar e mandar ----------
whatsappContact=function(r){
  const n=whatsappNumber(r.CELULAR)||whatsappNumber(r.TELEFONE);
  if(!n)return '<p class="crm-info">WhatsApp indisponível: confira o telefone com DDD no relatório.</p>';
  const vs=F.versoes(situacao(r)),sug=sugerida(r),nome=SIT.find(x=>x[0]===situacao(r))[1];
  return '<div class="cc-msgbox pv-msgbox" data-n="'+n+'"><p class="pv-sit">Mensagem sugerida para: <strong>'+esc(nome)+'</strong></p>'+
    '<div class="cc-versoes" role="group" aria-label="Escolha a versão da mensagem"><span>Versão:</span>'+
    vs.map((v,j)=>'<button type="button" data-iv="'+j+'" aria-pressed="'+(j===sug)+'">'+esc(v.titulo||'Versão '+(j+1))+'</button>').join('')+'</div>'+
    '<label class="cc-msgtxt"><span class="sr-only">Texto da mensagem (pode editar antes de mandar)</span><textarea class="pv-txt" rows="5" maxlength="2000">'+esc(mensagem(r,sug))+'</textarea></label>'+
    '<p class="cc-msgdica">Pode mudar o texto só para este aluno antes de mandar. O modelo não muda.</p>'+
    '<a class="btn whatsapp-contact pv-wa" href="#" target="_blank" rel="noopener noreferrer">Chamar no WhatsApp com esta mensagem</a>'+
    '<div class="pv-acoes"><a class="btn btn-gh" href="tel:+'+n+'">Ligar</a><button type="button" class="btn btn-gh pv-copiar">Copiar mensagem</button></div></div>';
};
document.addEventListener('click',async e=>{
  const box=e.target.closest('.pv-msgbox');if(!box||!crm.edit)return;
  const t=box.querySelector('.pv-txt');
  const b=e.target.closest('[data-iv]');
  if(b){
    const atual=box.querySelector('[data-iv][aria-pressed=true]');
    if(atual&&t.value.trim()!==mensagem(crm.edit,+atual.dataset.iv).trim()&&!(await caixa('Você mudou o texto. Trocar de versão apaga a mudança.',{titulo:'Trocar de versão?',ok:'Trocar',cancelar:'Voltar'})))return;
    box.querySelectorAll('[data-iv]').forEach(x=>x.setAttribute('aria-pressed',x===b));t.value=mensagem(crm.edit,+b.dataset.iv);return;
  }
  if(e.target.closest('.pv-wa')){e.target.closest('.pv-wa').href='https://wa.me/'+box.dataset.n+'?text='+encodeURIComponent(t.value.trim());return;}
  const c=e.target.closest('.pv-copiar');
  if(c){try{await navigator.clipboard.writeText(t.value.trim());c.textContent='✓ Copiado';setTimeout(()=>c.textContent='Copiar mensagem',1800);}catch{t.select();}}
});

// ---------- administração: seção "Mensagens do acompanhamento" ----------
const _drawAdminPV=drawAdmin;
drawAdmin=function(...a){
  _drawAdminPV.apply(this,a);
  if(currentProfile?.role!=='admin')return;
  const body=document.getElementById('admin-body');if(!body||body.querySelector('[data-admin-section="pvmsgs"]'))return;
  body.insertAdjacentHTML('beforeend',adminSection('pvmsgs','Mensagens do acompanhamento (WhatsApp)','<p class="context">Textos que aparecem na ficha do aluno no acompanhamento. Cada situação pode ter várias versões; o colaborador escolhe na hora e a sugerida muda a cada contato.</p><div id="pv-editor"><p class="context">Abra esta seção para editar.</p></div>'));
  const sec=body.querySelector('[data-admin-section="pvmsgs"]');
  const abrir=()=>{if(sec.open&&!sec.dataset.ok){sec.dataset.ok=1;F.carregar().then(()=>F.editor(document.getElementById('pv-editor')));}};
  sec.addEventListener('toggle',abrir);abrir();
};

// carrega as versões salvas quando o painel abre e quando o acompanhamento abre
const _drawCRMpv=drawCRM;let carregado=false;
drawCRM=function(...a){if(!carregado){carregado=true;F.carregar();}return _drawCRMpv.apply(this,a);};
window.PVMSG=Object.assign({situacao,mensagem},F);
})();
