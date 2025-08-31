#!/bin/bash

# Setup script za pripremu production servera
# Pokreni sa: ./scripts/setup-server.sh

set -e

SERVER_IP="157.230.119.11"
SSH_KEY="~/.ssh/hp-notebook-2025-buslogic"

echo "🚀 Setting up production server..."

# Kreiraj potrebne direktorijume na serveru
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
  echo "📁 Creating directories..."
  mkdir -p /root/apps/backend
  mkdir -p /root/backups
  mkdir -p /root/logs
EOF

echo "✅ Directories created"

# Kopiraj production environment fajl
echo "📋 Copying production environment file..."
scp -i $SSH_KEY apps/backend/.env.production root@$SERVER_IP:/root/apps/backend/.env.production

echo "🔧 Setting up Docker cleanup cron job..."
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
  # Docker cleanup cron job
  (crontab -l 2>/dev/null; echo "0 2 * * * docker system prune -af --volumes") | crontab -
  
  # Log rotation
  cat > /etc/logrotate.d/docker-containers << 'LOGROTATE'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
}
LOGROTATE
EOF

echo "✅ Server setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Edit /root/apps/backend/.env.production on server with real values"
echo "2. Add GitHub Secrets (see GITHUB_SECRETS.md)"
echo "3. Push to main branch to trigger deployment"