# Claude Electron API Documentation

**Generated:** 2025-09-24T05:16:07.363Z
**Project ID:** 2edce4f6-05a7-4437-bdbb-f026c49861ff
**Wiki Doc ID:** 812faaa7-f33e-4da1-a7a4-5ba272914344

---

## 🚀 Quick Start

This file contains API commands and instructions for working with Developer Agent from Claude Code.

## 📋 Prerequisites

- Developer Agent must be running
- You must be logged in to Developer Agent
- Claude Service is available on port 3100

---

## 📖 Wiki Documentation

# SADMIN Developer Agent - Korisnički priručnik

## 📱 O aplikaciji

SADMIN Developer Agent je desktop aplikacija koja omogućava automatsko praćenje rada developera na projektima. Aplikacija se integriše sa SADMIN platformom i omogućava:
- Automatsko praćenje vremena rada na taskovima
- Screenshot funkcionalnost tokom rada
- Integraciju sa projektima, taskovima i dokumentacijom
- Real-time sinhronizaciju sa timom

## 🚀 Instalacija

### Windows
1. Preuzmite `SADMIN-Developer-Agent-Setup.exe` sa portala
2. Pokrenite installer i pratite instrukcije
3. Aplikacija će se instalirati u `C:\Program Files\SADMIN Developer Agent`
4. Prečica će biti kreirana na Desktop-u

### macOS
1. Preuzmite `SADMIN-Developer-Agent.dmg` sa portala
2. Otvorite DMG fajl
3. Prevucite aplikaciju u Applications folder
4. Pokrenite iz Applications foldera

### Linux
1. Preuzmite `SADMIN-Developer-Agent.AppImage` sa portala
2. Učinite fajl izvršnim: `chmod +x SADMIN-Developer-Agent.AppImage`
3. Pokrenite aplikaciju

## 🔑 Prvo pokretanje

### Prijavljivanje
1. Pokrenite Developer Agent aplikaciju
2. Unesite vaše SADMIN kredencijale
   - Email adresa
   - Lozinka
3. Kliknite na "Prijavi se"

### Odabir projekta
1. Nakon prijavljivanja, odaberite projekat na kom radite
2. Projekat možete promeniti u bilo kom momentu kroz dropdown meni

---

# 🤖 Claude Code Integration Manual

## 📍 Lokacija ovog dokumenta u Wiki sistemu
- **Wiki Space**: User Manual (ID: 74a4580a-116e-462d-b35e-df755a2a54f2)
- **Kategorija**: Aplikacije (ID: 06f46584-18e5-4c10-bf2b-7002f7c9fc52)
- **Page ID**: 812faaa7-f33e-4da1-a7a4-5ba272914344

## ⚙️ Preduslov za Claude Code

### Developer Agent mora biti pokrenut
- **Windows**: Pokrenuti .exe aplikaciju
- **macOS**: Pokrenuti .app iz Applications
- **Linux**: Pokrenuti .AppImage

### ⚠️ KRITIČNO - Autentifikacija i kontekst

**Sve komande koriste Developer Agent sesiju koja automatski obezbeđuje:**
- **PROJECT-ID**: Automatski se čita iz trenutno odabranog projekta u Developer Agent
- **USER-ID**: Automatski se čita iz ulogovane sesije
- **AUTH TOKEN**: Automatski se prosleđuje iz Developer Agent sesije

**NAPOMENA**:
- Ako PROJECT-ID ili USER-ID nisu dostupni, komande neće raditi
- Morate biti ulogovani u Developer Agent i imati odabran projekat

## 🔧 Claude WebSocket Client

Claude WebSocket Client je CLI interfejs koji omogućava komunikaciju sa Developer Agent-om preko Claude Service-a (port 3100).

### Lokacija skripte
```bash
# WSL/Linux korisnici
/home/kocev/sadmin2025/developer-agent/claude-websocket-client.js

# Ili iz bilo kog projekta sa instaliranim developer-agent modulom
node developer-agent/claude-websocket-client.js
```

### Provera statusa
```bash
node claude-websocket-client.js status
```

Prikazuje:
- Status Developer Agent servisa
- **Trenutni projekat** (ako nije odabran, većina komandi neće raditi)
- Aktivnu sesiju
- Korisničke kredencijale

## 📝 Task Management Komande za Claude Code

### Osnovni Task Workflow

#### 1. Pregled taskova
```bash
# Svi aktivni taskovi (default: trenutni projekat)
node claude-websocket-client.js get-tasks

# Taskovi po statusu
node claude-websocket-client.js get-tasks --status TODO
node claude-websocket-client.js get-tasks --status IN_PROGRESS
node claude-websocket-client.js get-tasks --status TESTING
node claude-websocket-client.js get-tasks --status DONE

# Taskovi po story-ju
node claude-websocket-client.js get-tasks --storyId STORY-ID

# Taskovi po projektu
node claude-websocket-client.js get-tasks --projectId PROJECT-ID
```

#### 2. Detalji o tasku
```bash
# Preuzima sve informacije o tasku (uključujući attachment-e)
node claude-websocket-client.js get-task TASK-ID
```

#### 3. Početak rada na tasku - OBAVEZNO
```bash
# OBAVEZNO: Pokreće snimanje i prebacuje task u IN_PROGRESS
node claude-websocket-client.js start-task TASK-ID
```

#### 4. Ažuriranje statusa
```bash
# Workflow: TODO → IN_PROGRESS → TESTING → DONE

# Prebaci u testiranje (nakon završene implementacije)
node claude-websocket-client.js update-status TASK-ID TESTING "Implementacija završena, kreće testiranje"

# Označi kao završen (nakon uspešnog testiranja)
node claude-websocket-client.js update-status TASK-ID DONE "Opis šta je urađeno"
```

#### 5. Završetak rada - OBAVEZNO
```bash
# OBAVEZNO: Zaustavlja snimanje
node claude-websocket-client.js stop-task TASK-ID
```

### Kreiranje taskova
```bash
# AUTOMATSKI koristi trenutni PROJECT-ID i USER-ID iz Developer Agent sesije
node claude-websocket-client.js create-task "Naziv taska" \
  --description "Detaljan opis" \
  --priority HIGH \
  --storyId STORY-ID \
  --epicId EPIC-ID \
  --labels "bug,urgent" \
  --dueDate "2024-12-31"

# Eksplicitno zadavanje PROJECT-ID (ako radite sa drugim projektom)
node claude-websocket-client.js create-task PROJECT-ID "Naziv taska" \
  --description "Detaljan opis" \
  --priority HIGH
```

### Ažuriranje taskova
```bash
node claude-websocket-client.js update-task TASK-ID \
  --title "Novi naslov" \
  --description "Novi opis" \
  --priority MEDIUM \
  --status IN_PROGRESS \
  --estimatedHours 8 \
  --blockedBy "TASK-ID1,TASK-ID2" \
  --dependsOn "TASK-ID3,TASK-ID4"
```

## 📖 Story Management Komande

### Pregled story-ja
```bash
# Svi aktivni story-ji
node claude-websocket-client.js get-stories

# Story-ji po statusu
node claude-websocket-client.js get-stories --status IN_PROGRESS

# Story-ji po epic-u
node claude-websocket-client.js get-stories --epicId EPIC-ID
```

### Kreiranje story-ja
```bash
# Osnovni story
node claude-websocket-client.js create-story PROJECT-ID "Naziv story-ja" \
  --description "Opis" \
  --acceptanceCriteria "AC1,AC2,AC3" \
  --storyPoints 8 \
  --priority HIGH \
  --epicId EPIC-ID

# Story sa taskovima
node claude-websocket-client.js create-story-with-tasks PROJECT-ID "Naziv" \
  --tasks tasks.json \
  --dependencies dependencies.json \
  --storyPoints 13
```

## 🚀 Epic Management Komande

### Osnovne Epic operacije
```bash
# Kreiranje Epic-a
node claude-websocket-client.js create-epic PROJECT-ID "Naziv epic-a" \
  --description "Opis" \
  --priority CRITICAL

# Epic sa kompletnom hijerarhijom
node claude-websocket-client.js create-epic-full PROJECT-ID "Naziv" \
  --template epic-full-template.json
```

### Epic Dependencies
```bash
# Postavi dependencies
node claude-websocket-client.js set-epic-dependencies EPIC-ID \
  --blockedBy "EPIC-ID1,EPIC-ID2" \
  --dependsOn "EPIC-ID3,EPIC-ID4"

# Pregled dependencies
node claude-websocket-client.js get-epic-dependencies EPIC-ID
```

## 📚 Wiki/Docs Management Komande

### Wiki prostori - ISPRAVNA SINTAKSA
```bash
# Lista Wiki prostora za projekat
node claude-websocket-client.js list-wiki-spaces PROJECT-ID

# SADMIN 2025 Wiki prostori:
# - 2102dab8-aac9-4705-9f87-a5e9dd537df7 (PROJECT_DOCS)
# - ad5931bc-9a52-4b2d-9c6e-a9892d0bb5f5 (TECHNICAL)
# - 74a4580a-116e-462d-b35e-df755a2a54f2 (USER_MANUAL)
# - 57a81a5d-2d0c-4115-b3a9-7c2d259e9938 (API_DOCS)
# - 575d04a9-5a81-400b-abfd-cc590307589c (KNOWLEDGE_BASE)
```

### Wiki stranice - ISPRAVNA SINTAKSA

```bash
# Lista stranica u prostoru
node claude-websocket-client.js list-wiki-pages SPACE-ID

# Pregled stranice
node claude-websocket-client.js get-wiki-page PAGE-ID

# ⚠️ KREIRANJE STRANICE - KORISTI FLAG-OVE
node claude-websocket-client.js create-wiki-page SPACE-ID "Naslov" "slug-naslov" \
  --content "# Sadržaj\n\nMarkdown tekst..." \
  --categoryId CATEGORY-ID \
  --status PUBLISHED

# Kreiranje iz fajla
node claude-websocket-client.js create-wiki-page SPACE-ID "Naslov" "slug-naslov" \
  --content "$(cat dokumentacija.md)" \
  --categoryId 06f46584-18e5-4c10-bf2b-7002f7c9fc52 \
  --status DRAFT

# Ažuriranje stranice
node claude-websocket-client.js update-wiki-page PAGE-ID \
  --title "Novi naslov" \
  --content "Novi sadržaj" \
  --status PUBLISHED

# Brisanje stranice
node claude-websocket-client.js delete-wiki-page PAGE-ID
```

### Wiki kategorije
```bash
# Kreiranje kategorije - ISPRAVNA SINTAKSA
node claude-websocket-client.js create-wiki-category SPACE-ID "Naziv" "slug-naziv" \
  --description "Opis kategorije"

# Kategorija "Aplikacije" u User Manual prostoru
# ID: 06f46584-18e5-4c10-bf2b-7002f7c9fc52
```

## 🏗️ Projekti

### Važni Project ID-jevi
- **SADMIN 2025**: `2edce4f6-05a7-4437-bdbb-f026c49861ff`
- **Smart-City 2025**: `a7940d6e-2429-46a7-b9dc-c1a3800ad9f8`

## ⚠️ Važne napomene za Claude Code

### Task Workflow - OBAVEZNO

1. **UVEK pokreni snimanje** kada počinješ rad:
   ```bash
   node claude-websocket-client.js start-task TASK-ID
   ```

2. **NIKAD ne prebacuj direktno u DONE** - prvo TESTING:
   ```bash
   # Prvo testiranje
   node claude-websocket-client.js update-status TASK-ID TESTING "Implementacija završena"

   # Tek nakon uspešnog testiranja
   node claude-websocket-client.js update-status TASK-ID DONE "Detaljan opis"
   ```

3. **OBAVEZNO zaustavi snimanje** nakon završetka:
   ```bash
   node claude-websocket-client.js stop-task TASK-ID
   ```

## 📎 Attachment-i i Screenshot-ovi

### Download attachment-a
```bash
node claude-websocket-client.js download /uploads/file.png ./local-file.png
```

### Pristup screenshot-ovima
```bash
# Poslednji screenshot (automatski učitava)
./ss

# Lista poslednjih 5 screenshot-ova
./ss l
```

---

## 💼 UI Funkcionalnosti za krajnje korisnike

### Rad sa taskovima kroz UI

#### Pregled taskova
Aplikacija prikazuje sve vaše aktivne taskove iz odabranog projekta:
- **TODO** - Taskovi koji čekaju na početak
- **IN_PROGRESS** - Taskovi na kojima trenutno radite
- **TESTING** - Taskovi u fazi testiranja
- **DONE** - Završeni taskovi

#### Početak rada na tasku
1. Odaberite task iz liste
2. Kliknite na **"Start Recording"** dugme
3. Task se automatski prebacuje u **IN_PROGRESS** status
4. Počinje automatsko praćenje vremena i aktivnosti

#### Tokom rada
- Aplikacija automatski beleži vašu aktivnost
- Screenshot se pravi svakih 60 sekundi
- Privacy indicator pokazuje da je snimanje aktivno
- Možete pauzirati snimanje po potrebi

#### Završetak rada
1. Kada završite implementaciju, prebacite task u **TESTING**
2. Nakon uspešnog testiranja, prebacite u **DONE**
3. Kliknite **"Stop Recording"** da zaustavite snimanje
4. Dodajte komentar sa opisom urađenog

## 📊 Story Management kroz UI

### Rad sa Story-jima
- Story predstavlja veću funkcionalnost koja sadrži više taskova
- Možete videti sve story-je u vašem projektu
- Svaki story pokazuje progres kroz svoje taskove

## 🚀 Epic Management kroz UI

### Šta je Epic?
Epic je velika funkcionalnost koja može sadržati više story-ja i taskova. Obično predstavlja ceo modul ili major feature.

### Epic Dependencies
- Epic-i mogu imati međusobne zavisnosti
- **Blocked By** - Epic-i koji blokiraju trenutni
- **Depends On** - Epic-i od kojih trenutni zavisi

## 📚 Wiki/Dokumentacija kroz UI

### Tipovi Wiki prostora
- **Project Documentation** - Opšta dokumentacija projekta
- **Technical Documentation** - Tehnička dokumentacija
- **User Manual** - Korisnički priručnici
- **API Documentation** - API dokumentacija
- **Knowledge Base** - Baza znanja

### Pristup dokumentaciji
1. Kliknite na **Wiki** tab u aplikaciji
2. Odaberite tip dokumentacije
3. Pregledajte ili pretražite stranice
4. Možete kreirati nove stranice direktno iz aplikacije

## 🔔 Notifikacije

Aplikacija vas obaveštava o:
- Novim taskovima dodeljenim vama
- Promenama na vašim taskovima
- Komentarima na taskovima
- Sistemskim obaveštenjima

## ⚙️ Podešavanja

### Opšta podešavanja
- **Tema**: Svetla/Tamna
- **Jezik**: Srpski/Engleski
- **Notifikacije**: Uključene/Isključene

### Privacy podešavanja
- **Screenshot učestalost**: 30s, 60s, 120s
- **Blur sensitive info**: Da/Ne
- **Activity tracking**: Detaljno/Osnovno

### Prečice na tastaturi
- `Ctrl/Cmd + S` - Start/Stop snimanje
- `Ctrl/Cmd + P` - Pauziraj snimanje
- `Ctrl/Cmd + T` - Otvori task listu
- `Ctrl/Cmd + N` - Novi task

## 🔍 Često postavljana pitanja

### Aplikacija se ne povezuje sa serverom?
1. Proverite internet konekciju
2. Proverite da li su kredencijali ispravni
3. Restartujte aplikaciju
4. Kontaktirajte IT podršku ako problem perzistira

### Screenshot-ovi se ne šalju?
1. Proverite Privacy podešavanja
2. Proverite da li imate dovoljno prostora na disku
3. Proverite internet brzinu

### Task se ne prebacuje u novi status?
1. Proverite da li imate potrebne dozvole
2. Osvežite task listu (F5)
3. Proverite da li je task blokiran od strane drugog taska

### Kako da radim offline?
- Aplikacija automatski čuva podatke lokalno
- Kada se vratite online, podaci se sinhronizuju
- Screenshot-ovi se čuvaju lokalno i šalju kasnije

## 🔍 Debug i Troubleshooting za Claude Code

### Provera logova
```bash
# Status provera
node claude-websocket-client.js status
```

### Česta pitanja

**Q: Komande ne rade, vraćaju grešku autentifikacije?**
A: Proveri da li je Developer Agent pokrenut i ulogovan.

**Q: Kako da znam ID projekta/taska/story-ja?**
A: Koristi `get-tasks`, `get-stories`, `list-projects` komande.

## 📚 Primeri rada za Claude Code

### Primer 1: Rad na novom tasku
```bash
# 1. Proveri status
node claude-websocket-client.js status

# 2. Preuzmi taskove
node claude-websocket-client.js get-tasks --status TODO

# 3. Preuzmi detalje o tasku
node claude-websocket-client.js get-task TASK-ID

# 4. Započni rad
node claude-websocket-client.js start-task TASK-ID

# 5. [Radi na implementaciji...]

# 6. Prebaci u testiranje
node claude-websocket-client.js update-status TASK-ID TESTING "Implementacija završena"

# 7. [Testiraj funkcionalnost...]

# 8. Označi kao završen
node claude-websocket-client.js update-status TASK-ID DONE "Implementiran login sistem sa JWT"

# 9. Zaustavi snimanje
node claude-websocket-client.js stop-task TASK-ID
```

### Primer 2: Wiki dokumentacija - KOMPLETNI PRIMERI
```bash
# 1. Lista Wiki prostora
node claude-websocket-client.js list-wiki-spaces 2edce4f6-05a7-4437-bdbb-f026c49861ff

# 2. Kreiranje stranice u User Manual prostoru sa kategorijom
node claude-websocket-client.js create-wiki-page 74a4580a-116e-462d-b35e-df755a2a54f2 \
  "Nova stranica" "nova-stranica" \
  --content "# Sadržaj\n\n..." \
  --categoryId 06f46584-18e5-4c10-bf2b-7002f7c9fc52 \
  --status PUBLISHED

# 3. Kreiranje stranice iz fajla
node claude-websocket-client.js create-wiki-page 74a4580a-116e-462d-b35e-df755a2a54f2 \
  "Dokumentacija" "dokumentacija" \
  --content "$(cat docs.md)" \
  --status DRAFT

# 4. Ažuriranje postojeće stranice
node claude-websocket-client.js update-wiki-page PAGE-ID \
  --title "Ažurirani naslov" \
  --content "# Nova verzija\n\n..." \
  --status PUBLISHED
```

## 📞 Podrška

### Kontakt
- **Email**: support@sadmin.rs
- **Telefon**: +381 11 123 4567
- **Working hours**: Ponedeljak - Petak, 09:00 - 17:00

### Prijava problema
1. Otvorite **Help** meni
2. Kliknite **Report Issue**
3. Opišite problem detaljno
4. Priložite screenshot ako je potrebno
5. Kliknite **Send**

## 🔄 Ažuriranja

Aplikacija automatski proverava ažuriranja:
- Obaveštenje o novoj verziji
- Automatsko preuzimanje u pozadini
- Restart aplikacije za primenu ažuriranja

## 🏆 Best Practices

### Efikasan rad
1. **Uvek startujte snimanje** kada počinjete rad na tasku
2. **Redovno ažurirajte status** taskova
3. **Dodajte komentare** sa opisom urađenog
4. **Koristite kategorije** za organizaciju dokumentacije
5. **Pauziranje umesto zaustavljanja** za kratke pauze

### Organizacija rada
1. Radite na jednom tasku u isto vreme
2. Završite trenutni task pre prelaska na sledeći
3. Testirajte pre označavanja kao DONE
4. Dokumentujte značajne izmene

### Timska kolaboracija
1. Koristite komentare za komunikaciju
2. Tagujte kolege kada je potrebna pomoć
3. Ažurirajte dokumentaciju nakon većih izmena
4. Delite znanje kroz Wiki stranice

---

**Verzija**: 1.0.0
**Poslednje ažuriranje**: Decembar 2024
**© 2024 SADMIN - Sva prava zadržana**

---

## 🔧 Common Commands

### Check Status
```bash
node claude-websocket-client.js status
```

### Task Operations
```bash
# List tasks
node claude-websocket-client.js get-tasks

# Start task
node claude-websocket-client.js start-task TASK-ID

# Update status
node claude-websocket-client.js update-status TASK-ID DONE "Comment"

# Stop task
node claude-websocket-client.js stop-task TASK-ID
```

### Project Info
- **Project ID:** 2edce4f6-05a7-4437-bdbb-f026c49861ff
- **Wiki Doc ID:** 812faaa7-f33e-4da1-a7a4-5ba272914344

---

## 📝 Notes

This file was automatically generated by Developer Agent.
To regenerate, use Settings > Current Project > Create claude-electron-api.md

---

*Developer Agent - Electron Application*
