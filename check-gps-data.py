#!/usr/bin/env python3
import psycopg2
from datetime import datetime, timedelta

# Konekcija na TimescaleDB
conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="smartcity_gps",
    user="smartcity_ts",
    password="TimescalePass123!"
)

cur = conn.cursor()

print("🔍 Provera GPS podataka u TimescaleDB\n")
print("=" * 60)

# 1. Proveri koja vozila imaju podatke
print("\n📊 Vozila sa GPS podacima:")
cur.execute("""
    SELECT 
        garage_no,
        vehicle_id,
        COUNT(*) as total_points,
        MIN(time) as first_point,
        MAX(time) as last_point,
        AVG(speed)::NUMERIC(5,1) as avg_speed,
        MAX(speed) as max_speed
    FROM gps_data
    GROUP BY garage_no, vehicle_id
    ORDER BY total_points DESC
""")

vehicles_with_data = cur.fetchall()

if vehicles_with_data:
    print(f"\nPronađeno {len(vehicles_with_data)} vozila sa podacima:\n")
    for row in vehicles_with_data:
        garage_no, vehicle_id, points, first, last, avg_speed, max_speed = row
        print(f"  🚌 Vozilo: {garage_no}")
        print(f"     - Vehicle ID: {vehicle_id if vehicle_id else 'N/A'}")
        print(f"     - Broj GPS tačaka: {points}")
        print(f"     - Prvi podatak: {first}")
        print(f"     - Poslednji podatak: {last}")
        print(f"     - Prosečna brzina: {avg_speed} km/h")
        print(f"     - Max brzina: {max_speed} km/h")
        print()
else:
    print("  ❌ Nema GPS podataka ni za jedno vozilo")

# 2. Detaljnija statistika za poslednji dan
print("\n📅 Statistika za poslednji dan:")
cur.execute("""
    SELECT 
        garage_no,
        vehicle_id,
        COUNT(*) as points_today,
        MIN(time) as first_today,
        MAX(time) as last_today,
        ST_Length(
            ST_MakeLine(location ORDER BY time)::geography
        ) / 1000.0 as distance_km
    FROM gps_data
    WHERE time > NOW() - INTERVAL '1 day'
    GROUP BY garage_no, vehicle_id
    ORDER BY points_today DESC
""")

today_data = cur.fetchall()

if today_data:
    print(f"\nVozila aktivna u poslednjih 24h:\n")
    for row in today_data:
        garage_no, vehicle_id, points, first, last, distance = row
        print(f"  🚌 {garage_no} (ID: {vehicle_id if vehicle_id else 'N/A'})")
        print(f"     - Tačaka danas: {points}")
        print(f"     - Period: {first.strftime('%H:%M')} - {last.strftime('%H:%M')}")
        print(f"     - Kilometraža: {distance:.2f} km" if distance else "     - Kilometraža: N/A")
        print()
else:
    print("  ⚠️ Nema podataka za poslednji dan")

# 3. Proveri podatke za specifična vozila iz bus_vehicle tabele
print("\n🔗 Provera mapiranja sa bus_vehicle tabelom:")
cur.execute("""
    SELECT DISTINCT vehicle_id, garage_no
    FROM gps_data
    WHERE vehicle_id IS NOT NULL
    ORDER BY vehicle_id
""")

mapped_vehicles = cur.fetchall()

if mapped_vehicles:
    print(f"\nVozila sa vehicle_id mapiranjem:")
    for vid, gno in mapped_vehicles:
        print(f"  - Vehicle ID {vid}: {gno}")
else:
    print("  ⚠️ Nema mapiranih vehicle_id vrednosti")

# 4. Najnoviji podaci
print("\n⏰ Najnoviji GPS podaci:")
cur.execute("""
    SELECT 
        garage_no,
        vehicle_id,
        time,
        lat,
        lng,
        speed
    FROM gps_data
    ORDER BY time DESC
    LIMIT 5
""")

latest = cur.fetchall()

if latest:
    for row in latest:
        garage_no, vehicle_id, time, lat, lng, speed = row
        print(f"  - {garage_no} @ {time}: ({lat:.6f}, {lng:.6f}), {speed} km/h")
else:
    print("  ❌ Nema podataka")

# 5. Sumarna statistika
print("\n📈 Ukupna statistika:")
cur.execute("""
    SELECT 
        COUNT(DISTINCT garage_no) as total_vehicles,
        COUNT(*) as total_points,
        MIN(time) as oldest_point,
        MAX(time) as newest_point
    FROM gps_data
""")

stats = cur.fetchone()
if stats:
    total_vehicles, total_points, oldest, newest = stats
    print(f"  - Ukupno vozila: {total_vehicles}")
    print(f"  - Ukupno GPS tačaka: {total_points}")
    print(f"  - Najstariji podatak: {oldest}")
    print(f"  - Najnoviji podatak: {newest}")

cur.close()
conn.close()

print("\n" + "=" * 60)
print("✅ Provera završena!")