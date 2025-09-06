# 🪝 Claude Code Hooks

Kolekcija hook-ova za automatizaciju i zaštitu u Claude Code sesijama.

## 📁 Projekat-specifična konfiguracija

**Lokacija:** `/home/kocev/smart-city/.claude/settings.json`

Ova konfiguracija se automatski učitava kada Claude Code otvori Smart City folder.
Svi hook-ovi su definisani u projekat konfiguraciji i važe SAMO za ovaj projekat.

### Aktivacija:
```bash
cd /home/kocev/smart-city
# Claude Code automatski učitava .claude/settings.json
```

### Provera:
```bash
prisma migrate dev  # Treba biti BLOKIRAN
ssh root@server     # Treba tražiti SSH ključ
```

---

## 1. MySQL Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/mysql-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Blokira direktne upise u MySQL/PostgreSQL baze

### Postavka:
```bash
/home/kocev/smart-city/scripts/mysql-guard-hook.sh "$COMMAND"
```

### ✅ Dozvoljeno:
- SELECT, SHOW, DESCRIBE, EXPLAIN
- Prisma komande (migrate, db push)
- dbmate migracije

### ❌ Blokirano:
- INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE
- SQL fajlovi sa DML/DDL komandama

### Razlog:
Sve izmene baze moraju ići kroz Prisma/dbmate migracije zbog produkcije.

---

## 2. Prisma Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/prisma-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Blokira `prisma migrate dev` i daje instrukcije za ručni workflow

### Postavka:
```bash
/home/kocev/smart-city/scripts/prisma-guard-hook.sh "$COMMAND"
```

### ❌ Blokirano:
- `prisma migrate dev` - ne radi u non-interactive modu
- `prisma migrate dev --create-only` - takođe zahteva interakciju

### ⚠️ Upozorenje:
- `prisma db push` - dozvoljeno ali sa upozorenjem

### ✅ Ispravni postupak:
Hook vraća detaljan postupak kako da se rade migracije ručno.

---

## 3. Curl Login Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/curl-login-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Detektuje problematične curl login pozive sa Test123!

### Postavka:
```bash
/home/kocev/smart-city/scripts/curl-login-guard-hook.sh "$COMMAND"
```

### Problem koji rešava:
Password `Test123!` sadrži `!` što bash interpretira kao history expansion

### ✅ Ispravno rešenje koje hook predlaže:
```bash
curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "email": "admin@smart-city.rs",
  "password": "Test123!"
}
EOF
```

Hook takođe daje primer kako da se sačuva token za dalju upotrebu.

---

## 4. Claude Files Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/claude-files-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Preusmerava pretragu claude fajlova na root projekta

### Postavka:
```bash
/home/kocev/smart-city/scripts/claude-files-guard-hook.sh "$COMMAND"
```

### Problem koji rešava:
Claude Code često traži claude fajlove van root foldera umesto u `/home/kocev/smart-city/`

### ✅ Fajlovi koji su uvek u root-u:
- `claude-personal.md` - SSH kredencijali i lični podaci
- `claude-tips.md` - Tehnički saveti
- `claude-hooks.md` - Lista hook-ova
- `CLAUDE.md` - Projekat instrukcije

---

## 5. SSH & Git Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/git-ssh-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Forsira korišćenje SSH ključa za SVE SSH i Git operacije

### Postavka:
```bash
/home/kocev/smart-city/scripts/git-ssh-guard-hook.sh "$COMMAND"
```

### ❌ Blokirano:
- `ssh` komande bez `-i` ključa
- `git push/pull` bez SSH ključa
- HTTPS GitHub URL-ovi
- GitHub token autentifikacija

### ✅ Ispravno za SSH:
```bash
ssh -i ~/.ssh/hp-notebook-2025-buslogic root@157.230.119.11 "komanda"
```

### ✅ Ispravno za Git:
```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/hp-notebook-2025-buslogic" git push origin main
```

### 📋 Lista servera:
Hook prikazuje sve poznate servere (Production, Legacy MySQL/GPS, Test)

### 📄 Detalji:
SSH ključ i kredencijali su u `/home/kocev/smart-city/claude-personal.md`

---

## 6. After Compact Hook
**Fajl:** `/home/kocev/smart-city/scripts/after-compact-hook.sh`  
**Event:** `after:/compact` (post-execution)  
**Svrha:** Automatski podseća na učitavanje claude fajlova nakon compact

### Postavka:
```bash
/home/kocev/smart-city/scripts/after-compact-hook.sh
```

### Šta radi:
Nakon `/compact` komande:
1. Lista sve claude fajlove koje treba učitati
2. Generiše cat komande za svaki fajl
3. Prikazuje sažetak ključnih pravila
4. Podseća na 5 glavnih problema/rešenja

### Fajlovi koje učitava:
- `CLAUDE.md` - projekat instrukcije
- `claude-tips.md` - tehnički saveti
- `claude-personal.md` - kredencijali
- `claude-hooks.md` - lista hook-ova

---

## 7. [Ime sledećeg hook-a]
*Opis će biti dodat...*