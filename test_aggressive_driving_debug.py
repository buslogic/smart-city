#!/usr/bin/env python3
"""
Debug skripta za aggressive driving problem
Testira datum 30.08.2025 za vozilo P93597 (ID: 460)
"""

import requests
import json
from datetime import datetime

# Konfiguracija
BASE_URL = "http://localhost:3010/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
STATS_URL = f"{BASE_URL}/driving-behavior/vehicle"
EVENTS_URL = f"{BASE_URL}/driving-behavior/vehicle"
CHART_URL = f"{BASE_URL}/driving-behavior/vehicle"

# Kredencijali
EMAIL = "admin@smart-city.rs"
PASSWORD = "Test123!"

# Test parametri - specifično za problem
VEHICLE_ID = 460  # P93597
START_DATE = "2025-08-30"
END_DATE = "2025-08-30"

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
        print(f"✅ Uspešna prijava!")
        return token
    else:
        print(f"❌ Greška pri prijavi: {response.status_code}")
        print(response.text)
        return None

def test_statistics(token):
    """Testiraj statistics endpoint"""
    print(f"\n📊 STATISTIKA za vozilo {VEHICLE_ID} (P93597) na datum {START_DATE}")
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
            print(f"  - Događaja na 100km: {data.get('eventsPer100Km', 0)}")
            return data
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")
    
    return None

def test_events(token):
    """Testiraj events endpoint"""
    print(f"\n🚗 DOGAĐAJI za vozilo {VEHICLE_ID} (P93597) na datum {START_DATE}")
    print("-" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Test sa različitim severity filterima
    severities = [None, 'severe', 'moderate', 'all']
    
    for severity in severities:
        params = {
            "startDate": START_DATE,
            "endDate": END_DATE,
            "page": 1,
            "limit": 10
        }
        
        if severity:
            params["severity"] = severity
            
        url = f"{EVENTS_URL}/{VEHICLE_ID}/events"
        
        severity_label = severity if severity else "bez filtera"
        print(f"\nTestiram sa severity = '{severity_label}':")
        
        try:
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Ukupno događaja: {data.get('total', 0)}")
                
                events = data.get('events', [])
                if events:
                    print(f"  Prikazujem prvih {min(3, len(events))} događaja:")
                    for event in events[:3]:
                        print(f"    - {event.get('time')[:19]}: {event.get('eventType')} " + 
                              f"(severity={event.get('severity')}, g-force={event.get('gForce'):.2f})")
                else:
                    print("  ⚠️ Nema događaja")
            else:
                print(f"  ❌ Greška: {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ Izuzetak: {e}")

def test_chart_data(token):
    """Testiraj chart-data endpoint"""
    print(f"\n📈 CHART DATA za vozilo {VEHICLE_ID} (P93597) na datum {START_DATE}")
    print("-" * 60)
    
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
            print("✅ API poziv uspešan!")
            print(f"  - Vozilo: {data.get('garageNo')}")
            print(f"  - Period: {data.get('startDate')} - {data.get('endDate')}")
            print(f"  - Broj GPS tačaka: {data.get('totalPoints')}")
            print(f"  - Broj događaja: {data.get('eventCount')}")
            
            # Analiza data points
            data_points = data.get('dataPoints', [])
            events_in_points = 0
            event_types = {}
            
            for point in data_points:
                if point.get('eventType'):
                    events_in_points += 1
                    event_type = point.get('eventType')
                    severity = point.get('severity')
                    key = f"{event_type}_{severity}"
                    event_types[key] = event_types.get(key, 0) + 1
            
            print(f"\n  Analiza {len(data_points)} tačaka:")
            print(f"    - Tačke sa događajima: {events_in_points}")
            print(f"    - Tačke bez događaja: {len(data_points) - events_in_points}")
            
            if event_types:
                print("\n  Tipovi događaja u grafikonu:")
                for key, count in event_types.items():
                    print(f"    - {key}: {count}")
            else:
                print("\n  ⚠️ PROBLEM: Nema događaja u data points!")
                
            # Prikaži nekoliko tačaka sa događajima
            print("\n  Primeri tačaka SA događajima:")
            shown = 0
            for point in data_points:
                if point.get('eventType') and shown < 3:
                    print(f"    - {point.get('time')[:19]}: {point.get('eventType')} " +
                          f"(severity={point.get('severity')}, acc={point.get('acceleration'):.2f})")
                    shown += 1
                    
            if shown == 0:
                print("    ⚠️ Nema tačaka sa događajima!")
                
        else:
            print(f"❌ Greška: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Izuzetak: {e}")

def main():
    """Glavna funkcija"""
    print("=" * 70)
    print("DEBUG: AGGRESSIVE DRIVING - Vozilo P93597, Datum 30.08.2025")
    print("=" * 70)
    
    # Prijavi se
    token = login()
    
    if not token:
        print("Ne mogu da nastavim bez tokena!")
        return
    
    # Testiraj sve endpoint-e
    stats = test_statistics(token)
    test_events(token)
    test_chart_data(token)
    
    print("\n" + "=" * 70)
    print("REZIME PROBLEMA:")
    print("-" * 70)
    
    if stats:
        if stats.get('totalEvents', 0) == 0:
            print("❌ PROBLEM 1: Nema događaja u statistici")
        if stats.get('safetyScore', 100) == 100:
            print("❌ PROBLEM 2: Safety Score je 100 (default)")
    
    print("\nMogući uzroci:")
    print("1. Događaji nisu detektovani u bazi")
    print("2. Problem sa mapiranjem event_type enum vrednosti")
    print("3. Problem sa severity integer/string konverzijom")
    print("4. SQL funkcije ne vraćaju podatke")
    
    print("=" * 70)

if __name__ == "__main__":
    main()