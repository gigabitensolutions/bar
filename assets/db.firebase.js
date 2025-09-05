/* Firestore wrapper 100% (sem localStorage) + Health Check + Settings + contador seq. */
(function(){
  const cfg = window.FIREBASE_CONFIG || null;
  const hasFirebase = typeof firebase !== 'undefined' && cfg;

  const DB = {
    enabled: false,
    // Produtos
    getProducts: async ()=>[], setProduct: async ()=>{}, deleteProduct: async ()=>{},
    // Comandas
    upsertTab: async ()=>{}, deleteTab: async ()=>{}, getOpenTabs: async ()=>[],
    // Histórico
    saveHistory: async ()=>{}, getHistory: async ()=>[],
    // Settings (service10, bigTouch)
    getSettings: async ()=> ({}), setSettings: async ()=>{},
    // Sequência de histórico
    nextHistorySeq: async ()=> 1,
    // Health
    healthCheck: async ()=>({})
  };

  if(!hasFirebase){
    console.warn('[DB] Firebase não configurado.');
    window.DB = DB; return;
  }

  try{
    firebase.initializeApp(cfg);
    const db = firebase.firestore();
    try{ db.enablePersistence({synchronizeTabs:true}); }catch(e){ /* se falhar, segue online-only */ }

    const TENANT = cfg.TENANT_ID || 'default';
    const col = (name)=> db.collection('bars').doc(TENANT).collection(name);
    const settingsDoc = ()=> db.collection('bars').doc(TENANT).collection('settings').doc('app');
    const countersDoc = ()=> db.collection('bars').doc(TENANT).collection('counters').doc('history');

    DB.enabled = true;

    /* ===== Produtos ===== */
    DB.getProducts = async ()=>{
      const snap = await col('products').orderBy('id').get();
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
      const qs = await col('history').orderBy('closedAt','desc').limit(2000).get();
      return qs.docs.map(d=>d.data());
    };

    /* ===== Settings ===== */
    DB.getSettings = async ()=>{
      const snap = await settingsDoc().get();
      return snap.exists ? snap.data() : {};
    };
    DB.setSettings = async (data)=>{
      return settingsDoc().set(data, {merge:true});
    };

    /* ===== Sequência (transação) ===== */
    DB.nextHistorySeq = async ()=>{
      const ref = countersDoc();
      const next = await db.runTransaction(async tx=>{
        const snap = await tx.get(ref);
        const cur = snap.exists ? (snap.data().value || 0) : 0;
        const n = cur + 1;
        tx.set(ref, { value: n }, { merge:true });
        return n;
      });
      return next;
    };

    /* ===== Health Check ===== */
    DB.healthCheck = async ()=>{
      const out = {
        sdkLoaded: typeof firebase !== 'undefined',
        configPresent: !!cfg && !!cfg.projectId,
        projectId: cfg?.projectId || null,
        tenant: (cfg?.TENANT_ID || 'default'),
        enabled: true,
        online: navigator.onLine,
        canWrite: false,
        canReadServer: false,
        rulesOk: false,
        lastError: null
      };
      try {
        const pingRef = col('diagnostics').doc('ping');
        await pingRef.set({ ts: Date.now(), ua: navigator.userAgent, page: location.href }, { merge:true });
        out.canWrite = true;
        const snap = await pingRef.get({ source: 'server' });
        out.canReadServer = snap.exists === true;
        out.rulesOk = out.canWrite && out.canReadServer;
      } catch (err) {
        out.lastError = { code: err?.code || null, message: err?.message || String(err) };
      }
      return out;
    };

  }catch(err){
    console.error('[DB] Erro ao iniciar Firebase:', err);
  }

  window.DB = DB;
})();