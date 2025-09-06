#!/bin/bash

# Prvo se uloguj i sačuvaj token
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
  echo "Failed to login. Response:"
  echo $RESPONSE
  exit 1
fi

echo "Login successful!"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Pozovi debug endpoint
echo "Checking user permissions..."
echo "Response:"
curl -s -X GET http://localhost:3010/api/dashboard/debug/permissions \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "Testing dashboard/config endpoint..."
echo "Response:"
curl -s -X GET http://localhost:3010/api/dashboard/config \
  -H "Authorization: Bearer $TOKEN"