#!/usr/bin/env python3
import requests
import json

# Test login preko admin portala
admin_url = "https://smart-city-admin.vercel.app"
api_url = "https://gsp-api.smart-city.rs/api"

print("🔍 Testiram Admin Portal...\n")

# 1. Proveri da li admin portal radi
try:
    response = requests.get(admin_url, timeout=5)
    print(f"✅ Admin Portal dostupan na: {admin_url}")
    print(f"   Status: {response.status_code}")
except Exception as e:
    print(f"❌ Admin Portal nedostupan: {e}")
    exit(1)

# 2. Test login preko API-ja
print("\n📝 Testiram login...")
credentials = {
    "email": "admin@smart-city.rs",
    "password": "Test123!"
}

try:
    response = requests.post(
        f"{api_url}/auth/login",
        json=credentials,
        headers={"Content-Type": "application/json", "Origin": admin_url}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login uspešan!")
        token = data.get('accessToken')
        
        # 3. Test protected endpoint
        if token:
            print("\n🔐 Testiram protected endpoint...")
            headers = {
                "Authorization": f"Bearer {token}",
                "Origin": admin_url
            }
            
            # Test legacy-databases endpoint
            test_response = requests.get(f"{api_url}/legacy-databases", headers=headers)
            if test_response.status_code == 200:
                print("✅ Pristup legacy-databases dozvoljen!")
            else:
                print(f"❌ Pristup odbijen: {test_response.status_code}")
                print(f"   Response: {test_response.text[:200]}")
            
            # Test vehicles endpoint
            test_response = requests.get(f"{api_url}/vehicles", headers=headers)
            if test_response.status_code == 200:
                print("✅ Pristup vehicles dozvoljen!")
                vehicles_data = test_response.json()
                if 'data' in vehicles_data:
                    print(f"   Broj vozila: {len(vehicles_data['data'])}")
            else:
                print(f"❌ Pristup vehicles odbijen: {test_response.status_code}")
    else:
        print(f"❌ Login neuspešan: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"❌ Greška: {e}")

print("\n📊 Rezime:")
print(f"- Admin Portal: https://smart-city-admin.vercel.app ✅")
print(f"- API Backend: https://gsp-api.smart-city.rs ✅")
print(f"- DNS za gsp-admin.smart-city.rs: ❌ Treba podesiti")