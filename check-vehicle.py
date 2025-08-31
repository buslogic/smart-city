#!/usr/bin/env python3
import requests
import json

API_BASE = "http://localhost:3010/api"

# Login credentials
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
    
    # First check total count
    response = requests.get(
        f"{API_BASE}/vehicles",
        params={"limit": 1, "page": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        total = response.json().get("total", 0)
        print(f"📊 Total vehicles in database: {total}\n")
    
    # Get vehicles with search
    print("🔍 Searching for P93597...\n")
    response = requests.get(
        f"{API_BASE}/vehicles",
        params={"limit": 2000, "page": 1, "search": "P93597"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        vehicles = data.get("data", [])
        
        print(f"📊 Total vehicles in database: {data.get('total', 0)}\n")
        
        # Search for P93597
        found = False
        for vehicle in vehicles:
            if "P93597" in str(vehicle.get("garageNumber", "")):
                found = True
                print("✅ FOUND VEHICLE P93597:")
                print(f"   ID: {vehicle.get('id')}")
                print(f"   Garage Number: {vehicle.get('garageNumber')}")
                print(f"   Registration: {vehicle.get('registrationNumber')}")
                print(f"   Make: {vehicle.get('make')}")
                print(f"   Model: {vehicle.get('model')}")
                print(f"   Legacy ID: {vehicle.get('legacyId')}")
                print(f"   Active: {vehicle.get('isActive')}")
                break
        
        if not found:
            print("❌ Vehicle P93597 NOT found in bus_vehicle table\n")
            print("Listing all vehicles:")
            for i, vehicle in enumerate(vehicles[:10], 1):
                print(f"{i}. {vehicle.get('garageNumber')} - {vehicle.get('registrationNumber')} (ID: {vehicle.get('id')})")
            
            if len(vehicles) > 10:
                print(f"... and {len(vehicles) - 10} more vehicles")
                
            # Check if there's a vehicle with ID 460
            print("\n🔍 Checking for vehicle with ID 460:")
            for vehicle in vehicles:
                if vehicle.get('id') == 460:
                    print(f"Found: {vehicle.get('garageNumber')} - {vehicle.get('registrationNumber')}")
                    break
            else:
                print("Vehicle with ID 460 not found")
    else:
        print(f"Failed to get vehicles: {response.status_code}")
else:
    print(f"Login failed: {response.status_code}")