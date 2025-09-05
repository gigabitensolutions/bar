// assets/home.js — lista simples de produtos e badge de saúde
(function(){
  const $ = s => document.querySelector(s);
  const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

  function setBadge(text, ok=null){
    const el = $('#dbStatus'); if(!el) return;
    el.textContent = text;
    if(ok===true){ el.style.borderColor='#22c55e'; el.style.color='#22c55e'; }
    else if(ok===false){ el.style.borderColor='#ef4444'; el.style.color='#ef4444'; }
    else{ el.style.borderColor='#64748b'; el.style.color='#64748b'; }
  }

  async function health(){
    if(!window.DB?.enabled){ setBadge('DB: OFF', false); return; }
    try{
      const r = await window.DB.healthCheck();
      setBadge(r?.ok && r?.canReadServer ? 'DB: OK' : 'DB: ERRO', !!(r?.ok && r?.canReadServer));
    }catch{ setBadge('DB: ERRO', false); }
  }

  async function loadProducts(){
    const grid = $('#grid'); grid.innerHTML='';
    try{
      const prods = await window.DB.getProducts();
      if(!prods || !prods.length){
        grid.innerHTML = '<div class="muted">Nenhum produto cadastrado. Abra o Admin para adicionar.</div>';
        return;
      }
      prods.forEach(p=>{
        const div = document.createElement('div');
        div.className = 'card product';
        const img = p.image && p.image.trim() ? p.image : './assets/placeholder.svg';
        div.innerHTML = \`
          <img src="\${img}" alt="">
          <div style="flex:1">
            <div class="name">\${p.name}</div>
            <div class="muted">\${p.category || ''}</div>
          </div>
          <div class="price">\${BRL.format(Number(p.price||0))}</div>
        \`;
        grid.appendChild(div);
      });
    }catch(e){
      grid.innerHTML = '<div class="muted">Erro ao carregar produtos. Verifique a API.</div>';
      console.error(e);
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await health();
    await loadProducts();
    const r = document.getElementById('refreshBtn');
    if(r) r.onclick = ()=>{ health(); loadProducts(); };
  });
})();
