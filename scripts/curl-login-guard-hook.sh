#!/bin/bash

# Curl Login Guard Hook - Ispravlja probleme sa special karakterima u passwordu
# Koristi se kao pre-execution hook za Bash tool u Claude Code

# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Proveri da li komanda sadrži curl login sa problematičnim formatom
if echo "$COMMAND" | grep -E "curl.*auth/login" > /dev/null 2>&1; then
    
    # Proveri da li koristi here-doc (to je OK)
    if echo "$COMMAND" | grep -E "<<'?EOF'?" > /dev/null 2>&1; then
        # Ovo je ispravno, pusti da prođe
        exit 0
    fi
    
    # Ako sadrži Test123! u bilo kom obliku, blokiraj
    if echo "$COMMAND" | grep -E 'Test123!' > /dev/null 2>&1; then
        >&2 echo "❌ BLOKIRAN: Pogrešan format curl komande za login!"
        >&2 echo ""
        >&2 echo "⚠️  Password 'Test123!' sadrži '!' što bash interpretira kao history expansion."
        >&2 echo ""
        >&2 echo "✅ ISPRAVNO REŠENJE - koristi here-doc sa single quotes:"
        >&2 echo ""
        >&2 echo "curl -s -X POST http://localhost:3010/api/auth/login \\"
        >&2 echo "  -H \"Content-Type: application/json\" \\"
        >&2 echo "  -d @- <<'EOF'"
        >&2 echo "{"
        >&2 echo "  \"email\": \"admin@smart-city.rs\","
        >&2 echo "  \"password\": \"Test123!\""
        >&2 echo "}"
        >&2 echo "EOF"
        >&2 echo ""
        >&2 echo "📝 Alternativa - sačuvaj token za dalju upotrebu:"
        >&2 echo ""
        >&2 echo "TOKEN=\$(curl -s -X POST http://localhost:3010/api/auth/login \\"
        >&2 echo "  -H \"Content-Type: application/json\" \\"
        >&2 echo "  -d @- <<'EOF' | jq -r '.access_token'"
        >&2 echo "{"
        >&2 echo "  \"email\": \"admin@smart-city.rs\","
        >&2 echo "  \"password\": \"Test123!\""
        >&2 echo "}"
        >&2 echo "EOF"
        >&2 echo ")"
        >&2 echo ""
        >&2 echo "# Zatim koristi token:"
        >&2 echo "curl -H \"Authorization: Bearer \$TOKEN\" http://localhost:3010/api/users"
        exit 2
    fi
fi

# Dozvoli ispravno formatovane komande
exit 0