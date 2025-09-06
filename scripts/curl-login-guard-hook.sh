#!/bin/bash

# Curl Login Guard Hook - Ispravlja probleme sa special karakterima u passwordu
# Koristi se kao pre-execution hook za Bash tool u Claude Code

COMMAND="$1"

# Proveri da li komanda sadrži curl login sa problematičnim formatom
if echo "$COMMAND" | grep -E "curl.*auth/login" > /dev/null 2>&1; then
    
    # Proveri da li koristi here-doc (to je OK)
    if echo "$COMMAND" | grep -E "<<'?EOF'?" > /dev/null 2>&1; then
        # Ovo je ispravno, pusti da prođe
        exit 0
    fi
    
    # Ako sadrži Test123! u bilo kom obliku, blokiraj
    if echo "$COMMAND" | grep -E 'Test123!' > /dev/null 2>&1; then
        echo "❌ BLOKIRAN: Pogrešan format curl komande za login!"
        echo ""
        echo "⚠️  Password 'Test123!' sadrži '!' što bash interpretira kao history expansion."
        echo ""
        echo "✅ ISPRAVNO REŠENJE - koristi here-doc sa single quotes:"
        echo ""
        echo "curl -s -X POST http://localhost:3010/api/auth/login \\"
        echo "  -H \"Content-Type: application/json\" \\"
        echo "  -d @- <<'EOF'"
        echo "{"
        echo "  \"email\": \"admin@smart-city.rs\","
        echo "  \"password\": \"Test123!\""
        echo "}"
        echo "EOF"
        echo ""
        echo "📝 Alternativa - sačuvaj token za dalju upotrebu:"
        echo ""
        echo "TOKEN=\$(curl -s -X POST http://localhost:3010/api/auth/login \\"
        echo "  -H \"Content-Type: application/json\" \\"
        echo "  -d @- <<'EOF' | jq -r '.access_token'"
        echo "{"
        echo "  \"email\": \"admin@smart-city.rs\","
        echo "  \"password\": \"Test123!\""
        echo "}"
        echo "EOF"
        echo ")"
        echo ""
        echo "# Zatim koristi token:"
        echo "curl -H \"Authorization: Bearer \$TOKEN\" http://localhost:3010/api/users"
        exit 1
    fi
fi

# Dozvoli ispravno formatovane komande
exit 0