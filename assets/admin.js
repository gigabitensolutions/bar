const $=s=>document.querySelector(s);
let data=[];

function setDBStatus(el, info){
  if(!el) return;
  if(!window.DB?.enabled){
    el.textContent = 'DB: OFF';
    el.style.borderColor = '#ef4444'; el.style.color = '#ef4444';
    return;
  }
  const ok = !!info?.rulesOk;
  el.textContent = ok ? 'DB: OK' : 'DB: ERRO';
  el.style.borderColor = ok ? '#22c55e' : '#ef4444';
  el.style.color = ok ? '#22c55e' : '#ef4444';
}

async function health(){
  if(!window.DB?.enabled){ setDBStatus($('#dbStatusAdmin')); return; }
  const r = await window.DB.healthCheck();
  setDBStatus($('#dbStatusAdmin'), r);
}

async function load(){
  if(!window.DB?.enabled){ alert('Firebase não configurado.'); data=[]; return; }
  data = await window.DB.getProducts();
}

function render(){
  const tb = document.querySelector('#tbl tbody'); tb.innerHTML='';
  data.forEach(p=>{
    const img = (p.image && p.image.trim()) ? p.image : './assets/placeholder.svg';
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${img}" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid rgba(148,163,184,.25)"></td>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>R$ ${Number(p.price).toFixed(2)}</td>
      <td>${p.category}</td>`;
    tr.onclick=()=>{
      $('#pId').value=p.id; $('#pName').value=p.name;
      $('#pPrice').value=Number(p.price).toFixed(2);
      $('#pCat').value=p.category; $('#pImg').value=p.image||'';
    };
    tb.appendChild(tr);
  });
}

async function upsert(){
  if(!window.DB?.enabled) return alert('DB indisponível.');
  const id=$('#pId').value.trim();
  const name=$('#pName').value.trim();
  const price=Number(String($('#pPrice').value).replace(',','.'));
  const category=$('#pCat').value.trim();
  const image=$('#pImg').value.trim();
  if(!id||!name||!category||!(price>=0)) return alert('Preencha id, nome, preço e categoria.');
  const rec={id,name,price,category,image};
  await window.DB.setProduct(rec);
  const i = data.findIndex(x=>x.id===id);
  if(i>=0) data[i]=rec; else data.push(rec);
  render(); clearForm();
}

async function del(){
  if(!window.DB?.enabled) return alert('DB indisponível.');
  const id=$('#pId').value.trim(); if(!id) return;
  await window.DB.deleteProduct(id);
  data = data.filter(p=>p.id!==id);
  render(); clearForm();
}

function clearForm(){ $('#pId').value=''; $('#pName').value=''; $('#pPrice').value=''; $('#pCat').value=''; $('#pImg').value=''; }

function exportJSON(){
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='products.json'; a.click();
}
function importJSON(file){
  const r=new FileReader();
  r.onload=async e=>{
    try{
      const arr=JSON.parse(e.target.result);
      if(!Array.isArray(arr)) throw new Error('JSON deve ser um array de produtos.');
      await Promise.all(arr.map(p=> window.DB.setProduct(p)));
      data = await window.DB.getProducts();
      render();
      alert('Importado para o DB!');
    }catch(err){ alert('Erro: '+err.message); }
  };
  r.readAsText(file);
}

document.addEventListener('DOMContentLoaded',async ()=>{
  await health();
  await load(); render();
  $('#addBtn').onclick=upsert;
  $('#delBtn').onclick=del;
  $('#exportBtn').onclick=exportJSON;
  $('#importBtn').onclick=()=>$('#fileInput').click();
  $('#fileInput').addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) importJSON(f); e.target.value=''; });

  window.addEventListener('online', health);
  window.addEventListener('offline', health);
});