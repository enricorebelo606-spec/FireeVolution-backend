// FireeVolution 2.5 — backend/server.js
//
// Arquitetura:
//   Extensão FireeVolution -> Backend (este arquivo) -> IA -> Backend -> Extensão
//
// A chave de IA (ANTHROPIC_API_KEY) SÓ existe aqui, lida de variável de
// ambiente. Ela nunca é enviada para a extensão nem exposta no navegador.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "30mb" }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
  })
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.FIREEVOLUTION_MODEL || "claude-sonnet-5";
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "\n⚠️  ANTHROPIC_API_KEY não encontrada. Copie backend/.env.example para backend/.env e preencha a chave.\n"
  );
}

const SYSTEM_PROMPT = `
Você é a FireeVolution, uma IA especialista em analisar vídeos de redes sociais
(YouTube, TikTok, Instagram) e explicar por que eles viralizam ou não.

Sempre analise considerando: Hook, Retenção, Ritmo, Edição, Curiosidade,
Entretenimento, Clareza, CTA, Formato para redes sociais e Potencial de
compartilhamento.

Seja direto, prático e didático. Nunca invente detalhes específicos do vídeo
que você não conseguiu observar nas imagens fornecidas — nesses casos, fale
em termos gerais e deixe claro que é uma estimativa.
`.trim();

// ---------- util: chamada à API da Anthropic ----------

async function callAnthropic(messages, { maxTokens = 1800 } = {}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro da API de IA (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

function stripJsonFences(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
}

function dataUrlToImageBlock(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: match[1],
      data: match[2],
    },
  };
}

// ---------- rotas ----------

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fireevolution-backend", model: MODEL });
});

// Análise inicial de um vídeo (a partir de frames capturados no navegador)
app.post("/analyze", async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Backend sem ANTHROPIC_API_KEY configurada." });
    }

    const { site, videoMeta, frames, frameLabels } = req.body || {};

    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: "Nenhum frame de vídeo foi enviado." });
    }

    const imageBlocks = [];
    frames.forEach((dataUrl, i) => {
      const block = dataUrlToImageBlock(dataUrl);
      if (block) {
        imageBlocks.push({ type: "text", text: `Momento: ${frameLabels?.[i] || i + 1}` });
        imageBlocks.push(block);
      }
    });

    const instructions = `
Analise este vídeo de ${site || "uma rede social"} a partir dos frames abaixo
(título/arquivo: "${videoMeta?.title || "desconhecido"}", duração aproximada:
${videoMeta?.duration ? Math.round(videoMeta.duration) + "s" : "desconhecida"}).

Responda SOMENTE com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:

{
  "notaGeral": <número de 0 a 100>,
  "subscores": {
    "hook": <0-10>,
    "retencao": <0-10>,
    "ritmo": <0-10>,
    "edicao": <0-10>,
    "cta": <0-10>
  },
  "diagnostico": "<explicação simples de por que o vídeo viralizou ou não>",
  "comoReproduzir": "<sugestões práticas para o usuário criar vídeos parecidos, sem copiar o conteúdo original>",
  "titulos": ["<sugestão 1>", "<sugestão 2>", "<sugestão 3>"],
  "thumbnail": "<ideia de thumbnail baseada no conteúdo>",
  "momentosImportantes": [{"momento": "<ex: 0-3s>", "motivo": "<por que é importante>"}],
  "pontosFracos": [{"problema": "<parte que pode perder o espectador>", "comoMelhorar": "<sugestão>"}]
}
    `.trim();

    const userContent = [{ type: "text", text: instructions }, ...imageBlocks];

    const rawReply = await callAnthropic([{ role: "user", content: userContent }], {
      maxTokens: 2000,
    });

    let analysis;
    try {
      analysis = JSON.parse(stripJsonFences(rawReply));
    } catch (parseErr) {
      return res.status(502).json({
        error: "A IA respondeu em um formato inesperado. Tente analisar novamente.",
      });
    }

    // Histórico inicial do chat contínuo, para as próximas perguntas do usuário.
    const history = [
      { role: "user", content: instructions + " [imagens do vídeo enviadas]" },
      { role: "assistant", content: rawReply },
    ];

    res.json({ analysis, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro interno ao analisar o vídeo." });
  }
});

// Continuação do chat, usando a análise já feita como contexto
app.post("/chat", async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Backend sem ANTHROPIC_API_KEY configurada." });
    }

    const { message, analysis, videoMeta, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensagem vazia." });
    }

    const contextNote = analysis
      ? `Contexto: você já analisou o vídeo "${videoMeta?.title || "sem título"}" e chegou a este resultado em JSON: ${JSON.stringify(
          analysis
        )}. Use esse contexto para responder à pergunta do usuário sobre esse vídeo, de forma direta e específica.`
      : `O usuário ainda não enviou nenhum vídeo para análise. Se a pergunta depender de um vídeo específico, peça para ele detectar ou enviar um vídeo primeiro.`;

    const priorHistory = Array.isArray(history) ? history.slice(-10) : [];

    const messages = [
      { role: "user", content: contextNote },
      { role: "assistant", content: "Entendido, estou pronta para responder sobre esse vídeo." },
      ...priorHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const reply = await callAnthropic(messages, { maxTokens: 800 });

    const newHistory = [
      ...priorHistory,
      { role: "user", content: message },
      { role: "assistant", content: reply },
    ].slice(-20);

    res.json({ reply, history: newHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro interno no chat." });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 FireeVolution backend rodando em http://localhost:${PORT}`);
});
