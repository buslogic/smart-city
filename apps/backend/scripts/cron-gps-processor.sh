#!/bin/bash

# GPS LAG Transfer Cron Job
# Pokreće parallel processing svaki put kad se pozove iz cron-a

# Set working directory
cd /home/kocev/smart-city/apps/backend || exit 1

# Load NVM and Node
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Log directory
LOG_DIR="./logs/gps-cron"
mkdir -p "$LOG_DIR"

# Timestamp for log file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/cron_$TIMESTAMP.log"

# Start logging
echo "=== GPS LAG Transfer Cron Job ===" >> "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Run parallel processing in cron mode
npm run gps:process:parallel-cron >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

# Log completion
echo "" >> "$LOG_FILE"
echo "Completed at: $(date)" >> "$LOG_FILE"
echo "Exit code: $EXIT_CODE" >> "$LOG_FILE"

# Cleanup old logs (keep last 7 days)
find "$LOG_DIR" -name "cron_*.log" -mtime +7 -delete

# Exit with the same code as the processing script
exit $EXIT_CODE
