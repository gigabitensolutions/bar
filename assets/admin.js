const LS_KEY='products_cache_v1';
const $=s=>document.querySelector(s);
let data=[];

async function load(){
  try{
    if(window.DB?.enabled){
      data = await window.DB.getProducts();
      if(Array.isArray(data) && data.length){
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        render(); return;
      }
    }
    const cached = JSON.parse(localStorage.getItem(LS_KEY)||'[]');
    data = Array.isArray(cached)? cached : [];
  }catch(e){ data=[]; }
}
function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }
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
  const id=$('#pId').value.trim();
  const name=$('#pName').value.trim();
  const price=Number(String($('#pPrice').value).replace(',','.'));
  const category=$('#pCat').value.trim();
  const image=$('#pImg').value.trim();
  if(!id||!name||!category||!(price>=0)) return alert('Preencha id, nome, preço e categoria.');
  const rec={id,name,price,category,image};
  const i = data.findIndex(x=>x.id===id);
  if(i>=0) data[i]=rec; else data.push(rec);
  render(); clearForm();
  saveLocal();
  if(window.DB?.enabled){ try{ await window.DB.setProduct(rec); }catch(e){ console.warn(e); } }
}
async function del(){
  const id=$('#pId').value.trim(); if(!id) return;
  data = data.filter(p=>p.id!==id);
  render(); clearForm(); saveLocal();
  if(window.DB?.enabled){ try{ await window.DB.deleteProduct(id); }catch(e){ console.warn(e); } }
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
      data=arr; render(); saveLocal(); alert('Importado!');
      if(window.DB?.enabled){ await Promise.all(arr.map(p=>window.DB.setProduct(p))); }
    }catch(err){ alert('Erro: '+err.message); }
  };
  r.readAsText(file);
}

document.addEventListener('DOMContentLoaded',async ()=>{
  await load(); render();
  $('#addBtn').onclick=upsert;
  $('#delBtn').onclick=del;
  $('#saveBtn').onclick=()=>{ saveLocal(); alert('Salvo localmente/DB se habilitado.'); };
  $('#exportBtn').onclick=exportJSON;
  $('#importBtn').onclick=()=>$('#fileInput').click();
  $('#fileInput').addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) importJSON(f); e.target.value=''; });
});