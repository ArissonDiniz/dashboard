// CRM Comercial: mensagens do WhatsApp com versões editáveis.
// Sem nada salvo no banco para uma situação, valem as versões padrão abaixo.
(function(){
'use strict';
window.MsgFab=function(SIT,PADRAO,MARCAS,EXEMPLO){
let salvas={};
let ed={sit:SIT[0][0],lista:[],sujo:false};
function versoes(sit){const s=salvas[sit]?.versoes;return s&&s.length?s:PADRAO[sit]||[];}
// troca as marcas pelo valor; sem curso, some também a palavra antes dele ("em", "de", "sobre")
function preencher(t,ctx){
  let s=String(t||'');
  if(!ctx.curso)s=s.replace(/\s+(?:no curso de|pelo curso de|o curso de|em|de|sobre)\s+\{curso\}/gi,'').replace(/\{curso\}/g,'o curso');
  s=s.replace(/\{(\w+)\}/g,(m,k)=>k in ctx?(ctx[k]||''):m);
  return s.replace(/[ \t]{2,}/g,' ').replace(/\s+([.,!?])/g,'$1').trim();
}
async function carregar(){try{const {data,error}=await db.rpc('crm_templates_list');if(!error)salvas=data||{};}catch{}}

// ---------- editor (só administrador) ----------
function editor(el){
  el.innerHTML='<div class="cm-wrap"><div class="cm-lado"><h4>Situações</h4><ul class="cm-sits">'+SIT.map(([k,n])=>'<li><button type="button" data-k="'+k+'" aria-pressed="'+(k===ed.sit)+'">'+esc(n)+'<small>'+versoes(k).length+' versões'+(salvas[k]?' · editada':'')+'</small></button></li>').join('')+'</ul></div>'+
    '<div class="cm-main" id="cm-main"></div></div>';
  el.querySelector('.cm-sits').addEventListener('click',async e=>{const b=e.target.closest('[data-k]');if(!b||b.dataset.k===ed.sit)return;
    if(ed.sujo&&!(await caixa('Você mudou as versões desta situação e não salvou.',{titulo:'Mensagens não salvas',ok:'Descartar',cancelar:'Voltar',perigo:true})))return;
    ed.sit=b.dataset.k;editor(el);});
  ed.lista=versoes(ed.sit).map(v=>({titulo:v.titulo||'',texto:v.texto}));ed.sujo=false;principal(el);
}
function principal(el){
  const m=el.querySelector('#cm-main'),nome=SIT.find(s=>s[0]===ed.sit)[1],sv=salvas[ed.sit];
  m.innerHTML='<h4>'+esc(nome)+'</h4><p class="cc-p-legenda">'+(sv?'Editada por '+esc(sv.por||'?')+' em '+new Date(sv.em).toLocaleString('pt-BR',{timeZone:'America/Rio_Branco',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'.':'Versões padrão do painel.')+' O consultor escolhe a versão na ficha.</p>'+
    ed.lista.map((v,i)=>'<div class="cm-versao"><div class="cm-v-topo"><label>Nome da versão<input data-i="'+i+'" data-c="titulo" maxlength="60" value="'+esc(v.titulo)+'" placeholder="Versão '+(i+1)+'"></label><button type="button" class="btn btn-gh btn-sm" data-del="'+i+'"'+(ed.lista.length<2?' disabled':'')+'>Apagar</button></div>'+
      '<label class="cm-texto">Texto<textarea data-i="'+i+'" data-c="texto" rows="4" maxlength="1500">'+esc(v.texto)+'</textarea></label>'+
      '<p class="cm-prev"><span>Como fica:</span> '+esc(exemplo(v.texto))+'</p></div>').join('')+
    '<div class="cm-acoes">'+(ed.lista.length<10?'<button type="button" class="btn btn-gh" id="cm-add">+ Nova versão</button>':'')+(sv?'<button type="button" class="btn btn-gh" id="cm-reset">Voltar ao padrão</button>':'')+'<button type="button" class="btn" id="cm-salvar">Salvar mensagens</button></div><p id="cm-msg" class="cc-msg" role="status" aria-live="polite"></p>'+
    '<details class="cm-marcas" open><summary>Marcas que o painel preenche sozinho</summary><ul>'+MARCAS.map(([k,d])=>'<li><code>'+k+'</code> '+esc(d)+'</li>').join('')+'</ul></details>';
  m.oninput=e=>{const t=e.target;if(t.dataset.i===undefined)return;ed.lista[+t.dataset.i][t.dataset.c]=t.value;ed.sujo=true;
    if(t.dataset.c==='texto')t.closest('.cm-versao').querySelector('.cm-prev').innerHTML='<span>Como fica:</span> '+esc(exemplo(t.value));};
  m.onclick=async e=>{
    const d=e.target.closest('[data-del]');if(d){ed.lista.splice(+d.dataset.del,1);ed.sujo=true;principal(el);return;}
    if(e.target.id==='cm-add'){ed.lista.push({titulo:'',texto:''});ed.sujo=true;principal(el);m.querySelectorAll('textarea')[ed.lista.length-1].focus();return;}
    if(e.target.id==='cm-reset'){if(await caixa('As versões desta situação voltam a ser as padrão do painel.',{titulo:'Voltar ao padrão?',ok:'Voltar ao padrão'}))salvar(el,[]);return;}
    if(e.target.id==='cm-salvar'){const l=ed.lista.map((v,i)=>({titulo:v.titulo.trim()||'Versão '+(i+1),texto:v.texto.trim()}));
      if(l.some(v=>v.texto.length<5)){m.querySelector('#cm-msg').textContent='Tem versão sem texto. Escreva ou apague.';return;}salvar(el,l);}
  };
}
async function salvar(el,lista){
  const msgEl=el.querySelector('#cm-msg');msgEl.textContent='Salvando...';
  try{const {error}=await db.rpc('crm_templates_save',{p_situacao:ed.sit,p_versoes:lista});if(error)throw error;
    await carregar();editor(el);el.querySelector('#cm-msg').textContent='Mensagens salvas. Já valem para toda a equipe.';el.querySelector('#cm-msg').className='cc-msg cc-msg-ok';
  }catch(e){msgEl.textContent='Não salvou: '+e.message;}
}
function exemplo(t){return preencher(t,EXEMPLO(primeiroNome()));}
function primeiroNome(){const p=String(currentProfile?.name||'Ana').trim().split(/\s+/)[0];return p.charAt(0).toUpperCase()+p.slice(1).toLowerCase();}

return {SIT,versoes,preencher,carregar,editor,sujo:()=>ed.sujo};

};
const SIT=[
  ['ins_novo','Inscrito: primeiro contato'],
  ['ins_segunda','Inscrito: segunda graduação'],
  ['ins_transf','Inscrito: transferência'],
  ['ins_enem','Inscrito: nota do ENEM'],
  ['ins_encceja','Inscrito: ENCCEJA'],
  ['lead_curso','Lead: primeiro contato (com curso)'],
  ['lead_geral','Lead: primeiro contato (sem curso)'],
  ['lead_abandono','Lead: começou a inscrição e parou'],
  ['lead_enem','Lead: quer usar o ENEM'],
  ['lead_indicacao','Lead: indicação de amigo'],
  ['sem_resp','Sem resposta: nova mensagem'],
  ['sem_resp_ult','Sem resposta: última mensagem'],
  ['conversando','Conversando'],
  ['retorno','Retorno marcado'],
  ['convalidacao','Aguardando convalidação']
];
const V=(titulo,texto)=>({titulo,texto});
const PADRAO={
  ins_novo:[
    V('Acolhedora','Oi, {nome}! Tudo bem? {apresentacao} {de_volta}Que alegria ver sua inscrição em {curso}! Falta bem pouquinho para você garantir sua vaga. Posso te ajudar a finalizar a matrícula agora? Leva só alguns minutos. 😊'),
    V('Curta','Oi, {nome}! {apresentacao} Vi sua inscrição em {curso}. Quer que eu te ajude a finalizar a matrícula? É rapidinho.'),
    V('Com pergunta','Oi, {nome}, tudo bem? {apresentacao} {de_volta}Recebi sua inscrição em {curso}. Ficou alguma dúvida sobre mensalidade, aulas ou documentos? Me conta que eu resolvo com você por aqui.')
  ],
  ins_segunda:[
    V('Explicando a vantagem','Oi, {nome}! Tudo bem? {apresentacao} {de_volta}Vi sua inscrição para a segunda graduação em {curso}. Como você já tem diploma, dá para aproveitar disciplinas e se formar mais rápido. Quer que eu te explique como fica no seu caso?'),
    V('Curta','Oi, {nome}! {apresentacao} Vi que você quer fazer a segunda graduação em {curso}. Me manda seu histórico que eu vejo quais disciplinas você aproveita?')
  ],
  ins_transf:[
    V('Explicando','Oi, {nome}! Tudo bem? {apresentacao} {de_volta}Vi que você quer transferir seu curso de {curso} para a UNIASSELVI. A gente analisa as disciplinas que você já cursou para você não perder nada. Pode me mandar seu histórico por aqui?'),
    V('Curta','Oi, {nome}! {apresentacao} Recebi seu pedido de transferência. Me manda o histórico da outra faculdade que eu já peço a análise das disciplinas.')
  ],
  ins_enem:[
    V('Animada','Oi, {nome}! Tudo bem? {apresentacao} {de_volta}Vi sua inscrição em {curso} usando a nota do ENEM. Com ela você entra sem precisar fazer vestibular! Posso te ajudar a finalizar a matrícula agora? Leva só alguns minutos.'),
    V('Curta','Oi, {nome}! {apresentacao} Sua inscrição pelo ENEM em {curso} chegou aqui. Vamos finalizar a matrícula? Te ajudo agora.')
  ],
  ins_encceja:[
    V('Animada','Oi, {nome}! Tudo bem? {apresentacao} {de_volta}Vi sua inscrição em {curso} com o certificado do ENCCEJA. Está tudo certo para você começar! Posso te ajudar a finalizar a matrícula agora?'),
    V('Curta','Oi, {nome}! {apresentacao} Recebi sua inscrição com o ENCCEJA. Vamos finalizar a matrícula juntos?')
  ],
  lead_curso:[
    V('Contando condições','Oi, {nome}! Tudo bem? {apresentacao} Vi que você se interessou pelo curso de {curso}. Posso te contar como funciona, o valor da mensalidade e as condições deste mês? 😊'),
    V('Curta','Oi, {nome}! {apresentacao} Você pediu informações sobre {curso}, certo? Quer que eu te mande os valores?'),
    V('Com pergunta','Oi, {nome}, tudo bem? {apresentacao} Vi seu interesse em {curso}. Você prefere estudar mais online ou ter aulas no polo? Assim te passo a melhor opção.')
  ],
  lead_geral:[
    V('Acolhedora','Oi, {nome}! Tudo bem? {apresentacao} Vi que você tem interesse em fazer uma graduação com a gente. Qual curso você tem vontade de fazer? Te conto como funciona e as condições deste mês. 😊'),
    V('Curta','Oi, {nome}! {apresentacao} Vi seu interesse em estudar com a gente. Qual curso você está pensando em fazer?')
  ],
  lead_abandono:[
    V('Ajudando','Oi, {nome}! Tudo bem? {apresentacao} Vi que você começou sua inscrição e não conseguiu terminar. Posso te ajudar a concluir? É rapidinho.'),
    V('Curta','Oi, {nome}! {apresentacao} Sua inscrição ficou pela metade. Quer que eu termine com você agora?')
  ],
  lead_enem:[
    V('Explicando','Oi, {nome}! Tudo bem? {apresentacao} Vi que você quer usar sua nota do ENEM para entrar na faculdade. Com ela você entra sem vestibular! Qual curso você tem vontade de fazer?'),
    V('Curta','Oi, {nome}! {apresentacao} Com sua nota do ENEM você entra sem vestibular. Qual curso te interessa?')
  ],
  lead_indicacao:[
    V('Acolhedora','Oi, {nome}! Tudo bem? {apresentacao} Você foi indicado por um amigo para estudar com a gente! Qual curso você tem vontade de fazer? Te conto todas as condições.'),
    V('Curta','Oi, {nome}! {apresentacao} Um amigo indicou você para a UNIASSELVI. Posso te contar como funciona?')
  ],
  sem_resp:[
    V('Lembrete leve','Oi, {nome}! Passando de novo por aqui, viu minha mensagem? Ainda dá tempo de {objetivo}. Se preferir, me diga o melhor horário que eu te chamo.'),
    V('Curta','Oi, {nome}, tudo bem? Conseguiu ver minha mensagem? Estou por aqui para te ajudar a {objetivo}.'),
    V('Com pergunta','Oi, {nome}! Sei que a rotina é corrida. Prefere que eu te explique tudo por áudio ou por mensagem? Assim fica mais fácil para você {objetivo}.')
  ],
  sem_resp_ult:[
    V('Despedida gentil','Oi, {nome}! Esta é minha última mensagem por aqui, para não te incomodar. Se ainda quiser {objetivo}, é só responder que eu te ajudo na hora. Um abraço!'),
    V('Porta aberta','Oi, {nome}! Vou deixar você à vontade. Quando quiser {objetivo}, me chama aqui mesmo, combinado? Um abraço!')
  ],
  conversando:[
    V('Retomando','Oi, {nome}! Conseguiu pensar no que conversamos? Se quiser, já deixo tudo encaminhado para {objetivo}. É só me responder por aqui.'),
    V('Curta','Oi, {nome}! Ficou alguma dúvida do que conversamos? Estou por aqui.')
  ],
  retorno:[
    V('Lembrando o combinado','Oi, {nome}! {apresentacao} Combinamos de conversar hoje, lembra? Podemos continuar de onde paramos sobre {curso}? Se preferir, me diga o melhor horário.'),
    V('Curta','Oi, {nome}! Como combinamos, estou passando para continuar nossa conversa. Tem um minutinho?')
  ],
  convalidacao:[
    V('Pedindo histórico','Oi, {nome}! {apresentacao} Passando para saber se você já conseguiu separar o histórico para a análise das disciplinas. Assim que eu receber, já adianto sua matrícula. Qualquer dúvida, estou por aqui!'),
    V('Curta','Oi, {nome}! Conseguiu o histórico para a análise? Assim que chegar, eu adianto sua matrícula.')
  ]
};
const MARCAS=[['{nome}','primeiro nome da pessoa'],['{consultor}','seu primeiro nome'],['{polo}','nome do polo'],['{curso}','curso da pessoa'],['{apresentacao}','“Aqui é Ana, do time comercial da UNIASSELVI polo Rio Branco.”'],['{objetivo}','“garantir sua vaga em Pedagogia” (inscrito) ou “começar sua graduação neste semestre” (lead)'],['{de_volta}','“Que bom ter você de volta!” só para quem já tinha se inscrito antes']];

function situacao(r){
  const of=String(r.offer||'').toLowerCase(),orig=String(r.origin||'').toLowerCase();
  if(r.status==='Aguardando convalidação')return 'convalidacao';
  if(r.status==='Retornar em outra data')return 'retorno';
  if(r.status==='Conversando')return 'conversando';
  if(r.status==='Não atendeu')return r.attempts>=2?'sem_resp_ult':'sem_resp';
  if(r.kind==='inscrito'){
    if(of.includes('segunda'))return 'ins_segunda';
    if(of.includes('transfer'))return 'ins_transf';
    if(of.includes('enem'))return 'ins_enem';
    if(of.includes('encceja'))return 'ins_encceja';
    return 'ins_novo';
  }
  if(orig.includes('abandono'))return 'lead_abandono';
  if(r.course)return 'lead_curso';
  if(orig.includes('enem'))return 'lead_enem';
  if(orig.includes('indica'))return 'lead_indicacao';
  return 'lead_geral';
}
const F=window.MsgFab(SIT,PADRAO,MARCAS,c=>({nome:'Maria',consultor:c,polo:'Rio Branco',curso:'Pedagogia',apresentacao:'Aqui é '+c+', do time comercial da UNIASSELVI polo Rio Branco.',objetivo:'garantir sua vaga em Pedagogia',de_volta:''}));
window.CCMSG=Object.assign({situacao},F);
})();
