// assets/db.firebase.js
(function(){
  const cfg = window.FIREBASE_CONFIG || {};
  const API = (cfg.BACKEND_URL || "").replace(/\/+$/,'');
  const TENANT = cfg.TENANT_ID || "default";

  async function call(path, { method="GET", body } = {}){
    if(!API) throw new Error("BACKEND_URL não configurada.");
    const url = `${API}${path}${path.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(TENANT)}`;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "omit",
      cache: "no-cache"
    });
    const text = await res.text();
    if(!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
    return text ? JSON.parse(text) : null;
  }

  const DB = {
    enabled: !!API,
    // Produtos
    getProducts: async ()=> (await call("/products")).products,
    setProduct: async (p)=> { await call("/products", { method:"POST", body:p }); },
    deleteProduct: async (id)=> { await call(`/products/${encodeURIComponent(id)}`, { method:"DELETE" }); },
    // Comandas
    upsertTab: async (tab)=> { await call("/tabs/upsert", { method:"POST", body:tab }); },
    deleteTab: async (id)=> { await call(`/tabs/${encodeURIComponent(id)}`, { method:"DELETE" }); },
    getOpenTabs: async ()=> (await call("/tabs/open")).tabs,
    // Histórico
    saveHistory: async (rec)=> { await call("/history/save", { method:"POST", body:rec }); },
    getHistory: async ()=> (await call("/history")).history,
    // Settings
    getSettings: async ()=> (await call("/settings")).settings || {},
    setSettings: async (s)=> { await call("/settings", { method:"PATCH", body:s }); },
    // Sequência
    nextHistorySeq: async ()=> (await call("/seq/next", { method:"POST" })).value,
    // Fechamento atômico
    closeComanda: async (tab)=> (await call("/close-comanda", { method:"POST", body:tab })).record,
    // Health
    healthCheck: async ()=> await call("/health")
  };

  window.DB = DB;
})();
