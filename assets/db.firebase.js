(function(){
  // Ajuste sua URL/tenant em assets/firebase-config.js
  const cfg    = window.FIREBASE_CONFIG || {};
  const BASE   = cfg.BACKEND_URL;
  const TENANT = encodeURIComponent(cfg.TENANT_ID || 'default');

  function makeUrl(path){
    return `${BASE}${path}${path.includes('?')?'&':'?'}tenant=${TENANT}`;
  }

  async function api(path, opts){
    if(!BASE) throw new Error('BACKEND_URL não configurado (veja assets/firebase-config.js)');
    const res = await fetch(makeUrl(path), opts);
    if(!res.ok){
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error(`${res.status} ${res.statusText} — ${txt}`);
    }
    return await res.json();
  }

  // ===== API moderna (usada pelo POS) =====
  const modern = {
    health:        () => api('/health'),

    // Produtos
    listProducts:  () => api('/products'),
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

    // Fechamento (grava em histórico)
    closeComanda:  (c)=> api('/close-comanda', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c)
    }),

    // Histórico
    history:       () => api('/history'),

    // (opcionais) settings e seq
    settingsGet:   () => api('/settings'),
    settingsPatch: (s) => api('/settings', {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(s)
    }),
    seqNext:       () => api('/seq/next', { method:'POST' })
  };

  // ===== Aliases/Adaptadores legados para o ADMIN (window.DB.*) =====
  const legacy = {
    // healthCheck() -> health()
    healthCheck: modern.health,

    // getProducts deve retornar **array**
    getProducts: async () => {
      const r = await modern.listProducts();
      return Array.isArray(r.products) ? r.products : [];
    },

    // setProduct/deleteProduct: mesmos nomes que seu admin.js usa
    setProduct:    modern.upsertProduct,
    deleteProduct: modern.deleteProduct,

    // Extra: se algum código antigo usar esses nomes, ficam compatíveis
    saveProduct:   modern.upsertProduct,
    removeProduct: modern.deleteProduct,

    // POS (não usados no admin, mas deixo expostos)
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

  // Flag para seu admin mostrar "DB: OFF" quando não houver BASE
  apiObj.enabled = !!BASE;

  window.API = apiObj; // moderno
  window.DB  = apiObj; // legado (compatível com admin.js fornecido)
})();
