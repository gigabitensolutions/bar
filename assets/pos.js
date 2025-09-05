// assets/pos.js — POS com UX mobile, form inline e PIX EMVco (BR Code)
(function(){
  const $ = sel => document.querySelector(sel);
  const BRL = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
  const uid = () => Math.random().toString(36).slice(2,10);

  const PIX_CFG = {
    KEY:'edab0cd5-ecd4-4050-87f7-fbaf98899713',
    MERCHANT:'COMANDA BAR',
    CITY:'BRASIL'
  };
  const PAYMENT_METHODS = ['PIX', 'Cartão de Débito', 'Cartão de Crédito'];

  const SWATCHES = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#a855f7','#14b8a6','#64748b'];
  const state = {
    products:[], categories:['Todos'], filterCat:'Todos', query:'',
    comandas:{}, activeComandaId:null, service10:false, history:[],
    newC: { name:'Mesa 1', label:'', color:SWATCHES[0] }
  };

  /* ---------- Helpers ---------- */
  function setBadge(text, ok=null){
    const el = $('#dbStatus'); if(!el) return;
    el.textContent = text;
    el.classList.toggle('ok', ok===true);
    el.classList.toggle('err', ok===false);
  }
  async function health(){
    if(!window.DB?.enabled) return setBadge('DB: OFF', false);
    try{ const r = await window.DB.healthCheck(); setBadge(r?.ok && r?.canReadServer ? 'DB: OK' : 'DB: ERRO', !!(r?.ok && r?.canReadServer)); }
    catch{ setBadge('DB: ERRO', false); }
  }

  function tlv(id, value){
    const v = String(value ?? '');
    const len = String(v.length).padStart(2,'0');
    return id + len + v;
  }
  function crc16(str){ // CRC-16/CCITT-FALSE
    let crc = 0xFFFF;
    for(let i=0;i<str.length;i++){
      crc ^= str.charCodeAt(i) << 8;
      for(let j=0;j<8;j++){
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4,'0');
  }
  function sanitize(v,max){ v = (v||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,''); v = v.replace(/[^A-Za-z0-9 \-\.]/g,''); if(max) v=v.slice(0,max); return v || 'NA'; }
  function pixPayload({ key, name, city, amount=null, txid=null, desc=null }){
    name = sanitize(name,25); city = sanitize(city,15); txid = sanitize(txid||'COMANDA',25);
    const gui = tlv('00','br.gov.bcb.pix');
    const acc = tlv('01', key);
    const addDesc = desc ? tlv('02', String(desc).slice(0,50)) : '';
    const mai = tlv('26', gui + acc + addDesc);
    const mcc = tlv('52','0000');
    const cur = tlv('53','986');
    const amt = amount ? tlv('54', String(Number(amount).toFixed(2))) : '';
    const cty = tlv('58','BR');
    const mname = tlv('59', name);
    const mcity = tlv('60', city);
    const add = tlv('62', tlv('05', txid));
    const poi = tlv('01', amount ? '12' : '11'); // 12 dinâmico se tiver valor
    const base = tlv('00','01') + poi + mai + mcc + cur + amt + cty + mname + mcity + add + '6304';
    const crc = crc16(base);
    return base + crc;
  }

  function subtotal(c){ return Object.values(c.items||{}).reduce((s,i)=> s + Number(i.unit||0)*Number(i.qty||0), 0); }

  /* ---------- Produtos ---------- */
  async function loadProducts(){
    try{
      const arr = await window.DB.getProducts();
      state.products = Array.isArray(arr) ? arr : [];
      const cats = new Set(['Todos']); state.products.forEach(p => cats.add(p.category||'Outros')); state.categories = Array.from(cats);
      renderChips(); renderGrid();
    }catch(e){ console.error(e); $('#grid').innerHTML='<div class="card muted">Erro ao carregar produtos.</div>'; }
  }
  function renderChips(){
    const box = $('#chips'); if(!box) return; box.innerHTML='';
    const track = document.createElement('div'); track.className='chip-track';
    state.categories.forEach(cat => {
      const b = document.createElement('button'); b.className='chip'; b.textContent=cat;
      if(cat===state.filterCat) b.classList.add('active');
      b.onclick=()=>{ state.filterCat=cat; renderChips(); renderGrid(); };
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
    const grid = $('#grid'); if(!grid) return;
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

  /* ---------- Comandas ---------- */
  function getActive(){ return state.comandas[state.activeComandaId] || null; }
  function createComanda(opts={}){
    const id = uid();
    const c = { id, name:opts.name||'Mesa', label:opts.label||'', color:opts.color||'#22c55e', createdAt:Date.now(), status:'open', items:{}, payMethod:'PIX' };
    state.comandas[id] = c; state.activeComandaId = id;
    if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); }
    refreshComandaSelect(); renderDrawer(); return c;
  }
  function refreshComandaSelect(){
    const sel = $('#comandaSelect'); if(!sel) return;
    sel.innerHTML='';
    Object.values(state.comandas).forEach(c=>{
      if(c.status!=='open') return;
      const opt = document.createElement('option'); opt.value=c.id; opt.textContent=`${c.name}${c.label?(' ['+c.label+']'):''}`; sel.appendChild(opt);
    });
    if(state.activeComandaId && state.comandas[state.activeComandaId]?.status==='open'){ sel.value = state.activeComandaId; }
    else if (sel.options.length){ state.activeComandaId = sel.options[0].value; sel.value = state.activeComandaId; }
  }
  function addItem(p){
    const c = getActive() || createComanda({name: state.newC.name, label: state.newC.label, color: state.newC.color});
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
  function renderDrawer(){
    const c = getActive(); const box = $('#drawer'); if(!box) return;
    if(!c){ box.innerHTML = '<div class="muted">Nenhuma comanda ativa.</div>'; updateSummary(); return; }
    const items = Object.values(c.items||{});
    if(!items.length){
      box.innerHTML = `
        <div class="muted">Nenhum item. Toque nos produtos para adicionar.</div>
        <div class="form-row"><label>Forma de pagamento</label><select id="paySel" class="select">${PAYMENT_METHODS.map(m=>`<option ${c.payMethod===m?'selected':''}>${m}</option>`).join('')}</select></div>
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
        <div class="form-row"><label>Forma de pagamento</label><select id="paySel" class="select">${PAYMENT_METHODS.map(m=>`<option ${c.payMethod===m?'selected':''}>${m}</option>`).join('')}</select></div>
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
    const paySel = $('#paySel'); if(paySel){ paySel.onchange = ()=>{ c.payMethod = paySel.value; if(window.DB?.enabled){ window.DB.upsertTab(c).catch(()=>{}); } }; }
    const svc = $('#svc10'); if(svc){ svc.onchange = ()=>{ state.service10 = !!svc.checked; window.DB?.setSettings({ service10: state.service10 }).catch(()=>{}); updateSummary(); }; }
    $('#btnPix')?.addEventListener('click', showPix);
    $('#btnPrint')?.addEventListener('click', print80);
    $('#btnPdf')?.addEventListener('click', pdf);
    $('#btnClose')?.addEventListener('click', closeComanda);
    updateSummary();
  }
  function updateSummary(){
    const c = getActive(); const countEl = $('#summaryCount'); const totalEl = $('#summaryTotal');
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
        id: c.id, name: c.name, label: c.label||'', color: c.color||state.newC.color,
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
    const txid = ('TX' + (c.id||'').slice(0,8)).toUpperCase();
    const payload = pixPayload({ key: PIX_CFG.KEY, name: PIX_CFG.MERCHANT, city: PIX_CFG.CITY, amount: tot, txid, desc: `COMANDA ${c.name}` });
    const dlg = $('#pixDlg'); dlg.showModal();
    const box = $('#qrBox'); box.innerHTML=''; new QRCode(box, { text: payload, width: 256, height: 256 });
    $('#pixTotal').textContent = BRL.format(tot);
  }
  function print80(){
    const c = getActive(); if(!c) return;
    const items = Object.values(c.items||{});
    const st = subtotal(c); const svc = state.service10 ? st*0.10 : 0; const tot = st + svc;
    const area = $('#printArea');
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

  /* ---------- Histórico ---------- */
  async function showHistory(){
    if(!window.DB?.enabled) return alert('DB indisponível.');
    const dlg = $('#histDlg'); dlg.showModal();
    try{ const arr = await window.DB.getHistory(); state.history = Array.isArray(arr) ? arr.sort((a,b)=>b.closedAt-a.closedAt) : []; renderHistory(); }
    catch(e){ console.error(e); }
  }
  function renderHistory(){
    const tbody = $('#histBody'); if(!tbody) return;
    const pay = $('#fPay')?.value || 'Todos';
    const lab = ($('#fLabel')?.value||'').trim().toLowerCase();
    const t0 = $('#fFrom')?.value ? new Date($('#fFrom').value).getTime() : 0;
    const t1 = $('#fTo')?.value ? (new Date($('#fTo').value).getTime()+24*60*60*1000-1) : Infinity;
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
    const tot = list.reduce((s,r)=> s + Number(r.total||0), 0); $('#histTotal').textContent = BRL.format(tot);
  }
  function exportHistoryPDF(){
    const { jsPDF } = window.jspdf || {}; if(!jsPDF){ alert('jsPDF não carregado'); return; }
    const tbody = $('#histBody');
    const rows = Array.from(tbody?.querySelectorAll('tr')||[]).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    const doc = new jsPDF({ unit:'mm', format:'a4' }); let y = 12;
    doc.setFontSize(14); doc.text('Histórico de Vendas', 12, y); y+=6; doc.setFontSize(10);
    rows.forEach(r=>{ const line = r.join('  |  '); doc.text(line, 12, y); y+=6; if(y>280){ doc.addPage(); y=12; } });
    doc.setFontSize(12); y+=6; const total = $('#histTotal')?.textContent || ''; doc.text(`Total do período: ${total}`, 12, y);
    doc.save(`historico_${Date.now()}.pdf`);
  }

  /* ---------- Bind UI ---------- */
  function bind(){
    // search
    $('#search')?.addEventListener('input', e=>{ state.query = e.target.value; renderGrid(); });
    $('#clearSearch')?.addEventListener('click', ()=>{ state.query=''; $('#search').value=''; renderGrid(); });
    // comanda select
    $('#comandaSelect')?.addEventListener('change', e=>{ state.activeComandaId = e.target.value; renderDrawer(); });
    // history
    $('#historyBtn')?.addEventListener('click', showHistory);
    $('#histClose')?.addEventListener('click', ()=> $('#histDlg').close());
    $('#histExport')?.addEventListener('click', exportHistoryPDF);
    $('#fPay')?.addEventListener('change', renderHistory);
    $('#fLabel')?.addEventListener('input', renderHistory);
    $('#fFrom')?.addEventListener('change', renderHistory);
    $('#fTo')?.addEventListener('change', renderHistory);
    $('#pixClose')?.addEventListener('click', ()=> $('#pixDlg').close());
    $('#openDrawer')?.addEventListener('click', ()=> $('#drawerDlg').showModal());

    // new comanda inline
    const nameI = $('#ncName'); const labelI = $('#ncLabel'); const addBtn = $('#ncAdd');
    if(nameI) nameI.addEventListener('input', e=> state.newC.name = e.target.value);
    if(labelI) labelI.addEventListener('input', e=> state.newC.label = e.target.value);
    document.querySelectorAll('.swatch').forEach(el=>{
      el.addEventListener('click', ()=>{
        document.querySelectorAll('.swatch').forEach(s=> s.classList.remove('active'));
        el.classList.add('active'); state.newC.color = el.dataset.color;
      });
    });
    if(addBtn) addBtn.addEventListener('click', ()=>{
      const c = createComanda({ name: state.newC.name||'Mesa', label: state.newC.label||'', color: state.newC.color||SWATCHES[0] });
      $('#comandaSelect').value = c.id;
    });

    // delete comanda
    $('#deleteComandaBtn')?.addEventListener('click', ()=>{
      const c = getActive(); if(!c) return;
      if(confirm(`Excluir comanda "${c.name}"?`)){
        delete state.comandas[c.id];
        if(window.DB?.enabled){ window.DB.deleteTab(c.id).catch(()=>{}); }
        state.activeComandaId = Object.keys(state.comandas)[0] || null;
        refreshComandaSelect(); renderDrawer();
      }
    });
  }

  async function boot(){
    bind();
    await health();
    try{ const s = await window.DB.getSettings(); state.service10 = !!s.service10; }catch{}
    try{ const tabs = await window.DB.getOpenTabs(); tabs.forEach(t=> state.comandas[t.id]=t); if(tabs.length) state.activeComandaId = tabs[0].id; }catch{}
    refreshComandaSelect();
    await loadProducts();
    renderGrid();
    renderDrawer();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
