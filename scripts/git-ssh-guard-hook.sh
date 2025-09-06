#!/bin/bash

# SSH & Git Guard Hook - Forsira korišćenje SSH ključa za sve SSH i Git operacije
# Koristi se kao pre-execution hook za Bash tool u Claude Code

COMMAND="$1"

# Prvo proveri obične SSH komande na servere
if echo "$COMMAND" | grep -E "^ssh\s+" > /dev/null 2>&1; then
    
    # Proveri da li već koristi -i sa ključem (to je OK)
    if echo "$COMMAND" | grep -E "ssh.*-i\s+.*\.ssh/" > /dev/null 2>&1; then
        # Već koristi SSH ključ, pusti da prođe
        exit 0
    fi
    
    # Blokiraj SSH bez ključa
    echo "❌ BLOKIRAN: SSH pristup bez ključa!"
    echo ""
    echo "⚠️  Detektovan pokušaj SSH konekcije bez specificiranog ključa."
    echo ""
    echo "✅ ISPRAVNO - koristi SSH ključ:"
    echo ""
    echo "  ssh -i ~/.ssh/hp-notebook-2025-buslogic root@SERVER_IP \"komanda\""
    echo ""
    echo "📋 Poznati serveri iz claude-personal.md:"
    echo ""
    echo "  • Production (GSP LIVE): 157.230.119.11"
    echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11"
    echo ""
    echo "  • Legacy MySQL: 79.101.48.10"
    echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.10"
    echo ""
    echo "  • Legacy GPS: 79.101.48.11"
    echo "    ssh -i ~/.ssh/hp-notebook-2025-buslogic root@79.101.48.11"
    echo ""
    echo "  • Test Server: 164.92.200.100"
    echo "    ssh root@164.92.200.100 (ovaj ne treba ključ)"
    echo ""
    echo "📄 Svi detalji: /home/kocev/smart-city/claude-personal.md"
    exit 1
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
        echo "❌ BLOKIRAN: Ne koristi HTTPS za Git! Koristi SSH sa ključem."
        echo ""
        echo "⚠️  Detektovan pokušaj korišćenja HTTPS umesto SSH."
        echo ""
        echo "✅ ISPRAVNO: Uvek koristi SSH ključ za Git operacije:"
        echo ""
        echo "  GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git push origin main"
        echo ""
        echo "📝 Kompletan postupak:"
        echo ""
        echo "  1. Za push:"
        echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git push origin main"
        echo ""
        echo "  2. Za pull:"
        echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git pull origin main"
        echo ""
        echo "  3. Za clone:"
        echo "     GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" git clone git@github.com:user/repo.git"
        echo ""
        echo "🔑 SSH ključ se nalazi na: ~/.ssh/hp-notebook-2025-buslogic"
        echo ""
        echo "📄 Za više detalja pogledaj: /home/kocev/smart-city/claude-personal.md"
        exit 1
    fi
    
    # Proveri da li pokušava sa token autentifikacijom
    if echo "$COMMAND" | grep -E "(ghp_|github_pat_|personal.access.token)" > /dev/null 2>&1; then
        echo "❌ BLOKIRAN: Ne koristi GitHub token! Koristi SSH ključ."
        echo ""
        echo "⚠️  Detektovan pokušaj korišćenja GitHub tokena."
        echo ""
        echo "✅ Koristi SSH ključ kao što je prikazano gore."
        echo ""
        echo "📄 Pogledaj: /home/kocev/smart-city/claude-personal.md za detalje"
        exit 1
    fi
    
    # Ako nema GIT_SSH_COMMAND, blokiraj i daj instrukcije
    echo "⚠️  UPOZORENJE: Git komanda bez SSH ključa!"
    echo ""
    echo "✅ Dodaj GIT_SSH_COMMAND pre git komande:"
    echo ""
    echo "  GIT_SSH_COMMAND=\"ssh -i ~/.ssh/hp-notebook-2025-buslogic\" $COMMAND"
    echo ""
    echo "📄 Detalji u: /home/kocev/smart-city/claude-personal.md"
    exit 1
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