#!/bin/bash
set -e

echo "🚀 Iniciando deploy do Mind-Menu..."

# Build local para validar
echo "🔨 Fazendo build local..."
docker compose build

# Deploy do Admin
echo "📦 Deployando mindmenu-admin..."
cd mindmenu-admin
railway up
railway service link mindmenu-admin
railway variables set GOOGLE_CLIENT_ID="1057140037440-p09e6cuff3o8llet7b4cte5pfbnocdto.apps.googleusercontent.com"
railway variables set GOOGLE_CLIENT_SECRET="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"
cd ..

# Deploy do Restaurant Service
echo "📦 Deployando restaurant-service..."
cd restaurant-service
railway up
railway service link restaurant-service
railway variables set DATABASE_URL="postgresql://${PGUSER}:${POSTGRES_PASSWORD}@${RAILWAY_PRIVATE_DOMAIN}:5432/${PGDATABASE}"
cd ..

echo "✅ Deploy concluído!"
echo "Teste as URLs públicas:"
echo " - https://mindmenu-admin.up.railway.app/"
echo " - https://restaurant-service.up.railway.app/"
