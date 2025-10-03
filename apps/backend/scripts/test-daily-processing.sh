#!/bin/bash

# GPS LAG Transfer - Test Daily Processing
# Procesira jedan dan podataka sat po sat i prati napredak

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MAX_PARALLEL=20
ITERATIONS=24  # 24 sata u danu

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  GPS LAG Transfer - Daily Processing Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Parametri:${NC}"
echo "  Max parallel vehicles: $MAX_PARALLEL"
echo "  Iterations: $ITERATIONS hourly batches"
echo ""

# Initial monitoring
echo -e "${YELLOW}📊 Početno stanje:${NC}"
npm run gps:monitor
echo ""

# Process multiple batches
echo -e "${YELLOW}🚀 Početak procesiranja...${NC}"
echo ""

for i in $(seq 1 $ITERATIONS); do
    echo -e "${BLUE}─────────────────────────────────────────────────────────────────────${NC}"
    echo -e "${GREEN}Iteracija $i/$ITERATIONS${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────────────────────────────${NC}"

    # Run one batch
    npm run gps:process:parallel -- $MAX_PARALLEL

    # Quick status check
    if [ $((i % 4)) -eq 0 ]; then
        echo ""
        echo -e "${YELLOW}📊 Status nakon $i iteracija:${NC}"
        npm run gps:monitor
        echo ""
    fi

    # Small delay between batches
    sleep 2
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Procesiranje završeno!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Final monitoring
echo -e "${YELLOW}📊 Finalno stanje:${NC}"
npm run gps:monitor

echo ""
echo -e "${GREEN}Test završen. Proveri log fajlove za detalje.${NC}"
