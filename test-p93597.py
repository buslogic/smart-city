#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

API_BASE = "http://localhost:3010/api"

credentials = {
    "email": "admin@smart-city.rs",
    "password": "Test123!"
}

# Login
response = requests.post(
    f"{API_BASE}/auth/login",
    headers={"Content-Type": "application/json"},
    data=json.dumps(credentials)
)

if response.status_code == 200:
    token = response.json().get("accessToken")
    print("✅ Logged in successfully\n")
    
    # Test vehicle P93597 (ID 460)
    vehicle_id = 460
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    params = {
        "vehicleId": vehicle_id,
        "startDate": start_date.isoformat() + "Z",
        "endDate": end_date.isoformat() + "Z"
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"📊 Testing GPS Analytics for vehicle P93597 (ID: {vehicle_id})")
    print(f"   Period: {start_date.strftime('%Y-%m-%d')} - {end_date.strftime('%Y-%m-%d')}")
    
    response = requests.get(
        f"{API_BASE}/gps-analytics/vehicle",
        headers=headers,
        params=params
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ GPS Analytics retrieved successfully!")
        print(f"   - Total GPS Points: {data.get('totalPoints', 0)}")
        print(f"   - Total Distance: {data.get('totalDistance', 0):.2f} km")
        print(f"   - Average Speed: {data.get('avgSpeed', 0):.1f} km/h")
        print(f"   - Max Speed: {data.get('maxSpeed', 0)} km/h")
    else:
        print(f"❌ Error: {response.text}")
else:
    print(f"Login failed: {response.status_code}")
