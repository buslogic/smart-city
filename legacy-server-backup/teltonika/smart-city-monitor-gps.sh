#\!/bin/bash
echo "=== GPS MONITORING - $(date) ==="
echo ""
echo "1. RAW LOG STATUS:"
if [ -f /var/www/teltonika60/smart-city-gps-raw-log.txt ]; then
    lines=$(wc -l < /var/www/teltonika60/smart-city-gps-raw-log.txt)
    size=$(du -h /var/www/teltonika60/smart-city-gps-raw-log.txt | cut -f1)
    echo "   Trenutni log: $lines linija ($size)"
    
    # Statistika vozila
    vehicles=$(cut -d"|" -f2 /var/www/teltonika60/smart-city-gps-raw-log.txt | sort -u | wc -l)
    echo "   Jedinstvenih vozila: $vehicles"
else
    echo "   Nema aktivnog log fajla"
fi

echo ""
echo "2. PROCESSED LOGS (poslednji):"
last_processed=$(ls -t /var/www/teltonika60/processed_logs/ 2>/dev/null | head -1)
if [ -n "$last_processed" ]; then
    size=$(du -h /var/www/teltonika60/processed_logs/$last_processed | cut -f1)
    lines=$(wc -l < /var/www/teltonika60/processed_logs/$last_processed)
    echo "   $last_processed: $lines linija ($size)"
fi

echo ""
echo "3. VEHICLE FILTER:"
if [ -f /var/www/teltonika60/smart-city-gsp-vehicles.json ]; then
    count=$(grep -c ":" /var/www/teltonika60/smart-city-gsp-vehicles.json)
    echo "   Vozila u filteru: $count"
fi

echo ""
echo "4. POSLEDNJI LOG IZ PROCESSOR-a:"
tail -3 /var/log/gps_raw_processor.log 2>/dev/null || echo "   Nema log-a"

echo ""
echo "5. ACTIVE CONNECTIONS:"
connections=$(ss -tan | grep :12060 | grep ESTAB | wc -l)
echo "   GPS uređaja povezano: $connections"
