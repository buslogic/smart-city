#!/bin/bash

# Prisma Guard Hook - Blokira migrate dev i daje instrukcije
# Koristi se kao pre-execution hook za Bash tool u Claude Code

COMMAND="$1"

# Proveri da li komanda sadrži prisma migrate dev
if echo "$COMMAND" | grep -E "prisma migrate dev" > /dev/null 2>&1; then
    echo "❌ BLOKIRAN: 'prisma migrate dev' ne može da se koristi!"
    echo ""
    echo "⚠️  Claude Code radi u non-interactive modu i ne može da odgovara na YES/NO pitanja."
    echo ""
    echo "✅ ISPRAVNI POSTUPAK za Prisma migracije:"
    echo ""
    echo "1️⃣  Dodaj model u schema.prisma"
    echo ""
    echo "2️⃣  Kreiraj migrations folder:"
    echo "    mkdir -p prisma/migrations/\$(date +%Y%m%d%H%M%S)_naziv_migracije"
    echo ""
    echo "3️⃣  Napiši SQL ručno u migration.sql:"
    echo "    -- CreateTable"
    echo "    CREATE TABLE \`tabela\` ("
    echo "        \`id\` INTEGER NOT NULL AUTO_INCREMENT,"
    echo "        \`name\` VARCHAR(100) NOT NULL,"
    echo "        PRIMARY KEY (\`id\`)"
    echo "    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo ""
    echo "4️⃣  Primeni sa: npx prisma migrate deploy"
    echo "5️⃣  Generiši klijent: npx prisma generate"
    echo ""
    echo "📝 Za DROP/ALTER koristi isti postupak sa odgovarajućim SQL-om."
    exit 1
fi

# Proveri i za create-only varijantu
if echo "$COMMAND" | grep -E "prisma migrate.*--create-only" > /dev/null 2>&1; then
    echo "❌ BLOKIRAN: Čak ni '--create-only' ne radi u non-interactive modu!"
    echo ""
    echo "✅ Koristi gornji postupak sa ručnim SQL-om."
    exit 1
fi

# Upozori za db push
if echo "$COMMAND" | grep -E "prisma db push" > /dev/null 2>&1; then
    echo "⚠️  UPOZORENJE: 'prisma db push' preskače migracije!"
    echo ""
    echo "Ovo je OK samo za brzo testiranje, ali NE za produkciju."
    echo "Za produkciju koristi postupak sa migration.sql i 'migrate deploy'."
    echo ""
    echo "Nastavljam sa db push..."
    # Ne blokiraj, samo upozori
fi

# Dozvoli sve ostalo
exit 0