// FireeVolution 2.9 — background.js
// Único responsável por falar com o backend. A chave de IA NUNCA passa por aqui:
// ela fica só no backend, lida a partir de variável de ambiente.

const DEFAULT_BACKEND_URL = "https://fireevolution-backend.onrender.com";

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.local.get("backendUrl");
  return (backendUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

async function callBackend(path, payload, method = "POST") {
  const base = await getBackendUrl();
  let res;
  try {
    const opts = { method };
    if (method !== "GET") {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(payload);
    }
    res = await fetch(base + path, opts);
  } catch (networkErr) {
    // "Failed to fetch": o servidor não está rodando, a URL está errada,
    // ou a porta não está liberada em host_permissions no manifest.json.
    throw new Error(
      `Não consegui conectar ao backend em ${base}. Confirme que ele está rodando (npm start dentro de backend/) e que a URL está correta no ícone da extensão.`
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson.error || "";
    } catch (_) {
      /* ignore parse errors */
    }
    throw new Error(
      `O backend respondeu com erro ${res.status}. ${detail || "Verifique se o servidor está rodando."}`
    );
  }

  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "FIREEVOLUTION_ANALYZE") {
    callBackend("/analyze", msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // resposta assíncrona
  }

  if (msg?.type === "FIREEVOLUTION_CHAT") {
    callBackend("/chat", msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg?.type === "FIREEVOLUTION_PING") {
    callBackend("/health", null, "GET")
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
