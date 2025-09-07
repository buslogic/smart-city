#!/bin/sh
set -e

echo "🚀 Starting Smart City Backend..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migration failed, but continuing to start the application..."
    # Optionally exit here if you want to stop on migration failure
    # exit 1
fi

# Generate Prisma client (in case of schema changes)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🎯 Starting NestJS application..."
exec node dist/src/main