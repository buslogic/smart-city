#!/bin/bash

# SmartCity GPS Sync Test Script
# Testira konekciju i slanje test podataka

API_URL="${API_URL:-http://localhost:3010/gps-ingest}"
API_KEY="${API_KEY:-smartcity_legacy_gps_key_2024}"

echo "=== SmartCity GPS Ingest Test ==="
echo "API URL: $API_URL"
echo ""

# Test konekcije
echo "1. Testing connection..."
curl -s -X POST \
  "$API_URL/test" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "2. Sending test GPS data..."

# Test podatak
GPS_DATA='{
  "data": [
    {
      "garageNo": "P21001",
      "lat": 44.8125,
      "lng": 20.4489,
      "speed": 35,
      "course": 180,
      "alt": 120,
      "state": 1,
      "inRoute": 1,
      "lineNumber": "26",
      "direction": 1,
      "peopleIn": 5,
      "peopleOut": 2,
      "batteryStatus": 85,
      "captured": "'$(date -Iseconds)'",
      "edited": "'$(date -Iseconds)'"
    }
  ],
  "source": "test_script",
  "timestamp": "'$(date -Iseconds)'"
}'

curl -s -X POST \
  "$API_URL/batch" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$GPS_DATA" | jq .

echo ""
echo "=== Test completed ==="