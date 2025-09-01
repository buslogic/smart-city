#!/bin/bash
# Skripta za proveru statusa migracija na produkciji

echo "======================================================================"
echo "PROVERA TIMESCALEDB MIGRACIJA NA PRODUKCIJI"
echo "======================================================================"

# Učitaj production environment
cd /home/kocev/smart-city/apps/backend/timescale
source .env.production

echo ""
echo "📊 Status migracija:"
echo "----------------------------------------------------------------------"
export PATH=$PATH:~/bin && dbmate --migrations-dir ./migrations status

echo ""
echo "🔍 Provera da li postoji funkcija detect_aggressive_driving_batch:"
echo "----------------------------------------------------------------------"
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
psql $(echo $DATABASE_URL | sed 's/postgres/postgresql/') -c "\df detect_aggressive_driving_batch" 2>/dev/null | grep -q detect_aggressive_driving_batch

if [ $? -eq 0 ]; then
    echo "✅ Funkcija detect_aggressive_driving_batch postoji!"
else
    echo "❌ Funkcija detect_aggressive_driving_batch NE postoji!"
    echo "   Potrebno je pokrenuti migraciju!"
fi

echo ""
echo "📈 Broj događaja u driving_events tabeli:"
echo "----------------------------------------------------------------------"
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
psql $(echo $DATABASE_URL | sed 's/postgres/postgresql/') -t -c "SELECT COUNT(*) FROM driving_events;" 2>/dev/null || echo "Tabela ne postoji"

echo ""
echo "======================================================================"
echo "ZAVRŠENO"
echo "======================================================================"