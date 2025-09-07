#!/bin/bash

# SSH & Git Guard Hook - Forsira korišćenje SSH ključa za sve SSH i Git operacije
# Koristi se kao pre-execution hook za Bash tool u Claude Code

# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Prvo proveri obične SSH komande na servere
if echo "$COMMAND" | grep -E "^ssh\s+" > /dev/null 2>&1; then
    
    # Proveri da li već koristi -i sa ključem (to je OK)
    if echo "$COMMAND" | grep -E "ssh.*-i\s+.*\.ssh/" > /dev/null 2>&1; then
        # Već koristi SSH ključ, pusti da prođe
        exit 0
    fi
    
    # Blokiraj SSH bez ključa
    >&2 echo "❌ BLOKIRAN: SSH pristup bez ključa!"
    >&2 echo ""
    >&2 echo "⚠️  Detektovan pokušaj SSH konekcije bez specificiranog ključa."
    >&2 echo ""
    >&2 echo "✅ ISPRAVNO - koristi SSH ključ:"
    >&2 echo ""
    >&2 echo "  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@SERVER_IP \"komanda\""
    >&2 echo ""
    >&2 echo "📋 Poznati serveri iz claude-personal.md:"
    >&2 echo ""
    >&2 echo "  • Production (GSP LIVE): 157.230.119.11"
    >&2 echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11"
    >&2 echo ""
    >&2 echo "  • Legacy MySQL: 79.101.48.10"
    >&2 echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.10"
    >&2 echo ""
    >&2 echo "  • Legacy GPS: 79.101.48.11"
    >&2 echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11"
    >&2 echo ""
    >&2 echo "  • Test Server: 164.92.200.100"
    >&2 echo "    ssh root@164.92.200.100 (ovaj ne treba ključ)"
    >&2 echo ""
    >&2 echo "📄 Svi detalji: /home/kocev/smart-city/claude-personal.md"
    exit 2
fi

# Proveri da li komanda koristi git push/pull/fetch/clone
if echo "$COMMAND" | grep -E "git\s+(push|pull|fetch|clone)" > /dev/null 2>&1; then
    
    # Proveri da li već koristi GIT_SSH_COMMAND (to je OK)
    if echo "$COMMAND" | grep -E "GIT_SSH_COMMAND=" > /dev/null 2>&1; then
        # Već koristi SSH ključ, pusti da prođe
        exit 0
    fi
    
    # Proveri da li pokušava sa https:// URL-om
    if echo "$COMMAND" | grep -E "https://github\.com" > /dev/null 2>&1; then
        >&2 echo "❌ BLOKIRAN: Ne koristi HTTPS za Git! Koristi SSH sa ključem."
        >&2 echo ""
        >&2 echo "⚠️  Detektovan pokušaj korišćenja HTTPS umesto SSH."
        >&2 echo ""
        >&2 echo "✅ ISPRAVNO: Uvek koristi SSH ključ za Git operacije:"
        >&2 echo ""
        >&2 echo "  GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git push origin main"
        >&2 echo ""
        >&2 echo "📝 Kompletan postupak:"
        >&2 echo ""
        >&2 echo "  1. Za push:"
        >&2 echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git push origin main"
        >&2 echo ""
        >&2 echo "  2. Za pull:"
        >&2 echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git pull origin main"
        >&2 echo ""
        >&2 echo "  3. Za clone:"
        >&2 echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git clone git@github.com:user/repo.git"
        >&2 echo ""
        >&2 echo "🔑 SSH ključ se nalazi na: ~/.ssh/hp-notebook-2025-buslogic"
        >&2 echo ""
        >&2 echo "📄 Za više detalja pogledaj: /home/kocev/smart-city/claude-personal.md"
        exit 2
    fi
    
    # Proveri da li pokušava sa token autentifikacijom
    if echo "$COMMAND" | grep -E "(ghp_|github_pat_|personal.access.token)" > /dev/null 2>&1; then
        >&2 echo "❌ BLOKIRAN: Ne koristi GitHub token! Koristi SSH ključ."
        >&2 echo ""
        >&2 echo "⚠️  Detektovan pokušaj korišćenja GitHub tokena."
        >&2 echo ""
        >&2 echo "✅ Koristi SSH ključ kao što je prikazano gore."
        >&2 echo ""
        >&2 echo "📄 Pogledaj: /home/kocev/smart-city/claude-personal.md za detalje"
        exit 2
    fi
    
    # Ako nema GIT_SSH_COMMAND, blokiraj i daj instrukcije
    >&2 echo "⚠️  UPOZORENJE: Git komanda bez SSH ključa!"
    >&2 echo ""
    >&2 echo "✅ Dodaj GIT_SSH_COMMAND pre git komande:"
    >&2 echo ""
    >&2 echo "  GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" $COMMAND"
    >&2 echo ""
    >&2 echo "📄 Detalji u: /home/kocev/smart-city/claude-personal.md"
    exit 2
fi

# Proveri git config komande
if echo "$COMMAND" | grep -E "git config.*user\.(name|email)" > /dev/null 2>&1; then
    echo "ℹ️  Git konfiguracija:"
    echo ""
    echo "  git config user.name \"Smart City Dev\""
    echo "  git config user.email \"dev@smart-city.rs\""
    echo ""
    echo "Nastavljam..."
    # Ne blokiraj, samo informiši
fi

# Dozvoli sve ostalo
exit 0