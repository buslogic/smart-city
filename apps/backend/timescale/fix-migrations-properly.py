#!/usr/bin/env python3
"""
Pravilno označava migracije u schema_migrations kako dbmate očekuje
"""
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="smartcity_gps",
    user="smartcity_ts",
    password="TimescalePass123!"
)

cur = conn.cursor()

print("=== POPRAVKA MIGRACIJA PO DBMATE VODIČU ===\n")

# 1. Očisti postojeće
print("1. Čistim schema_migrations...")
cur.execute("DELETE FROM schema_migrations")
conn.commit()
print(f"   Obrisano {cur.rowcount} redova\n")

# 2. Proveri koje migracije su STVARNO primenjene
print("2. Proveram koje su migracije STVARNO primenjene...\n")

# Proveri prvu migraciju
tables_exist = True
cur.execute("""
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_name IN ('gps_data', 'driving_events', 'api_keys')
""")
table_count = cur.fetchone()[0]
print(f"   - Tabele iz prve migracije: {table_count}/3")

if table_count == 3:
    # Označi prvu kao primenjenu - BEZ .sql ekstenzije!
    cur.execute("INSERT INTO schema_migrations (version) VALUES ('20250901_001_initial_seed')")
    conn.commit()
    print("   ✅ Prva migracija označena kao primenjena\n")
else:
    print("   ❌ Prva migracija NIJE potpuno primenjena\n")

# Proveri drugu migraciju
cur.execute("""
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'driving_events'
      AND column_name IN ('acceleration_value', 'g_force')
""")
column_count = cur.fetchone()[0]
print(f"   - Kolone iz druge migracije: {column_count}/2")

if column_count == 2:
    # Označi drugu kao primenjenu - BEZ .sql ekstenzije!
    cur.execute("INSERT INTO schema_migrations (version) VALUES ('20250901_002_aggressive_driving_detection')")
    conn.commit()
    print("   ✅ Druga migracija označena kao primenjena\n")
else:
    print("   ❌ Druga migracija NIJE primenjena (što je OK, pokrećemo je)\n")

# 3. Prikaži finalno stanje
print("3. Finalno stanje schema_migrations:")
cur.execute("SELECT version FROM schema_migrations ORDER BY version")
for row in cur.fetchall():
    print(f"   - {row[0]}")

cur.close()
conn.close()

print("\n" + "=" * 60)
print("Sada pokreni:")
print("cd /home/kocev/smart-city/apps/backend/timescale")
print("export PATH=$PATH:~/bin")
print("dbmate --migrations-dir ./migrations status")
print("=" * 60)