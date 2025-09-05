/* Firestore wrapper simples com fallback para localStorage */
(function(){
  const cfg = window.FIREBASE_CONFIG || null;
  const hasFirebase = typeof firebase !== 'undefined' && cfg;

  // API pública exposta em window.DB
  const DB = {
    enabled: false,
    // Produtos
    getProducts: async ()=>[], setProduct: async ()=>{}, deleteProduct: async ()=>{},
    // Comandas
    upsertTab: async ()=>{}, deleteTab: async ()=>{}, getOpenTabs: async ()=>[],
    // Histórico (fechamentos)
    saveHistory: async ()=>{}, getHistory: async ()=>[],
  };

  if(!hasFirebase){
    console.warn('[DB] Firebase não configurado — usando localStorage.');
    window.DB = DB; return;
  }

  try{
    firebase.initializeApp(cfg);
    const db = firebase.firestore();
    try{ db.enablePersistence({synchronizeTabs:true}); }catch(e){ /* ok se falhar */ }

    const TENANT = cfg.TENANT_ID || 'default';
    const col = (name)=> db.collection('bars').doc(TENANT).collection(name);

    DB.enabled = true;

    /* ===== Produtos ===== */
    DB.getProducts = async ()=>{
      const snap = await col('products').get();
      return snap.docs.map(d=>({id:d.id, ...d.data()}));
    };
    DB.setProduct = async (p)=> col('products').doc(p.id).set(p, {merge:true});
    DB.deleteProduct = async (id)=> col('products').doc(id).delete();

    /* ===== Comandas (tabs) ===== */
    DB.upsertTab = async (tab)=>{
      const payload = {...tab};
      return col('tabs').doc(tab.id).set(payload, {merge:true});
    };
    DB.deleteTab = async (id)=> col('tabs').doc(id).delete();
    DB.getOpenTabs = async ()=>{
      const qs = await col('tabs').where('status','==','open').orderBy('createdAt','desc').get();
      return qs.docs.map(d=>d.data());
    };

    /* ===== Histórico ===== */
    DB.saveHistory = async (rec)=>{
      const key = String(rec.number).padStart(6,'0');
      return col('history').doc(key).set(rec, {merge:true});
    };
    DB.getHistory = async ()=>{
      const qs = await col('history').orderBy('closedAt','desc').limit(1000).get();
      return qs.docs.map(d=>d.data());
    };

  }catch(err){
    console.error('[DB] Erro ao iniciar Firebase:', err);
  }

  window.DB = DB;
})();