// FireeVolution 2.8 — popup.js
// Apenas configura a URL do backend. Nenhuma chave de API é armazenada
// ou usada aqui — a IA fica inteiramente do lado do backend.

const input = document.getElementById("fe-backend-url");
const saveBtn = document.getElementById("fe-save-btn");
const statusEl = document.getElementById("fe-status");

chrome.storage.local.get(["backendUrl"], (res) => {
  input.value = res.backendUrl || "https://fireevolution-backend.onrender.com";
});

saveBtn.addEventListener("click", () => {
  const url = input.value.trim().replace(/\/+$/, "");
  if (!url) {
    setStatus("Informe uma URL válida.", false);
    return;
  }
  chrome.storage.local.set({ backendUrl: url }, () => {
    setStatus("Salvo! Recarregue a página da rede social para aplicar.", true);
  });
});

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.className = ok ? "ok" : "err";
}
