#!/usr/bin/env bash
# Tribo.ai — Setup automatizado para desenvolvimento local
# Uso: ./setup.sh

set -euo pipefail

cd "$(dirname "$0")"

echo "🧑‍💻 Tribo.ai — Setup de desenvolvimento"
echo ""

# 1. Verifica dependências
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado. Instale Node 20+"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker não encontrado. Instale Docker"; exit 1; }

NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node $NODE_MAJOR é muito antigo. Use Node 20+."
  exit 1
fi

echo "✓ Node $(node --version)"
echo "✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo ""

# 2. Sobe o Postgres
echo "🐘 Subindo Postgres via Docker..."
docker compose up -d postgres
echo ""

# 3. Aguarda o Postgres estar pronto
echo "⏳ Aguardando Postgres ficar pronto..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U tribo -d tribo_ai >/dev/null 2>&1; then
    echo "✓ Postgres pronto"
    break
  fi
  sleep 1
done
echo ""

# 4. Configura .env se não existir
cd web
if [ ! -f .env ]; then
  echo "📄 Criando .env a partir do .env.example..."
  cp .env.example .env
  # Atualiza DATABASE_URL para apontar pro docker
  sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://tribo:tribo_dev@localhost:5433/tribo_ai"|' .env
  rm -f .env.bak
  echo "✓ .env criado"
  echo ""
  echo "⚠️  IMPORTANTE: Edite tribo-ai/web/.env e adicione sua ANTHROPIC_API_KEY"
  echo "    (pegue em https://console.anthropic.com)"
  echo ""
else
  echo "✓ .env já existe"
fi

# 5. Instala dependências
if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências (isso pode demorar alguns minutos)..."
  npm install
else
  echo "✓ node_modules já presente"
fi
echo ""

# 6. Gera Prisma client
echo "⚙️  Gerando Prisma client..."
npx prisma generate

# 7. Cria schema no banco
echo "🗄️  Criando schema no banco..."
npx prisma db push --accept-data-loss

# 8. Roda seed
echo "🌱 Populando dados demo..."
npm run db:seed

echo ""
echo "✅ Setup completo!"
echo ""
echo "Para rodar o app:"
echo "  cd tribo-ai/web && npm run dev"
echo ""
echo "Depois abra:"
echo "  http://localhost:3000/feed         (timeline)"
echo "  http://localhost:3000/assistente   (chatbot de RH — precisa ANTHROPIC_API_KEY)"
echo "  http://localhost:3000/ponto        (ausências)"
echo "  http://localhost:3000/onboarding   (fluxo de anamnese)"
echo ""
echo "Para parar o Postgres depois:"
echo "  cd tribo-ai && docker compose down"
