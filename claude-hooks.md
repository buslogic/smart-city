# 🪝 Claude Code Hooks

Kolekcija hook-ova za automatizaciju i zaštitu u Claude Code sesijama.

## 📁 Projekat-specifična konfiguracija

### Glavna konfiguracija
**Lokacija:** `/home/kocev/smart-city/.claude/settings.json`

Ova konfiguracija se **automatski učitava** kada Claude Code otvori Smart City folder.
Hook-ovi važe **SAMO za ovaj projekat**, ne utiču na druge projekte na računaru.

### Struktura foldera
```
/home/kocev/smart-city/
├── .claude/
│   └── settings.json    # Hook konfiguracija (koristi $CLAUDE_PROJECT_DIR)
├── scripts/             # Hook skripte
│   ├── hook-json-parser.py      # ⭐ Helper za JSON parsiranje
│   ├── mysql-guard-hook.sh
│   ├── prisma-guard-hook.sh
│   ├── curl-login-guard-hook.sh
│   ├── claude-files-guard-hook.sh
│   ├── git-ssh-guard-hook.sh
│   ├── search-tools-guard-hook.sh
│   └── after-compact-hook.sh
└── claude-hooks.md      # Ova dokumentacija
```

### Aktivacija
Hook-ovi se aktiviraju **automatski** kada:
1. Otvorite Smart City folder u Claude Code
2. Claude Code učita `.claude/settings.json`
3. Vidite poruku: `Running hook PreToolUse:Bash...`

### Provera da li rade
```bash
# Test 1: Prisma (treba biti BLOKIRAN)
prisma migrate dev

# Test 2: SSH (treba tražiti ključ)
ssh root@server

# Test 3: MySQL (treba biti BLOKIRAN)
mysql -e "INSERT INTO test"

# Test 4: Grep (treba biti BLOKIRAN)
grep -r "TODO" apps/backend
```

### Restart/Nova instanca
- Hook-ovi se učitavaju **automatski** iz `.claude/settings.json`
- **Nema potrebe** za ručnim dodavanjem
- Svaka instanca koja otvori projekat dobija iste hook-ove

### ⚠️ Napomene
- **NE KORISTIMO** globalnu konfiguraciju (`~/.claude/settings.json`)
- Hook-ovi koriste `$CLAUDE_PROJECT_DIR` varijablu za relativne putanje
- Može se commitovati u Git zajedno sa projektom
- **Hook skripte čitaju JSON sa stdin** (ne primaju argumente)
- **Exit kod 2** blokira izvršavanje komande

---

## 🛠️ Hook Implementacija (09/2025 Update)

### JSON Input Format
Svi PreToolUse:Bash hook-ovi primaju JSON sa stdin:
```json
{"tool_input": {"command": "actual bash command here"}}
```

### Standardni Template
```bash
#!/bin/bash
# Čitaj JSON input sa stdin i ekstraktuj komandu
JSON_INPUT=$(cat)
COMMAND=$(echo "$JSON_INPUT" | "$(dirname "$0")/hook-json-parser.py")

# Logika validacije...
if [[ condition ]]; then
    echo "❌ BLOKIRAN: Razlog"
    exit 2  # Exit kod 2 blokira izvršavanje
fi

# Propusti komandu
exit 0
```

### Helper Skripta
**`scripts/hook-json-parser.py`** - parsira JSON i ekstraktuje command:
```python
import sys, json
data = json.load(sys.stdin)
print(data.get('tool_input', {}).get('command', ''))
```

---

## 1. MySQL Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/mysql-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Blokira direktne upise u MySQL/PostgreSQL baze

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

## 7. Search Tools Guard Hook
**Fajl:** `/home/kocev/smart-city/scripts/search-tools-guard-hook.sh`  
**Event:** `tool:Bash` (pre-execution)  
**Svrha:** Blokira bash search/read komande i forsira Claude Code alate

### ❌ Blokirano:
- `grep`, `egrep`, `fgrep` - pretraživanje sadržaja
- `find`, `locate` - pronalaženje fajlova
- `cat`, `head`, `tail`, `less`, `more` - čitanje fajlova
- `ack`, `ag` - alternativni search alati

### ✅ Ispravno rešenje:
**Za pretraživanje sadržaja:**
```
Koristi Grep tool umesto bash grep
```

**Za pronalaženje fajlova:**
```
Koristi Glob tool umesto find
```

**Za čitanje fajlova:**
```
Koristi Read tool umesto cat/head/tail
```

### Razlog:
- Bash komande troše više konteksta
- Claude alati su optimizovani i brži
- Read tool daje line brojeve automatski
- Grep/Glob alati imaju bolju regex podršku

### Izuzetak:
- Heredoc (`cat <<EOF`) je dozvoljen jer se koristi za pisanje

---

## ✅ Status Hook-ova (09/2025)

Svi hook-ovi su **ažurirani** sa novom implementacijom:
- ✅ Čitaju JSON sa stdin (ne primaju argumente)
- ✅ Koriste `hook-json-parser.py` helper skriptu  
- ✅ Exit kod 2 za blokiranje komandi
- ✅ Konfiguracija bez `"$COMMAND"` argumenta

**Restart Claude Code** je potreban za učitavanje novih hook-ova iz `.claude/settings.json`.