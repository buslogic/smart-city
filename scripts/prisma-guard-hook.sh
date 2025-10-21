#!/bin/bash

# Prisma Guard Hook - Blokira migrate dev i daje instrukcije za diff
# Koristi se kao pre-execution hook za Bash tool u Claude Code

# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Proveri da li komanda sadrži prisma migrate dev
if echo "$COMMAND" | grep -E "prisma migrate dev" > /dev/null 2>&1; then
    # Poruke idu na stderr da bi bile vidljive u Claude Code
    >&2 echo "❌ BLOKIRAN: 'prisma migrate dev' ne može da se koristi!"
    >&2 echo ""
    >&2 echo "⚠️  Claude Code radi u non-interactive modu i ne može da odgovara na YES/NO pitanja."
    >&2 echo ""
    >&2 echo "✅ PREPORUČENI POSTUPAK - Koristi Prisma migrate diff:"
    >&2 echo ""
    >&2 echo "1️⃣  Dodaj/izmeni model u schema.prisma"
    >&2 echo ""
    >&2 echo "2️⃣  Formatiraj schema.prisma:"
    >&2 echo "    npx prisma format"
    >&2 echo ""
    >&2 echo "3️⃣  Kreiraj migration folder sa TAČNIM formatom (YYYYMMDDHHmmss):"
    >&2 echo ""
    >&2 echo "    ⚠️  KRITIČNO: Prvo proveri da si u backend direktorijumu!"
    >&2 echo "    cd /home/kocev/smart-city/apps/backend"
    >&2 echo ""
    >&2 echo "    Tek onda kreiraj folder:"
    >&2 echo "    mkdir -p prisma/migrations/\$(date +%Y%m%d%H%M%S)_naziv_migracije"
    >&2 echo ""
    >&2 echo "    ILI koristi apsolutnu putanju direktno:"
    >&2 echo "    mkdir -p /home/kocev/smart-city/apps/backend/prisma/migrations/\$(date +%Y%m%d%H%M%S)_naziv_migracije"
    >&2 echo ""
    >&2 echo "4️⃣  Generiši SQL automatski pomoću diff:"
    >&2 echo ""
    >&2 echo "    ⚠️  KRITIČNO - OBRNUTA LOGIKA (često se greši ovde!):"
    >&2 echo "    --from-schema-datasource = trenutna baza (SOURCE)"
    >&2 echo "    --to-schema-datamodel    = nova schema (TARGET)"
    >&2 echo ""
    >&2 echo "    npx prisma migrate diff \\"
    >&2 echo "      --from-schema-datasource prisma/schema.prisma \\"
    >&2 echo "      --to-schema-datamodel prisma/schema.prisma \\"
    >&2 echo "      --script > prisma/migrations/FOLDER_NAME/migration.sql"
    >&2 echo ""
    >&2 echo "5️⃣  Pregledaj generisan SQL i po potrebi ga doradi"
    >&2 echo ""
    >&2 echo "6️⃣  Primeni migraciju:"
    >&2 echo "    npx prisma migrate deploy"
    >&2 echo ""
    >&2 echo "7️⃣  Generiši Prisma klijent:"
    >&2 echo "    npx prisma generate"
    >&2 echo ""
    >&2 echo "💡 PREDNOSTI DIFF PRISTUPA:"
    >&2 echo "   • Automatski generiše ispravne SQL komande"
    >&2 echo "   • Čuva foreign key constraints"
    >&2 echo "   • Pravilno handluje tipove podataka"
    >&2 echo "   • Sigurniji od ručnog pisanja SQL-a"
    exit 2
fi

# Proveri i za create-only varijantu
if echo "$COMMAND" | grep -E "prisma migrate.*--create-only" > /dev/null 2>&1; then
    >&2 echo "❌ BLOKIRAN: Čak ni '--create-only' ne radi u non-interactive modu!"
    >&2 echo ""
    >&2 echo "✅ Koristi Prisma migrate diff postupak iznad."
    exit 2
fi

# Upozori za db push
if echo "$COMMAND" | grep -E "prisma db push" > /dev/null 2>&1; then
    >&2 echo "⚠️  UPOZORENJE: 'prisma db push' preskače migracije!"
    >&2 echo ""
    >&2 echo "❌ NE PREPORUČUJE SE - može dovesti do gubitka podataka!"
    >&2 echo ""
    >&2 echo "✅ Umesto toga koristi migrate diff postupak:"
    >&2 echo "   1. npx prisma format"
    >&2 echo "   2. npx prisma migrate diff --from-schema-datamodel --to-schema-datasource"
    >&2 echo "   3. npx prisma migrate deploy"
    >&2 echo ""
    >&2 echo "Nastavljam sa db push na tvoju odgovornost..."
    # Ne blokiraj, ali jako upozori
fi

# Proveri format migration foldera
if echo "$COMMAND" | grep -E "mkdir.*migrations/[^/]+$" > /dev/null 2>&1; then
    FOLDER_NAME=$(echo "$COMMAND" | grep -oE "migrations/[^/]+$" | cut -d'/' -f2)
    
    # Proveri da li folder ime počinje sa timestamp formatom (14 cifara)
    if ! echo "$FOLDER_NAME" | grep -E "^[0-9]{14}_" > /dev/null 2>&1; then
        >&2 echo "⚠️  UPOZORENJE: Migration folder nema ispravan format!"
        >&2 echo ""
        >&2 echo "❌ Trenutni: $FOLDER_NAME"
        >&2 echo "✅ Ispravno: \$(date +%Y%m%d%H%M%S)_naziv_migracije"
        >&2 echo "   Primer: 20250906150324_add_dashboard_tables"
        >&2 echo ""
        >&2 echo "Prisma očekuje tačno 14 cifara za timestamp!"
    fi
    
    # Proveri da li se kreira u pravom direktorijumu
    if ! echo "$COMMAND" | grep -E "apps/backend/prisma/migrations" > /dev/null 2>&1; then
        if ! pwd | grep -E "apps/backend$" > /dev/null 2>&1; then
            >&2 echo ""
            >&2 echo "🔴 KRITIČNO UPOZORENJE: Izgleda da nisi u backend direktorijumu!"
            >&2 echo ""
            >&2 echo "   Trenutna lokacija: $(pwd)"
            >&2 echo "   Trebalo bi: /home/kocev/smart-city/apps/backend"
            >&2 echo ""
            >&2 echo "⚠️  OBAVEZNO prvo promeni direktorijum:"
            >&2 echo "   cd /home/kocev/smart-city/apps/backend"
            >&2 echo ""
            >&2 echo "ILI koristi punu putanju:"
            >&2 echo "   mkdir -p /home/kocev/smart-city/apps/backend/prisma/migrations/\$(date +%Y%m%d%H%M%S)_naziv"
        fi
    fi
fi

# Savet za formatiranje schema.prisma
if echo "$COMMAND" | grep -E "prisma generate" > /dev/null 2>&1; then
    >&2 echo "💡 SAVET: Pre 'prisma generate', uvek pokreni:"
    >&2 echo "   npx prisma format"
    >&2 echo ""
    >&2 echo "Ovo osigurava konzistentan format schema.prisma fajla."
fi

# Dozvoli sve ostalo
exit 0