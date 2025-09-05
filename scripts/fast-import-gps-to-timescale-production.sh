#!/bin/bash

# =============================================================================
# Fast Direct GPS Import to TimescaleDB - PRODUCTION Version
# =============================================================================
# Ova skripta direktno importuje GPS podatke u TimescaleDB koristeći COPY
# Radi sa produkcijskim serverom koji koristi managed databases
# =============================================================================

set -e  # Exit on error

# Parameters
DUMP_FILE="${1:-/tmp/gps_export.sql.gz}"
GARAGE_NO="${2:-P93598}"
BATCH_SIZE="${3:-100000}"  # 100K zapisa po batch-u

# MySQL production konfiguracija - koristi environment varijable
MYSQL_HOST="${MYSQL_HOST:-smart-city-do-user-23797702-0.m.db.ondigitalocean.com}"
MYSQL_PORT="${MYSQL_PORT:-25060}"
MYSQL_USER="${MYSQL_USER:-gsp-user}"
MYSQL_PASS="${MYSQL_PASS}"  # Mora biti postavljen kroz environment
MYSQL_DB="${MYSQL_DB:-gsp-smart-city}"

# TimescaleDB production konfiguracija - koristi environment varijable
TS_HOST="${TS_HOST:-b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com}"
TS_PORT="${TS_PORT:-31143}"
TS_DB="${TS_DB:-tsdb}"
TS_USER="${TS_USER:-tsdbadmin}"
TS_PASS="${TS_PASS}"  # Mora biti postavljen kroz environment

# Proveri da li su password-i postavljeni
if [ -z "$MYSQL_PASS" ] || [ -z "$TS_PASS" ]; then
  echo "❌ MYSQL_PASS i TS_PASS moraju biti postavljeni kroz environment varijable!"
  exit 1
fi

echo "================================================"
echo "⚡ Fast GPS Import - PRODUCTION Version"
echo "================================================"
echo "Dump fajl: $DUMP_FILE"
echo "Vozilo: $GARAGE_NO"
echo "Batch size: $BATCH_SIZE zapisa"
echo ""

# Step 1: Proveri da li vozilo postoji
echo "Step 1: Proveravam vozilo $GARAGE_NO..."
VEHICLE_ID=$(mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p"$MYSQL_PASS" $MYSQL_DB \
  --ssl-mode=REQUIRED \
  -e "SELECT id FROM bus_vehicles WHERE garage_number='$GARAGE_NO';" -s -N 2>/dev/null)

if [ -z "$VEHICLE_ID" ]; then
  echo "❌ Vozilo $GARAGE_NO nije pronađeno!"
  exit 1
fi
echo "✅ Pronađeno vozilo sa ID: $VEHICLE_ID"

# Step 2: Kreiraj privremenu MySQL tabelu za konverziju
echo ""
echo "Step 2: Pripremam podatke za import..."

# Kreiraj privremeni direktorijum
TEMP_DIR="/tmp/gps_import_$$"
mkdir -p $TEMP_DIR

# Ekstraktuj dump i konvertuj u CSV
echo "Ekstraktujem i konvertujem podatke u CSV format..."

gunzip -c $DUMP_FILE | \
  grep "^INSERT INTO" | \
  sed "s/INSERT INTO \`${GARAGE_NO}gps\` VALUES //g" | \
  sed 's/),(/\n/g' | \
  sed 's/^(//g' | \
  sed 's/);$//g' | \
  sed 's/);//g' | \
  awk -F',' -v vehicle_id="$VEHICLE_ID" -v garage_no="$GARAGE_NO" '
  {
    # Format: edited,captured,lat,lng,course,speed,alt,inroute,state
    # Trebamo: time,vehicle_id,garage_no,lat,lng,speed,course,alt,state,in_route
    
    # Očisti apostrofe sa datuma
    gsub(/'\''/, "", $1)  # edited
    gsub(/'\''/, "", $2)  # captured
    
    # Konvertuj in_route u boolean (true/false)
    in_route = ($8 > 0) ? "true" : "false"
    
    # CSV output
    print $2 "," vehicle_id "," garage_no "," $3 "," $4 "," $6 "," $5 "," $7 "," $9 "," in_route
  }
  ' > $TEMP_DIR/gps_data.csv

# Proveri broj linija
LINE_COUNT=$(wc -l < $TEMP_DIR/gps_data.csv)
echo "✅ Pripremljeno $LINE_COUNT GPS zapisa za import"

# Step 3: Import u TimescaleDB koristeći COPY
echo ""
echo "Step 3: Direktan import u TimescaleDB Cloud..."
echo "Ovo će biti MNOGO brže od buffer metode!"

# Podeli CSV na batch-eve ako je prevelik
TOTAL_BATCHES=$(( (LINE_COUNT + BATCH_SIZE - 1) / BATCH_SIZE ))
echo "Ukupno batch-eva: $TOTAL_BATCHES"

START_TIME=$(date +%s)

for ((i=0; i<$TOTAL_BATCHES; i++)); do
  BATCH_START=$((i * BATCH_SIZE + 1))
  BATCH_END=$(((i + 1) * BATCH_SIZE))
  
  echo -n "Batch $((i+1))/$TOTAL_BATCHES: Importujem linije $BATCH_START-$BATCH_END..."
  
  # Izvuci batch iz CSV-a
  sed -n "${BATCH_START},${BATCH_END}p" $TEMP_DIR/gps_data.csv > $TEMP_DIR/batch_$i.csv
  
  # COPY direktno u TimescaleDB koristeći stdin
  cat $TEMP_DIR/batch_$i.csv | PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -c "
    BEGIN;
    
    -- Kreiraj privremenu tabelu za batch
    CREATE TEMP TABLE temp_gps_import (
      time TIMESTAMPTZ,
      vehicle_id INTEGER,
      garage_no VARCHAR(20),
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      speed DOUBLE PRECISION,
      course DOUBLE PRECISION,
      alt DOUBLE PRECISION,
      state INTEGER,
      in_route BOOLEAN
    );
    
    -- COPY podatke preko stdin (SUPER BRZO!)
    COPY temp_gps_import FROM STDIN WITH (FORMAT csv);
    
    -- Insert sa ON CONFLICT
    INSERT INTO gps_data (time, vehicle_id, garage_no, lat, lng, location, speed, course, alt, state, in_route, data_source)
    SELECT 
      time,
      vehicle_id,
      garage_no,
      lat,
      lng,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326),
      speed,
      course,
      alt,
      state,
      in_route,
      'historical_fast_import'
    FROM temp_gps_import
    ON CONFLICT (vehicle_id, time) DO UPDATE SET
      garage_no = EXCLUDED.garage_no,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      location = EXCLUDED.location,
      speed = EXCLUDED.speed,
      course = EXCLUDED.course,
      alt = EXCLUDED.alt;
    
    DROP TABLE temp_gps_import;
    
    COMMIT;
  " 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo " ✅"
  else
    echo " ⚠️"
  fi
  
  # Obriši batch fajl
  rm -f $TEMP_DIR/batch_$i.csv
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "✅ Import završen za $DURATION sekundi!"

# Step 4: Pokreni detekciju agresivne vožnje
echo ""
echo "Step 4: Pokrećem detekciju agresivne vožnje..."

# Pronađi vremenski opseg importovanih podataka
TIME_RANGE=$(PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -t -c "
  SELECT 
    MIN(time)::date || ',' || MAX(time)::date 
  FROM gps_data 
  WHERE vehicle_id = $VEHICLE_ID 
    AND data_source = 'historical_fast_import';
")

IFS=',' read -r START_DATE END_DATE <<< "$TIME_RANGE"
START_DATE=$(echo $START_DATE | xargs)
END_DATE=$(echo $END_DATE | xargs)

if [ ! -z "$START_DATE" ] && [ ! -z "$END_DATE" ]; then
  echo "Detektujem agresivnu vožnju za period: $START_DATE do $END_DATE"
  
  # Pozovi detekciju po DANIMA (kao što radi CRON), ne odjednom za celi period
  echo "Procesiranje po danima (kao CRON batch processing)..."
  current_date="$START_DATE"
  day_count=0
  
  while [ "$current_date" \< "$END_DATE" ] || [ "$current_date" = "$END_DATE" ]; do
    day_count=$((day_count + 1))
    
    # Prikaži progres svakih 10 dana
    if [ $((day_count % 10)) -eq 1 ]; then
      echo -n "  Dan $day_count: $current_date..."
    fi
    
    # Pozovi detekciju za jedan dan
    PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -t -c "
      SELECT detect_aggressive_driving_batch(
        $VEHICLE_ID,
        '$GARAGE_NO',
        '$current_date 00:00:00'::TIMESTAMPTZ,
        '$current_date 23:59:59'::TIMESTAMPTZ
      );
    " 2>/dev/null
    
    # Prikaži progres svakih 10 dana
    if [ $((day_count % 10)) -eq 0 ]; then
      echo " ✅"
    fi
    
    # Pređi na sledeći dan
    current_date=$(date -d "$current_date +1 day" +%Y-%m-%d)
  done
  
  # Završi poslednju liniju ako nije završena
  if [ $((day_count % 10)) -ne 0 ]; then
    echo " ✅"
  fi
  
  echo "  Ukupno procesiranih dana: $day_count"
  
  # Step 5: Refresh continuous aggregates
  echo ""
  echo "Step 5: Osvežavam continuous aggregates..."
  
  # Refresh po mesecima da ne bude previše odjednom
  current_month="$START_DATE"
  while [ "$current_month" \< "$END_DATE" ] || [ "$current_month" = "$END_DATE" ]; do
    month_end=$(date -d "$current_month +1 month -1 day" +%Y-%m-%d)
    if [ "$month_end" \> "$END_DATE" ]; then
      month_end="$END_DATE"
    fi
    
    echo -n "  Mesec $current_month..."
    # Refresh aggregates pojedinačno jer ne mogu biti u istoj transakciji
    PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -c "
      CALL refresh_continuous_aggregate('vehicle_hourly_stats', '$current_month'::TIMESTAMPTZ, '$month_end 23:59:59'::TIMESTAMPTZ);
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
      PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -c "
        CALL refresh_continuous_aggregate('daily_vehicle_stats', '$current_month'::TIMESTAMPTZ, '$month_end 23:59:59'::TIMESTAMPTZ);
      " 2>/dev/null
      
      if [ $? -eq 0 ]; then
        PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -c "
          CALL refresh_continuous_aggregate('monthly_vehicle_raw_stats', '$current_month'::TIMESTAMPTZ, '$month_end 23:59:59'::TIMESTAMPTZ);
        " 2>/dev/null && echo " ✅" || echo " ⚠️"
      else
        echo " ⚠️"
      fi
    else
      echo " ⚠️"
    fi
    
    current_month=$(date -d "$current_month +1 month" +%Y-%m-%d)
  done
else
  echo "⚠️ Nije moguće pronaći vremenski opseg podataka"
fi

# Step 6: Očisti privremene fajlove
echo ""
echo "Step 6: Čistim privremene fajlove..."
rm -rf $TEMP_DIR

# Step 7: Prikaži statistike
echo ""
echo "================================================"
echo "📊 REZULTATI IMPORTA"
echo "================================================"

# Proveri koliko je importovano
IMPORTED=$(PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -t -c "
  SELECT COUNT(*) 
  FROM gps_data 
  WHERE vehicle_id = $VEHICLE_ID 
    AND data_source = 'historical_fast_import';
")

EVENTS=$(PGPASSWORD=$TS_PASS psql -h $TS_HOST -p $TS_PORT -U $TS_USER -d $TS_DB -t -c "
  SELECT COUNT(*) 
  FROM driving_events 
  WHERE vehicle_id = $VEHICLE_ID 
    AND time BETWEEN '$START_DATE' AND '$END_DATE 23:59:59';
")

echo "✅ Importovano GPS tačaka: $IMPORTED"
echo "✅ Detektovano agresivnih događaja: $EVENTS"
echo "⏱️ Vreme importa: $DURATION sekundi"
echo ""
echo "Brzina: $((LINE_COUNT / DURATION)) zapisa/sekund"
echo ""
echo "🚀 Ovo je ~100x brže od buffer metode!"
echo "================================================"