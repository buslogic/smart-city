#!/bin/bash

echo "🗑️  Brisanje schema_migrations tabele..."

# Direktno pozovi mysql komandu
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "DROP TABLE IF EXISTS schema_migrations;"

if [ $? -eq 0 ]; then
    echo "✅ Tabela schema_migrations je obrisana"
else
    echo "❌ Greška pri brisanju tabele"
    exit 1
fi