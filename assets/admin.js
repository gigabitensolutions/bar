
document.getElementById("btn-load-history").addEventListener("click", async () => {
  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
  try {
    const history = await fetchHistory();
    tbody.innerHTML = history.map(h => {
      const dt = new Date(h.closedAt).toLocaleString();
      return `<tr><td>${h.number}</td><td>${h.name}</td><td>${h.total}</td><td>${h.payMethod}</td><td>${dt}</td></tr>`;
    }).join("");
    window._history_cache = history;
  } catch (e) {
    tbody.innerHTML = "<tr><td colspan='5'>Erro ao carregar histórico</td></tr>";
  }
});

document.getElementById("btn-export-csv").addEventListener("click", () => {
  const rows = window._history_cache || [];
  let csv = "Número,Nome,Total,Forma Pgto,Fechamento\n";
  csv += rows.map(h => {
    const dt = new Date(h.closedAt).toLocaleString();
    return `${h.number},"${h.name}",${h.total},${h.payMethod},${dt}`;
  }).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "historico_comandas.csv";
  a.click();
});

document.getElementById("btn-export-pdf").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.text("Histórico de Comandas", 10, 10);
  const rows = window._history_cache || [];
  let y = 20;
  rows.forEach(h => {
    const dt = new Date(h.closedAt).toLocaleString();
    pdf.text(`#${h.number} - ${h.name} - R$${h.total} - ${h.payMethod} - ${dt}`, 10, y);
    y += 10;
  });
  pdf.save("historico_comandas.pdf");
});
