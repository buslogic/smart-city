#!/bin/bash

# MySQL Guard Hook - Sprečava direktne MySQL upise
# Koristi se kao pre-execution hook za Bash tool u Claude Code

# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Lista zabranjenih MySQL komandi i pattern-a
FORBIDDEN_PATTERNS=(
    "mysql.*-e.*INSERT"
    "mysql.*-e.*UPDATE"
    "mysql.*-e.*DELETE"
    "mysql.*-e.*CREATE"
    "mysql.*-e.*ALTER"
    "mysql.*-e.*DROP"
    "mysql.*-e.*TRUNCATE"
    "mysql.*INSERT INTO"
    "mysql.*UPDATE.*SET"
    "mysql.*DELETE FROM"
    "mysql.*CREATE TABLE"
    "mysql.*ALTER TABLE"
    "mysql.*DROP TABLE"
    "mysql.*TRUNCATE TABLE"
    "psql.*INSERT"
    "psql.*UPDATE"
    "psql.*DELETE"
    "psql.*CREATE"
    "psql.*ALTER"
    "psql.*DROP"
)

# Dozvoljene komande (SELECT, SHOW, DESCRIBE)
ALLOWED_PATTERNS=(
    "mysql.*SELECT"
    "mysql.*SHOW"
    "mysql.*DESCRIBE"
    "mysql.*EXPLAIN"
    "psql.*SELECT"
    "prisma migrate"
    "prisma db push"
    "npx prisma"
)

# Proveri da li komanda sadrži zabranjene pattern-e
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -iE "$pattern" > /dev/null 2>&1; then
        
        # Proveri da li je ipak dozvoljena komanda (npr. prisma migrate)
        is_allowed=false
        for allowed in "${ALLOWED_PATTERNS[@]}"; do
            if echo "$COMMAND" | grep -iE "$allowed" > /dev/null 2>&1; then
                is_allowed=true
                break
            fi
        done
        
        if [ "$is_allowed" = false ]; then
            >&2 echo "❌ BLOKIRAN: Direktan upis u bazu podataka nije dozvoljen!"
            >&2 echo ""
            >&2 echo "⚠️  Pokušali ste da izvršite: $COMMAND"
            >&2 echo ""
            >&2 echo "✅ ISPRAVNO: Koristite Prisma migracije za izmene baze:"
            >&2 echo "   • cd apps/backend && npx prisma migrate dev --name naziv_migracije"
            >&2 echo "   • cd apps/backend && npx prisma db push (samo za development)"
            >&2 echo ""
            >&2 echo "📚 Za TimescaleDB koristite dbmate migracije:"
            >&2 echo "   • cd apps/backend/timescale"
            >&2 echo "   • dbmate new naziv_migracije"
            >&2 echo "   • dbmate up"
            >&2 echo ""
            >&2 echo "ℹ️  Dozvoljene su samo SELECT, SHOW i DESCRIBE komande za čitanje podataka."
            exit 2
        fi
    fi
done

# Dodatna provera za direktne SQL fajlove
if echo "$COMMAND" | grep -iE "mysql.*<.*\.sql|psql.*-f.*\.sql" > /dev/null 2>&1; then
    # Proveri da li SQL fajl sadrži upise
    SQL_FILE=$(echo "$COMMAND" | sed -n 's/.*[<-f] *\([^ ]*\.sql\).*/\1/p' | head -1)
    
    if [ -f "$SQL_FILE" ]; then
        if grep -iE "INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE" "$SQL_FILE" > /dev/null 2>&1; then
            if ! grep -iE "prisma|migration|dbmate" "$SQL_FILE" > /dev/null 2>&1; then
                >&2 echo "❌ BLOKIRAN: SQL fajl '$SQL_FILE' sadrži direktne upise u bazu!"
                >&2 echo ""
                >&2 echo "✅ Koristite Prisma ili dbmate migracije umesto direktnih SQL skripti."
                exit 2
            fi
        fi
    fi
fi

# Ako je komanda prošla sve provere, dozvoli izvršavanje
exit 0