#!/bin/bash

# Script za kreiranje nove TimescaleDB baze za Litas projekat
# Ovaj script kreira novu bazu litas_tsdb u TimescaleDB Cloud

echo "🚀 Kreiram novu TimescaleDB bazu za Litas projekat..."

# TimescaleDB connection string za admin pristup
TIMESCALE_ADMIN="postgres://tsdbadmin:Buslogic123%21@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/tsdb?sslmode=require"

echo "📊 Kreiram litas_tsdb bazu..."
docker run --rm postgres:16 psql "$TIMESCALE_ADMIN" -c "CREATE DATABASE litas_tsdb;"

if [ $? -eq 0 ]; then
    echo "✅ Baza litas_tsdb uspešno kreirana!"

    # Kreiraj osnovne TimescaleDB ekstenzije u novoj bazi
    echo "🔧 Dodajem TimescaleDB ekstenzije..."
    LITAS_DB="postgres://tsdbadmin:Buslogic123%21@b96osgyp1w.duvl2ceai2.tsdb.cloud.timescale.com:31143/litas_tsdb?sslmode=require"

    docker run --rm postgres:16 psql "$LITAS_DB" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
    docker run --rm postgres:16 psql "$LITAS_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"

    echo "✅ TimescaleDB ekstenzije dodane!"

    # Kreiraj Kubernetes secret
    echo "🔑 Kreiram Kubernetes secret..."
    kubectl create secret generic litas-timescale-credentials \
      --from-literal=TIMESCALE_DATABASE_URL="$LITAS_DB" \
      -n litas-smart-city

    echo "✅ Secret litas-timescale-credentials kreiran!"

    # Restartuj deployment
    echo "🔄 Restartujem deployment..."
    kubectl rollout restart deployment litas-backend -n litas-smart-city

    echo "🎉 Litas TimescaleDB setup završen!"
    echo "📝 Nova baza: litas_tsdb"
    echo "🔗 Connection string: $LITAS_DB"

else
    echo "❌ Greška pri kreiranju baze litas_tsdb"
    exit 1
fi