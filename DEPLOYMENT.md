# 🚀 Smart City Backend - DigitalOcean Deployment

## 📋 Pre-deployment Checklist

### 1. DigitalOcean Setup
- [ ] Kreiran DigitalOcean nalog
- [ ] Kreiran Container Registry
- [ ] Kreiran App Platform projekat
- [ ] Konfigurisane Managed baze (MySQL i Redis)

### 2. GitHub Setup
- [ ] Kod pushovan na GitHub
- [ ] Dodati GitHub Secrets:
  - `DIGITALOCEAN_ACCESS_TOKEN` - API token sa DigitalOcean
  - `DIGITALOCEAN_REGISTRY` - Naziv Container Registry
  - `DIGITALOCEAN_APP_ID` - ID App Platform aplikacije

### 3. Environment Variables
- [ ] Popunjen `.env.production` fajl sa produkcijskim vrednostima
- [ ] Generisani jaki JWT secret key-evi
- [ ] Konfigurisani CORS domeni

## 🛠️ Instalacija DigitalOcean CLI (doctl)

```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Windows (PowerShell)
iwr https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-windows-amd64.zip -OutFile doctl.zip
Expand-Archive -Path doctl.zip
```

## 🔑 Autentifikacija

```bash
# Generiši API token na: https://cloud.digitalocean.com/account/api/tokens
doctl auth init

# Proveri konekciju
doctl account get
```

## 📦 Container Registry Setup

```bash
# Kreiraj registry
doctl registry create smart-city

# Login na registry
doctl registry login

# Proveri registry
doctl registry get
```

## 🗄️ Database Setup

### MySQL Database
```bash
# Kreiraj MySQL cluster
doctl databases create smart-city-mysql \
  --engine mysql \
  --version 8 \
  --size db-s-1vcpu-1gb \
  --region fra1 \
  --num-nodes 1

# Dobavi connection string
doctl databases connection smart-city-mysql --format Host,Port,User,Password,Database
```

### Redis Cache
```bash
# Kreiraj Redis cluster
doctl databases create smart-city-redis \
  --engine redis \
  --version 7 \
  --size db-s-1vcpu-1gb \
  --region fra1 \
  --num-nodes 1

# Dobavi connection info
doctl databases connection smart-city-redis --format Host,Port,Password
```

## 🚀 Deployment Methods

### Metod 1: Automatski preko GitHub Actions
Push na `main` branch automatski pokreće deployment.

```bash
git add .
git commit -m "Deploy backend to DigitalOcean"
git push origin main
```

### Metod 2: Manuelno preko CLI

```bash
# Production deployment
./scripts/deploy-backend.sh production

# Staging deployment (ako imaš staging environment)
./scripts/deploy-backend.sh staging
```

### Metod 3: Direktno preko doctl

```bash
# Build i push Docker image
docker build -t smart-city-backend:latest -f apps/backend/Dockerfile .
docker tag smart-city-backend:latest registry.digitalocean.com/smart-city/smart-city-backend:latest
doctl registry login
docker push registry.digitalocean.com/smart-city/smart-city-backend:latest

# Deploy aplikaciju
doctl apps create --spec .do/app.yaml
```

## 📊 Monitoring i Logs

```bash
# Lista svih aplikacija
doctl apps list

# Dobavi detalje aplikacije
doctl apps get <app-id>

# Praćenje logova u realnom vremenu
doctl apps logs <app-id> --follow

# Proveri deployment status
doctl apps list-deployments <app-id>

# Rollback na prethodnu verziju
doctl apps create-deployment <app-id> --rollback
```

## 🔧 Troubleshooting

### Problem: Build fails
```bash
# Proveri Docker build lokalno
docker build -t test -f apps/backend/Dockerfile .
docker run -p 3010:3010 test
```

### Problem: Database connection fails
```bash
# Test MySQL konekciju
mysql -h <host> -P <port> -u <user> -p

# Proveri da li je SSL omogućen
# Dodaj ?ssl-mode=REQUIRED na DATABASE_URL
```

### Problem: Redis connection fails
```bash
# Test Redis konekciju
redis-cli -h <host> -p <port> -a <password> ping
```

### Problem: Health check fails
```bash
# Proveri logove
doctl apps logs <app-id> --type run

# SSH na container (ako je omogućeno)
doctl apps console <app-id>
```

## 🔐 Sigurnosne napomene

1. **NIKAD ne commituj .env.production sa pravim vrednostima**
2. **Generiši jake JWT secret key-eve:**
   ```bash
   openssl rand -base64 64
   ```
3. **Koristi Secrets Management za sensitive podatke**
4. **Omogući 2FA na DigitalOcean nalogu**
5. **Redovno update-uj dependencies**
6. **Konfiguriši firewall rules**

## 📈 Skaliranje

```bash
# Povećaj broj instanci
doctl apps update <app-id> --spec .do/app.yaml \
  --set services[0].instance_count=3

# Promeni veličinu instance
doctl apps update <app-id> --spec .do/app.yaml \
  --set services[0].instance_size_slug=professional-s

# Auto-scaling (preko App Platform dashboard)
```

## 💰 Procena troškova

- **App Platform:** ~$5-20/mesec (zavisi od instance)
- **MySQL Database:** ~$15/mesec (basic)
- **Redis Cache:** ~$15/mesec (basic)
- **Container Registry:** ~$5/mesec (500MB)
- **Bandwidth:** $0.01/GB nakon 1TB

**Ukupno:** ~$40-60/mesec za osnovnu produkciju

## 📚 Dodatni resursi

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [doctl Reference](https://docs.digitalocean.com/reference/doctl/)
- [Container Registry Guide](https://docs.digitalocean.com/products/container-registry/)
- [Managed Databases Guide](https://docs.digitalocean.com/products/databases/)

## 🆘 Podrška

- DigitalOcean Support: https://www.digitalocean.com/support/
- Community: https://www.digitalocean.com/community/
- Status Page: https://status.digitalocean.com/