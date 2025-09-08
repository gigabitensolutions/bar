(function(){
  // Config do Functions (ajuste em assets/firebase-config.js)
  const cfg   = window.FIREBASE_CONFIG || {};
  const BASE  = cfg.BACKEND_URL;
  const TENANT= encodeURIComponent(cfg.TENANT_ID || 'default');

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
  const apiModern = {
    // Health
    health:        () => api('/health'),

    // Produtos (admin)
    listProducts:  () => api('/products'),
    upsertProduct: (p) => api('/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p)}),
    deleteProduct: (id)=> api(`/products/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Comandas abertas (tabs) — sessão cross-browser
    tabsOpen:      () => api('/tabs/open'),
    upsertTab:     (t) => api('/tabs/upsert', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(t)}),
    deleteTab:     (id)=> api(`/tabs/${encodeURIComponent(id)}`, { method:'DELETE' }),

    // Fechamento (grava histórico no Firestore)
    closeComanda:  (c)=> api('/close-comanda', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c)}),

    // Histórico
    history:       () => api('/history'),

    // (opcionais) settings e seq
    settingsGet:   () => api('/settings'),
    settingsPatch: (s) => api('/settings', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(s) }),
    seqNext:       () => api('/seq/next', { method:'POST' })
  };

  // ===== Aliases legados (mantêm compatibilidade com código antigo) =====
  const apiLegacy = {
    // healthCheck() -> health()
    healthCheck:   apiModern.health,

    // getProducts()/saveProduct()/removeProduct() -> list/upsert/delete
    getProducts:   apiModern.listProducts,
    saveProduct:   apiModern.upsertProduct,
    removeProduct: apiModern.deleteProduct,

    // getOpenTabs()/setTab()/removeTab()/closeTab() -> tabs/closeComanda
    getOpenTabs:   apiModern.tabsOpen,
    setTab:        apiModern.upsertTab,
    removeTab:     apiModern.deleteTab,
    closeTab:      apiModern.closeComanda,

    // getHistory() -> history()
    getHistory:    apiModern.history,

    // getSettings()/patchSettings()/nextSequence() -> settings/seq
    getSettings:   apiModern.settingsGet,
    patchSettings: apiModern.settingsPatch,
    nextSequence:  apiModern.seqNext
  };

  // Exporta juntando atual + legado
  window.API = Object.assign({}, apiModern, apiLegacy);
})();
