#\!/bin/bash
# Smart City GPS Cron Setup
# Created: 03.09.2025
# 
# Ovaj fajl instalira cron job za Smart City GPS procesiranje

echo "=== Smart City GPS Cron Setup ==="
echo ""
echo "Instaliranje cron job-a za Smart City GPS procesiranje..."

# Ukloni postojeći Smart City cron ako postoji
crontab -l 2>/dev/null | grep -v "smart-city-raw-processor" > /tmp/cron_temp || true

# Dodaj novi cron job - svakih 2 minuta
echo "*/2 * * * * /usr/bin/php /var/www/teltonika60/smart-city-raw-processor.php >> /var/log/smart-city-raw-processor.log 2>&1" >> /tmp/cron_temp

# Opciono: Dodaj sync vozila jednom dnevno u 3 ujutru (zakomentarisano)
# echo "0 3 * * * /usr/bin/php /var/www/teltonika60/smart-city-gsp-vehicles-sync-filter.php >> /var/log/smart-city-sync.log 2>&1" >> /tmp/cron_temp

# Instaliraj crontab
crontab /tmp/cron_temp
rm /tmp/cron_temp

echo "✅ Cron job instaliran\!"
echo ""
echo "Trenutni Smart City cron job-ovi:"
crontab -l | grep smart-city
echo ""
echo "📊 Za praćenje log-a:"
echo "   tail -f /var/log/smart-city-raw-processor.log"
echo ""
echo "🔄 Za ručno pokretanje:"
echo "   php /var/www/teltonika60/smart-city-raw-processor.php"
