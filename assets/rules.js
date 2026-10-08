/* Regras compartilhadas e testáveis. Datas civis no fuso da campanha. */
(function(root){
 const clean=v=>String(v??'').trim();
 const statuses=['Não contatado','Contatado','Aguardando retorno','Retornar depois','Contato inexistente','Solicitou cancelamento','Cancelado'];
 const empty=()=>({welcome:'Pendente',outcome:'Não informado',promised:'',event:'record_update',status:statuses[0],notes:'',lastContact:'',nextContact:'',author:'',updatedAt:'',version:0});
 const cancelled=r=>!['','nan','none','nat','null'].includes(clean(r.DATA_CANCELAMENTO).toLowerCase());
 const paid=r=>clean(r.PRIMEIRA_MENSALIDADE_COBRADA_PAGA)==='S';
 function dateOnly(v){const s=clean(v);if(!s)return null;let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/),d=m?m[1]+'-'+m[2]+'-'+m[3]:null;if(!d){m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)d=m[3]+'-'+m[2]+'-'+m[1];}return d&&dateValid(d)?d:null;}
 function dateValid(s){return !s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
 function today(zone,now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
 function plus(d,n){return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
 function range(period,t,from='',to=''){
  if(period==='all')return {from:null,to:null};if(period==='today')return {from:t,to:t};
  if(period==='week'){const dow=new Date(t+'T12:00:00Z').getUTCDay()||7;return{from:plus(t,1-dow),to:plus(t,7-dow)};}
  if(period==='month')return{from:t.slice(0,7)+'-01',to:plus(t.slice(0,7)+'-01',32).slice(0,7)+'-01',exclusiveTo:true};
  if(period==='year')return{from:t.slice(0,4)+'-01-01',to:t.slice(0,4)+'-12-31'};
  if(!dateValid(from)||!dateValid(to)||from&&to&&from>to)throw Error('Confira o intervalo: a data inicial deve ser anterior ou igual à final.');
  return {from:from||null,to:to||null};
 }
 function inRange(value,range){if(!range.from&&!range.to)return true;const d=dateOnly(value);return !!d&&(!range.from||d>=range.from)&&(!range.to||(range.exclusiveTo?d<range.to:d<=range.to));}
 function metric(r,type,range,mode='events'){
  if(r._missing)return type==='missing';if(type==='missing')return false;
  const entered=inRange(r.DATA_MATRICULA,range);
  if(type==='paga')return paid(r)&&(mode==='cohort'?entered:inRange(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA,range));
  if(type==='cancel')return cancelled(r)&&(mode==='cohort'?entered:inRange(r.DATA_CANCELAMENTO,range));
  if(!entered)return false;
  if(type==='ativos')return !cancelled(r);if(type==='naoPaga')return !cancelled(r)&&!paid(r);return true;
 }
 function draft(d,t){
  if(!statuses.includes(d.status)||typeof d.notes!=='string'||d.notes.length>6000)throw Error('Confira status e observações (máximo de 6.000 caracteres).');
  if(!dateValid(d.lastContact)||!dateValid(d.nextContact)||d.lastContact>t)throw Error('Confira as datas; último contato não pode ser futuro.');
  if(!['Não contatado','Contato inexistente','Solicitou cancelamento','Cancelado'].includes(d.status)&&!d.lastContact)throw Error('Informe a data do último contato.');
  if(d.welcome==='Tentativa sem resposta'&&!['Contato inexistente','Solicitou cancelamento','Cancelado'].includes(d.status)&&(!d.nextContact||d.nextContact<t))throw Error('Agende o próximo contato para hoje ou uma data futura após a tentativa sem resposta.');
  if(d.status==='Retornar depois'&&!d.nextContact)throw Error('Informe a data de retorno.');
  if(d.nextContact&&d.lastContact&&d.nextContact<d.lastContact)throw Error('Retorno anterior ao contato.');return d;
 }
 const due=(s,t)=>s.nextContact?(s.nextContact<t?'late':s.nextContact===t?'today':'future'):'none';
 const idle=(s,t,n)=>!s.lastContact||(Date.parse(t)-Date.parse(s.lastContact))/86400000>=n;
 function priority(a,b,t){const rank=s=>({late:0,today:1,future:3,none:s.status==='Não contatado'?2:4})[due(s,t)];return rank(a)-rank(b)||(a.nextContact||'9999').localeCompare(b.nextContact||'9999')||(a.lastContact||'').localeCompare(b.lastContact||'');}
 function goalEligible(r,c){const enrolled=dateOnly(r.DATA_MATRICULA),payment=dateOnly(r.DATA_PRIMEIRA_MENSALIDADE_COBRADA_PAGA);return !r._missing&&paid(r)&&!!enrolled&&!!payment&&enrolled>=c.starts_on&&(!c.ends_on||enrolled<=c.ends_on)&&payment>=c.starts_on&&(!(c.payment_ends_on||c.ends_on)||payment<=(c.payment_ends_on||c.ends_on))&&(c.include_cancelled_paid_in_goal!==false||!cancelled(r));}
 function academicNote(r){return clean(r._engagement)==='Nota disciplina (data)';}
 function expectedDue(r){const d=dateOnly(r.DATA_MATRICULA);if(!d)return null;const y=Number(d.slice(0,4)),m=Number(d.slice(5,7));return m===6?y+'-08-10':(y+(m===12?1:0))+'-'+String(m%12+1).padStart(2,'0')+'-10';}
 function dueState(r,t){if(r._missing||cancelled(r)||paid(r))return 'na';const d=expectedDue(r);return !d?'unknown':d<t?'overdue':d===t?'today':'future';}
 const core={academicNote,expectedDue,dueState,goalEligible,clean,statuses,empty,cancelled,paid,dateOnly,dateValid,today,plus,range,inRange,metric,draft,due,idle,priority};
 root.Core=core;if(typeof module!=='undefined')module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
