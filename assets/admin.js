// assets/admin.js
// Admin de Produtos — integrado à API do Firebase Functions (via window.DB)

(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  let data = []; // lista de produtos

  /* ---------- UI: Badge de status DB ---------- */
  function setDBStatus(el, info){
    if(!el) return;
    let text = 'DB: —', ok = null;

    if(!window.DB?.enabled){
      text = 'DB: OFF';
      ok = false;
    } else if(info && info.ok && info.canReadServer){
      text = 'DB: OK';
      ok = true;
    } else if(info && info.ok === false){
      text = 'DB: ERRO';
      ok = false;
    } else {
      text = 'DB: —';
      ok = null;
    }

    el.textContent = text;
    if(ok === true){
      el.style.borderColor = '#22c55e';
      el.style.color = '#22c55e';
    }else if(ok === false){
      el.style.borderColor = '#ef4444';
      el.style.color = '#ef4444';
    }else{
      el.style.borderColor = '#64748b';
      el.style.color = '#64748b';
    }
  }

  async function health(){
    const el = $('#dbStatusAdmin');
    if(!window.DB?.enabled){ setDBStatus(el); return; }
    try{
      const r = await window.DB.healthCheck();
      setDBStatus(el, r);
    }catch(e){
      setDBStatus(el, { ok:false });
      console.warn('[admin] health error:', e);
    }
  }

  /* ---------- Helpers ---------- */
  function parsePriceInput(v){
    // aceita "12,34" ou "12.34"
    if(typeof v !== 'string') v = String(v ?? '');
    v = v.replace(/\s/g,'').replace(/\./g,'').replace(',', '.'); // "1.234,56" -> "1234.56"
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  function clearForm(){
    $('#pId').value = '';
    $('#pName').value = '';
    $('#pPrice').value = '';
    $('#pCat').value = '';
    $('#pImg').value = '';
  }

  function setLoading(loading){
    const btns = ['addBtn','delBtn','exportBtn','importBtn'].map(id => $('#'+id)).filter(Boolean);
    btns.forEach(b => b.disabled = !!loading);
  }

  /* ---------- CRUD ---------- */
  async function load(){
    if(!window.DB?.enabled){
      alert('BACKEND_URL não configurada em assets/firebase-config.js');
      data = [];
      render();
      return;
    }
    try{
      data = await window.DB.getProducts();
      if(!Array.isArray(data)) data = [];
    }catch(e){
      console.error('[admin] load error:', e);
      alert('Erro ao carregar produtos. Veja o console.');
      data = [];
    }
    render();
  }

  async function upsert(){
    if(!window.DB?.enabled) return alert('DB indisponível.');

    const id = $('#pId').value.trim();
    const name = $('#pName').value.trim();
    const priceStr = $('#pPrice').value.trim();
    const price = parsePriceInput(priceStr);
    const category = $('#pCat').value.trim();
    const image = $('#pImg').value.trim();

    if(!id || !name || !category){
      return alert('Preencha ID, Nome e Categoria.');
    }
    if(!Number.isFinite(price)){
      return alert('Preço inválido. Use números (ex.: 12,34).');
    }

    const rec = { id, name, price, category, image };
    setLoading(true);
    try{
      await window.DB.setProduct(rec);
      const i = data.findIndex(x => x.id === id);
      if(i >= 0) data[i] = rec; else data.push(rec);
      render();
      clearForm();
    }catch(e){
      console.error('[admin] upsert error:', e);
      alert('Erro ao salvar produto. Veja o console.');
    }finally{
      setLoading(false);
    }
  }

  async function del(){
    if(!window.DB?.enabled) return alert('DB indisponível.');
    const id = $('#pId').value.trim();
    if(!id) return;
    if(!confirm(`Excluir produto "${id}"?`)) return;

    setLoading(true);
    try{
      await window.DB.deleteProduct(id);
      data = data.filter(p => p.id !== id);
      render();
      clearForm();
    }catch(e){
      console.error('[admin] delete error:', e);
      alert('Erro ao excluir. Veja o console.');
    }finally{
      setLoading(false);
    }
  }

  /* ---------- Import/Export ---------- */
  function exportJSON(){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file){
    const r = new FileReader();
    r.onload = async e => {
      try{
        const arr = JSON.parse(e.target.result);
        if(!Array.isArray(arr)) throw new Error('O JSON deve ser um array de produtos.');
        // validação básica
        const sanitized = arr.map(p => {
          const id = String(p.id ?? '').trim();
          const name = String(p.name ?? '').trim();
          const category = String(p.category ?? '').trim();
          const price = parsePriceInput(String(p.price ?? ''));
          const image = String(p.image ?? '').trim();
          if(!id || !name || !category || !Number.isFinite(price)){
            throw new Error(`Produto inválido: ${JSON.stringify(p)}`);
          }
          return { id, name, category, price, image };
        });

        setLoading(true);
        await Promise.all(sanitized.map(p => window.DB.setProduct(p)));
        data = await window.DB.getProducts();
        render();
        alert('Produtos importados com sucesso!');
      }catch(err){
        console.error('[admin] import error:', err);
        alert('Erro ao importar: ' + err.message);
      }finally{
        setLoading(false);
      }
    };
    r.readAsText(file);
  }

  /* ---------- Render ---------- */
  function render(){
    const tb = document.querySelector('#tbl tbody');
    if(!tb) return;
    tb.innerHTML = '';

    const sorted = [...data].sort((a,b)=> String(a.id).localeCompare(String(b.id)));
    sorted.forEach(p => {
      const img = (p.image && String(p.image).trim()) ? p.image : './assets/placeholder.svg';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:44px">
          <img src="\${img}" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid rgba(148,163,184,.25)" onerror="this.src='./assets/placeholder.svg'">
        </td>
        <td>\${escapeHTML(p.id)}</td>
        <td>\${escapeHTML(p.name)}</td>
        <td>\${BRL.format(Number(p.price||0))}</td>
        <td>\${escapeHTML(p.category)}</td>
      `;
      tr.style.cursor = 'pointer';
      tr.onclick = () => {
        $('#pId').value = p.id;
        $('#pName').value = p.name;
        $('#pPrice').value = String(Number(p.price || 0).toFixed(2)).replace('.', ',');
        $('#pCat').value = p.category;
        $('#pImg').value = p.image || '';
      };
      tb.appendChild(tr);
    });
  }

  function escapeHTML(str){
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  /* ---------- Eventos ---------- */
  function bind(){
    const addBtn = $('#addBtn');
    const delBtn = $('#delBtn');
    const expBtn = $('#exportBtn');
    const impBtn = $('#importBtn');
    const fileInput = $('#fileInput');

    if(addBtn) addBtn.onclick = upsert;
    if(delBtn) delBtn.onclick = del;
    if(expBtn) expBtn.onclick = exportJSON;
    if(impBtn) impBtn.onclick = () => fileInput && fileInput.click();
    if(fileInput){
      fileInput.addEventListener('change', e => {
        const f = e.target.files?.[0];
        if(f) importJSON(f);
        e.target.value = '';
      });
    }

    // UX: Enter no campo preço salva
    const priceEl = $('#pPrice');
    if(priceEl){
      priceEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){ upsert(); }
      });
    }

    window.addEventListener('online', health);
    window.addEventListener('offline', health);
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    bind();
    await health();
    await load();
  });

})();
