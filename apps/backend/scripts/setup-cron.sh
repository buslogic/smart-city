#!/bin/bash

# GPS LAG Transfer Cron Setup Helper
# Koristi se za instalaciju i deinstalaciju cron job-a

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/cron-gps-processor.sh"
CRON_ENTRY="*/15 * * * * $CRON_SCRIPT"
CRON_COMMENT="# GPS LAG Transfer - Parallel Processing"

function install_cron() {
    echo "Installing GPS LAG Transfer cron job..."

    # Check if already installed
    if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
        echo "⚠️  Cron job already installed!"
        echo "Current crontab:"
        crontab -l | grep -A1 "$CRON_COMMENT"
        return 1
    fi

    # Backup current crontab
    crontab -l > /tmp/crontab.backup 2>/dev/null || true

    # Add new cron job
    (crontab -l 2>/dev/null; echo ""; echo "$CRON_COMMENT"; echo "$CRON_ENTRY") | crontab -

    echo "✅ Cron job installed successfully!"
    echo ""
    echo "Schedule: Every 15 minutes"
    echo "Script: $CRON_SCRIPT"
    echo "Logs: /home/kocev/smart-city/apps/backend/logs/gps-cron/"
    echo ""
    echo "Current crontab:"
    crontab -l | grep -A1 "$CRON_COMMENT"
}

function uninstall_cron() {
    echo "Uninstalling GPS LAG Transfer cron job..."

    # Check if installed
    if ! crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
        echo "⚠️  Cron job not found!"
        return 1
    fi

    # Remove cron job
    crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT" | grep -v "$CRON_COMMENT" | crontab -

    echo "✅ Cron job uninstalled successfully!"
}

function show_status() {
    echo "GPS LAG Transfer Cron Job Status"
    echo "=================================="
    echo ""

    if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
        echo "Status: ✅ INSTALLED"
        echo ""
        echo "Current crontab entry:"
        crontab -l | grep -A1 "$CRON_COMMENT"
        echo ""
        echo "Recent logs:"
        ls -lht /home/kocev/smart-city/apps/backend/logs/gps-cron/ 2>/dev/null | head -n 6 || echo "No logs yet"
    else
        echo "Status: ❌ NOT INSTALLED"
        echo ""
        echo "To install: $0 install"
    fi
}

function show_logs() {
    LOG_DIR="/home/kocev/smart-city/apps/backend/logs/gps-cron"

    if [ ! -d "$LOG_DIR" ]; then
        echo "No logs directory found at: $LOG_DIR"
        return 1
    fi

    LATEST_LOG=$(ls -t "$LOG_DIR"/cron_*.log 2>/dev/null | head -n 1)

    if [ -z "$LATEST_LOG" ]; then
        echo "No log files found"
        return 1
    fi

    echo "Latest log: $LATEST_LOG"
    echo "=================================="
    cat "$LATEST_LOG"
}

# Main
case "$1" in
    install)
        install_cron
        ;;
    uninstall|remove)
        uninstall_cron
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "GPS LAG Transfer Cron Setup"
        echo ""
        echo "Usage: $0 {install|uninstall|status|logs}"
        echo ""
        echo "Commands:"
        echo "  install    - Install cron job (every 15 minutes)"
        echo "  uninstall  - Remove cron job"
        echo "  status     - Show current status"
        echo "  logs       - Show latest log file"
        exit 1
        ;;
esac
