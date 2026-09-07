// FireeVolution 2.8 — content.js
// Injeta a bolinha flutuante 🔥 e o chat de análise de vídeos em
// YouTube, TikTok e Instagram (o manifest já restringe os sites via matches).

(function () {
  "use strict";

  if (window.__fireevolutionInjected) return;
  window.__fireevolutionInjected = true;

  const SITE = detectSite();

  const state = {
    open: false,
    frames: [], // [{dataUrl, label}]
    videoMeta: null, // {title, duration, source}
    analysis: null, // último resultado estruturado
    history: [], // [{role, content}] para o chat contínuo
    busy: false,
  };

  function detectSite() {
    const h = location.hostname;
    if (h.includes("youtube.com")) return "YouTube";
    if (h.includes("tiktok.com")) return "TikTok";
    if (h.includes("instagram.com")) return "Instagram";
    return null;
  }

  if (!SITE) return; // segurança extra, além do manifest

  // ---------- BOLINHA FLUTUANTE ----------

  const bubble = document.createElement("div");
  bubble.id = "fireevolution-bubble";
  bubble.innerHTML = `<span class="fe-bubble-emoji">🔥</span>`;
  document.documentElement.appendChild(bubble);

  restoreBubblePosition();
  makeDraggable(bubble);

  bubble.addEventListener("click", (e) => {
    if (bubble.dataset.dragged === "1") {
      bubble.dataset.dragged = "0";
      return;
    }
    togglePanel();
  });

  function restoreBubblePosition() {
    chrome.storage.local.get(["fe_bubble_pos"], (res) => {
      const pos = res.fe_bubble_pos;
      if (pos && typeof pos.top === "number" && typeof pos.left === "number") {
        bubble.style.top = pos.top + "px";
        bubble.style.left = pos.left + "px";
        bubble.style.right = "auto";
        bubble.style.bottom = "auto";
      }
    });
  }

  function makeDraggable(el) {
    let startX, startY, origTop, origLeft, dragging = false;

    el.addEventListener("mousedown", (e) => {
      dragging = true;
      bubble.dataset.dragged = "0";
      const rect = el.getBoundingClientRect();
      origTop = rect.top;
      origLeft = rect.left;
      startX = e.clientX;
      startY = e.clientY;
      el.classList.add("fe-dragging");
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        bubble.dataset.dragged = "1";
      }
      const newTop = Math.min(
        window.innerHeight - el.offsetHeight - 4,
        Math.max(4, origTop + dy)
      );
      const newLeft = Math.min(
        window.innerWidth - el.offsetWidth - 4,
        Math.max(4, origLeft + dx)
      );
      el.style.top = newTop + "px";
      el.style.left = newLeft + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("fe-dragging");
      const rect = el.getBoundingClientRect();
      chrome.storage.local.set({
        fe_bubble_pos: { top: rect.top, left: rect.left },
      });
    });
  }

  // ---------- PAINEL / CHAT ----------

  const panel = document.createElement("div");
  panel.id = "fireevolution-panel";
  panel.innerHTML = `
    <div class="fe-header">
      <div class="fe-header-title"><span>🔥</span> FireeVolution</div>
      <button class="fe-close" title="Fechar">✕</button>
    </div>
    <div class="fe-messages" id="fe-messages"></div>
    <div class="fe-video-controls" id="fe-video-controls">
      <button id="fe-detect-btn" class="fe-btn fe-btn-secondary">🎯 Detectar vídeo da página</button>
      <label class="fe-btn fe-btn-secondary" id="fe-manual-label">
        📁 Enviar vídeo manualmente
        <input type="file" id="fe-file-input" accept="video/*" hidden />
      </label>
    </div>
    <div class="fe-analyze-row" id="fe-analyze-row" style="display:none;">
      <button id="fe-analyze-btn" class="fe-btn fe-btn-primary">🔥 Analisar vídeo</button>
    </div>
    <div class="fe-input-row">
      <input type="text" id="fe-text-input" placeholder="Pergunte algo sobre o vídeo..." />
      <button id="fe-send-btn" class="fe-btn fe-btn-primary">Enviar</button>
    </div>
  `;
  document.documentElement.appendChild(panel);

  panel.querySelector(".fe-close").addEventListener("click", togglePanel);

  const messagesEl = panel.querySelector("#fe-messages");
  const detectBtn = panel.querySelector("#fe-detect-btn");
  const fileInput = panel.querySelector("#fe-file-input");
  const analyzeRow = panel.querySelector("#fe-analyze-row");
  const analyzeBtn = panel.querySelector("#fe-analyze-btn");
  const textInput = panel.querySelector("#fe-text-input");
  const sendBtn = panel.querySelector("#fe-send-btn");

  addBotMessage(
    `Oi! Eu sou a FireeVolution 🔥. Detecto o vídeo do ${SITE} e explico por que ele viraliza (ou não). ` +
      `Escolha uma opção abaixo para começar, ou me envie um vídeo manualmente.`
  );

  detectBtn.addEventListener("click", handleDetectClick);
  fileInput.addEventListener("change", handleManualUpload);
  analyzeBtn.addEventListener("click", handleAnalyzeClick);
  sendBtn.addEventListener("click", handleSend);
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  function togglePanel() {
    state.open = !state.open;
    panel.classList.toggle("fe-open", state.open);
  }

  function addBotMessage(html) {
    const div = document.createElement("div");
    div.className = "fe-msg fe-msg-bot";
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "fe-msg fe-msg-user";
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "fe-msg fe-msg-bot fe-typing";
    div.id = "fe-typing";
    div.innerHTML = `<span></span><span></span><span></span>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("fe-typing");
    if (el) el.remove();
  }

  // ---------- DETECÇÃO AUTOMÁTICA DE VÍDEO ----------

  function findMainVideoElement() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;
    // pega o maior vídeo visível na tela (heurística simples e honesta)
    videos.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return videos[0];
  }

  async function captureFramesFromVideoElement(videoEl) {
    // Tenta capturar frames reais. Se o vídeo for de outra origem
    // (o caso comum em YouTube/TikTok/Instagram), o canvas fica "tainted"
    // e toDataURL lança SecurityError — nesse caso NÃO fingimos sucesso.
    if (!videoEl || !videoEl.duration || isNaN(videoEl.duration)) {
      throw new Error("Não foi possível ler a duração do vídeo.");
    }

    const duration = videoEl.duration;
    const fractions = [0.02, 0.33, 0.66, 0.95];
    const labels = ["Começo", "Desenvolvimento (33%)", "Desenvolvimento (66%)", "Final"];
    const frames = [];

    const canvas = document.createElement("canvas");
    const maxW = 320; // reduzido para manter o payload leve (evita erro 413 no backend)
    const scale = Math.min(1, maxW / (videoEl.videoWidth || maxW));
    canvas.width = Math.max(1, Math.round((videoEl.videoWidth || maxW) * scale));
    canvas.height = Math.max(1, Math.round((videoEl.videoHeight || 180) * scale));
    const ctx = canvas.getContext("2d");

    const wasPaused = videoEl.paused;
    const originalTime = videoEl.currentTime;

    for (let i = 0; i < fractions.length; i++) {
      const t = Math.min(duration - 0.05, Math.max(0, duration * fractions[i]));
      await seekTo(videoEl, t);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      // Isso lança SecurityError se a fonte do vídeo for cross-origin sem CORS.
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      frames.push({ dataUrl, label: labels[i] });
    }

    try {
      videoEl.currentTime = originalTime;
      if (wasPaused) videoEl.pause();
    } catch (_) {
      /* melhor esforço, não é crítico */
    }

    return frames;
  }

  function seekTo(videoEl, time) {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        videoEl.removeEventListener("seeked", onSeeked);
        resolve();
      };
      videoEl.addEventListener("seeked", onSeeked);
      try {
        videoEl.currentTime = time;
      } catch (err) {
        videoEl.removeEventListener("seeked", onSeeked);
        reject(err);
      }
      // timeout de segurança caso "seeked" nunca dispare
      setTimeout(resolve, 1500);
    });
  }

  async function handleDetectClick() {
    const videoEl = findMainVideoElement();
    if (!videoEl) {
      addBotMessage(
        "Não encontrei nenhum vídeo tocando nesta página agora. Dê play no vídeo e tente de novo, ou envie um arquivo manualmente com 📁."
      );
      return;
    }

    addBotMessage("Tentando capturar frames do vídeo da página...");

    try {
      const frames = await captureFramesFromVideoElement(videoEl);
      state.frames = frames;
      state.videoMeta = {
        title: document.title,
        duration: videoEl.duration,
        source: SITE,
        origem: "automática",
      };
      showFramePreview(frames);
      addBotMessage(
        `Consegui capturar ${frames.length} momentos do vídeo (${SITE}). Quando quiser, clique em 🔥 Analisar vídeo.`
      );
      analyzeRow.style.display = "flex";
    } catch (err) {
      // Falha honesta: não fingimos que capturamos o vídeo.
      addBotMessage(
        `Não consegui capturar automaticamente este vídeo (o ${SITE} protege o conteúdo do player contra captura via navegador). ` +
          `Use a opção <strong>📁 Enviar vídeo manualmente</strong> abaixo para analisar um arquivo salvo no seu dispositivo.`
      );
    }
  }

  function handleManualUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.src = url;
    videoEl.muted = true;
    videoEl.preload = "auto";
    videoEl.style.display = "none";
    document.body.appendChild(videoEl);

    addBotMessage(`Carregando "${escapeHtml(file.name)}" para análise...`);

    videoEl.addEventListener("loadedmetadata", async () => {
      try {
        const frames = await captureFramesFromVideoElement(videoEl);
        state.frames = frames;
        state.videoMeta = {
          title: file.name,
          duration: videoEl.duration,
          source: SITE,
          origem: "upload manual",
        };
        showFramePreview(frames);
        addBotMessage(
          `Vídeo carregado! Capturei ${frames.length} momentos. Clique em 🔥 Analisar vídeo quando quiser.`
        );
        analyzeRow.style.display = "flex";
      } catch (err) {
        addBotMessage(
          "Não consegui extrair frames deste arquivo. Tente outro formato de vídeo (mp4/webm costuma funcionar melhor)."
        );
      } finally {
        URL.revokeObjectURL(url);
        videoEl.remove();
      }
    });

    videoEl.addEventListener("error", () => {
      addBotMessage("Não consegui abrir esse arquivo de vídeo. Tente outro formato (mp4, webm).");
      URL.revokeObjectURL(url);
      videoEl.remove();
    });
  }

  function showFramePreview(frames) {
    const wrap = document.createElement("div");
    wrap.className = "fe-frame-preview";
    frames.forEach((f) => {
      const img = document.createElement("img");
      img.src = f.dataUrl;
      img.title = f.label;
      wrap.appendChild(img);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- ANÁLISE ----------

  // ---------- SEGURANÇA CONTRA PAYLOAD GRANDE DEMAIS (erro 413) ----------

  function estimateBase64Bytes(dataUrl) {
    const commaIdx = dataUrl.indexOf(",");
    const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    return Math.ceil((b64.length * 3) / 4);
  }

  function shrinkDataUrl(dataUrl, maxW, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Falha ao reprocessar frame."));
      img.src = dataUrl;
    });
  }

  // Garante que o total de imagens enviado fique bem abaixo de qualquer
  // limite de tamanho de requisição (ex.: o 413 do Render). Primeiro tenta
  // comprimir mais; se ainda não for suficiente, reduz a quantidade de frames.
  async function ensurePayloadWithinLimit(frames, maxTotalBytes = 500 * 1024) {
    let working = frames.slice();
    const totalOf = (list) => list.reduce((sum, f) => sum + estimateBase64Bytes(f.dataUrl), 0);

    if (totalOf(working) > maxTotalBytes) {
      const shrunk = [];
      for (const f of working) {
        try {
          const dataUrl = await shrinkDataUrl(f.dataUrl, 220, 0.35);
          shrunk.push({ ...f, dataUrl });
        } catch (_) {
          shrunk.push(f); // se falhar, mantém o original
        }
      }
      working = shrunk;
    }

    while (totalOf(working) > maxTotalBytes && working.length > 2) {
      working.splice(1, 1); // remove um frame do meio, preservando começo e fim
    }

    return working;
  }

  async function handleAnalyzeClick() {
    if (state.busy) return;
    if (!state.frames.length) {
      addBotMessage("Ainda não tenho nenhum vídeo capturado. Detecte ou envie um vídeo primeiro.");
      return;
    }

    state.busy = true;
    analyzeBtn.disabled = true;
    addTypingIndicator();

    const safeFrames = await ensurePayloadWithinLimit(state.frames);

    chrome.runtime.sendMessage(
      {
        type: "FIREEVOLUTION_ANALYZE",
        payload: {
          site: SITE,
          videoMeta: state.videoMeta,
          frames: safeFrames.map((f) => f.dataUrl),
          frameLabels: safeFrames.map((f) => f.label),
        },
      },
      (response) => {
        state.busy = false;
        analyzeBtn.disabled = false;
        removeTypingIndicator();

        if (chrome.runtime.lastError) {
          addBotMessage(
            "Não consegui falar com o backend da FireeVolution. Verifique se o servidor está rodando e se a URL está configurada no ícone da extensão."
          );
          return;
        }

        if (!response || !response.ok) {
          addBotMessage(
            `Ocorreu um erro ao analisar o vídeo: ${escapeHtml(response?.error || "erro desconhecido")}.`
          );
          return;
        }

        state.analysis = response.data.analysis;
        state.history = response.data.history || [];
        renderAnalysis(state.analysis);
      }
    );
  }

  function scoreBar(label, value) {
    const pct = Math.max(0, Math.min(10, value)) * 10;
    return `
      <div class="fe-score-row">
        <span class="fe-score-label">${escapeHtml(label)}</span>
        <div class="fe-score-track"><div class="fe-score-fill" style="width:${pct}%"></div></div>
        <span class="fe-score-value">${value}/10</span>
      </div>`;
  }

  function renderAnalysis(a) {
    const scores = a.subscores || {};
    const titles = (a.titulos || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
    const moments = (a.momentosImportantes || [])
      .map((m) => `<li><strong>${escapeHtml(m.momento || "")}:</strong> ${escapeHtml(m.motivo || "")}</li>`)
      .join("");
    const weaknesses = (a.pontosFracos || [])
      .map((w) => `<li><strong>${escapeHtml(w.problema || "")}:</strong> ${escapeHtml(w.comoMelhorar || "")}</li>`)
      .join("");

    const html = `
      <div class="fe-analysis-card">
        <div class="fe-score-main">🔥 Potencial de viralização: <strong>${a.notaGeral ?? "?"}/100</strong></div>
        ${scoreBar("Hook", scores.hook ?? 0)}
        ${scoreBar("Retenção", scores.retencao ?? 0)}
        ${scoreBar("Ritmo", scores.ritmo ?? 0)}
        ${scoreBar("Edição", scores.edicao ?? 0)}
        ${scoreBar("CTA", scores.cta ?? 0)}

        <h4>🎯 Por que viralizou?</h4>
        <p>${escapeHtml(a.diagnostico || "")}</p>

        <h4>🚀 Como fazer algo parecido</h4>
        <p>${escapeHtml(a.comoReproduzir || "")}</p>

        <h4>💡 Sugestões de título</h4>
        <ul>${titles || "<li>—</li>"}</ul>

        <h4>🖼️ Ideia de thumbnail</h4>
        <p>${escapeHtml(a.thumbnail || "")}</p>

        <h4>⚡ Momentos importantes</h4>
        <ul>${moments || "<li>—</li>"}</ul>

        <h4>❌ Pontos fracos</h4>
        <ul>${weaknesses || "<li>—</li>"}</ul>
      </div>
    `;
    addBotMessage(html);
    addBotMessage("Pode continuar perguntando sobre esse vídeo — eu mantenho o contexto da análise. 🔥");
  }

  // ---------- CHAT CONTÍNUO ----------

  function handleSend() {
    const text = textInput.value.trim();
    if (!text || state.busy) return;
    textInput.value = "";
    addUserMessage(text);

    state.busy = true;
    sendBtn.disabled = true;
    addTypingIndicator();

    chrome.runtime.sendMessage(
      {
        type: "FIREEVOLUTION_CHAT",
        payload: {
          message: text,
          analysis: state.analysis,
          videoMeta: state.videoMeta,
          history: state.history,
        },
      },
      (response) => {
        state.busy = false;
        sendBtn.disabled = false;
        removeTypingIndicator();

        if (chrome.runtime.lastError || !response || !response.ok) {
          addBotMessage(
            `Não consegui responder agora: ${escapeHtml(
              response?.error || chrome.runtime.lastError?.message || "erro desconhecido"
            )}`
          );
          return;
        }

        state.history = response.data.history || state.history;
        addBotMessage(escapeHtml(response.data.reply).replace(/\n/g, "<br>"));
      }
    );
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }
})();
