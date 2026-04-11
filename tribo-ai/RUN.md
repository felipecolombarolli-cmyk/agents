# Como rodar o Tribo.ai localmente

Guia passo a passo para subir o MVP em ambiente de desenvolvimento.

> **Status**: ✅ Build validado + rotas testadas (feed, ponto, onboarding, assistente retornam 200).

## Pré-requisitos

- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Docker** (para o Postgres) OU Postgres nativo instalado
- Chave da **Anthropic API** ([console.anthropic.com](https://console.anthropic.com)) — opcional, só necessária pro chatbot

## Caminho 1 — Setup automatizado (1 comando)

```bash
cd tribo-ai
./setup.sh
```

O script:
1. Sobe Postgres via Docker
2. Cria `.env` com defaults
3. Instala dependências
4. Gera Prisma client
5. Cria schema no banco
6. Popula dados demo (1 tenant, 4 usuários, posts, kudos, ausências)

Depois:

```bash
cd web
npm run dev
```

Abra http://localhost:3000.

## Caminho 2 — Setup manual (se o script falhar)

### 1. Subir Postgres

**Via Docker Compose:**
```bash
cd tribo-ai
docker compose up -d postgres
```

**Ou via Postgres nativo (Linux):**
```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER tribo WITH PASSWORD 'tribo_dev';"
sudo -u postgres psql -c "CREATE DATABASE tribo_ai OWNER tribo;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tribo_ai TO tribo;"
```

### 2. Configurar variáveis de ambiente

```bash
cd tribo-ai/web
cp .env.example .env
```

Edite `.env`:
```bash
# Se usou docker-compose (porta 5433):
DATABASE_URL="postgresql://tribo:tribo_dev@localhost:5433/tribo_ai"

# Se usou Postgres nativo (porta 5432):
DATABASE_URL="postgresql://tribo:tribo_dev@localhost:5432/tribo_ai"

# Para o chatbot funcionar:
ANTHROPIC_API_KEY="sk-ant-..."

# Qualquer string longa (não precisa ser real em dev):
NEXTAUTH_SECRET="dev-secret-change-in-prod"
```

### 3. Instalar, criar schema e popular dados

```bash
cd tribo-ai/web
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Rodar o app

```bash
npm run dev
```

## O que testar

Abra http://localhost:3000 e navegue:

| Rota | O que funciona |
|---|---|
| `/feed` | ✅ Lista posts reais do banco, cria novo post via form, curtir/descurtir |
| `/ponto` | ✅ Mostra ausências reais do dia (Paula Mendes em home office) |
| `/onboarding` | ✅ UI interativa das 10 perguntas da anamnese |
| `/assistente` | ✅ Chatbot com streaming (precisa `ANTHROPIC_API_KEY`) |

### Testar o chatbot

Na `/assistente`, tente perguntas como:
- "Quando tenho direito a férias?"
- "Como calcular 13º proporcional?"
- "Quantos dias de licença-paternidade?"
- "Posso fazer home office nas sextas?"

A resposta vem em streaming (palavra por palavra), com contexto da "Acme Brasil" injetado (setor tech, CCT SINDPD, valores Colaboração/Inovação/Respeito/Excelência).

### Testar a importação de ponto

```bash
# Criar CSV de teste
cat > /tmp/ponto-teste.csv <<EOF
E-mail,Data,Status,Horas Trabalhadas
marina@acme.com.br,15/04/2026,Férias,
joao@acme.com.br,15/04/2026,Presente,08:30
paula@acme.com.br,15/04/2026,Home Office,07:45
EOF

# Enviar para o endpoint
curl -X POST http://localhost:3000/api/ponto/import \
  -F "file=@/tmp/ponto-teste.csv" \
  -F "format=tangerino"
```

Resposta esperada: JSON com `summary.successRows: 3` e preview dos registros parseados.

## Login / Auth

**Em dev, auth é mockado**: você está automaticamente logado como `demo@tribo.ai` (usuário "Você (Demo)", owner do tenant "Acme Brasil"). Nenhuma tela de login no MVP.

Para trocar o usuário "logado" temporariamente, edite `web/lib/auth.ts` e mude a constante `DEMO_USER_EMAIL` para outro email do seed (`marina@acme.com.br`, `joao@acme.com.br` ou `paula@acme.com.br`).

## Troubleshooting

### "Nenhum tenant demo encontrado"
Você esqueceu de rodar o seed:
```bash
cd tribo-ai/web && npm run db:seed
```

### "Can't reach database server"
Postgres não está rodando:
```bash
# Docker:
cd tribo-ai && docker compose up -d postgres
# Nativo:
sudo service postgresql start
```

### Chatbot retorna erro
Verifique que `ANTHROPIC_API_KEY` está no `.env`. Sem a chave, a API `/api/chat/stream` retorna erro mas as outras rotas funcionam.

### Porta 3000 ocupada
```bash
npm run dev -- -p 4000
```

## Parar tudo

```bash
# Parar o Next (Ctrl+C no terminal onde rodou npm run dev)

# Parar o Postgres:
cd tribo-ai && docker compose down
# ou
sudo service postgresql stop
```

## Estado atual do MVP

| Feature | Status |
|---|---|
| Schema Prisma multi-tenant | ✅ |
| Seed de dados demo | ✅ |
| Auth mock (dev) | ✅ |
| Feed (listar + postar + curtir) | ✅ |
| Ponto (dashboard ausências) | ✅ |
| Anamnese (UI) | ✅ |
| Anamnese (persistência) | ✅ |
| Chatbot RH (streaming) | ✅ |
| Parsers de ponto (API) | ✅ |
| Kudos UI | ❌ pendente |
| Pesquisas UI | ❌ pendente |
| Admin dashboard | ❌ pendente |
| Comentários em posts | ❌ pendente |
| Auth real (NextAuth) | ❌ pendente (está mockado) |

## Próximos passos sugeridos

1. Criar UI de kudos (`/reconhecimento`)
2. Criar UI de pesquisas (`/pesquisas`)
3. Criar dashboard admin (`/admin`)
4. Trocar auth mock por NextAuth + magic link via Resend
5. Implementar RAG para políticas internas do tenant no chatbot
6. Adicionar prompt caching no cliente Claude para reduzir custo
