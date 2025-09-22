#!/bin/bash

echo "🧹 Čišćenje nepostojećih migracija iz _prisma_migrations tabele..."

# Lista migracija koje treba obrisati
MIGRATIONS_TO_DELETE=(
    "20250910071605_add_permissions_crud_permissions"
    "20250910194537_add_api_keys_permissions"
)

# Proveri da li migracije postoje pre brisanja
for migration in "${MIGRATIONS_TO_DELETE[@]}"; do
    echo "Proveram migraciju: $migration"

    # Proveri da li migracija postoji u bazi
    COUNT=$(docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -sN -e "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '$migration';")

    if [ "$COUNT" -eq "1" ]; then
        echo "  ✅ Pronađena u bazi, brišem..."
        docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "DELETE FROM _prisma_migrations WHERE migration_name = '$migration';"

        if [ $? -eq 0 ]; then
            echo "  ✅ Migracija $migration je obrisana"
        else
            echo "  ❌ Greška pri brisanju migracije $migration"
            exit 1
        fi
    else
        echo "  ℹ️  Migracija $migration ne postoji u bazi, preskačem..."
    fi
done

echo ""
echo "✅ Čišćenje završeno!"
echo ""
echo "📋 Trenutno stanje _prisma_migrations tabele:"
docker exec smartcity-mysql-local mysql -u smartcity_user -pSecurePassword123! smartcity_dev -e "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"