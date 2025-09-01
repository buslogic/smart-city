#!/usr/bin/env python3
"""
Skripta za detekciju događaja agresivne vožnje za 30.08.2025
"""

import psycopg2
from datetime import datetime

# Konfiguracija
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'smartcity_gps',
    'user': 'smartcity_ts',
    'password': 'TimescalePass123!'
}

VEHICLE_ID = 460  # P93597
GARAGE_NO = 'P93597'
START_DATE = '2025-08-30 00:00:00'
END_DATE = '2025-08-30 23:59:59'

def main():
    print("=" * 70)
    print("DETEKCIJA DOGAĐAJA AGRESIVNE VOŽNJE")
    print(f"Vozilo: {GARAGE_NO} (ID: {VEHICLE_ID})")
    print(f"Period: {START_DATE} - {END_DATE}")
    print("=" * 70)
    
    try:
        # Poveži se na bazu
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Povezan na TimescaleDB")
        
        # Proveri da li ima GPS podataka
        print("\n1. Provera GPS podataka...")
        cursor.execute("""
            SELECT COUNT(*) as total, 
                   MIN(time) as min_time, 
                   MAX(time) as max_time,
                   AVG(speed) as avg_speed,
                   MAX(speed) as max_speed
            FROM gps_data 
            WHERE vehicle_id = %s 
              AND time BETWEEN %s AND %s
        """, (VEHICLE_ID, START_DATE, END_DATE))
        
        result = cursor.fetchone()
        print(f"   - Ukupno GPS tačaka: {result[0]}")
        print(f"   - Period: {result[1]} do {result[2]}")
        print(f"   - Prosečna brzina: {result[3]:.1f} km/h")
        print(f"   - Maksimalna brzina: {result[4]:.1f} km/h")
        
        if result[0] == 0:
            print("❌ Nema GPS podataka za ovaj period!")
            return
            
        # Proveri postojeće događaje PRE detekcije
        print("\n2. Postojeći događaji PRE detekcije...")
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN event_type = 'harsh_acceleration' THEN 1 END) as acc,
                   COUNT(CASE WHEN event_type = 'harsh_braking' THEN 1 END) as brake,
                   COUNT(CASE WHEN severity = 1 THEN 1 END) as normal,
                   COUNT(CASE WHEN severity = 3 THEN 1 END) as moderate,
                   COUNT(CASE WHEN severity = 5 THEN 1 END) as severe
            FROM driving_events
            WHERE vehicle_id = %s 
              AND time BETWEEN %s AND %s
        """, (VEHICLE_ID, START_DATE, END_DATE))
        
        before = cursor.fetchone()
        print(f"   - Ukupno: {before[0]}")
        print(f"   - Ubrzanja: {before[1]}, Kočenja: {before[2]}")
        print(f"   - Normal: {before[3]}, Moderate: {before[4]}, Severe: {before[5]}")
        
        # Pokreni detekciju
        print("\n3. Pokrećem detekciju agresivne vožnje...")
        cursor.execute("""
            SELECT * FROM detect_aggressive_driving_batch(%s, %s, %s::timestamptz, %s::timestamptz)
        """, (VEHICLE_ID, GARAGE_NO, START_DATE, END_DATE))
        
        detection = cursor.fetchone()
        print(f"   ✅ Detekcija završena!")
        print(f"   - Ukupno događaja: {detection[0]}")
        print(f"   - Ubrzanja: {detection[1]}")
        print(f"   - Kočenja: {detection[2]}")
        print(f"   - Umereni: {detection[3]}")
        print(f"   - Ozbiljni: {detection[4]}")
        
        # Commit promene
        conn.commit()
        print("\n   ✅ Promene sačuvane u bazi!")
        
        # Proveri događaje POSLE detekcije
        print("\n4. Događaji POSLE detekcije...")
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN event_type = 'harsh_acceleration' THEN 1 END) as acc,
                   COUNT(CASE WHEN event_type = 'harsh_braking' THEN 1 END) as brake,
                   COUNT(CASE WHEN severity = 1 THEN 1 END) as normal,
                   COUNT(CASE WHEN severity = 3 THEN 1 END) as moderate,
                   COUNT(CASE WHEN severity = 5 THEN 1 END) as severe
            FROM driving_events
            WHERE vehicle_id = %s 
              AND time BETWEEN %s AND %s
        """, (VEHICLE_ID, START_DATE, END_DATE))
        
        after = cursor.fetchone()
        print(f"   - Ukupno: {after[0]}")
        print(f"   - Ubrzanja: {after[1]}, Kočenja: {after[2]}")
        print(f"   - Normal: {after[3]}, Moderate: {after[4]}, Severe: {after[5]}")
        
        # Prikaži nekoliko primera
        if after[0] > 0:
            print("\n5. Primeri detektovanih događaja:")
            cursor.execute("""
                SELECT time, event_type, severity, 
                       speed_before, speed_after, 
                       acceleration_value, g_force
                FROM driving_events
                WHERE vehicle_id = %s 
                  AND time BETWEEN %s AND %s
                  AND severity >= 3
                ORDER BY severity DESC, ABS(acceleration_value) DESC
                LIMIT 5
            """, (VEHICLE_ID, START_DATE, END_DATE))
            
            events = cursor.fetchall()
            for event in events:
                severity_text = "SEVERE" if event[2] == 5 else "MODERATE" if event[2] == 3 else "NORMAL"
                event_type = "UBRZANJE" if "acceleration" in event[1] else "KOČENJE"
                print(f"   - {event[0]}: {event_type} [{severity_text}]")
                print(f"     Brzina: {event[3]:.1f} → {event[4]:.1f} km/h")
                print(f"     Ubrzanje: {event[5]:.2f} m/s² ({event[6]:.2f}G)")
        
        print("\n" + "=" * 70)
        print("ZAVRŠENO!")
        
        if after[0] > before[0]:
            print(f"✅ Uspešno detektovano {after[0] - before[0]} novih događaja!")
        elif after[0] == 0:
            print("⚠️ Nisu detektovani događaji - možda nema agresivne vožnje?")
        else:
            print("ℹ️ Događaji su već bili detektovani")
            
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ Greška: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()