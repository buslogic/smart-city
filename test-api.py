#!/usr/bin/env python3
import requests
import json

# API base URL
BASE_URL = "http://localhost:3010/api"

# Login credentials
credentials = {
    "email": "admin@smart-city.rs",
    "password": "Test123!"
}

def login():
    """Login and get access token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
        if response.status_code in [200, 201]:
            data = response.json()
            print("Login successful!")
            print(f"Access Token: {data['accessToken'][:50]}...")
            print(f"User: {data['user']['email']}")
            print(f"Roles: {', '.join(data['user'].get('roles', []))}")
            return data['accessToken']
        else:
            print(f"Login failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def get_users(token):
    """Get users list"""
    try:
        headers = {
            "Authorization": f"Bearer {token}"
        }
        response = requests.get(f"{BASE_URL}/users", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"\nUsers found: {data['total']}")
            for user in data['data']:
                roles = user.get('roles', [])
                print(f"- {user['firstName']} {user['lastName']} ({user['email']}) - Roles: {', '.join(roles) if roles else 'No roles'}")
            return data
        else:
            print(f"Failed to get users: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("Testing Smart City API...")
    print("-" * 40)
    
    # Login
    token = login()
    
    if token:
        print("-" * 40)
        # Get users
        get_users(token)