#!/bin/bash
# Skraćenica za brz pregled poslednjeg screenshot-a iz Smart City projekta

SCREENSHOT_DIR="/mnt/c/Users/ivank/AppData/Roaming/developer-agent/debug-screenshots"

case "${1:-show}" in
    show|s)
        # Pronađi poslednji screenshot
        LAST=$(ls -t "$SCREENSHOT_DIR"/*.png 2>/dev/null | head -1)
        if [ -n "$LAST" ]; then
            echo "📸 Poslednji screenshot: $(basename "$LAST")"
            echo "📅 Vreme: $(stat -c %y "$LAST" | cut -d' ' -f1,2)"
            echo "📂 Putanja: $LAST"
            echo ""
            echo "✅ Screenshot je spreman za pregled u Claude Code."
            echo "Claude Code će automatski učitati sliku."
        else
            echo "❌ Nema screenshot-ova u folderu"
        fi
        ;;
    list|l)
        echo "📋 Poslednji screenshot-ovi:"
        ls -lht "$SCREENSHOT_DIR"/*.png 2>/dev/null | head -5
        ;;
    path|p)
        # Samo vrati putanju (za Claude Code interno korišćenje)
        ls -t "$SCREENSHOT_DIR"/*.png 2>/dev/null | head -1
        ;;
    *)
        echo "ss [s|l|p] - s=show info, l=list, p=path only"
        ;;
esac