// FireeVolution 2.9 — backend/server.js
//
// Arquitetura:
//   Extensão FireeVolution -> Backend (este arquivo) -> IA (Groq) -> Backend -> Extensão
//
// A chave de IA (GROQ_API_KEY) SÓ existe aqui, lida de variável de
// ambiente. Ela nunca é enviada para a extensão nem exposta no navegador.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
  })
);

app.use(express.json({ limit: "8mb" }));

// Se o corpo da requisição for grande demais, devolve uma mensagem clara em
// JSON em vez do erro cru (o Express, por padrão, responderia com HTML).
// Fica DEPOIS do cors() para que a resposta de erro também tenha os
// cabeçalhos de CORS — senão o navegador bloqueia a leitura da resposta.
app.use((err, _req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      error:
        "O vídeo/frames enviados são grandes demais para o backend. Tente novamente — a extensão já reduz automaticamente o tamanho.",
    });
  }
  next(err);
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.FIREEVOLUTION_MODEL || "qwen/qwen3.6-27b";
const PORT = process.env.PORT || 3000;

if (!GROQ_API_KEY) {
  console.warn(
    "\n⚠️  GROQ_API_KEY não encontrada. Copie backend/.env.example para backend/.env e preencha a chave.\n"
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

// ---------- util: chamada à API da Groq ----------
// Endpoint compatível com o formato da OpenAI: https://api.groq.com/openai/v1/chat/completions
// O modelo qwen/qwen3.6-27b suporta visão (imagens) e modo JSON nativo.

async function callGroq(messages, { maxTokens = 1800, jsonMode = false } = {}) {
  const body = {
    model: MODEL,
    max_completion_tokens: maxTokens,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro da API de IA (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
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
  if (!/^data:image\/\w+;base64,/.test(dataUrl || "")) return null;
  return {
    type: "image_url",
    image_url: { url: dataUrl },
  };
}

// ---------- rotas ----------

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "fireevolution-backend",
    message: "FireeVolution backend está no ar. Use /health, /analyze ou /chat.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fireevolution-backend", model: MODEL });
});

// Análise inicial de um vídeo (a partir de frames capturados no navegador)
app.post("/analyze", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "Backend sem GROQ_API_KEY configurada." });
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

    const rawReply = await callGroq([{ role: "user", content: userContent }], {
      maxTokens: 2000,
      jsonMode: true,
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
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "Backend sem GROQ_API_KEY configurada." });
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

    const reply = await callGroq(messages, { maxTokens: 800 });

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

// Qualquer rota não reconhecida cai aqui, com uma mensagem clara em JSON
// (em vez do "Cannot GET /xxx" padrão do Express, que é texto puro).
app.use((req, res) => {
  res.status(404).json({
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}. Rotas disponíveis: /health, /analyze, /chat.`,
  });
});

app.listen(PORT, () => {
  console.log(`🔥 FireeVolution backend rodando em http://localhost:${PORT}`);
});
