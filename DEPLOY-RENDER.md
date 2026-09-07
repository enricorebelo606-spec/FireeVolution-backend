# 🚀 Deploy do backend no Render (passo a passo com comandos prontos)

Só substitua os textos em MAIÚSCULO pelos seus dados e vá colando os comandos.

## Parte 1 — Subir o backend pro GitHub

1. Crie um repositório vazio em https://github.com/new
   - Nome sugerido: `fireevolution-backend`
   - Não marque nenhuma opção extra (sem README, sem .gitignore, sem license)

2. No terminal, dentro da pasta `backend/`:

```bash
cd backend
git init
git add .
git commit -m "backend inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO-GITHUB/fireevolution-backend.git
git push -u origin main
```

O `.gitignore` já incluído nesta pasta impede que o `.env` (com sua chave
secreta) vá para o GitHub — só o `.env.example` (vazio) é enviado.

Se o GitHub pedir autenticação, use um **token de acesso pessoal** (não a
senha da conta): https://github.com/settings/tokens → "Generate new token
(classic)" → marque o escopo `repo` → use o token como senha quando o git
pedir.

## Parte 2 — Criar o serviço no Render

1. Acesse https://render.com e crie uma conta (pode logar com GitHub)
2. Clique em **New +** → **Web Service**
3. Conecte o repositório `fireevolution-backend`
4. Preencha:
   - **Name**: `fireevolution-backend`
   - **Root Directory**: (deixe vazio)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Em **Environment Variables**, adicione:

| Key | Value |
|---|---|
| `OPENAI_API_KEY` | SUA_CHAVE_REAL_AQUI |
| `FIREEVOLUTION_MODEL` | `gpt-4o` |
| `ALLOWED_ORIGINS` | `*` |

6. Clique em **Create Web Service** e aguarde o deploy (2–5 min, status vira **Live**)
7. Copie a URL mostrada no topo, algo como:
   `https://fireevolution-backend.onrender.com`

## Parte 3 — Apontar a extensão para o backend online

1. No arquivo `extension/manifest.json`, já deixei um placeholder pronto.
   Troque `SEU-BACKEND-AQUI` pelo nome real do seu serviço no Render:

```json
"https://SEU-BACKEND-AQUI.onrender.com/*"
```

   vira, por exemplo:

```json
"https://fireevolution-backend.onrender.com/*"
```

2. Em `chrome://extensions`, clique em **recarregar** na FireeVolution
3. Clique no ícone 🔥 da extensão, cole a URL completa (sem barra no final)
   no campo do backend, ex: `https://fireevolution-backend.onrender.com`
4. Clique em **Salvar**

Pronto — a extensão agora fala com o backend hospedado, sem depender do seu
computador estar ligado.

## Testando

```bash
curl https://SEU-BACKEND-AQUI.onrender.com/health
```

Deve responder `{"ok":true,...}`.

⚠️ **Plano free do Render "dorme"** depois de ~15 min sem uso. A primeira
chamada depois disso demora uns 30–50 segundos para acordar — é normal, não
é erro.
