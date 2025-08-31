#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

# API Configuration
API_BASE = "http://localhost:3010/api"

# Login credentials
credentials = {
    "email": "admin@smart-city.rs",
    "password": "Test123!"
}

def login():
    """Login and get access token"""
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            headers={"Content-Type": "application/json"},
            data=json.dumps(credentials)
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful!")
            token = data.get("accessToken")  # Changed from access_token to accessToken
            if token:
                # Decode JWT to see permissions
                import base64
                parts = token.split('.')
                if len(parts) >= 2:
                    payload = parts[1]
                    # Add padding if needed
                    payload += '=' * (4 - len(payload) % 4)
                    decoded = base64.b64decode(payload)
                    import json as j
                    user_data = j.loads(decoded)
                    print(f"   User ID: {user_data.get('sub')}")
            return token
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error during login: {e}")
        return None

def test_gps_analytics(token):
    """Test GPS analytics endpoint"""
    # Test parameters
    vehicle_id = 1  # Assuming vehicle with ID 1 exists
    end_date = datetime.now()
    start_date = end_date - timedelta(days=1)  # Last 24 hours
    
    params = {
        "vehicleId": vehicle_id,
        "startDate": start_date.isoformat() + "Z",
        "endDate": end_date.isoformat() + "Z"
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n📊 Testing GPS Analytics for vehicle {vehicle_id}")
        print(f"   Period: {start_date.strftime('%Y-%m-%d %H:%M')} - {end_date.strftime('%Y-%m-%d %H:%M')}")
        
        response = requests.get(
            f"{API_BASE}/gps-analytics/vehicle",
            headers=headers,
            params=params
        )
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ GPS Analytics retrieved successfully!")
            print("\n📈 Basic Metrics:")
            print(f"   - Total GPS Points: {data.get('totalPoints', 0)}")
            print(f"   - Total Distance: {data.get('totalDistance', 0):.2f} km")
            print(f"   - Average Speed: {data.get('avgSpeed', 0):.1f} km/h")
            print(f"   - Max Speed: {data.get('maxSpeed', 0)} km/h")
            print(f"   - Driving Hours: {data.get('drivingHours', 0):.1f} h")
            print(f"   - Idle Time: {data.get('idleTime', 0):.1f} h")
            print(f"   - Total Stops: {data.get('totalStops', 0)}")
            print(f"   - Efficiency: {data.get('efficiency', 0):.1f}%")
            
            # Hourly data
            hourly_data = data.get('hourlyData', [])
            if hourly_data:
                print(f"\n📊 Hourly Data Points: {len(hourly_data)}")
                total_hourly_distance = sum(h.get('distance', 0) for h in hourly_data)
                print(f"   - Total hourly distance: {total_hourly_distance:.2f} km")
            
            # Speed distribution
            speed_dist = data.get('speedDistribution', [])
            if speed_dist:
                print("\n🚗 Speed Distribution:")
                for item in speed_dist:
                    print(f"   - {item['range']}: {item['percentage']:.1f}% ({item['count']} points)")
            
            # Daily stats
            daily_stats = data.get('dailyStats', [])
            if daily_stats:
                print(f"\n📅 Daily Statistics: {len(daily_stats)} days")
                for day in daily_stats:
                    print(f"   - {day['date']}: {day['distance']:.2f} km, {day['avgSpeed']:.1f} km/h")
            
            return data
        else:
            print(f"❌ Failed to get analytics: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error getting analytics: {e}")
        return None

def test_multiple_vehicles(token):
    """Test analytics for multiple vehicles"""
    print("\n" + "="*60)
    print("Testing multiple vehicles (if they exist)")
    print("="*60)
    
    # Try to get vehicle list first
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{API_BASE}/vehicles", headers=headers)
        if response.status_code == 200:
            vehicles = response.json()
            print(f"\n📋 Found {len(vehicles)} vehicles")
            
            # Test first 3 vehicles
            for vehicle in vehicles[:3]:
                print(f"\n🚌 Testing vehicle: {vehicle.get('garageNumber', 'N/A')} (ID: {vehicle['id']})")
                
                end_date = datetime.now()
                start_date = end_date - timedelta(days=7)  # Last 7 days
                
                params = {
                    "vehicleId": vehicle['id'],
                    "startDate": start_date.isoformat() + "Z",
                    "endDate": end_date.isoformat() + "Z"
                }
                
                response = requests.get(
                    f"{API_BASE}/gps-analytics/vehicle",
                    headers=headers,
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('totalPoints', 0) > 0:
                        print(f"   ✅ Has GPS data: {data['totalPoints']} points, {data['totalDistance']:.2f} km")
                    else:
                        print(f"   ⚠️ No GPS data for this period")
    except Exception as e:
        print(f"Error getting vehicles: {e}")

def main():
    print("🚀 Testing GPS Analytics API")
    print("="*60)
    
    # Step 1: Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    # Step 2: Test GPS Analytics
    analytics = test_gps_analytics(token)
    
    # Step 3: Test multiple vehicles
    test_multiple_vehicles(token)
    
    print("\n" + "="*60)
    print("✅ Test completed!")

if __name__ == "__main__":
    main()