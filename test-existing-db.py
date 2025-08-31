#!/usr/bin/env python3

import requests
import json

API_BASE = "http://localhost:3010/api"

def get_auth_token():
    login_data = {
        "email": "admin@smart-city.rs",
        "password": "Test123!"
    }
    
    response = requests.post(f"{API_BASE}/auth/login", json=login_data)
    if response.status_code in [200, 201]:
        data = response.json()
        if "accessToken" in data:
            return data["accessToken"]
        else:
            raise Exception(f"No access token in response: {response.text}")
    else:
        raise Exception(f"Login failed with status {response.status_code}: {response.text}")

def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_existing_databases():
    print("Testing existing legacy databases...")
    print("-" * 50)
    
    # Get auth token
    token = get_auth_token()
    headers = get_headers(token)
    
    # Get all databases
    print("1. Getting all legacy databases...")
    list_response = requests.get(f"{API_BASE}/legacy-databases", headers=headers)
    if list_response.status_code == 200:
        databases = list_response.json()
        print(f"✅ Found {len(databases)} legacy databases")
        
        for db in databases:
            print(f"\n--- Testing database: {db['name']} ---")
            print(f"ID: {db['id']}")
            print(f"Host: {db['host']}:{db['port']}")
            print(f"Database: {db['database']}")
            print(f"Username: {db['username']}")
            print(f"Type: {db['type']}")
            
            # Test connection for this database
            print("🔍 Testing connection...")
            test_response = requests.post(f"{API_BASE}/legacy-databases/{db['id']}/test-connection", headers=headers)
            
            if test_response.status_code == 201:
                result = test_response.json()
                print(f"Result: {result}")
                print(f"✅ Success: {result.get('success', 'Unknown')}")
                print(f"   Message: {result.get('message', 'No message')}")
                if result.get('responseTime'):
                    print(f"   Response Time: {result.get('responseTime')}ms")
                if result.get('error'):
                    print(f"   Error: {result.get('error')}")
                if result.get('connectionInfo'):
                    info = result['connectionInfo']
                    print(f"   Connection Info: {info['host']}:{info['port']}/{info['database']} ({info['type']})")
            else:
                print(f"❌ Test request failed: {test_response.status_code} {test_response.text}")
            
    else:
        print(f"❌ Failed to get databases: {list_response.text}")

if __name__ == "__main__":
    try:
        test_existing_databases()
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
