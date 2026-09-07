# 🔥 FireeVolution 2.8

Analista de vídeos com IA para **YouTube, TikTok e Instagram**. A FireeVolution
mostra uma bolinha flutuante 🔥 nesses sites; ao clicar nela, abre um chat que
analisa o vídeo em reprodução (ou um vídeo enviado manualmente) e explica por
que ele viralizou, com nota, diagnóstico, sugestões de título, ideia de
thumbnail, momentos-chave e pontos fracos.

A FireeVolution é um produto independente. **Não depende do ChatGPT** e não é
uma extensão do ChatGPT.

```
FireeVolution-2.8/
│
├── extension/          → a extensão Chrome (Manifest V3)
│   ├── manifest.json
│   ├── background.js   → único ponto que fala com o backend
│   ├── content.js      → bolinha flutuante + chat
│   ├── style.css
│   ├── popup.html / popup.js → configurar a URL do backend
│   └── icons/
│
├── backend/             → servidor que guarda a chave de IA
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── README.md
```

## Arquitetura e segurança

```
Extensão FireeVolution → Backend → IA → Backend → FireeVolution
```

A chave da API de IA **nunca** fica na extensão. Ela vive só no backend, lida
de uma variável de ambiente (`OPENAI_API_KEY`). A extensão só sabe o
endereço do backend (configurável no popup, padrão `http://localhost:3000`).

A extensão só pede a permissão `storage` (para lembrar a posição da bolinha e
a URL do backend) e só roda em YouTube, TikTok e Instagram — em nenhum outro
site, inclusive o próprio ChatGPT ou o Google.

## 1. Rodando o backend

```bash
cd backend
cp .env.example .env
# edite o .env e coloque sua OPENAI_API_KEY
npm install
npm start
```

O servidor sobe em `http://localhost:3000` por padrão (ajustável via `PORT`
no `.env`). Ele expõe três rotas:

- `GET /health` — checagem simples.
- `POST /analyze` — recebe os frames do vídeo e devolve a análise estruturada.
- `POST /chat` — continuação da conversa usando a análise como contexto.

> O modelo padrão é `gpt-4o` (variável `FIREEVOLUTION_MODEL`). Troque
> se quiser usar outro modelo com suporte a imagens.

Se você for hospedar o backend em outro domínio (não `localhost`), adicione
esse domínio em `extension/manifest.json`, dentro de `host_permissions`, e
recarregue a extensão.

## 2. Instalando a extensão no Chrome

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/` (não o `.zip` inteiro — se você extraiu o
   zip, aponte para a subpasta `FireeVolution-2.8/extension`)
5. Clique no ícone 🔥 da extensão na barra do Chrome e confirme/edite a URL
   do backend (padrão `http://localhost:3000`)
6. Abra o YouTube, o TikTok ou o Instagram — a bolinha 🔥 deve aparecer

## 3. Usando

1. Clique na bolinha 🔥 para abrir o chat
2. Clique em **🎯 Detectar vídeo da página** para tentar capturar
   automaticamente o vídeo em reprodução
   - Se o site bloquear a captura automática (comum em players que carregam
     vídeo de outra origem), a FireeVolution avisa honestamente e oferece
     **📁 Enviar vídeo manualmente**
3. Clique em **🔥 Analisar vídeo**
4. Veja a nota de potencial de viralização, os subscores (Hook, Retenção,
   Ritmo, Edição, CTA), o diagnóstico, como reproduzir o resultado, sugestões
   de título, ideia de thumbnail, momentos importantes e pontos fracos
5. Continue perguntando no campo de texto — o contexto da análise é mantido
   durante a conversa

## Sobre a captura automática de vídeo

Navegadores impedem, por segurança (CORS), que uma página capture pixels de
um vídeo que vem de outra origem sem autorização explícita do servidor de
vídeo. Isso é comum em players do YouTube, TikTok e Instagram. Por isso, a
FireeVolution **tenta** capturar automaticamente e, se não conseguir, não
finge sucesso — ela mostra a opção de envio manual, que sempre funciona
porque o arquivo enviado é local (sem restrição de origem).

## Licença

Uso livre para fins pessoais/educacionais. Ajuste conforme sua necessidade.
