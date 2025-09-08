(function(){
  const cfg = window.FIREBASE_CONFIG || {};
  const BASE = cfg.BACKEND_URL;
  const TENANT = encodeURIComponent(cfg.TENANT_ID || 'default');

  async function api(path, opts){
    if(!BASE) throw new Error('BACKEND_URL não configurado');
    const url = `${BASE}${path}${path.includes('?')?'&':'?'}tenant=${TENANT}`;
    const res = await fetch(url, opts);
    if(!res.ok){
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error(`${res.status} ${res.statusText} — ${txt}`);
    }
    return await res.json();
  }

  // Produtos (admin)
  // Tabs (sessão em aberto) e Histórico (comandas fechadas)
  window.API = {
    health:        () => api('/health'),

    listProducts:  () => api('/products'),
    upsertProduct: (p) => api('/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p)}),
    deleteProduct: (id)=> api(`/products/${encodeURIComponent(id)}`, { method:'DELETE' }),

    tabsOpen:      () => api('/tabs/open'),
    upsertTab:     (t) => api('/tabs/upsert', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(t)}),
    deleteTab:     (id)=> api(`/tabs/${encodeURIComponent(id)}`, { method:'DELETE' }),

    closeComanda:  (c)=> api('/close-comanda', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c)}),
    history:       () => api('/history'),
  };
})();