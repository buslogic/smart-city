#!/bin/bash

# Skripta za refresh continuous aggregates nakon migracija
# Ova skripta se pokreće NAKON dbmate migracija na produkciji

echo "=========================================="
echo "Starting continuous aggregates refresh..."
echo "=========================================="

# Učitaj environment varijable za produkciju
if [ -f .env.production ]; then
    source .env.production
else
    echo "ERROR: .env.production file not found!"
    exit 1
fi

# Proveri da li je DATABASE_URL postavljen
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set!"
    exit 1
fi

echo "Connecting to database..."

# Funkcija za izvršavanje SQL komandi
execute_sql() {
    psql "$DATABASE_URL" -c "$1"
    return $?
}

# 1. Refresh vehicle_hourly_stats - kritično za Monthly Report
echo ""
echo "Step 1: Refreshing vehicle_hourly_stats (this may take 5-10 minutes)..."
echo "Date range: Last 3 months to ensure all vehicles are included"

if execute_sql "CALL refresh_continuous_aggregate('vehicle_hourly_stats', (NOW() - INTERVAL '3 months')::timestamptz, NULL::timestamptz);"; then
    echo "✅ vehicle_hourly_stats refreshed successfully"
else
    echo "❌ Failed to refresh vehicle_hourly_stats"
    exit 1
fi

# 2. Refresh daily_vehicle_stats
echo ""
echo "Step 2: Refreshing daily_vehicle_stats (this may take 3-5 minutes)..."
echo "Date range: Last 3 months"

if execute_sql "CALL refresh_continuous_aggregate('daily_vehicle_stats', (NOW() - INTERVAL '3 months')::timestamptz, NULL::timestamptz);"; then
    echo "✅ daily_vehicle_stats refreshed successfully"
else
    echo "❌ Failed to refresh daily_vehicle_stats"
    exit 1
fi

# 3. Verifikacija da vozila 1 i 2 sada imaju podatke
echo ""
echo "Step 3: Verifying that vehicles 1 and 2 now have data..."

VERIFICATION_QUERY="
SELECT 
    'vehicle_hourly_stats' as aggregate,
    COUNT(*) as records,
    MIN(vehicle_id) as min_id,
    MAX(vehicle_id) as max_id
FROM vehicle_hourly_stats
WHERE vehicle_id IN (1, 2)
UNION ALL
SELECT 
    'daily_vehicle_stats' as aggregate,
    COUNT(*) as records,
    MIN(vehicle_id) as min_id,
    MAX(vehicle_id) as max_id
FROM daily_vehicle_stats
WHERE vehicle_id IN (1, 2);
"

echo "Verification results:"
execute_sql "$VERIFICATION_QUERY"

# 4. Proveri kilometražu za vozila 1 i 2
echo ""
echo "Step 4: Checking mileage for vehicles 1 and 2..."

MILEAGE_QUERY="
SELECT 
    vehicle_id,
    garage_no,
    SUM(distance_km) as total_km
FROM vehicle_hourly_stats
WHERE vehicle_id IN (1, 2)
    AND hour >= (NOW() - INTERVAL '1 month')::date
GROUP BY vehicle_id, garage_no
ORDER BY vehicle_id;
"

echo "Mileage results for last month:"
execute_sql "$MILEAGE_QUERY"

echo ""
echo "=========================================="
echo "Aggregate refresh completed!"
echo "=========================================="
echo ""
echo "IMPORTANT: Monthly Report should now show correct mileage for all vehicles."
echo "If vehicles 1 and 2 still show 0 km, check the logs above for errors."