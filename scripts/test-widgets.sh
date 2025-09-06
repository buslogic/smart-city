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

echo "Testing available widgets endpoint..."
echo ""
curl -s -X GET http://localhost:3010/api/dashboard/widgets/available \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool