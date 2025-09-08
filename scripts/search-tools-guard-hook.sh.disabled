#!/bin/bash

# Search Tools Guard Hook
# Blokira grep, find, cat i slične komande i predlaže korišćenje Claude Code alata

# Čitaj JSON input sa stdin
JSON_INPUT=$(cat)

# Ekstraktuj komandu iz JSON-a
# JSON format: {"tool_input": {"command": "actual command here"}}
COMMAND=$(echo "$JSON_INPUT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null)

# Debug log (zakomentarisano u produkciji)
# echo "Hook primio komandu: $COMMAND" >&2

# Proveri da li komanda sadrži problematične search/read alate
if echo "$COMMAND" | grep -qE '\b(grep|egrep|fgrep|find|locate|ack|ag)\b'; then
    >&2 echo "❌ BLOKIRAN: Pokušaj korišćenja search komande!"
    >&2 echo ""
    >&2 echo "⚠️ PROBLEM: Ne koristi bash komande za pretraživanje!"
    >&2 echo ""
    >&2 echo "✅ ISPRAVNO REŠENJE:"
    >&2 echo "Za pretraživanje koristi Claude Code alate:"
    >&2 echo ""
    >&2 echo "1. Grep tool - za pretraživanje sadržaja fajlova:"
    >&2 echo "   - Pattern search u fajlovima"
    >&2 echo "   - Regex podrška"
    >&2 echo "   - Filtriranje po tipu fajla"
    >&2 echo ""
    >&2 echo "2. Glob tool - za pronalaženje fajlova po imenu:"
    >&2 echo "   - Pattern matching (*.js, **/*.ts)"
    >&2 echo "   - Brže od find komande"
    >&2 echo ""
    >&2 echo "3. Task tool - za kompleksne pretrage:"
    >&2 echo "   - Multi-step search"
    >&2 echo "   - Kada nisi siguran šta tražiš"
    >&2 echo ""
    >&2 echo "NAPOMENA: Bash grep/find komande su sporije i troše više konteksta!"
    exit 2  # Exit kod 2 blokira izvršavanje
fi

# Proveri za cat, head, tail, less, more
if echo "$COMMAND" | grep -qE '\b(cat|head|tail|less|more|bat)\b'; then
    # Dozvoli heredoc (cat <<EOF)
    if echo "$COMMAND" | grep -q "<<"; then
        exit 0
    fi
    
    >&2 echo "❌ BLOKIRAN: Pokušaj čitanja fajla kroz bash!"
    >&2 echo ""
    >&2 echo "⚠️ PROBLEM: Ne koristi bash komande za čitanje fajlova!"
    >&2 echo ""
    >&2 echo "✅ ISPRAVNO REŠENJE:"
    >&2 echo "Koristi Read tool za čitanje fajlova:"
    >&2 echo "- Automatski line numbering"
    >&2 echo "- Podrška za velike fajlove (offset/limit)"
    >&2 echo "- Čita slike i PDF fajlove"
    >&2 echo "- Bolje formatiranje"
    >&2 echo ""
    >&2 echo "NAPOMENA: cat/head/tail troše kontekst i ne daju line brojeve!"
    exit 2  # Exit kod 2 blokira izvršavanje
fi

# Propusti komandu
exit 0