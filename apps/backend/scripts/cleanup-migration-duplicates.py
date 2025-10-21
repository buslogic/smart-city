#!/usr/bin/env python3
"""
Script to clean up duplicate migration records from _prisma_migrations table.
This is necessary when Prisma creates duplicate entries that block migration execution.
"""

import mysql.connector
import sys

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'port': 3325,
    'user': 'root',
    'password': 'root_password',
    'database': 'smartcity_dev'
}

MIGRATION_NAME = '20251011135004_add_turnusi_permissions'

def main():
    try:
        # Connect to database
        print(f"Povezivanje na bazu {DB_CONFIG['database']}...")
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check current state
        print(f"\n1. Provera trenutnog stanja za migraciju: {MIGRATION_NAME}")
        cursor.execute("""
            SELECT id, migration_name, finished_at, rolled_back_at, applied_steps_count
            FROM _prisma_migrations
            WHERE migration_name = %s
        """, (MIGRATION_NAME,))

        rows = cursor.fetchall()
        print(f"   Pronađeno {len(rows)} redova:")
        for row in rows:
            print(f"   - ID: {row[0]}, finished_at: {row[2]}, rolled_back_at: {row[3]}, steps: {row[4]}")

        if len(rows) == 0:
            print("\n✅ Nema duplikata - tabela je čista!")
            return

        # Delete all records for this migration
        print(f"\n2. Brisanje svih zapisa za migraciju {MIGRATION_NAME}...")
        cursor.execute("""
            DELETE FROM _prisma_migrations
            WHERE migration_name = %s
        """, (MIGRATION_NAME,))

        deleted_count = cursor.rowcount
        conn.commit()

        print(f"   ✅ Obrisano {deleted_count} reda")

        # Verify deletion
        print(f"\n3. Verifikacija - provera da li su zapisi obrisani...")
        cursor.execute("""
            SELECT COUNT(*)
            FROM _prisma_migrations
            WHERE migration_name = %s
        """, (MIGRATION_NAME,))

        count = cursor.fetchone()[0]

        if count == 0:
            print(f"   ✅ Uspešno! Tabela je očišćena.")
            print(f"\n📋 SLEDEĆI KORACI:")
            print(f"   1. Pokreni: npx prisma migrate deploy")
            print(f"   2. Proveri da su permisije dodate u bazu")
        else:
            print(f"   ❌ GREŠKA: Još uvek postoji {count} reda!")

    except mysql.connector.Error as err:
        print(f"\n❌ MySQL greška: {err}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Greška: {e}")
        sys.exit(1)
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
            print("\n✅ Konekcija zatvorena")

if __name__ == "__main__":
    main()
