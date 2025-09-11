#!/usr/bin/env python3
"""
Skripta za brisanje test API ključeva iz baze podataka
"""

import mysql.connector
import os
from datetime import datetime

def cleanup_test_api_keys():
    # Konekcija na lokalnu MySQL bazu
    connection = mysql.connector.connect(
        host='localhost',
        port=3325,
        user='smartcity_user',
        password='SecurePassword123!',
        database='smartcity_dev'
    )
    
    cursor = connection.cursor()
    
    try:
        # Prvo prikaži postojeće ključeve
        cursor.execute("SELECT id, name, created_at FROM api_keys ORDER BY id")
        existing_keys = cursor.fetchall()
        
        print("🔍 Postojeći API ključevi:")
        for key_id, name, created_at in existing_keys:
            print(f"  ID: {key_id}, Name: {name}, Created: {created_at}")
        
        # Obriši test ključeve (ID 3 i 4)
        test_key_ids = [3, 4]
        
        for key_id in test_key_ids:
            cursor.execute("SELECT name FROM api_keys WHERE id = %s", (key_id,))
            result = cursor.fetchone()
            
            if result:
                key_name = result[0]
                cursor.execute("DELETE FROM api_keys WHERE id = %s", (key_id,))
                print(f"✅ Obrisan API ključ: ID {key_id} - {key_name}")
            else:
                print(f"ℹ️  API ključ sa ID {key_id} ne postoji")
        
        connection.commit()
        
        # Prikaži finalne ključeve
        cursor.execute("SELECT id, name, created_at FROM api_keys ORDER BY id")
        final_keys = cursor.fetchall()
        
        print("\n🔍 Finalni API ključevi:")
        for key_id, name, created_at in final_keys:
            print(f"  ID: {key_id}, Name: {name}, Created: {created_at}")
            
    except Exception as e:
        print(f"❌ Greška: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    print("🧹 Pokretanje cleanup skripte za test API ključeve...")
    cleanup_test_api_keys()
    print("✅ Cleanup završen!")