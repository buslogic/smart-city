#!/usr/bin/env python3
"""
Debug skripta za chart data i severity na produkciji
"""

import requests
import json

# Konfiguracija
BASE_URL = "http://157.230.119.11:3010/api"
LOGIN_URL = f"{BASE_URL}/auth/login"

# Kredencijali
EMAIL = "admin@smart-city.rs"
PASSWORD = "Test123!"

# Test parametri
VEHICLE_ID = 460  # P93597
START_DATE = "2025-08-30"
END_DATE = "2025-08-30"

def login():
    """Prijavi se i vrati token"""
    payload = {"email": EMAIL, "password": PASSWORD}
    response = requests.post(LOGIN_URL, json=payload)
    if response.status_code == 200:
        return response.json().get('accessToken')
    return None

def test_chart_data(token):
    """Testiraj chart-data endpoint i analiziraj severity"""
    print("=" * 70)
    print("CHART DATA ANALIZA - PRODUKCIJA")
    print("=" * 70)
    
    headers = {"Authorization": f"Bearer {token}"}
    params = {"startDate": START_DATE, "endDate": END_DATE}
    
    url = f"{BASE_URL}/driving-behavior/vehicle/{VEHICLE_ID}/chart-data"
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n📊 Osnovni podaci:")
        print(f"  - Ukupno tačaka: {data.get('totalPoints')}")
        print(f"  - Broj događaja: {data.get('eventCount')}")
        
        # Analiziraj severity u data points
        severity_analysis = {}
        event_types = {}
        sample_events = {"severe": [], "moderate": [], "normal": []}
        
        for point in data.get('dataPoints', []):
            if point.get('eventType'):
                # Analiziraj tip severity podatka
                severity = point.get('severity')
                severity_type = type(severity).__name__
                severity_key = f"{severity} ({severity_type})"
                
                severity_analysis[severity_key] = severity_analysis.get(severity_key, 0) + 1
                
                # Grupiši po event type
                evt = point.get('eventType')
                event_types[evt] = event_types.get(evt, 0) + 1
                
                # Sačuvaj primere
                if isinstance(severity, int):
                    if severity >= 4 and len(sample_events["severe"]) < 3:
                        sample_events["severe"].append(point)
                    elif severity == 3 and len(sample_events["moderate"]) < 3:
                        sample_events["moderate"].append(point)
                    elif severity <= 2 and len(sample_events["normal"]) < 3:
                        sample_events["normal"].append(point)
        
        print(f"\n🔍 Analiza severity vrednosti:")
        for key, count in sorted(severity_analysis.items()):
            print(f"  - severity={key}: {count} tačaka")
        
        print(f"\n📈 Tipovi događaja:")
        for evt, count in event_types.items():
            print(f"  - {evt}: {count}")
        
        print(f"\n🎨 Primeri događaja po severity:")
        
        print("\n  SEVERE (trebalo bi crveno):")
        if sample_events["severe"]:
            for event in sample_events["severe"]:
                print(f"    - {event['time'][:19]}: {event['eventType']}, severity={event['severity']}, acc={event['acceleration']:.2f}")
        else:
            print("    ⚠️ NEMA SEVERE DOGAĐAJA!")
        
        print("\n  MODERATE (trebalo bi narandžasto):")
        if sample_events["moderate"]:
            for event in sample_events["moderate"]:
                print(f"    - {event['time'][:19]}: {event['eventType']}, severity={event['severity']}, acc={event['acceleration']:.2f}")
        else:
            print("    ⚠️ NEMA MODERATE DOGAĐAJA!")
        
        print("\n  NORMAL (zeleno):")
        for event in sample_events["normal"][:3]:
            print(f"    - {event['time'][:19]}: {event['eventType']}, severity={event['severity']}, acc={event['acceleration']:.2f}")
        
        return data
    else:
        print(f"❌ Greška: {response.status_code}")
        return None

def test_events_with_filters(token):
    """Testiraj events endpoint sa različitim filterima"""
    print("\n" + "=" * 70)
    print("EVENTS SA FILTERIMA - PRODUKCIJA")
    print("=" * 70)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    filters = [
        ("bez filtera", None),
        ("severe", "severe"),
        ("moderate", "moderate"),
        ("normal", "normal")
    ]
    
    for filter_name, severity_filter in filters:
        params = {
            "startDate": START_DATE,
            "endDate": END_DATE,
            "page": 1,
            "limit": 5
        }
        
        if severity_filter:
            params["severity"] = severity_filter
        
        url = f"{BASE_URL}/driving-behavior/vehicle/{VEHICLE_ID}/events"
        response = requests.get(url, headers=headers, params=params)
        
        print(f"\n🔍 Filter: {filter_name}")
        
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            events = data.get('events', [])
            
            print(f"  Ukupno: {total}")
            
            if events:
                print(f"  Primeri:")
                for event in events[:3]:
                    severity = event.get('severity')
                    print(f"    - {event.get('eventType')}: severity={severity} (tip: {type(severity).__name__})")
            else:
                print(f"  ⚠️ Nema događaja")
        else:
            print(f"  ❌ Greška: {response.status_code}")
            if response.status_code == 400:
                print(f"  Detalji: {response.text}")

def main():
    print("🔐 Prijavljivanje...")
    token = login()
    
    if not token:
        print("❌ Neuspešna prijava!")
        return
    
    print("✅ Prijavljen!\n")
    
    # Test chart data
    chart_data = test_chart_data(token)
    
    # Test events sa filterima
    test_events_with_filters(token)
    
    print("\n" + "=" * 70)
    print("ZAKLJUČAK:")
    print("-" * 70)
    
    if chart_data:
        event_count = chart_data.get('eventCount', 0)
        if event_count > 0:
            print("📊 Chart data sadrži događaje")
            print("\nMogući problemi:")
            print("1. Severity se možda ne mapira pravilno (int vs string)")
            print("2. Frontend možda filtrira podatke")
            print("3. Možda nedostaju severe/moderate događaji u trenutnom sample-u")
        else:
            print("⚠️ Chart data NEMA događaje!")
    
    print("=" * 70)

if __name__ == "__main__":
    main()