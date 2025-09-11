// assets/admin.js — CRUD de Produtos
(function(){
  const $ = s => document.querySelector(s);
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  let data = [];

  function setDBStatus(el, info){
    if(!el) return;
    let text = 'DB: —', ok = null;
    if(!window.DB?.enabled){ text = 'DB: OFF'; ok=false; }
    else if(info && info.ok && info.canReadServer){ text='DB: OK'; ok=true; }
    else if(info && info.ok === false){ text='DB: ERRO'; ok=false; }
    el.textContent = text;
    el.classList.toggle('ok', !!(info && info.ok && info.canReadServer));
    el.classList.toggle('err', !!(info && info.ok===false));
  }
  async function health(){
    try{ const r = await window.DB.healthCheck(); setDBStatus($('#dbStatusAdmin'), r); }
    catch{ setDBStatus($('#dbStatusAdmin'), { ok:false }); }
  }

  function parsePriceInput(v){ if(typeof v!=='string') v=String(v??''); v=v.replace(/\s/g,'').replace(/\./g,'').replace(',', '.'); const n=Number(v); return Number.isFinite(n)&&n>=0?n:NaN; }
  function clearForm(){ $('#pId').value=''; $('#pName').value=''; $('#pPrice').value=''; $('#pCat').value=''; $('#pImg').value=''; }
  function setLoading(x){ ['addBtn','delBtn','exportBtn','importBtn'].forEach(id=>{ const b=$('#'+id); if(b) b.disabled=!!x; }); }

  async function load(){ try{ data = await window.DB.getProducts(); }catch(e){ console.error(e); data=[]; } render(); }
  async function upsert(){
    const id=$('#pId').value.trim(); const name=$('#pName').value.trim(); const category=$('#pCat').value.trim();
    const price=parsePriceInput($('#pPrice').value.trim()); const image=$('#pImg').value.trim();
    if(!id||!name||!category) return alert('Preencha ID, Nome e Categoria.'); if(!Number.isFinite(price)) return alert('Preço inválido.');
    setLoading(true);
    try{
      const rec={id,name,category,price,image}; await window.DB.setProduct(rec);
      const i=data.findIndex(x=>x.id===id); if(i>=0) data[i]=rec; else data.push(rec); render(); clearForm();
    }catch(e){ console.error(e); alert('Erro ao salvar.'); } finally{ setLoading(false); }
  }
  async function del(){
    const id=$('#pId').value.trim(); if(!id) return; if(!confirm('Excluir produto?')) return;
    setLoading(true); try{ await window.DB.deleteProduct(id); data=data.filter(p=>p.id!==id); render(); clearForm(); }
    catch(e){ console.error(e); alert('Erro ao excluir.'); } finally{ setLoading(false); }
  }
  function exportJSON(){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='products.json'; a.click(); URL.revokeObjectURL(a.href); }
  function importJSON(file){
    const r=new FileReader(); r.onload=async e=>{
      try{
        const arr=JSON.parse(e.target.result); if(!Array.isArray(arr)) throw new Error('JSON deve ser array.');
        const sanitized = arr.map(p => { const id=String(p.id||'').trim(); const name=String(p.name||'').trim(); const category=String(p.category||'').trim(); const price=Number(p.price||0); const image=String(p.image||'').trim(); if(!id||!name||!category||!Number.isFinite(price)) throw new Error('Produto inválido: '+JSON.stringify(p)); return { id,name,category,price,image }; });
        await Promise.all(sanitized.map(p=> window.DB.setProduct(p)));
        data = await window.DB.getProducts(); render(); alert('Importado!');
      }catch(err){ alert('Erro: '+err.message); }
    }; r.readAsText(file);
  }
  function render(){
    const tb=document.querySelector('#tbl tbody'); if(!tb) return; tb.innerHTML='';
    [...data].sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(p=>{
      const img = (p.image&&p.image.trim())?p.image:'./assets/placeholder.svg';
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td style="width:44px"><img src="${img}" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid rgba(148,163,184,.25)" onerror="this.src='./assets/placeholder.svg'"></td>
        <td>${p.id}</td><td>${p.name}</td><td>${BRL.format(Number(p.price||0))}</td><td>${p.category||''}</td>`;
      tr.onclick=()=>{ $('#pId').value=p.id; $('#pName').value=p.name; $('#pPrice').value=String(Number(p.price||0).toFixed(2)).replace('.',','); $('#pCat').value=p.category||''; $('#pImg').value=p.image||''; };
      tb.appendChild(tr);
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    $('#addBtn').onclick=upsert; $('#delBtn').onclick=del; $('#exportBtn').onclick=exportJSON; $('#importBtn').onclick=()=>$('#fileInput').click();
    $('#fileInput').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) importJSON(f); e.target.value=''; });
    health(); load();
  });
})();
