// Caixas de confirmação e avisos do próprio painel (no lugar das caixas do navegador).
(function(){
'use strict';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// caixa('Pergunta?', {titulo, ok, cancelar, perigo}) -> Promise<boolean>
window.caixa=function(texto,o={}){
  return new Promise(res=>{
    const d=document.createElement('dialog');d.className='av-caixa'+(o.perigo?' av-perigo':'');
    d.setAttribute('aria-labelledby','av-t');
    d.innerHTML='<h2 id="av-t">'+e(o.titulo||'Confirmar')+'</h2><p>'+e(texto)+'</p><div class="av-botoes">'+
      (o.cancelar===false?'':'<button type="button" class="btn btn-gh" value="0">'+e(o.cancelar||'Cancelar')+'</button>')+
      '<button type="button" class="btn av-ok" value="1">'+e(o.ok||'Confirmar')+'</button></div>';
    const pai=[...document.querySelectorAll('dialog[open]')].pop()||document.body;
    pai.appendChild(d);
    let fim=false;const fecha=v=>{if(fim)return;fim=true;d.close();d.remove();res(v);};
    d.addEventListener('click',ev=>{const b=ev.target.closest('button');if(b)fecha(b.value==='1');else if(ev.target===d)fecha(false);});
    d.addEventListener('cancel',ev=>{ev.preventDefault();fecha(false);});
    d.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();fecha(false);}});
    d.showModal();d.querySelector(o.perigo?'.btn-gh':'.av-ok')?.focus();
  });
};

// aviso('Título','texto',{tipo:'ok'|'novo'|'erro', acao:{label,fn}, tempo:ms})
window.aviso=function(titulo,texto,o={}){
  let pilha=document.getElementById('av-pilha');
  const pai=[...document.querySelectorAll('dialog[open]')].pop()||document.body;
  if(!pilha||pilha.parentNode!==pai){pilha?.remove();pilha=document.createElement('div');pilha.id='av-pilha';pilha.setAttribute('role','status');pilha.setAttribute('aria-live','polite');pai.appendChild(pilha);}
  while(pilha.children.length>=4)pilha.firstChild.remove();
  const t=document.createElement('div');t.className='av-aviso av-'+(o.tipo||'ok');
  t.innerHTML='<div class="av-txt"><strong>'+e(titulo)+'</strong>'+(texto?'<span>'+e(texto)+'</span>':'')+'</div>'+
    (o.acao?'<button type="button" class="btn btn-sm av-acao">'+e(o.acao.label)+'</button>':'')+
    '<button type="button" class="av-x" aria-label="Fechar aviso">×</button>';
  const sai=()=>{t.classList.add('av-sai');setTimeout(()=>t.remove(),200);};
  t.querySelector('.av-x').onclick=sai;
  if(o.acao)t.querySelector('.av-acao').onclick=()=>{sai();o.acao.fn();};
  pilha.appendChild(t);
  let timer=setTimeout(sai,o.tempo||8000);
  t.addEventListener('mouseenter',()=>clearTimeout(timer));
  t.addEventListener('mouseleave',()=>{timer=setTimeout(sai,4000);});
};
window.alert=function(m){window.aviso('Aviso',String(m??''),{tipo:'erro'});};
})();
