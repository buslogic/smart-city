# 👀 KAKO DA VIDIŠ CHROMIUM BROWSER DOK TEST RADI

## ✨ DA, MOŽEŠ DA GLEDAŠ SVAKI KLIK!

Playwright može da pokrene **pravi browser** koji možeš da vidiš i pratiš šta se dešava!

## 🎬 OPCIJE ZA VIZUELNI PRIKAZ

### 1️⃣ **HEADED MODE** - Standardni prikaz
```bash
npm run test:e2e:headed
```
- ✅ Otvara pravi Chromium/Firefox/Safari browser
- ✅ Vidiš sve akcije u realnom vremenu
- ✅ Browser ostaje otvoren dok test radi

### 2️⃣ **DEBUG MODE** - Korak po korak
```bash
npm run test:e2e:debug
```
- ⏸️ **PAUZA** između koraka
- ⏭️ **NEXT** dugme za sledeći korak  
- 🔍 **Inspector** pokazuje selektore
- 📝 Možeš da edituješ test uživo!

### 3️⃣ **UI MODE** - Najbolji za development
```bash
npm run test:e2e:ui
```
- 🎮 **Interaktivni interface**
- ⏮️ **Time travel** - vrati se na bilo koji korak
- 📸 **DOM snapshots** za svaki korak
- 🔄 **Watch mode** - automatski rerun

### 4️⃣ **DEMO TEST** - Specijalno za tebe!
```bash
npm run test:e2e:demo
```
Pokreće specijalni test koji:
- 🐌 **SPORO** kuca tekst (slovo po slovo)
- 📸 Pravi **screenshots**
- 🎥 Snima **video**
- 💛 **Highlight** elemente pre klika
- ⏳ **Pauzira** između akcija

## 🎯 PRIMER: Gledaj kako test kuca i klikće

```bash
# Pokreni ovu komandu:
npm run test:e2e:demo
```

**Šta ćeš videti:**
1. Browser se otvara
2. Ide na login stranicu
3. **SPORO** kuca email (slovo po slovo!)
4. **SPORO** kuca password
5. Hover preko dugmeta
6. Klikće login
7. Čeka dashboard
8. Pravi screenshot

## 🐌 KAKO USPORITI SVE TESTOVE

### Opcija 1: Preko konfiguracije
Edituj `playwright.config.ts`:
```typescript
use: {
  slowMo: 1000, // 1 sekund između svake akcije
  launchOptions: {
    slowMo: 500, // 500ms usporavanje
  }
}
```

### Opcija 2: Preko komandne linije
```bash
# Samo Chromium, sporo, jedan po jedan
npm run test:e2e:slow
```

### Opcija 3: U samom testu
```typescript
test('Moj test', async ({ page }) => {
  test.slow(); // Označi test kao spor
  
  // Ili kucaj sporo
  await page.type('input', 'tekst', { delay: 100 });
  
  // Ili dodaj pauze
  await page.waitForTimeout(2000); // 2 sekunde
});
```

## 📸 GDE SU SCREENSHOTS I VIDEO?

Nakon testa pogledaj:
- 📸 **Screenshots**: `pre-login.png`, `dashboard.png`, `mobile-view.png`
- 🎥 **Video**: `videos/` folder
- 📊 **Report**: `npm run test:e2e:report`

## 🎮 KONTROLE U DEBUG MODE

Kad pokreneš `npm run test:e2e:debug`:

| Dugme | Funkcija |
|-------|----------|
| ▶️ Resume | Nastavi test |
| ⏭️ Step over | Sledeći korak |
| 🔍 Pick locator | Selektuj element na stranici |
| 📋 Copy | Kopiraj selektor |
| 🛑 Stop | Zaustavi test |

## 💡 PRO TIPS

1. **Gledaj network saobraćaj:**
   ```bash
   PWDEBUG=console npm run test:e2e:headed
   ```

2. **Samo jedan test:**
   ```bash
   npm run test:e2e:headed -- --grep "Uspešna prijava"
   ```

3. **Različite rezolucije:**
   ```bash
   npm run test:e2e:headed -- --project=mobile-chrome
   ```

4. **Sačuvaj trace za kasnije:**
   ```bash
   npm run test:e2e -- --trace on
   npx playwright show-trace trace.zip
   ```

## 🚀 PROBAJ ODMAH!

```bash
# Najbolje za početak:
npm run test:e2e:ui

# Ili demo sa sporim izvršavanjem:
npm run test:e2e:demo
```

Browser će se otvoriti i **VIDEĆEŠ SVE** - kako test otvara stranice, kuca tekst, klikće dugmiće, čeka da se učitaju elementi... Baš kao da ti ručno testiraš aplikaciju! 🎉