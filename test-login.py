#!/usr/bin/env python3
import requests
import json

# API endpoint
url = "https://gsp-api.smart-city.rs/api/auth/login"

# Kredencijali
credentials = {
    "email": "admin@smart-city.rs",
    "password": "Test123!"
}

# Headers
headers = {
    "Content-Type": "application/json"
}

try:
    # Pošalji login request
    response = requests.post(url, json=credentials, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login uspešan!")
        print(f"Access Token: {data.get('accessToken', 'N/A')[:50]}...")  # Prikaži prvih 50 karaktera
        print(f"Refresh Token: {data.get('refreshToken', 'N/A')[:50]}...")
        
        # Sačuvaj token za dalju upotrebu
        with open('token.txt', 'w') as f:
            f.write(data.get('accessToken', ''))
        print("\nToken sačuvan u token.txt")
        
        # Testiraj pristup legacy-databases endpoint-u
        if data.get('accessToken'):
            test_url = "https://gsp-api.smart-city.rs/api/legacy-databases"
            test_headers = {
                "Authorization": f"Bearer {data['accessToken']}"
            }
            test_response = requests.get(test_url, headers=test_headers)
            print(f"\n📊 Test legacy-databases endpoint:")
            print(f"   Status: {test_response.status_code}")
            if test_response.status_code == 200:
                print("   ✅ Pristup dozvoljen!")
            else:
                print(f"   ❌ Pristup odbijen: {test_response.text}")
    else:
        print(f"❌ Login neuspešan!")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ Greška: {e}")