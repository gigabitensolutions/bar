
async function fetchHistory() {
  const tenant = window.FIREBASE_CONFIG.TENANT_ID;
  const url = `${window.FIREBASE_CONFIG.BACKEND_URL}/history?tenant=${tenant}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.history || [];
}
