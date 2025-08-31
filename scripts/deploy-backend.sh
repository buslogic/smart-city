#!/bin/bash

# Smart City Backend Deployment Script
# Za DigitalOcean App Platform

set -e

echo "🚀 Smart City Backend Deployment"
echo "================================"

# Boje za output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Proveri da li je doctl instaliran
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl nije instaliran. Instaliraj sa: https://docs.digitalocean.com/reference/doctl/how-to/install/${NC}"
    exit 1
fi

# Proveri environment
if [ "$1" != "production" ] && [ "$1" != "staging" ]; then
    echo -e "${YELLOW}Upotreba: ./deploy-backend.sh [production|staging]${NC}"
    exit 1
fi

ENVIRONMENT=$1
echo -e "${GREEN}📦 Deploying to: $ENVIRONMENT${NC}"

# Učitaj environment varijable
if [ "$ENVIRONMENT" == "production" ]; then
    ENV_FILE="apps/backend/.env.production"
    APP_NAME="smart-city-backend"
    DOMAIN="api.smart-city.rs"
else
    ENV_FILE="apps/backend/.env.staging"
    APP_NAME="smart-city-backend-staging"
    DOMAIN="api-staging.smart-city.rs"
fi

# Proveri da li postoji env fajl
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment fajl ne postoji: $ENV_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment fajl pronađen${NC}"

# Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t smart-city-backend:latest -f apps/backend/Dockerfile .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image uspešno kreiran${NC}"
else
    echo -e "${RED}❌ Greška pri kreiranju Docker image${NC}"
    exit 1
fi

# Tag i push na DigitalOcean registry
echo -e "${YELLOW}📤 Pushing to DigitalOcean Container Registry...${NC}"

# Login na registry
doctl registry login

# Tag image
docker tag smart-city-backend:latest registry.digitalocean.com/smart-city/smart-city-backend:latest
docker tag smart-city-backend:latest registry.digitalocean.com/smart-city/smart-city-backend:$(git rev-parse --short HEAD)

# Push image
docker push registry.digitalocean.com/smart-city/smart-city-backend:latest
docker push registry.digitalocean.com/smart-city/smart-city-backend:$(git rev-parse --short HEAD)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image uspešno pushovan na registry${NC}"
else
    echo -e "${RED}❌ Greška pri push-u na registry${NC}"
    exit 1
fi

# Deploy na App Platform
echo -e "${YELLOW}🚀 Deploying to DigitalOcean App Platform...${NC}"

# Update app spec
doctl apps update $(doctl apps list --format ID --no-header | grep $APP_NAME) --spec .do/app.yaml

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment pokrenut${NC}"
else
    echo -e "${RED}❌ Greška pri deployment-u${NC}"
    exit 1
fi

# Čekaj da se deployment završi
echo -e "${YELLOW}⏳ Čekanje da se deployment završi...${NC}"
sleep 60

# Health check
echo -e "${YELLOW}🏥 Provera health statusa...${NC}"
HEALTH_URL="https://$DOMAIN/health"

if curl -f $HEALTH_URL; then
    echo -e "${GREEN}✅ Aplikacija je uspešno deployovana i radi!${NC}"
    echo -e "${GREEN}🌐 URL: https://$DOMAIN${NC}"
else
    echo -e "${RED}❌ Health check neuspešan${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment završen uspešno!${NC}"
echo "================================"
echo -e "📊 Dashboard: https://cloud.digitalocean.com/apps"
echo -e "📝 Logs: doctl apps logs $(doctl apps list --format ID --no-header | grep $APP_NAME)"
echo -e "🔍 Status: doctl apps get $(doctl apps list --format ID --no-header | grep $APP_NAME)"