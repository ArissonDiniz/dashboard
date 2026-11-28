// Calendário na identidade da UNIASSELVI para todos os campos de data do painel.
// O campo continua sendo <input type="date"> (valor aaaa-mm-dd, dá para digitar);
// só o calendário que abre é trocado pelo nosso.
(function(){
'use strict';
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const SEM=['D','S','T','Q','Q','S','S'];
let pop=null,alvo=null,mes=null;
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const hoje=()=>iso(new Date());
function fechar(){if(pop){pop.remove();pop=null;}if(alvo)alvo.setAttribute('aria-expanded','false');alvo=null;}
function abrir(inp){
  fechar();alvo=inp;inp.setAttribute('aria-expanded','true');
  const v=inp.value||hoje();mes=new Date(+v.slice(0,4),+v.slice(5,7)-1,1);
  pop=document.createElement('div');pop.className='cal-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Escolher data');
  (inp.closest('dialog')||document.body).appendChild(pop);desenhar();posicionar();
  pop.querySelector('[aria-selected=true],.cal-hoje,.cal-dia:not([disabled])')?.focus();
}
function posicionar(){
  const r=alvo.getBoundingClientRect(),h=pop.offsetHeight,w=pop.offsetWidth;
  let top=r.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);
  pop.style.top=top+'px';pop.style.left=Math.min(Math.max(8,r.left),innerWidth-w-8)+'px';
}
function desenhar(){
  const min=alvo.min||'',max=alvo.max||'',sel=alvo.value,y=mes.getFullYear(),m=mes.getMonth();
  const ini=new Date(y,m,1).getDay(),fim=new Date(y,m+1,0).getDate();
  let dias='';for(let i=0;i<ini;i++)dias+='<span></span>';
  for(let d=1;d<=fim;d++){const k=iso(new Date(y,m,d)),off=(min&&k<min)||(max&&k>max);
    dias+='<button type="button" class="cal-dia'+(k===hoje()?' cal-hoje':'')+'" data-d="'+k+'" aria-selected="'+(k===sel)+'"'+(off?' disabled':'')+' aria-label="'+d+' de '+MESES[m]+'">'+d+'</button>';}
  pop.innerHTML='<div class="cal-topo"><button type="button" class="cal-nav" data-n="-1" aria-label="Mês anterior">‹</button><strong>'+MESES[m].charAt(0).toUpperCase()+MESES[m].slice(1)+' de '+y+'</strong><button type="button" class="cal-nav" data-n="1" aria-label="Próximo mês">›</button></div>'+
    '<div class="cal-sem">'+SEM.map(s=>'<span>'+s+'</span>').join('')+'</div><div class="cal-grade">'+dias+'</div>'+
    '<div class="cal-rodape"><button type="button" class="cal-acao" data-a="hoje">Hoje</button><button type="button" class="cal-acao" data-a="amanha">Amanhã</button><button type="button" class="cal-acao" data-a="limpar">Limpar</button></div>';
}
function escolher(v){
  const inp=alvo;if(!inp)return;
  if(v&&((inp.min&&v<inp.min)||(inp.max&&v>inp.max)))return;
  inp.value=v;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));fechar();inp.focus();
}
// abre o nosso no lugar do calendário do navegador
document.addEventListener('click',e=>{
  const inp=e.target.closest?.('input[type=date]');
  if(inp&&!inp.disabled&&!inp.readOnly){e.preventDefault();abrir(inp);return;}
  if(pop&&pop.contains(e.target)){
    const n=e.target.closest('[data-n]');if(n){mes.setMonth(mes.getMonth()+ +n.dataset.n);desenhar();return;}
    const d=e.target.closest('[data-d]');if(d){escolher(d.dataset.d);return;}
    const a=e.target.closest('[data-a]');if(a){const t=new Date();if(a.dataset.a==='amanha')t.setDate(t.getDate()+1);escolher(a.dataset.a==='limpar'?'':iso(t));}
    return;
  }
  if(pop)fechar();
},true);
document.addEventListener('keydown',e=>{
  const inp=e.target.closest?.('input[type=date]');
  if(inp&&(e.key===' '||(e.altKey&&e.key==='ArrowDown'))){e.preventDefault();abrir(inp);return;}
  if(!pop)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const i=alvo;fechar();i?.focus();return;}
  const b=document.activeElement?.closest?.('.cal-dia');
  const passo={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
  if(b&&passo){e.preventDefault();const d=new Date(b.dataset.d+'T12:00');d.setDate(d.getDate()+passo);
    if(d.getMonth()!==mes.getMonth()){mes=new Date(d.getFullYear(),d.getMonth(),1);desenhar();}
    pop.querySelector('[data-d="'+iso(d)+'"]')?.focus();}
},true);
addEventListener('resize',()=>{if(pop)posicionar();});
// clicar num dia não pode tirar o foco (evita a ficha rolar e o calendário pular)
document.addEventListener('mousedown',e=>{if(pop&&pop.contains(e.target))e.preventDefault();},true);
document.addEventListener('scroll',e=>{if(pop&&alvo&&!pop.contains(e.target))posicionar();},true);
})();
