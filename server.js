require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'fireevolution-backend', model: 'gpt-4o-mini' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, prompt } = req.body;
    const userContent = message || prompt;

    if (!userContent) {
      return res.status(400).json({ error: 'Nenhuma mensagem enviada.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave OPENAI_API_KEY não configurada no servidor.' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente útil e preciso.' },
          { role: 'user', content: userContent }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API da OpenAI' });
    }

    const aiMessage = data.choices[0].message.content;
    return res.json({ response: aiMessage, reply: aiMessage });

  } catch (error) {
    console.error('Erro no servidor:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

