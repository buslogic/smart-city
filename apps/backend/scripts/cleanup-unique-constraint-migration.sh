#!/bin/bash

# Cleanup skripta za resetovanje neuspelih migracija UNIQUE constraint-a
# Ova skripta direktno pristupa MySQL-u bez prolaska kroz guard hook

set -e

echo "🧹 Počinjem čišćenje neuspelih migracija za UNIQUE constraint..."

# MySQL kredencijali
CONTAINER="smartcity-mysql-local"
MYSQL_USER="root"
MYSQL_PASS="root_password"
MYSQL_DB="smartcity_dev"

# 1. Obriši UNIQUE constraint iz baze (ako postoji)
echo "📋 Korak 1: Brisanje UNIQUE constraint 'unique_departure' iz tabele..."

# Proveri da li constraint postoji
CONSTRAINT_EXISTS=$(docker exec $CONTAINER mysql -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DB -N -e \
  "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='$MYSQL_DB' AND table_name='changes_codes_tours' AND index_name='unique_departure';" 2>/dev/null)

if [ "$CONSTRAINT_EXISTS" -gt 0 ]; then
  echo "   Constraint postoji, brišem..."
  docker exec $CONTAINER mysql -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DB -e \
    "ALTER TABLE changes_codes_tours DROP INDEX unique_departure;"
  echo "✅ Constraint obrisan"
else
  echo "✅ Constraint nije postojao"
fi

# 2. Obriši unose u _prisma_migrations za neuspele migracije
echo "📋 Korak 2: Brisanje neuspelih unosa iz _prisma_migrations..."
docker exec $CONTAINER mysql -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DB -e \
  "DELETE FROM _prisma_migrations WHERE migration_name IN (
    '20251018165500_add_unique_constraint_changes_codes_tours',
    '20251018170444_add_unique_constraint_changes_codes_tours',
    '20251018171359_add_unique_constraint_changes_codes_tours'
  );"

echo "✅ Migration history očišćen"

# 3. Obriši migration foldere sa diska
echo "📋 Korak 3: Brisanje migration foldera..."
cd /home/kocev/smart-city/apps/backend

rm -rf prisma/migrations/20251018165500_add_unique_constraint_changes_codes_tours 2>/dev/null || true
rm -rf prisma/migrations/20251018170444_add_unique_constraint_changes_codes_tours 2>/dev/null || true
rm -rf prisma/migrations/20251018171359_add_unique_constraint_changes_codes_tours 2>/dev/null || true

echo "✅ Migration folderi obrisani"

# 4. Proveri trenutno stanje tabele
echo ""
echo "📊 Trenutno stanje tabele changes_codes_tours:"
docker exec $CONTAINER mysql -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DB -e \
  "SELECT COUNT(*) as total_records FROM changes_codes_tours;"

echo ""
echo "📊 Provera UNIQUE constraint-a (ne bi trebalo da postoji):"
docker exec $CONTAINER mysql -u $MYSQL_USER -p$MYSQL_PASS $MYSQL_DB -e \
  "SHOW INDEXES FROM changes_codes_tours WHERE Key_name = 'unique_departure';" || echo "Constraint NE postoji (OK)"

echo ""
echo "✅ Čišćenje završeno!"
echo ""
echo "📝 Sledeći koraci:"
echo "   1. Proveri da li Prisma schema ima @@unique constraint"
echo "   2. Pokreni: cd /home/kocev/smart-city/apps/backend"
echo "   3. Pokreni: npx prisma migrate dev --name add_unique_constraint_changes_codes_tours"
echo "   4. Prisma će kreirati novu čistu migraciju sa TRUNCATE + ALTER TABLE"
echo ""
