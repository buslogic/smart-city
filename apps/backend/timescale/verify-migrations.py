#!/usr/bin/env python3
"""
Verifikuje da li su migracije STVARNO primenjene
Ovo rešava dbmate problem gde označava migracije kao primenjene čak i kad SQL padne
"""
import psycopg2
import sys
from datetime import datetime

# Definiši šta svaka migracija treba da kreira
MIGRATION_CHECKS = {
    '20250901_001_initial_seed.sql': {
        'tables': ['gps_data', 'driving_events', 'api_keys'],
        'functions': ['set_gps_location', 'update_garage_number', 'calculate_vehicle_mileage'],
        'views': ['current_vehicle_positions', 'vehicle_summary'],
        'aggregates': ['vehicle_hourly_stats', 'daily_vehicle_stats'],
        'constraints': ['gps_vehicle_time_unique']
    },
    '20250901_002_aggressive_driving_detection.sql': {
        'tables': [],
        'functions': ['detect_aggressive_driving_batch'],
        'columns': {
            'driving_events': ['acceleration_value', 'g_force']
        },
        'views': [],
        'aggregates': [],
        'constraints': []
    }
}

def check_table_exists(cur, table_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = %s
        )
    """, (table_name,))
    return cur.fetchone()[0]

def check_function_exists(cur, function_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = %s
        )
    """, (function_name,))
    return cur.fetchone()[0]

def check_view_exists(cur, view_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = %s
        )
    """, (view_name,))
    return cur.fetchone()[0]

def check_aggregate_exists(cur, aggregate_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM timescaledb_information.continuous_aggregates 
            WHERE view_name = %s
        )
    """, (aggregate_name,))
    return cur.fetchone()[0]

def check_constraint_exists(cur, constraint_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = %s
        )
    """, (constraint_name,))
    return cur.fetchone()[0]

def check_column_exists(cur, table_name, column_name):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        )
    """, (table_name, column_name))
    return cur.fetchone()[0]

def verify_migration(cur, migration_name, checks):
    print(f"\n📋 Verifikacija: {migration_name}")
    print("=" * 60)
    
    all_ok = True
    
    # Proveri tabele
    if checks['tables']:
        print("  Tabele:")
        for table in checks['tables']:
            exists = check_table_exists(cur, table)
            status = "✅" if exists else "❌"
            print(f"    {status} {table}")
            if not exists:
                all_ok = False
    
    # Proveri funkcije
    if checks['functions']:
        print("  Funkcije:")
        for func in checks['functions']:
            exists = check_function_exists(cur, func)
            status = "✅" if exists else "❌"
            print(f"    {status} {func}")
            if not exists:
                all_ok = False
    
    # Proveri kolone
    if 'columns' in checks and checks['columns']:
        print("  Kolone:")
        for table, columns in checks['columns'].items():
            for column in columns:
                exists = check_column_exists(cur, table, column)
                status = "✅" if exists else "❌"
                print(f"    {status} {table}.{column}")
                if not exists:
                    all_ok = False
    
    # Proveri view-ove
    if checks['views']:
        print("  View-ovi:")
        for view in checks['views']:
            exists = check_view_exists(cur, view)
            status = "✅" if exists else "❌"
            print(f"    {status} {view}")
            if not exists:
                all_ok = False
    
    # Proveri continuous aggregates
    if checks['aggregates']:
        print("  Continuous Aggregates:")
        for agg in checks['aggregates']:
            exists = check_aggregate_exists(cur, agg)
            status = "✅" if exists else "❌"
            print(f"    {status} {agg}")
            if not exists:
                all_ok = False
    
    # Proveri constraints
    if checks['constraints']:
        print("  Constraints:")
        for constraint in checks['constraints']:
            exists = check_constraint_exists(cur, constraint)
            status = "✅" if exists else "❌"
            print(f"    {status} {constraint}")
            if not exists:
                all_ok = False
    
    return all_ok

def main():
    conn = psycopg2.connect(
        host="localhost",
        port=5433,
        database="smartcity_gps",
        user="smartcity_ts",
        password="TimescalePass123!"
    )
    
    cur = conn.cursor()
    
    print("=" * 60)
    print("VERIFIKACIJA MIGRACIJA - DBMATE FIX")
    print("=" * 60)
    
    # Dohvati migracije iz schema_migrations
    cur.execute("SELECT version FROM schema_migrations ORDER BY version")
    applied_migrations = [row[0] for row in cur.fetchall()]
    
    print(f"\n📋 Dbmate tvrdi da su primenjene {len(applied_migrations)} migracije:")
    for mig in applied_migrations:
        print(f"  - {mig}")
    
    # Verifikuj svaku migraciju
    all_good = True
    for migration_name, checks in MIGRATION_CHECKS.items():
        if migration_name.replace('.sql', '') in ' '.join(applied_migrations):
            result = verify_migration(cur, migration_name, checks)
            if not result:
                all_good = False
                print(f"  ⚠️ MIGRACIJA {migration_name} NIJE POTPUNO PRIMENJENA!")
    
    print("\n" + "=" * 60)
    if all_good:
        print("✅ SVE MIGRACIJE SU USPEŠNO PRIMENJENE")
    else:
        print("❌ NEKE MIGRACIJE NISU POTPUNO PRIMENJENE")
        print("\n💡 PREPORUKE:")
        print("1. Ponovo pokreni migracije koje nisu prošle")
        print("2. Ili ručno izvrši SQL koji nedostaje")
        print("3. Koristi ovu skriptu posle svakog dbmate up")
    print("=" * 60)
    
    cur.close()
    conn.close()
    
    return 0 if all_good else 1

if __name__ == "__main__":
    sys.exit(main())