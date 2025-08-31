#!/usr/bin/env python3
import requests
import json

API_BASE = "http://localhost:3010/api"

# First login as admin
credentials = {
    "email": "admin@smart-city.rs", 
    "password": "Test123!"
}

response = requests.post(
    f"{API_BASE}/auth/login",
    headers={"Content-Type": "application/json"},
    data=json.dumps(credentials)
)

if response.status_code == 200:
    data = response.json()
    token = data.get("accessToken")
    print(f"✅ Logged in successfully")
    
    # Get user details
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Get current user
    response = requests.get(f"{API_BASE}/auth/me", headers=headers)
    if response.status_code == 200:
        user_data = response.json()
        print(f"User: {user_data.get('email')}")
        print(f"Roles: {user_data.get('roles', [])}")
        print(f"Permissions: {user_data.get('permissions', [])}")
        
        # Check if dispatcher:view_analytics is in permissions
        permissions = user_data.get('permissions', [])
        if 'dispatcher:view_analytics' in permissions:
            print("✅ User has dispatcher:view_analytics permission")
        else:
            print("❌ User does NOT have dispatcher:view_analytics permission")
            print("\nAll permissions:")
            for perm in sorted(permissions):
                print(f"  - {perm}")
    else:
        print(f"Failed to get user info: {response.status_code}")
        print(response.text)
else:
    print(f"Login failed: {response.status_code}")
    print(response.text)