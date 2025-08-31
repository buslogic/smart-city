#!/usr/bin/env python3

import requests
import json
import os

API_BASE = "http://localhost:3010/api"

def get_auth_token():
    """Get authentication token"""
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
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_legacy_database_crud():
    """Test Legacy Database CRUD operations"""
    print("Testing Legacy Database API...")
    print("-" * 50)
    
    # Get auth token
    token = get_auth_token()
    headers = get_headers(token)
    
    # Test data for MySQL database - real external credentials
    test_db_data = {
        "name": "GSP Beograd Test Database",
        "description": "Test database sa pravim spoljnim kredencijalima",
        "type": "mysql",
        "host": "79.101.48.10",
        "port": 3306,
        "database": "pib100049398",
        "username": "gsp_beograd_legacy_user",
        "password": "gspBeograd123!",
        "isActive": True
    }
    
    print("1. Creating new legacy database entry...")
    create_response = requests.post(f"{API_BASE}/legacy-databases", json=test_db_data, headers=headers)
    if create_response.status_code == 201:
        db_entry = create_response.json()
        db_id = db_entry["id"]
        print(f"✅ Created database entry with ID: {db_id}")
        print(f"   Name: {db_entry['name']}")
        print(f"   Type: {db_entry['type']}")
        print(f"   Host: {db_entry['host']}:{db_entry['port']}")
        print(f"   Database: {db_entry['database']}")
        print(f"   Username: {db_entry['username']}")
        print(f"   Active: {db_entry['isActive']}")
        print(f"   Password in response: {'password' in db_entry}")
    else:
        print(f"❌ Failed to create database entry: {create_response.text}")
        return
    
    print("\n2. Testing connection...")
    test_response = requests.post(f"{API_BASE}/legacy-databases/{db_id}/test-connection", headers=headers)
    if test_response.status_code == 201:
        test_result = test_response.json()
        print(f"✅ Connection test completed")
        print(f"   Success: {test_result['success']}")
        print(f"   Message: {test_result['message']}")
        if test_result.get('responseTime'):
            print(f"   Response Time: {test_result['responseTime']}ms")
        if test_result.get('error'):
            print(f"   Error: {test_result['error']}")
    else:
        print(f"❌ Connection test failed: {test_response.text}")
    
    print("\n3. Getting all legacy databases...")
    list_response = requests.get(f"{API_BASE}/legacy-databases", headers=headers)
    if list_response.status_code == 200:
        databases = list_response.json()
        print(f"✅ Found {len(databases)} legacy databases")
        for db in databases:
            print(f"   - {db['name']} ({db['type']}) - Active: {db['isActive']}")
            if 'testConnection' in db:
                print(f"     Last test: {db.get('testConnection', 'N/A')}")
    else:
        print(f"❌ Failed to get databases: {list_response.text}")
    
    print("\n4. Cleaning up - deleting test database...")
    delete_response = requests.delete(f"{API_BASE}/legacy-databases/{db_id}", headers=headers)
    if delete_response.status_code == 200:
        print("✅ Test database deleted successfully")
    else:
        print(f"❌ Failed to delete database: {delete_response.text}")
    
    print("\n" + "="*50)
    print("Legacy Database API test completed!")

if __name__ == "__main__":
    try:
        test_legacy_database_crud()
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
