#!/bin/bash

# After Compact Hook - Automatski učitava claude fajlove nakon compact komande
# Koristi se kao post-execution hook nakon /compact komande

# Putanja do root direktorijuma projekta
PROJECT_ROOT="/home/kocev/smart-city"

# Lista claude fajlova koje treba učitati
CLAUDE_FILES=(
    "CLAUDE.md"
    "claude-tips.md"
    "claude-personal.md"
    "claude-hooks.md"
)

echo "🔄 AUTO-UČITAVANJE CLAUDE FAJLOVA NAKON COMPACT..."
echo ""
echo "Nakon compact akcije, potrebno je da Claude Code ponovo učita sve važne fajlove."
echo ""

# Generiši READ komande za Claude Code
echo "📚 MOLIM VAS, IZVRŠITE SLEDEĆE KOMANDE:"
echo ""
echo "# Učitavanje projekat instrukcija i konfiguracija:"

for file in "${CLAUDE_FILES[@]}"; do
    FILE_PATH="${PROJECT_ROOT}/${file}"
    
    if [ -f "$FILE_PATH" ]; then
        echo "cat ${FILE_PATH}"
        
        # Kratki opis svakog fajla
        case "$file" in
            "CLAUDE.md")
                echo "# ↑ Projekat instrukcije, tech stack, struktura"
                ;;
            "claude-tips.md")
                echo "# ↑ Tehnički saveti, curl, MySQL pristup"
                ;;
            "claude-personal.md")
                echo "# ↑ Kredencijali, SSH ključevi, passwords"
                ;;
            "claude-hooks.md")
                echo "# ↑ Lista svih aktivnih hook-ova"
                ;;
        esac
        echo ""
    else
        echo "⚠️  UPOZORENJE: Fajl $file ne postoji na lokaciji: $FILE_PATH"
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 SAŽETAK KLJUČNIH PRAVILA:"
echo ""
echo "1. 🔧 Prisma migracije - RUČNI workflow (non-interactive problem)"
echo "   Schema → Folder → SQL → Deploy → Generate"
echo ""
echo "2. 🔐 Curl login - here-doc sa 'EOF' (exclamation problem)"
echo "   curl ... -d @- <<'EOF' ... EOF"
echo ""
echo "3. 🚗 VehicleMapper - OBAVEZNO za konverzije ID ↔ garage_number"
echo ""
echo "4. 🛡️ Hook-ovi - 5 aktivnih (MySQL, Prisma, Curl, Claude Files, Git SSH)"
echo ""
echo "5. 📁 Claude fajlovi - UVEK u /home/kocev/smart-city/"
echo ""
echo "✅ Claude Code je sada spreman za rad sa svim pravilima!"

# Return success
exit 0