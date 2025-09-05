// assets/pos.js — unchanged logic, premium UI handled via CSS
(function(){
  const $ = s => document.querySelector(s);
  const BRL = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
  const uid = () => Math.random().toString(36).slice(2,10);

  const PIX_CFG = { KEY:'edab0cd5-ecd4-4050-87f7-fbaf98899713', MERCHANT:'COMANDA BAR', CITY:'BRASIL', DESC:'COMANDA' };
  const PAYMENT_METHODS = ['PIX', 'Cartão de Débito', 'Cartão de Crédito'];

  const state = { products:[], categories:['Todos'], filterCat:'Todos', query:'', comandas:{}, activeComandaId:null, service10:false, history:[] };

  function setBadge(text, ok=null){
    const el = $('#dbStatus'); if(!el) return;
    el.textContent = text;
    if(ok===true){ el.classList.add('is-ok'); el.classList.remove('is-err'); }
    else if(ok===false){ el.classList.add('is-err'); el.classList.remove('is-ok'); }
    else{ el.classList.remove('is-ok','is-err'); }
  }
  async function health(){
    if(!window.DB?.enabled) return setBadge('DB: OFF', false);
    try{ const r = await window.DB.healthCheck(); setBadge(r?.ok && r?.canReadServer ? 'DB: OK' : 'DB: ERRO', !!(r?.ok && r?.canReadServer)); }
    catch{ setBadge('DB: ERRO', false); }
  }

  async function loadProducts(){
    const grid = '#grid';
    try{
      const arr = await window.DB.getProducts();
      state.products = Array.isArray(arr) ? arr : [];
      const cats = new Set(['Todos']); state.products.forEach(p => cats.add(p.category||'Outros')); state.categories = Array.from(cats);
      renderChips(); renderGrid();
    }catch(e){ console.error(e); const el=document.querySelector(grid); if(el) el.innerHTML='<div class="muted">Erro ao carregar produtos.</div>'; }
  }
  function renderChips(){
    const box = $('#chips'); if(!box) return; box.innerHTML='';
    // Track background creates a segmented control
    const track = document.createElement('div'); track.className='chip-track';
    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = cat;
      if(cat === state.filterCat){ b.classList.add('active'); }
      b.onclick = () => { state.filterCat = cat; renderChips(); renderGrid(); };
      track.appendChild(b);
    });
    box.appendChild(track);
  }
  function matches(p){
    const okCat = (state.filterCat==='Todos' || (p.category||'')===state.filterCat);
    const q = state.query.trim().toLowerCase();
    const okQ = !q || (p.name||'').toLowerCase().includes(q) || (p.id||'').toLowerCase().includes(q);
    return okCat && okQ;
  }
  function renderGrid(){
    const grid = document.querySelector('#grid'); if(!grid) return;
    const list = state.products.filter(matches);
    if(!list.length){ grid.innerHTML = '<div class="muted">Nenhum produto.</div>'; return; }
    grid.innerHTML='';
    list.forEach(p=>{
      const card = document.createElement('button'); card.className='card product tap';
      const img = (p.image && p.image.trim()) ? p.image : './assets/placeholder.svg';
      card.innerHTML = `
        <img src="${img}" alt="" onerror="this.src='./assets/placeholder.svg'">
        <div class="product-info"><div class="name">${p.name}</div><div class="muted">${p.category||''}</div></div>
        <div class="price">${BRL.format(Number(p.price||0))}</div>`;
      card.addEventListener('click', ()=> addItem(p));
      grid.appendChild(card);
    });
  }

  function getActive(){ return state.comandas[state.activeComandaId] || null; }
  function createComanda(opts={}){
    const id = uid();
    const c = { id, name:opts.name||'Mesa', label:opts.label||'', color:opts.color||'#22c55e', createdAt:Date.now(), status:'open', items:{}, payMethod:'PIX' };
    state.comandas[id] = c; state.activeComandaId = id;
    if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); }
    refreshComandaSelect(); renderDrawer(); return c;
  }
  function refreshComandaSelect(){
    const sel = document.querySelector('#comandaSelect'); if(!sel) return;
    sel.innerHTML='';
    Object.values(state.comandas).forEach(c=>{
      if(c.status!=='open') return;
      const opt = document.createElement('option'); opt.value=c.id; opt.textContent=`${c.name}${c.label?(' ['+c.label+']'):''}`; sel.appendChild(opt);
    });
    if(state.activeComandaId && state.comandas[state.activeComandaId]?.status==='open'){ sel.value = state.activeComandaId; }
    else if (sel.options.length){ state.activeComandaId = sel.options[0].value; sel.value = state.activeComandaId; }
  }
  function addItem(p){
    const c = getActive() || createComanda({name:'Mesa'});
    const it = c.items[p.id] || { id:p.id, name:p.name, unit:Number(p.price||0), qty:0 };
    it.qty += 1; c.items[p.id] = it;
    if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); }
    renderDrawer();
  }
  function updateQty(pid, delta){
    const c = getActive(); if(!c) return;
    const it = c.items[pid]; if(!it) return;
    it.qty += delta; if(it.qty<=0) delete c.items[pid];
    if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); }
    renderDrawer();
  }
  function subtotal(c){ return Object.values(c.items||{}).reduce((s,i)=> s + Number(i.unit||0)*Number(i.qty||0), 0); }
  function renderDrawer(){
    const c = getActive(); const box = document.querySelector('#drawer'); if(!box) return;
    if(!c){ box.innerHTML = '<div class="muted">Nenhuma comanda ativa.</div>'; updateSummary(); return; }
    const items = Object.values(c.items||{});
    if(!items.length){
      box.innerHTML = `
        <div class="muted">Nenhum item. Toque nos produtos para adicionar.</div>
        <div class="form-row"><label>Forma de pagamento</label><select id="paySel" class="select">${['PIX','Cartão de Débito','Cartão de Crédito'].map(m=>`<option ${c.payMethod===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="row"><label><input type="checkbox" id="svc10" ${state.service10?'checked':''}> 10% de serviço</label></div>`;
    }else{
      box.innerHTML = items.map(it => `
        <div class="row line">
          <div class="line-info"><div class="name">${it.name}</div><div class="muted">${BRL.format(it.unit)} • Qtd: ${it.qty}</div></div>
          <div class="qty">
            <button class="btn" aria-label="Diminuir" data-action="qty-" data-id="${it.id}">−</button>
            <button class="btn" aria-label="Aumentar" data-action="qty+" data-id="${it.id}">+</button>
          </div>
          <div class="price">${BRL.format(it.unit*it.qty)}</div>
        </div>`).join('') + `
        <div class="form-row"><label>Forma de pagamento</label><select id="paySel" class="select">${['PIX','Cartão de Débito','Cartão de Crédito'].map(m=>`<option ${c.payMethod===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="row"><label><input type="checkbox" id="svc10" ${state.service10?'checked':''}> 10% de serviço</label></div>
        <div class="row actions">
          <button class="btn accent" id="btnPix">Gerar PIX</button>
          <button class="btn" id="btnPrint">Imprimir 80mm</button>
          <button class="btn" id="btnPdf">Salvar PDF</button>
          <button class="btn danger" id="btnClose">Fechar</button>
        </div>`;
    }
    box.querySelectorAll('button[data-action]').forEach(b=>{
      const id = b.getAttribute('data-id'); const act = b.getAttribute('data-action');
      b.addEventListener('click', ()=> updateQty(id, act==='qty+'?+1:-1));
    });
    const paySel = document.querySelector('#paySel'); if(paySel){ paySel.onchange = ()=>{ c.payMethod = paySel.value; if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); } }; }
    const svc = document.querySelector('#svc10'); if(svc){ svc.onchange = ()=>{ state.service10 = !!svc.checked; window.DB?.setSettings({ service10: state.service10 }).catch(()=>{}); updateSummary(); }; }
    document.querySelector('#btnPix')?.addEventListener('click', showPix);
    document.querySelector('#btnPrint')?.addEventListener('click', print80);
    document.querySelector('#btnPdf')?.addEventListener('click', pdf);
    document.querySelector('#btnClose')?.addEventListener('click', closeComanda);
    updateSummary();
  }
  function updateSummary(){
    const c = getActive(); const countEl = document.querySelector('#summaryCount'); const totalEl = document.querySelector('#summaryTotal');
    if(!c){ if(countEl) countEl.textContent='0 itens'; if(totalEl) totalEl.textContent=BRL.format(0); return; }
    const items = Object.values(c.items||{});
    const st = subtotal(c);
    const service = state.service10 ? st*0.10 : 0;
    const tot = st + service;
    if(countEl) countEl.textContent = `${items.reduce((a,i)=>a+i.qty,0)} itens`;
    if(totalEl) totalEl.textContent = BRL.format(tot);
  }

  async function closeComanda(){
    const c = getActive(); if(!c) return alert('Nenhuma comanda ativa');
    if(!Object.keys(c.items||{}).length){
      if(confirm('Comanda vazia. Zerar sem registrar?')){ c.items={}; if(window.DB?.enabled) window.DB.upsertTab(c).catch(()=>{}); renderDrawer(); }
      return;
    }
    if(!window.DB?.enabled) return alert('DB indisponível.');
    try{
      const rec = await window.DB.closeComanda({
        id: c.id, name: c.name, label: c.label||'', color: c.color||'#22c55e',
        createdAt: c.createdAt||Date.now(), payMethod: c.payMethod||'PIX', service10: !!state.service10, items: c.items
      });
      state.history.unshift(rec);
      c.items={}; c.status='closed'; c.closedAt=rec.closedAt;
      alert(`Comanda fechada! Registro #${String(rec.number).padStart(4,'0')}`);
      renderDrawer(); refreshComandaSelect();
    }catch(e){ console.error(e); alert('Erro ao fechar comanda.'); }
  }
  function showPix(){
    const c = getActive(); if(!c) return;
    const st = subtotal(c); const svc = state.service10 ? st*0.10 : 0; const tot = st + svc;
    const payload = `PIX|KEY:${PIX_CFG.KEY}|MERCHANT:${PIX_CFG.MERCHANT}|DESC:${PIX_CFG.DESC}|AMOUNT:${tot.toFixed(2)}`;
    const dlg = document.querySelector('#pixDlg'); dlg.showModal();
    const box = document.querySelector('#qrBox'); box.innerHTML=''; new QRCode(box, { text: payload, width: 240, height: 240 });
    document.querySelector('#pixTotal').textContent = BRL.format(tot);
  }
  function print80(){
    const c = getActive(); if(!c) return;
    const items = Object.values(c.items||{});
    const st = subtotal(c); const svc = state.service10 ? st*0.10 : 0; const tot = st + svc;
    const area = document.querySelector('#printArea');
    area.innerHTML = `
      <div class="ticket">
        <h3>${PIX_CFG.MERCHANT}</h3>
        <div>Comanda: ${c.name} ${c.label?('['+c.label+']'):''}</div>
        <hr/>${items.map(i=>`<div class="trow"><span>${i.qty}x ${i.name}</span><span>${BRL.format(i.unit*i.qty)}</span></div>`).join('')}
        <hr/><div class="trow"><span>Subtotal</span><span>${BRL.format(st)}</span></div>
        <div class="trow"><span>Serviço 10%</span><span>${BRL.format(svc)}</span></div>
        <div class="trow total"><span>Total</span><span>${BRL.format(tot)}</span></div>
        <div>Pagamento: ${c.payMethod||'PIX'}</div>
        <div class="muted">Obrigado!</div>
      </div>`;
    window.print();
  }
  function pdf(){
    const c = getActive(); if(!c) return;
    const items = Object.values(c.items||{});
    const st = subtotal(c); const svc = state.service10 ? st*0.10 : 0; const tot = st + svc;
    const { jsPDF } = window.jspdf || {}; if(!jsPDF){ alert('jsPDF não carregado'); return; }
    const doc = new jsPDF({ unit:'mm', format:'a4' }); let y=12;
    doc.setFontSize(14); doc.text(PIX_CFG.MERCHANT, 12, y); y+=6;
    doc.setFontSize(11); doc.text(`Comanda: ${c.name} ${c.label?('['+c.label+']'):''}`, 12, y); y+=6;
    doc.line(12,y,198,y); y+=4; doc.setFontSize(10);
    items.forEach(i=>{ doc.text(`${i.qty}x ${i.name}`, 12, y); doc.text(BRL.format(i.unit*i.qty), 198, y, { align:'right' }); y+=6; });
    doc.line(12,y,198,y); y+=4;
    doc.text('Subtotal', 12, y); doc.text(BRL.format(st), 198, y, { align:'right' }); y+=6;
    doc.text('Serviço 10%', 12, y); doc.text(BRL.format(svc), 198, y, { align:'right' }); y+=6;
    doc.setFontSize(12); doc.text('Total', 12, y); doc.text(BRL.format(tot), 198, y, { align:'right' }); y+=8;
    doc.setFontSize(10); doc.text(`Pagamento: ${c.payMethod||'PIX'}`, 12, y); y+=10;
    doc.text('Recibo/Nota gerado automaticamente.', 12, y); doc.save(`recibo_${c.name}_${Date.now()}.pdf`);
  }

  async function showHistory(){
    if(!window.DB?.enabled) return alert('DB indisponível.');
    const dlg = document.querySelector('#histDlg'); dlg.showModal();
    try{ const arr = await window.DB.getHistory(); state.history = Array.isArray(arr) ? arr.sort((a,b)=>b.closedAt-a.closedAt) : []; renderHistory(); }
    catch(e){ console.error(e); }
  }
  function renderHistory(){
    const tbody = document.querySelector('#histBody'); if(!tbody) return;
    const pay = document.querySelector('#fPay')?.value || 'Todos';
    const lab = (document.querySelector('#fLabel')?.value||'').trim().toLowerCase();
    const t0 = document.querySelector('#fFrom')?.value ? new Date(document.querySelector('#fFrom').value).getTime() : 0;
    const t1 = document.querySelector('#fTo')?.value ? (new Date(document.querySelector('#fTo').value).getTime()+24*60*60*1000-1) : Infinity;
    const list = state.history.filter(r=>{
      const okPay = pay==='Todos' || (r.payMethod===pay);
      const okLab = !lab || (String(r.label||'').toLowerCase().includes(lab));
      const okDt = r.closedAt>=t0 && r.closedAt<=t1; return okPay && okLab && okDt;
    });
    tbody.innerHTML = list.map(r=>`
      <tr>
        <td>#${String(r.number).padStart(4,'0')}</td>
        <td>${r.name}</td>
        <td>${r.label||''}</td>
        <td>${new Date(r.closedAt).toLocaleString('pt-BR')}</td>
        <td>${r.payMethod}</td>
        <td>${BRL.format(r.total||0)}</td>
      </tr>`).join('');
    const tot = list.reduce((s,r)=> s + Number(r.total||0), 0); document.querySelector('#histTotal').textContent = BRL.format(tot);
  }
  function exportHistoryPDF(){
    const { jsPDF } = window.jspdf || {}; if(!jsPDF){ alert('jsPDF não carregado'); return; }
    const tbody = document.querySelector('#histBody');
    const rows = Array.from(tbody?.querySelectorAll('tr')||[]).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    const doc = new jsPDF({ unit:'mm', format:'a4' }); let y = 12;
    doc.setFontSize(14); doc.text('Histórico de Vendas', 12, y); y+=6; doc.setFontSize(10);
    rows.forEach(r=>{ const line = r.join('  |  '); doc.text(line, 12, y); y+=6; if(y>280){ doc.addPage(); y=12; } });
    doc.setFontSize(12); y+=6; const total = document.querySelector('#histTotal')?.textContent || ''; doc.text(`Total do período: ${total}`, 12, y);
    doc.save(`historico_${Date.now()}.pdf`);
  }

  function bind(){
    document.querySelector('#search')?.addEventListener('input', e=>{ state.query = e.target.value; renderGrid(); });
    document.querySelector('#clearSearch')?.addEventListener('click', ()=>{ state.query=''; document.querySelector('#search').value=''; renderGrid(); });
    document.querySelector('#newComandaBtn')?.addEventListener('click', ()=>{
      const name = prompt('Nome da comanda (ex.: Mesa 1):','Mesa 1') || 'Mesa';
      const label = prompt('Etiqueta (opcional, ex.: Verde):','') || '';
      const color = prompt('Cor HEX (opcional, ex.: #22c55e):','#22c55e') || '#22c55e';
      createComanda({name,label,color});
    });
    document.querySelector('#deleteComandaBtn')?.addEventListener('click', ()=>{
      const c = getActive(); if(!c) return;
      if(confirm(`Excluir comanda "${c.name}"?`)){
        delete state.comandas[c.id];
        if(window.DB?.enabled){ window.DB.deleteTab(c.id).catch(()=>{}); }
        state.activeComandaId = Object.keys(state.comandas)[0] || null;
        refreshComandaSelect(); renderDrawer();
      }
    });
    document.querySelector('#comandaSelect')?.addEventListener('change', e=>{ state.activeComandaId = e.target.value; renderDrawer(); });
    document.querySelector('#historyBtn')?.addEventListener('click', showHistory);
    document.querySelector('#histClose')?.addEventListener('click', ()=> document.querySelector('#histDlg').close());
    document.querySelector('#histExport')?.addEventListener('click', exportHistoryPDF);
    document.querySelector('#fPay')?.addEventListener('change', renderHistory);
    document.querySelector('#fLabel')?.addEventListener('input', renderHistory);
    document.querySelector('#fFrom')?.addEventListener('change', renderHistory);
    document.querySelector('#fTo')?.addEventListener('change', renderHistory);
    document.querySelector('#pixClose')?.addEventListener('click', ()=> document.querySelector('#pixDlg').close());
    document.querySelector('#openDrawer')?.addEventListener('click', ()=> document.querySelector('#drawerDlg').showModal());
  }

  async function boot(){
    bind();
    await health();
    try{ const s = await window.DB.getSettings(); state.service10 = !!s.service10; }catch{}
    try{ const tabs = await window.DB.getOpenTabs(); tabs.forEach(t=> state.comandas[t.id]=t); if(tabs.length) state.activeComandaId = tabs[0].id; }catch{}
    refreshComandaSelect();
    await loadProducts();
    renderDrawer();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
