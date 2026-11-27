// Administração > Enviar planilhas: matrículas, inscritos e leads de uma vez, sem depender do vigia.
(function(){
'use strict';
const TIPOS={matriculas:'Matrículas (pós-venda)',inscritos:'Inscritos (CRM)',leads:'Leads (CRM)'};
const ORDEM=['matriculas','inscritos','leads'];
let fila=[],enviando=false;

// ---------- leitura ----------
function lerCsv(t){t=t.replace(/^﻿/,'');const L=[];let l=[],c='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}
    else if(ch==='"')q=true;else if(ch===';'){l.push(c);c='';}else if(ch==='\n'){l.push(c);L.push(l);l=[];c='';}else if(ch!=='\r')c+=ch;}
  if(c||l.length){l.push(c);L.push(l);}return L.filter(x=>x.some(v=>String(v).trim()));}
async function texto(f){const b=await f.arrayBuffer();const t=new TextDecoder('utf-8').decode(b);return t.includes('�')?new TextDecoder('windows-1252').decode(b):t;}
function tipoPeloNome(n){n=n.toLowerCase();
  if(n.includes('total_matricula'))return 'matriculas';
  if(n.includes('preinscrito'))return 'leads';
  if(n.includes('indicador_total_comercial'))return 'inscritos';
  return '';}
function tipoPeloCab(cab){if(cab.includes('Origem atual'))return 'leads';return '';}
function dataSo(v,campo,n){const s=String(v||'').trim();if(!s||['nan','nat','null','none'].includes(s.toLowerCase()))return null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/),d=m?m[1]+'-'+m[2]+'-'+m[3]:null;
  if(!d){m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);if(m)d=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');}
  if(!d||isNaN(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw Error(campo+': data inválida na linha '+n+'.');return d;}
function dataHora(s){s=String(s||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2}:\d{2}(:\d{2})?)?/);if(m)return m[1]+'-'+m[2]+'-'+m[3]+'T'+(m[4]||'12:00')+'-05:00';
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2}:\d{2}(:\d{2})?)?/);if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')+'T'+(m[4]||'12:00')+'-05:00';return null;}

// mesmas regras do vigia (robo-atualizacao/processar.js)
function matriculas(v){
  const cab=v[0].map(x=>String(x).trim());
  const obrig=['CODIGO_DA_INSCRICAO','CODIGO_ALUNO','NOME','CODIGO_DO_CURSO','NOME_DO_CURSO','CODIGO_DO_POLO','DATA_MATRICULA','DATA_CANCELAMENTO','DATA_PAGAMENTO_PAINEL','TEM_APROVEITAMENTO','STATUS_ENGAJAMENTO','ULTIMO_ACESSO','SISTEMA_ULTIMO_ACESSO','ESPECIALIZACAO_MATRICULOU_CODIGO','ESPECIALIZACAO_MATRICULOU','ESPECIALIZACAO_MATRICULOU_CPF'];
  const falta=obrig.filter(k=>!cab.includes(k));if(falta.length)throw Error('O relatório de matrículas veio sem as colunas: '+falta.join(', '));
  const vistos=new Set(),out=[];
  v.slice(1).forEach((cel,i)=>{const r=Object.fromEntries(cab.map((h,j)=>[h,String(cel[j]??'').trim()]));const n=i+2,id=r.CODIGO_DA_INSCRICAO;
    if(!id||vistos.has(id))throw Error('Inscrição vazia ou repetida na linha '+n+'.');vistos.add(id);
    const pago=r.DATA_PAGAMENTO_PAINEL===''?null:dataSo(r.DATA_PAGAMENTO_PAINEL,'DATA_PAGAMENTO_PAINEL',n);
    out.push({engagement_status:r.STATUS_ENGAJAMENTO||null,has_credit:r.TEM_APROVEITAMENTO===''?null:r.TEM_APROVEITAMENTO==='S',
      last_access_on:dataSo(r.ULTIMO_ACESSO,'Último acesso',n),last_access_system:r.SISTEMA_ULTIMO_ACESSO||null,
      inscription_id:id,student_code:r.CODIGO_ALUNO,name:r.NOME,course_code:r.CODIGO_DO_CURSO,course_name:r.NOME_DO_CURSO,polo_id:r.CODIGO_DO_POLO,
      enrolled_on:dataSo(r.DATA_MATRICULA,'Matrícula',n),cancelled_on:dataSo(r.DATA_CANCELAMENTO,'Cancelamento',n),
      paid:pago!==null,paid_on:pago,phone:r.TELEFONE||'',mobile:r.CELULAR||'',email:r.EMAIL||'',
      seller_cpf:r.ESPECIALIZACAO_MATRICULOU_CPF||null,seller_code:r.ESPECIALIZACAO_MATRICULOU_CODIGO||'',seller_name:r.ESPECIALIZACAO_MATRICULOU||'',
      extra:{convenio:r.ENTRADA_COM_CONVENIO||null,entrada:r.ENTRADA_QUE_ALUNO_SELECIONOU||null,aceita_whats:r.ACEITA_WHATS||null,renegociou:r.POSSUI_PRIMEIRA_RENEGOCIACAO||null,disciplina:r.DISCIPLINA_ATUAL||null,primeira_disciplina:r.PRIMEIRA_DISCIPLINA||null,turno:r.TURNO||null,ticket:r.TICKET_MEDIO||null}});
  });
  if(!out.length)throw Error('Relatório de matrículas vazio.');return out;
}
function inscritos(v){
  const cab=v[0].map(x=>String(x).trim()),ix=k=>cab.indexOf(k),g=(c,k)=>{const j=ix(k);return j<0?'':String(c[j]??'').trim();};
  const falta=['CODIGO_DA_INSCRICAO','NOME','CODIGO_DO_POLO','MATRICULOU'].filter(k=>ix(k)<0);if(falta.length)throw Error('A planilha de inscritos veio sem as colunas: '+falta.join(', '));
  return v.slice(1).map(c=>({inscription_id:g(c,'CODIGO_DA_INSCRICAO'),name:g(c,'NOME'),cpf:g(c,'CPF'),mobile:g(c,'CELULAR')||g(c,'TELEFONE'),polo_id:g(c,'CODIGO_DO_POLO'),
    course_name:g(c,'NOME_DO_CURSO'),offer:g(c,'ENTRADA_QUE_ALUNO_SELECIONOU')||g(c,'PROCESSO_SELETIVO'),created_at:dataHora(g(c,'DATA_DA_INSCRICAO')),
    reinscrito:g(c,'INSCRITO')?g(c,'INSCRITO').toLowerCase().startsWith('reinscrito'):null,accepts_whats:g(c,'ACEITA_WHATS')?g(c,'ACEITA_WHATS')==='S':null,
    matriculated:g(c,'MATRICULOU')==='S'||!!g(c,'DATA_MATRICULA'),cancelled:!!g(c,'DATA_CANCELAMENTO')}));
}
function leads(v){
  const cab=v[0].map(x=>String(x).trim()),ix=k=>cab.indexOf(k),g=(c,k)=>{const j=ix(k);return j<0?'':String(c[j]??'').trim();};
  const falta=['Nome','Codigo do polo','Celular','Origem atual'].filter(k=>ix(k)<0);if(falta.length)throw Error('A planilha de leads veio sem as colunas: '+falta.join(', '));
  return v.slice(1).map(c=>{const o=g(c,'Origem atual'),so=g(c,'Sub origem atual');return {name:g(c,'Nome'),cpf:g(c,'CPF'),mobile:g(c,'Celular'),polo_id:g(c,'Codigo do polo'),course_name:g(c,'Nome do curso'),
    origin:[o,so&&so!=='-'&&so!=='Carga do Polo'?so:''].filter(Boolean).join(' · '),created_at:dataHora(g(c,'Data de criacao do lead'))};});
}

// ---------- tela ----------
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function quando(iso){if(!iso)return '';const d=new Date(iso),hoje=new Date();const hr=d.toLocaleTimeString('pt-BR',{timeZone:'America/Rio_Branco',hour:'2-digit',minute:'2-digit'});
  const dia=d.toLocaleDateString('pt-BR',{timeZone:'America/Rio_Branco'});return (dia===hoje.toLocaleDateString('pt-BR',{timeZone:'America/Rio_Branco'})?'hoje às ':dia+' às ')+hr;}
function corpo(){
  return '<p class="context">Baixe no Portal Comercial os relatórios de <strong>matrículas</strong>, <strong>inscritos</strong> e <strong>leads</strong> e solte os três aqui de uma vez. O painel reconhece cada um pelo nome do arquivo.</p>'+
   '<div id="env-status" class="env-status">Carregando a última atualização...</div>'+
   '<label class="env-zona" id="env-zona"><input id="env-file" type="file" accept=".csv,text/csv" multiple onchange="envEscolher(this.files)"><strong>Clique para escolher os arquivos</strong><span>ou arraste os arquivos .csv para cá</span></label>'+
   '<div id="env-lista"></div><p id="env-msg" class="env-msg" role="status" aria-live="polite"></p>';
}
async function status(){
  const el=document.getElementById('env-status');if(!el)return;
  try{const {data,error}=await db.rpc('upload_status');if(error)throw error;
    el.innerHTML=ORDEM.map(k=>{const s=data?.[k];return '<div><strong>'+TIPOS[k].split(' (')[0]+'</strong><span>'+(s?'Atualizado '+h(quando(s.at))+' por '+h(s.actor):'Ainda não enviado')+'</span></div>';}).join('');
  }catch(e){el.textContent='Não consegui ver a última atualização.';}
}
function desenharLista(){
  const el=document.getElementById('env-lista');if(!el)return;
  if(!fila.length){el.innerHTML='';return;}
  el.innerHTML='<ul class="env-arquivos">'+fila.map((f,i)=>'<li class="'+(f.ok===true?'env-ok':f.ok===false?'env-erro':'')+'"><span class="env-nome">'+h(f.file.name)+'</span>'+
    '<select aria-label="Tipo do arquivo '+h(f.file.name)+'" onchange="envTipo('+i+',this.value)"'+(enviando?' disabled':'')+'><option value="">Qual planilha é esta?</option>'+ORDEM.map(k=>'<option value="'+k+'"'+(f.tipo===k?' selected':'')+'>'+TIPOS[k]+'</option>').join('')+'</select>'+
    (f.res?'<span class="env-res">'+h(f.res)+'</span>':'')+'<button type="button" class="env-tirar" onclick="envTirar('+i+')" aria-label="Tirar '+h(f.file.name)+'"'+(enviando?' disabled':'')+'>Tirar</button></li>').join('')+'</ul>'+
    '<button id="env-enviar" class="btn" onclick="envEnviar()"'+(enviando?' disabled':'')+'>'+(enviando?'Enviando...':'Enviar '+fila.length+(fila.length===1?' planilha':' planilhas'))+'</button>';
}
function msg(t,tipo){const el=document.getElementById('env-msg');if(el){el.textContent=t||'';el.className='env-msg'+(tipo?' env-msg-'+tipo:'');}}

window.envEscolher=async function(files){
  for(const file of [...files]){
    if(!/\.csv$/i.test(file.name)){msg(file.name+' não é .csv. Baixe o relatório em CSV no portal.','erro');continue;}
    let tipo=tipoPeloNome(file.name);
    if(!tipo){try{const v=lerCsv((await texto(file)).slice(0,5000));tipo=tipoPeloCab(v[0]||[]);}catch{}}
    const j=fila.findIndex(f=>f.tipo&&f.tipo===tipo);if(j>=0)fila.splice(j,1);
    fila.push({file,tipo});
  }
  fila.sort((a,b)=>ORDEM.indexOf(a.tipo)-ORDEM.indexOf(b.tipo));
  const sem=fila.filter(f=>!f.tipo).length;
  msg(sem?'Escolha o tipo de '+(sem===1?'1 arquivo':sem+' arquivos')+' que não reconheci pelo nome.':'');
  desenharLista();const inp=document.getElementById('env-file');if(inp)inp.value='';
};
window.envTipo=function(i,t){if(fila[i])fila[i].tipo=t;};
window.envTirar=function(i){fila.splice(i,1);msg('');desenharLista();};
window.envEnviar=async function(){
  if(enviando||!fila.length)return;
  if(fila.some(f=>!f.tipo)){msg('Escolha o tipo de cada arquivo antes de enviar.','erro');return;}
  const tipos=fila.map(f=>f.tipo);if(new Set(tipos).size!==tipos.length){msg('Tem dois arquivos do mesmo tipo. Tire um deles.','erro');return;}
  const camp=document.getElementById('f-campaign')?.value||APP_CONFIG.campaign;
  enviando=true;fila.forEach(f=>{f.ok=undefined;f.res='';});desenharLista();msg('Enviando...');
  let erros=0;
  for(const f of fila){
    try{
      const v=lerCsv(await texto(f.file));if(v.length<2)throw Error('Planilha vazia.');
      if(f.tipo==='matriculas'){
        const rows=matriculas(v),batch=crypto.randomUUID();
        const {data:prev,error:e1}=await db.rpc('admin_apply_report',{p_campaign:camp,p_rows:rows,p_batch:batch,p_expected:null,p_apply:false});if(e1)throw e1;
        if(prev?.large_drop)throw Error('O relatório deixaria '+prev.missing+' alunos de fora (mais de 20% da base). Nada foi aplicado. Baixe o relatório completo de novo.');
        const {data:res,error:e2}=await db.rpc('admin_apply_report',{p_campaign:camp,p_rows:rows,p_batch:batch,p_expected:prev?.previous??null,p_apply:true});if(e2)throw e2;
        f.res=res.rows+' matrículas, '+res.new+' novas, '+res.became_paid+' passaram a pagas';
      }else{
        const rows=f.tipo==='inscritos'?inscritos(v):leads(v);
        const {data:res,error}=await db.rpc('crm_import',{p_campaign:camp,p_kind:f.tipo==='inscritos'?'inscrito':'lead',p_rows:rows});if(error)throw error;
        f.res=res.gravados+(f.tipo==='inscritos'?' inscritos':' leads')+(res.sairam?', '+res.sairam+' saíram da planilha':'');
      }
      f.ok=true;
    }catch(e){f.ok=false;f.res='Erro: '+(e.message||e);erros++;}
    desenharLista();
  }
  enviando=false;desenharLista();
  msg(erros?'Algumas planilhas não entraram. Veja o motivo ao lado de cada uma.':'Pronto! O painel e o CRM já estão atualizados.',erros?'erro':'ok');
  if(!erros){aviso('Planilhas enviadas','Painel e CRM atualizados.',{tipo:'ok'});setTimeout(()=>{fila=[];desenharLista();},8000);}
  status();try{await fetchData();}catch{}
};

// arrastar e soltar
document.addEventListener('dragover',e=>{const z=e.target.closest?.('#env-zona');if(z){e.preventDefault();z.classList.add('env-sobre');}});
document.addEventListener('dragleave',e=>{const z=e.target.closest?.('#env-zona');if(z)z.classList.remove('env-sobre');});
document.addEventListener('drop',e=>{const z=e.target.closest?.('#env-zona');if(z){e.preventDefault();z.classList.remove('env-sobre');envEscolher(e.dataTransfer.files);}});

// coloca a seção no topo da Administração
const original=window.drawAdmin;
if(typeof original==='function'){
  window.drawAdmin=function(){
    original.apply(this,arguments);
    const root=document.getElementById('admin-body');if(!root||document.getElementById('env-zona'))return;
    const d=document.createElement('details');d.className='admin-section env-secao';d.open=true;d.dataset.adminSection='envio';
    d.innerHTML='<summary>Enviar planilhas do portal<span class="section-toggle" aria-hidden="true"></span></summary><div class="admin-section-body">'+corpo()+'</div>';
    root.prepend(d);desenharLista();status();
  };
}
})();
