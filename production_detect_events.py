#!/usr/bin/env python3
"""
Skripta za detekciju događaja agresivne vožnje na PRODUKCIJI
"""

import psycopg2
from datetime import datetime, timedelta
import sys
import os
from urllib.parse import urlparse

def parse_database_url(url):
    """Parse DATABASE_URL za psycopg2 konekciju"""
    parsed = urlparse(url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path[1:],  # Remove leading /
        'user': parsed.username,
        'password': parsed.password
    }

def test_single_vehicle(conn, vehicle_id, garage_no, date_str):
    """Test detekciju za jedno vozilo"""
    cursor = conn.cursor()
    
    print(f"\n🚗 Testiranje vozila {garage_no} (ID: {vehicle_id}) za datum {date_str}")
    print("-" * 60)
    
    start_time = f"{date_str} 00:00:00"
    end_time = f"{date_str} 23:59:59"
    
    # Proveri GPS podatke
    cursor.execute("""
        SELECT COUNT(*) FROM gps_data 
        WHERE vehicle_id = %s AND DATE(time) = %s
    """, (vehicle_id, date_str))
    
    gps_count = cursor.fetchone()[0]
    print(f"GPS tačaka: {gps_count}")
    
    if gps_count == 0:
        print("⚠️ Nema GPS podataka za ovaj datum")
        return False
    
    # Proveri postojeće događaje
    cursor.execute("""
        SELECT COUNT(*) FROM driving_events 
        WHERE vehicle_id = %s AND DATE(time) = %s
    """, (vehicle_id, date_str))
    
    before = cursor.fetchone()[0]
    print(f"Događaja pre detekcije: {before}")
    
    # Pokreni detekciju
    print("Pokrećem detekciju...")
    cursor.execute("""
        SELECT * FROM detect_aggressive_driving_batch(%s, %s, %s::timestamptz, %s::timestamptz)
    """, (vehicle_id, garage_no, start_time, end_time))
    
    result = cursor.fetchone()
    print(f"Detektovano: {result[0]} ukupno ({result[4]} severe, {result[3]} moderate)")
    
    # Commit
    conn.commit()
    
    # Proveri posle
    cursor.execute("""
        SELECT COUNT(*) FROM driving_events 
        WHERE vehicle_id = %s AND DATE(time) = %s
    """, (vehicle_id, date_str))
    
    after = cursor.fetchone()[0]
    print(f"Događaja posle detekcije: {after}")
    print(f"✅ Novo detektovano: {after - before}")
    
    cursor.close()
    return True

def detect_all_vehicles(conn, date_str):
    """Detektuj događaje za sva vozila"""
    cursor = conn.cursor()
    
    print(f"\n🚌 Detekcija za SVA vozila na datum {date_str}")
    print("=" * 70)
    
    # Pronađi sva vozila koja imaju GPS podatke za taj datum
    cursor.execute("""
        SELECT DISTINCT vehicle_id, garage_no 
        FROM gps_data 
        WHERE DATE(time) = %s 
          AND vehicle_id IS NOT NULL
        ORDER BY vehicle_id
    """, (date_str,))
    
    vehicles = cursor.fetchall()
    print(f"Pronađeno {len(vehicles)} vozila sa GPS podacima")
    
    if len(vehicles) == 0:
        print("⚠️ Nema vozila sa GPS podacima za ovaj datum")
        return
    
    success_count = 0
    error_count = 0
    total_events = 0
    
    for vehicle_id, garage_no in vehicles:
        try:
            print(f"\n[{vehicles.index((vehicle_id, garage_no)) + 1}/{len(vehicles)}] Vozilo {garage_no} (ID: {vehicle_id})")
            
            start_time = f"{date_str} 00:00:00"
            end_time = f"{date_str} 23:59:59"
            
            # Pokreni detekciju
            cursor.execute("""
                SELECT * FROM detect_aggressive_driving_batch(%s, %s, %s::timestamptz, %s::timestamptz)
            """, (vehicle_id, garage_no, start_time, end_time))
            
            result = cursor.fetchone()
            events = result[0] if result else 0
            
            if events > 0:
                print(f"  ✅ Detektovano {events} događaja")
                total_events += events
            else:
                print(f"  ℹ️ Nema agresivne vožnje")
            
            success_count += 1
            
            # Commit posle svakog vozila
            conn.commit()
            
        except Exception as e:
            error_count += 1
            print(f"  ❌ Greška: {e}")
            conn.rollback()
    
    print("\n" + "=" * 70)
    print("REZIME:")
    print(f"  ✅ Uspešno: {success_count} vozila")
    print(f"  ❌ Greške: {error_count} vozila")
    print(f"  📊 Ukupno događaja: {total_events}")
    print("=" * 70)
    
    cursor.close()

def main():
    # Učitaj DATABASE_URL iz .env.production
    env_path = '/home/kocev/smart-city/apps/backend/timescale/.env.production'
    
    if not os.path.exists(env_path):
        print("❌ .env.production fajl ne postoji!")
        sys.exit(1)
    
    # Čitaj DATABASE_URL
    database_url = None
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                database_url = line.split('=', 1)[1].strip()
                break
    
    if not database_url:
        print("❌ DATABASE_URL nije pronađen u .env.production!")
        sys.exit(1)
    
    print("=" * 70)
    print("DETEKCIJA AGRESIVNE VOŽNJE - PRODUKCIJA")
    print("=" * 70)
    
    # Pitaj korisnika šta želi
    print("\nOpcije:")
    print("1. Test na jednom vozilu (P93597, 30.08.2025)")
    print("2. Detekcija za SVA vozila za određeni datum")
    print("3. Detekcija za SVA vozila za poslednih 7 dana")
    
    choice = input("\nIzaberite opciju (1-3): ").strip()
    
    try:
        # Poveži se na bazu
        db_config = parse_database_url(database_url)
        conn = psycopg2.connect(**db_config)
        print("✅ Povezan na produkcijsku TimescaleDB bazu")
        
        if choice == '1':
            # Test na jednom vozilu
            test_single_vehicle(conn, 460, 'P93597', '2025-08-30')
            
        elif choice == '2':
            # Detekcija za određeni datum
            date_str = input("Unesite datum (YYYY-MM-DD): ").strip()
            try:
                datetime.strptime(date_str, '%Y-%m-%d')
                detect_all_vehicles(conn, date_str)
            except ValueError:
                print("❌ Neispravan format datuma!")
                
        elif choice == '3':
            # Detekcija za poslednih 7 dana
            confirm = input("⚠️ Ovo može potrajati! Nastaviti? (da/ne): ").strip().lower()
            if confirm == 'da':
                for i in range(7):
                    date = datetime.now() - timedelta(days=i)
                    date_str = date.strftime('%Y-%m-%d')
                    print(f"\n📅 Datum: {date_str}")
                    detect_all_vehicles(conn, date_str)
        else:
            print("❌ Nepoznata opcija!")
            
        conn.close()
        print("\n✅ Završeno!")
        
    except Exception as e:
        print(f"❌ Greška: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()