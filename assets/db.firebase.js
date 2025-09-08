(function(){
  // Config de ambiente (ajuste em assets/firebase-config.js)
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

  // ===== API moderna (nomes atuais) =====
  const modern = {
    // Health
    health:        () => api('/health'),

    // Produtos (admin)
    listProducts:  () => api('/products'),
    upsertProduct: (p) => api('/products', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p)
    }),
    deleteProduct: (id)=> api(`/products/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Comandas abertas (tabs) — sessão cross-browser
    tabsOpen:      () => api('/tabs/open'),
    upsertTab:     (t) => api('/tabs/upsert', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(t)
    }),
    deleteTab:     (id)=> api(`/tabs/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Fechamento (grava histórico no Firestore)
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

  // ===== Aliases legados (para código antigo) =====
  const legacy = {
    // healthCheck() -> health()
    healthCheck:   modern.health,

    // getProducts()/setProduct()/deleteProduct() -> list/upsert/delete
    getProducts:   modern.listProducts,
    setProduct:    modern.upsertProduct,
    deleteProduct: modern.deleteProduct,

    // Também mantenho estes (caso apareçam em outras telas):
    saveProduct:   modern.upsertProduct,  // alias adicional
    removeProduct: modern.deleteProduct,  // alias adicional

    // getOpenTabs()/setTab()/removeTab()/closeTab()
    getOpenTabs:   modern.tabsOpen,
    setTab:        modern.upsertTab,
    removeTab:     modern.deleteTab,
    closeTab:      modern.closeComanda,

    // getHistory()
    getHistory:    modern.history,

    // getSettings()/patchSettings()/nextSequence()
    getSettings:   modern.settingsGet,
    patchSettings: modern.settingsPatch,
    nextSequence:  modern.seqNext
  };

  // Exporta em window.API (moderno) e window.DB (legado)
  const apiObj = Object.assign({}, modern, legacy);

  // Flag simples para que seu admin mostre "DB: OFF" enquanto não há BASE
  apiObj.enabled = !!BASE;

  window.API = apiObj;
  window.DB  = apiObj; // <= compatibilidade com seu admin.js
})();