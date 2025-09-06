#!/bin/bash

# Prvo se uloguj
echo "Logging in..."
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "email": "admin@smart-city.rs",
  "password": "Test123!"
}
EOF
)

# Ekstraktuj access token
TOKEN=$(echo $RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to login"
  exit 1
fi

echo "Testing toggle widget endpoint..."
echo ""

# Pokušaj da uključiš vehicle-statistics widget
TOGGLE_RESPONSE=$(curl -s -X POST http://localhost:3010/api/dashboard/widgets/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"widgetId": "vehicle-statistics", "enabled": true}')

echo "Response:"
echo $TOGGLE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $TOGGLE_RESPONSE