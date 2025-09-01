#!/usr/bin/env python3
"""
Test skripta za driving-behavior API endpoint
"""

import requests
import json
from datetime import datetime, timedelta

# Konfiguracija
BASE_URL = "http://localhost:3010/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
STATS_URL = f"{BASE_URL}/driving-behavior/vehicle"
EVENTS_URL = f"{BASE_URL}/driving-behavior/vehicle"
CHART_URL = f"{BASE_URL}/driving-behavior/vehicle"

# Kredencijali
EMAIL = "admin@smart-city.rs"
PASSWORD = "Test123!"

# Test parametri
VEHICLE_ID = 460
START_DATE = "2025-01-01"
END_DATE = "2025-09-01"

def login():
    """Prijavi se i vrati token"""
    print("🔐 Prijavljujem se...")
    
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    
    response = requests.post(LOGIN_URL, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('accessToken')
        print(f"✅ Uspešna prijava! Token: {token[:50]}...")
        return token
    else:
        print(f"❌ Greška pri prijavi: {response.status_code}")
        print(response.text)
        return None

def test_statistics(token):
    """Testiraj statistics endpoint"""
    print(f"\n📊 Testiram statistics endpoint za vozilo {VEHICLE_ID}...")
    
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
            print("✅ Uspešno!")
            print(json.dumps(data, indent=2))
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            
            # Ako je 500, pokušaj da pročitaš log
            if response.status_code == 500:
                print("\n🔍 Detalji greške:")
                try:
                    error_data = response.json()
                    if 'message' in error_data:
                        print(f"Poruka: {error_data['message']}")
                except:
                    pass
                    
    except Exception as e:
        print(f"❌ Izuzetak: {e}")

def test_events(token):
    """Testiraj events endpoint"""
    print(f"\n🚗 Testiram events endpoint za vozilo {VEHICLE_ID}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE,
        "page": 1,
        "limit": 10
    }
    
    url = f"{EVENTS_URL}/{VEHICLE_ID}/events"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Uspešno!")
            print(f"Ukupno događaja: {data.get('total', 0)}")
            
            events = data.get('events', [])
            if events:
                print(f"Prikazujem prvih {len(events)} događaja:")
                for event in events[:5]:
                    print(f"  - {event.get('time')}: {event.get('eventType')} (severity: {event.get('severity')})")
            else:
                print("Nema događaja u ovom periodu.")
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")

def test_chart_data(token):
    """Testiraj chart-data endpoint"""
    print(f"\n📈 Testiram chart-data endpoint za vozilo {VEHICLE_ID}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE
    }
    
    url = f"{CHART_URL}/{VEHICLE_ID}/chart-data"
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Uspešno!")
            print(f"Vozilo: {data.get('garageNo')}")
            print(f"Period: {data.get('startDate')} - {data.get('endDate')}")
            print(f"Broj tačaka: {data.get('totalPoints')}")
            print(f"Broj događaja: {data.get('eventCount')}")
            
            # Prikaži prvih nekoliko data points
            data_points = data.get('dataPoints', [])
            if data_points:
                print(f"\nPrvih nekoliko tačaka:")
                for point in data_points[:5]:
                    event_info = ""
                    if point.get('eventType'):
                        event_info = f" [EVENT: {point.get('eventType')}]"
                    print(f"  - {point.get('time')}: speed={point.get('speed'):.1f} km/h, acc={point.get('acceleration'):.2f} m/s²{event_info}")
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")

def main():
    """Glavna funkcija"""
    print("=" * 60)
    print("TESTIRANJE DRIVING BEHAVIOR API")
    print("=" * 60)
    
    # Prijavi se
    token = login()
    
    if not token:
        print("Ne mogu da nastavim bez tokena!")
        return
    
    # Testiraj sve endpoint-e
    test_statistics(token)
    test_events(token)
    test_chart_data(token)
    
    print("\n" + "=" * 60)
    print("TESTIRANJE ZAVRŠENO")
    print("=" * 60)

if __name__ == "__main__":
    main()