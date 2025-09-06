#!/bin/bash

# TypeScript Build & Fix skripta za Smart City Admin Portal
# Koristi se kao: ./scripts/tsf.sh ili samo "tsf" ako dodaš alias

echo "🎨 TypeScript Build & Fix za Admin Portal"
echo "=========================================="
echo ""

cd /home/kocev/smart-city/apps/admin-portal

echo "📦 Pokrećem TypeScript build..."
npm run build 2>&1 | tee /tmp/ts-frontend-build-output.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Build uspešan! Nema TypeScript grešaka."
else
    echo ""
    echo "❌ Pronađene TypeScript greške!"
    echo ""
    echo "🔍 Analiziram greške..."
    
    # Ekstraktuj jedinstvene fajlove sa greškama
    grep -E "^(apps/admin-portal/)?src/.*\.(ts|tsx)" /tmp/ts-frontend-build-output.log | \
        sed 's/([0-9]*,[0-9]*).*//' | \
        sort -u > /tmp/ts-frontend-error-files.txt
    
    FILE_COUNT=$(wc -l < /tmp/ts-frontend-error-files.txt)
    
    echo "📝 Pronađeno $FILE_COUNT fajlova sa greškama:"
    echo ""
    cat /tmp/ts-frontend-error-files.txt
    echo ""
    echo "💡 INSTRUKCIJE ZA CLAUDE CODE:"
    echo "--------------------------------"
    echo "Molim te ispravi TypeScript greške u sledećim fajlovima:"
    echo ""
    
    while IFS= read -r file; do
        echo "• $file"
    done < /tmp/ts-frontend-error-files.txt
    
    echo ""
    echo "Greške su u /tmp/ts-frontend-build-output.log"
    echo ""
    echo "Za automatsko ispravljanje, Claude Code treba da:"
    echo "1. Pročita log fajl: cat /tmp/ts-frontend-build-output.log"
    echo "2. Analizira svaku grešku"
    echo "3. Otvori problematične fajlove"
    echo "4. Ispravi TypeScript greške"
    echo "5. Ponovo pokrene: npm run build"
fi

# Cleanup
rm -f /tmp/ts-frontend-error-files.txt