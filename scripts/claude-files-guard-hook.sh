#!/bin/bash

# Claude Files Guard Hook - Preusmerava pretragu claude fajlova na root projekta
# Koristi se kao pre-execution hook za Bash tool u Claude Code

# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Lista claude fajlova koji se uvek nalaze u root-u projekta
CLAUDE_FILES=(
    "claude-personal.md"
    "claude-tips.md"
    "claude-hooks.md"
    "claude.md"
    "CLAUDE.md"
)

# Proveri da li komanda pokušava da traži claude fajlove
for file in "${CLAUDE_FILES[@]}"; do
    if echo "$COMMAND" | grep -E "(find|locate|ls|cat|grep).*$file" > /dev/null 2>&1; then
        
        # Proveri da li već traži u pravom direktorijumu
        if echo "$COMMAND" | grep -E "/home/kocev/smart-city" > /dev/null 2>&1; then
            # Već traži u pravom mestu, pusti da prođe
            exit 0
        fi
        
        echo "❌ STOP: Claude fajlovi se nalaze u root-u projekta!"
        echo ""
        echo "📁 Lokacije claude fajlova:"
        echo ""
        echo "  • /home/kocev/smart-city/claude-personal.md - Git SSH kredencijali i lični podaci"
        echo "  • /home/kocev/smart-city/claude-tips.md - Tehnički saveti i procedure"
        echo "  • /home/kocev/smart-city/claude-hooks.md - Lista svih hook-ova"
        echo "  • /home/kocev/smart-city/CLAUDE.md - Projekat instrukcije"
        echo ""
        echo "✅ Ispravne komande:"
        echo ""
        echo "  cat /home/kocev/smart-city/$file"
        echo "  less /home/kocev/smart-city/$file"
        echo "  grep 'pattern' /home/kocev/smart-city/$file"
        echo ""
        echo "📝 Svi claude fajlovi su UVEK u: /home/kocev/smart-city/"
        exit 2
    fi
done

# Dozvoli sve ostalo
exit 0