(function(){
  // Ajuste sua URL/tenant em assets/firebase-config.js
  const cfg    = window.FIREBASE_CONFIG || {};
  const BASE   = cfg.BACKEND_URL;
  const TENANT = encodeURIComponent(cfg.TENANT_ID || 'default');

  function makeUrl(path){
    return `${BASE}${path}${path.includes('?')?'&':'?'}tenant=${TENANT}`;
  }

  async function safeJson(res){
    // Aceita 200 com corpo vazio e 204 No Content
    const text = await res.text().catch(()=> '');
    if(!text) return {}; // corpo vazio => ok
    try{ return JSON.parse(text); }catch(_){ return {}; }
  }

  async function api(path, opts){
    if(!BASE) throw new Error('BACKEND_URL não configurado (veja assets/firebase-config.js)');
    const res = await fetch(makeUrl(path), opts);
    if(!res.ok){
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error(`${res.status} ${res.statusText} — ${txt}`);
    }
    return await safeJson(res);
  }

  // ===== API moderna (POS) =====
  const modern = {
    health:        () => api('/health'),

    // Produtos
    listProducts:  async () => {
      const r = await api('/products');
      // Normaliza para SEMPRE { products: [...] } — seu backend pode retornar array puro
      if (Array.isArray(r)) return { products: r };
      if (r && Array.isArray(r.products)) return { products: r.products };
      return { products: [] };
    },
    upsertProduct: (p) => api('/products', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p)
    }),
    deleteProduct: (id)=> api(`/products/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Comandas abertas (sessão cross-browser)
    tabsOpen:      () => api('/tabs/open'),
    upsertTab:     (t) => api('/tabs/upsert', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(t)
    }),
    deleteTab:     (id)=> api(`/tabs/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Fechamento (grava histórico)
    closeComanda:  (c)=> api('/close-comanda', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c)
    }),

    // Histórico
    history:       () => api('/history'),

    // (opcionais)
    settingsGet:   () => api('/settings'),
    settingsPatch: (s) => api('/settings', {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(s)
    }),
    seqNext:       () => api('/seq/next', { method:'POST' })
  };

  // ===== Adaptadores legados (compatíveis com seu admin.js) =====
  const legacy = {
    healthCheck: modern.health,

    // getProducts deve retornar **array**
    getProducts: async () => {
      const r = await modern.listProducts();
      return r.products || [];
    },

    // Nomes esperados no admin.js
    setProduct:    modern.upsertProduct,
    deleteProduct: modern.deleteProduct,

    // Aliases extras (se alguma tela usar)
    saveProduct:   modern.upsertProduct,
    removeProduct: modern.deleteProduct,

    // POS (não usados no admin, mas expostos)
    getOpenTabs:   modern.tabsOpen,
    setTab:        modern.upsertTab,
    removeTab:     modern.deleteTab,
    closeTab:      modern.closeComanda,

    getHistory:    modern.history,
    getSettings:   modern.settingsGet,
    patchSettings: modern.settingsPatch,
    nextSequence:  modern.seqNext
  };

  // Exporta moderno e legado na mesma instância
  const apiObj = Object.assign({}, modern, legacy);

  // Flag para o admin mostrar "DB: OFF" quando não houver BASE
  apiObj.enabled = !!BASE;

  window.API = apiObj; // moderno
  window.DB  = apiObj; // legado (compatível com admin.js)
})();