#!/bin/bash

# Simple Backend Deployment Script for Smart City
# Uses pre-built Docker image from DigitalOcean Registry

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Smart City Backend Deployment${NC}"
echo "========================================"

# Configuration
CONTAINER_NAME="backend-app"
IMAGE="registry.digitalocean.com/smart-city/backend:latest"
HEALTH_CHECK_URL="https://api.smart-city.rs/health"
MAX_WAIT_TIME=60

# Pull latest image
echo -e "${YELLOW}🐳 Pulling latest Docker image...${NC}"
docker pull $IMAGE

# Stop old container
echo -e "${YELLOW}🛑 Stopping old container...${NC}"
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

# Start new container with existing configuration
echo -e "${YELLOW}🚀 Starting new container...${NC}"
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  --network host \
  --env-file /root/apps/backend/.env.production \
  -v /root/apps/backend/uploads:/app/uploads \
  $IMAGE

# Wait for container to be healthy
echo -e "${YELLOW}⏳ Waiting for backend to be healthy...${NC}"
WAIT_TIME=0
while [ $WAIT_TIME -lt $MAX_WAIT_TIME ]; do
    if docker ps | grep -q $CONTAINER_NAME; then
        # Check container health status
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "unknown")
        if [ "$HEALTH" = "healthy" ]; then
            echo -e "${GREEN}✅ Backend is healthy!${NC}"
            break
        fi
    fi
    echo -n "."
    sleep 2
    WAIT_TIME=$((WAIT_TIME + 2))
done

if [ $WAIT_TIME -ge $MAX_WAIT_TIME ]; then
    echo -e "${RED}❌ Backend failed to become healthy within $MAX_WAIT_TIME seconds${NC}"
    echo -e "${RED}📋 Container logs:${NC}"
    docker logs $CONTAINER_NAME --tail 50
    exit 1
fi

# Clean up old Docker images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# Show deployment info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✨ DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "📍 API URL: ${GREEN}https://api.smart-city.rs${NC}"
echo -e "📦 Container: ${GREEN}$CONTAINER_NAME${NC}"
echo -e "📅 Deployed at: ${GREEN}$(date)${NC}"
echo ""

# Show container status
docker ps | grep $CONTAINER_NAME