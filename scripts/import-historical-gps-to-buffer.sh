#!/bin/bash

# =============================================================================
# Import Historical GPS Data Through Buffer Pipeline
# =============================================================================
# Ova skripta importuje istorijske GPS podatke kroz MySQL buffer tabelu
# kako bi prošli kroz kompletan pipeline sa detekcijom agresivne vožnje
# =============================================================================

set -e  # Exit on error

# Configuration
DUMP_FILE="${1:-/home/kocev/smart-city/scripts/P93597gps_export.sql.gz}"
GARAGE_NO="P93597"
BATCH_SIZE="${2:-5000}"  # Koliko zapisa odjednom da ubaci u buffer

# MySQL lokalna konfiguracija
MYSQL_HOST="localhost"
MYSQL_PORT="3325"
MYSQL_DB="smartcity_dev"
MYSQL_USER="root"
MYSQL_PASS="root_password"
MYSQL_CONTAINER="smartcity-mysql-local"

echo "================================================"
echo "Historical GPS Import kroz Buffer Pipeline"
echo "================================================"
echo "Dump fajl: $DUMP_FILE"
echo "Vozilo: $GARAGE_NO"
echo "Batch size: $BATCH_SIZE"
echo ""

# Step 1: Proveri da li vozilo postoji u našoj bazi
echo "Step 1: Proveravam vozilo $GARAGE_NO u lokalnoj bazi..."
VEHICLE_ID=$(docker exec $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB \
  -e "SELECT id FROM bus_vehicles WHERE garage_number='$GARAGE_NO';" -s -N 2>/dev/null)

if [ -z "$VEHICLE_ID" ]; then
  echo "❌ Vozilo $GARAGE_NO nije pronađeno u lokalnoj bazi!"
  echo "Prvo morate dodati vozilo u bus_vehicles tabelu."
  exit 1
fi

echo "✅ Pronađeno vozilo sa ID: $VEHICLE_ID"

# Step 2: Kreiraj privremenu MySQL tabelu za import
echo ""
echo "Step 2: Kreiram privremenu tabelu za import..."

docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB << EOF
DROP TABLE IF EXISTS temp_gps_import;

CREATE TABLE temp_gps_import (
  edited TIMESTAMP NOT NULL,
  captured DATETIME NOT NULL,
  lat DECIMAL(11,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  course SMALLINT NOT NULL,
  speed SMALLINT NOT NULL,
  alt SMALLINT NOT NULL,
  inroute SMALLINT NOT NULL,
  state TINYINT NOT NULL,
  PRIMARY KEY (captured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
EOF

echo "✅ Privremena tabela kreirana"

# Step 3: Importuj dump u privremenu tabelu
echo ""
echo "Step 3: Importujem dump fajl u privremenu tabelu..."
echo "Ovo može potrajati nekoliko minuta..."

# Ekstraktuj i importuj, ali promeni ime tabele na temp_gps_import
gunzip -c $DUMP_FILE | \
  sed 's/`P93597gps`/`temp_gps_import`/g' | \
  docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB

# Proveri broj importovanih zapisa
IMPORTED_COUNT=$(docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB \
  -e "SELECT COUNT(*) FROM temp_gps_import;" -s -N 2>/dev/null)

echo "✅ Importovano $IMPORTED_COUNT zapisa u privremenu tabelu"

# Step 4: Prebaci podatke u buffer tabelu u batch-ovima
echo ""
echo "Step 4: Prebacujem podatke u gps_raw_buffer tabelu..."
echo "Ovo će omogućiti procesiranje sa detekcijom agresivne vožnje"

TOTAL_PROCESSED=0
OFFSET=0

while [ $OFFSET -lt $IMPORTED_COUNT ]; do
  REMAINING=$((IMPORTED_COUNT - OFFSET))
  CURRENT_BATCH=$((REMAINING < BATCH_SIZE ? REMAINING : BATCH_SIZE))
  
  echo -n "Batch $((OFFSET / BATCH_SIZE + 1)): Obrađujem zapise $OFFSET - $((OFFSET + CURRENT_BATCH))..."
  
  docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB << EOF
    INSERT INTO gps_raw_buffer (
      vehicle_id,
      garage_no,
      imei,
      timestamp,
      lat,
      lng,
      speed,
      course,
      altitude,
      satellites,
      state,
      in_route,
      received_at,
      process_status,
      retry_count,
      source,
      raw_data
    )
    SELECT 
      $VEHICLE_ID as vehicle_id,
      '$GARAGE_NO' as garage_no,
      NULL as imei,
      captured as timestamp,
      lat,
      lng,
      speed,
      course,
      alt as altitude,
      0 as satellites,
      state,
      inroute as in_route,
      NOW() as received_at,
      'pending' as process_status,
      0 as retry_count,
      'historical_import' as source,
      JSON_OBJECT(
        'edited', edited,
        'captured', captured,
        'original_table', 'P93597gps'
      ) as raw_data
    FROM temp_gps_import
    ORDER BY captured
    LIMIT $BATCH_SIZE OFFSET $OFFSET
    ON DUPLICATE KEY UPDATE
      process_status = 'pending',
      retry_count = 0,
      received_at = NOW();
EOF
  
  if [ $? -eq 0 ]; then
    echo " ✅"
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + CURRENT_BATCH))
  else
    echo " ⚠️ Greška, nastavljam..."
  fi
  
  OFFSET=$((OFFSET + BATCH_SIZE))
  
  # Mala pauza da ne preopteretimo bazu
  sleep 0.5
done

echo ""
echo "✅ Ukupno prebačeno u buffer: $TOTAL_PROCESSED zapisa"

# Step 5: Očisti privremenu tabelu
echo ""
echo "Step 5: Čistim privremenu tabelu..."
docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB \
  -e "DROP TABLE IF EXISTS temp_gps_import;"
echo "✅ Privremena tabela obrisana"

# Step 6: Prikaži status buffer tabele
echo ""
echo "Step 6: Status buffer tabele:"
docker exec -i $MYSQL_CONTAINER mysql -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB << EOF
SELECT 
  process_status,
  COUNT(*) as count,
  MIN(timestamp) as oldest,
  MAX(timestamp) as newest
FROM gps_raw_buffer
WHERE garage_no = '$GARAGE_NO'
  AND source = 'historical_import'
GROUP BY process_status;
EOF

echo ""
echo "================================================"
echo "✅ Import završen!"
echo ""
echo "GPS Processor servis će automatski prebaciti podatke iz buffer-a u TimescaleDB."
echo "Processor se pokreće svakih 30 sekundi i obrađuje do 4000 zapisa po batch-u."
echo ""
echo "Tokom procesiranja će se izvršiti:"
echo "1. Deduplikacija podataka"
echo "2. Detekcija agresivne vožnje (harsh_acceleration, harsh_braking)"
echo "3. Refresh continuous aggregates za brže izveštaje"
echo "4. Analiza statistika"
echo ""
echo "Možete pratiti progres pomoću:"
echo "- GPS Sync Dashboard u Admin Portal-u"
echo "- Ili direktno u bazi sa: SELECT process_status, COUNT(*) FROM gps_raw_buffer WHERE garage_no='$GARAGE_NO' GROUP BY process_status;"
echo ""
echo "Procenjeno vreme obrade: ~$((IMPORTED_COUNT / 4000 / 2 + 1)) minuta"
echo "================================================"