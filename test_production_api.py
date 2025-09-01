#!/usr/bin/env python3
"""
Test produkcijskog API-ja za aggressive driving
"""

import requests
import json
from datetime import datetime

# Produkcijska konfiguracija
# BASE_URL = "https://adminapi.smart-city.rs/api"
BASE_URL = "http://157.230.119.11:3010/api"  # Direktna IP adresa
LOGIN_URL = f"{BASE_URL}/auth/login"
STATS_URL = f"{BASE_URL}/driving-behavior/vehicle"

# Kredencijali
EMAIL = "admin@smart-city.rs"
PASSWORD = "Test123!"

# Test parametri
VEHICLE_ID = 460  # P93597
START_DATE = "2025-08-30"
END_DATE = "2025-08-30"

def login():
    """Prijavi se i vrati token"""
    print("🔐 Prijavljujem se na PRODUKCIJU...")
    
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    
    response = requests.post(LOGIN_URL, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('accessToken')
        print(f"✅ Uspešna prijava!")
        return token
    else:
        print(f"❌ Greška pri prijavi: {response.status_code}")
        print(response.text)
        return None

def test_statistics(token):
    """Testiraj statistics endpoint"""
    print(f"\n📊 STATISTIKA NA PRODUKCIJI za vozilo {VEHICLE_ID} (P93597)")
    print("-" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE
    }
    
    url = f"{STATS_URL}/{VEHICLE_ID}/statistics"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API poziv uspešan!")
            print("\nStatistika:")
            print(f"  - Safety Score: {data.get('safetyScore', 'N/A')}")
            print(f"  - Ukupno događaja: {data.get('totalEvents', 0)}")
            print(f"  - Ozbiljna ubrzanja: {data.get('severeAccelerations', 0)}")
            print(f"  - Umerena ubrzanja: {data.get('moderateAccelerations', 0)}")
            print(f"  - Ozbiljna kočenja: {data.get('severeBrakings', 0)}")
            print(f"  - Umerena kočenja: {data.get('moderateBrakings', 0)}")
            print(f"  - Max G-sila: {data.get('maxGForce', 0)}")
            print(f"  - Prosečna G-sila: {data.get('avgGForce', 0)}")
            print(f"  - Ukupna distanca (km): {data.get('totalDistanceKm', 0)}")
            
            if data.get('totalEvents', 0) == 0:
                print("\n⚠️ NEMA DOGAĐAJA - potrebna je detekcija!")
                return False
            else:
                print("\n✅ Događaji postoje u bazi!")
                return True
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")
        return False

def test_events(token):
    """Testiraj events endpoint"""
    print(f"\n🚗 DOGAĐAJI NA PRODUKCIJI")
    print("-" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE,
        "page": 1,
        "limit": 5
    }
    
    url = f"{STATS_URL}/{VEHICLE_ID}/events"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Ukupno događaja: {data.get('total', 0)}")
            
            events = data.get('events', [])
            if events:
                print(f"\nPrvih {len(events)} događaja:")
                for event in events:
                    print(f"  - {event.get('time')[:19]}: {event.get('eventType')} " + 
                          f"(severity={event.get('severity')})")
        else:
            print(f"❌ Greška: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")

def main():
    print("=" * 70)
    print("TEST PRODUKCIJSKOG API-JA")
    print(f"Server: {BASE_URL}")
    print(f"Datum: {START_DATE}")
    print("=" * 70)
    
    # Prijavi se
    token = login()
    
    if not token:
        print("Ne mogu da nastavim bez tokena!")
        return
    
    # Testiraj
    has_events = test_statistics(token)
    
    if has_events:
        test_events(token)
    
    print("\n" + "=" * 70)
    if not has_events:
        print("⚠️ ZAKLJUČAK: Potrebno je pokrenuti detekciju događaja na produkciji!")
        print("\nSledeci koraci:")
        print("1. Pristupiti Timescale Cloud bazi")
        print("2. Pokrenuti detect_aggressive_driving_batch funkciju")
        print("3. Testirati ponovo")
    else:
        print("✅ ZAKLJUČAK: Sistem radi na produkciji!")
    print("=" * 70)

if __name__ == "__main__":
    main()