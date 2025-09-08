#!/bin/bash

# =====================================================
# GPS System Health Check Script
# =====================================================

echo "=========================================="
echo "GPS SYSTEM HEALTH CHECK"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. CHECK PM2 PROCESSES
echo -e "\n${YELLOW}[1] PM2 Process Status:${NC}"
pm2 list | grep -E "smart-city|gps"

# 2. CHECK MEMORY USAGE
echo -e "\n${YELLOW}[2] Memory Usage:${NC}"
free -h | grep -E "Mem|Swap"

# 3. CHECK DISK SPACE
echo -e "\n${YELLOW}[3] Disk Space:${NC}"
df -h | grep -E "Filesystem|mysql|/var"

# 4. CHECK MYSQL CONNECTIONS
echo -e "\n${YELLOW}[4] MySQL Connection Status:${NC}"
mysql -u root -e "SHOW STATUS LIKE 'Threads_connected';"
mysql -u root -e "SHOW STATUS LIKE 'Max_used_connections';"
mysql -u root -e "SHOW PROCESSLIST;" | head -20

# 5. CHECK LAST ERRORS IN PM2 LOGS
echo -e "\n${YELLOW}[5] Recent Errors in PM2 Logs:${NC}"
pm2 logs --nostream --lines 100 | grep -i "error" | tail -10

# 6. CHECK TIMESCALE CONNECTION
echo -e "\n${YELLOW}[6] TimescaleDB Connection Test:${NC}"
PGPASSWORD=$TIMESCALE_PASSWORD psql -h localhost -p 5433 -U smartcity_ts -d smartcity_gps -c "SELECT version();" 2>&1 | head -1

# 7. CHECK GPS BUFFER TABLE LOCKS
echo -e "\n${YELLOW}[7] Table Locks on gps_raw_buffer:${NC}"
mysql -u root smartcity -e "
SELECT 
    OBJECT_NAME as table_name,
    INDEX_NAME,
    LOCK_TYPE,
    LOCK_MODE,
    LOCK_STATUS,
    LOCK_DATA
FROM performance_schema.data_locks 
WHERE OBJECT_NAME = 'gps_raw_buffer'
LIMIT 10;"

# 8. CHECK SLOW QUERIES
echo -e "\n${YELLOW}[8] Current Long Running Queries:${NC}"
mysql -u root -e "
SELECT 
    ID,
    USER,
    HOST,
    DB,
    COMMAND,
    TIME,
    STATE,
    LEFT(INFO, 100) as QUERY
FROM information_schema.PROCESSLIST 
WHERE TIME > 10 
    AND COMMAND != 'Sleep'
ORDER BY TIME DESC
LIMIT 10;"

# 9. CHECK CRON JOB STATUS
echo -e "\n${YELLOW}[9] Backend Cron Status (from logs):${NC}"
pm2 logs smart-city-backend --nostream --lines 200 | grep -E "GPS Processor|Worker Pool|Procesirano" | tail -5

# 10. CHECK ERROR RATE
echo -e "\n${YELLOW}[10] Error Rate in Buffer:${NC}"
mysql -u root smartcity -e "
SELECT 
    process_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM gps_raw_buffer), 2) as percentage
FROM gps_raw_buffer 
GROUP BY process_status;"

# 11. CHECK IF PROCESSOR IS STUCK
echo -e "\n${YELLOW}[11] Check for Stuck Processing:${NC}"
mysql -u root smartcity -e "
SELECT 
    COUNT(*) as stuck_records,
    MIN(processed_at) as oldest_stuck,
    TIMESTAMPDIFF(MINUTE, MIN(processed_at), NOW()) as minutes_stuck
FROM gps_raw_buffer 
WHERE process_status = 'processing'
    AND processed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE);"

# 12. RESTART RECOMMENDATION
echo -e "\n${YELLOW}[12] Recommendations:${NC}"

# Get stuck count
STUCK_COUNT=$(mysql -u root smartcity -sN -e "SELECT COUNT(*) FROM gps_raw_buffer WHERE process_status = 'processing' AND processed_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE);")
FAILED_COUNT=$(mysql -u root smartcity -sN -e "SELECT COUNT(*) FROM gps_raw_buffer WHERE process_status = 'failed';")
PENDING_COUNT=$(mysql -u root smartcity -sN -e "SELECT COUNT(*) FROM gps_raw_buffer WHERE process_status = 'pending';")

if [ "$STUCK_COUNT" -gt "1000" ]; then
    echo -e "${RED}⚠️  CRITICAL: $STUCK_COUNT records stuck in processing! Restart recommended:${NC}"
    echo "   pm2 restart smart-city-backend"
fi

if [ "$FAILED_COUNT" -gt "10000" ]; then
    echo -e "${RED}⚠️  WARNING: $FAILED_COUNT failed records! Check error messages:${NC}"
    echo "   mysql -u root smartcity -e \"SELECT error_message, COUNT(*) FROM gps_raw_buffer WHERE process_status='failed' GROUP BY error_message ORDER BY COUNT(*) DESC LIMIT 5;\""
fi

if [ "$PENDING_COUNT" -gt "100000" ]; then
    echo -e "${RED}⚠️  ALERT: $PENDING_COUNT pending records! System is falling behind!${NC}"
    echo "   Consider increasing batch size and worker count"
fi

echo -e "\n=========================================="
echo "Health check completed at $(date '+%H:%M:%S')"
echo "==========================================="