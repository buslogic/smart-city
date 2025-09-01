#!/usr/bin/env python3
"""
Test skripta za proveru boja na grafikonu
"""

import requests
import json

# Konfiguracija
BASE_URL = "http://localhost:3010/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
CHART_URL = f"{BASE_URL}/driving-behavior/vehicle"

# Kredencijali
EMAIL = "admin@smart-city.rs"
PASSWORD = "Test123!"

# Test parametri
VEHICLE_ID = 460  # P93597
START_DATE = "2025-08-30"
END_DATE = "2025-08-30"

def login():
    """Prijavi se i vrati token"""
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    
    response = requests.post(LOGIN_URL, json=payload)
    if response.status_code == 200:
        return response.json().get('accessToken')
    return None

def test_chart_data(token):
    """Testiraj chart-data endpoint i analiziraj severity vrednosti"""
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    params = {
        "startDate": START_DATE,
        "endDate": END_DATE
    }
    
    url = f"{CHART_URL}/{VEHICLE_ID}/chart-data"
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        
        # Analiziraj severity vrednosti
        severity_types = {}
        events_with_severity = []
        
        for point in data.get('dataPoints', []):
            if point.get('eventType'):
                severity = point.get('severity')
                severity_type = type(severity).__name__
                severity_types[severity_type] = severity_types.get(severity_type, 0) + 1
                
                # Dodaj u listu za analizu
                if len(events_with_severity) < 10:  # Samo prvih 10
                    events_with_severity.append({
                        'time': point['time'][:19],
                        'eventType': point['eventType'],
                        'severity': severity,
                        'severity_type': severity_type,
                        'acceleration': point.get('acceleration', 0)
                    })
        
        print("=" * 70)
        print("ANALIZA SEVERITY VREDNOSTI U CHART DATA")
        print("=" * 70)
        
        print(f"\nUkupno tačaka: {data.get('totalPoints')}")
        print(f"Događaja: {data.get('eventCount')}")
        
        print("\nTipovi severity vrednosti:")
        for typ, count in severity_types.items():
            print(f"  - {typ}: {count}")
        
        print("\nPrimeri događaja sa severity:")
        for event in events_with_severity:
            severity_display = event['severity']
            color = "?"
            
            # Proveri kako bi frontend interpretirao ovu vrednost
            if isinstance(event['severity'], int):
                if event['severity'] >= 4:
                    color = "🔴 CRVENA (severe)"
                elif event['severity'] == 3:
                    color = "🟠 NARANDŽASTA (moderate)"
                else:
                    color = "🟢 ZELENA (normal)"
            elif isinstance(event['severity'], str):
                if event['severity'] == 'severe':
                    color = "🔴 CRVENA"
                elif event['severity'] == 'moderate':
                    color = "🟠 NARANDŽASTA"
                else:
                    color = "🟢 ZELENA"
            
            print(f"  {event['time']}: {event['eventType']}")
            print(f"    severity={severity_display} (tip: {event['severity_type']}) -> {color}")
            print(f"    acceleration={event['acceleration']:.2f} m/s²")
            print()
        
        # Proveri da li ima ozbiljnih i umerenih događaja
        severe_count = 0
        moderate_count = 0
        normal_count = 0
        
        for point in data.get('dataPoints', []):
            if point.get('eventType'):
                severity = point.get('severity')
                if isinstance(severity, int):
                    if severity >= 4:
                        severe_count += 1
                    elif severity == 3:
                        moderate_count += 1
                    else:
                        normal_count += 1
        
        print("SUMARNO:")
        print(f"  - Normal (zelena): {normal_count}")
        print(f"  - Moderate (narandžasta): {moderate_count}")
        print(f"  - Severe (crvena): {severe_count}")
        
        if severe_count > 0 and moderate_count > 0:
            print("\n✅ Trebalo bi da se vide sve tri boje na grafikonu!")
        elif severe_count == 0 and moderate_count == 0:
            print("\n⚠️ Nema moderate i severe događaja - samo zelene tačke!")
        
        print("=" * 70)

def main():
    token = login()
    if not token:
        print("Ne mogu da se prijavim!")
        return
    
    test_chart_data(token)

if __name__ == "__main__":
    main()