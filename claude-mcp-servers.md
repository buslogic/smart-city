# Claude MCP Servers - Model Context Protocol integracija

## 📡 O MCP Serverima

MCP (Model Context Protocol) serveri omogućavaju Claude Code-u pristup spoljnim alatima i servisima kroz standardizovan protokol. Ova integracija omogućava napredne funkcionalnosti koje nisu moguće samo kroz standardne alate.

## 🌐 Chrome DevTools MCP Server

### Šta omogućava?
Chrome DevTools MCP server omogućava potpunu kontrolu nad Chrome browser-om za:
- Automatizovano testiranje web aplikacija
- Web scraping i analizu stranica
- End-to-end testiranje korisničkih scenarija
- Debugging i monitoring web aplikacija
- Screenshot i snapshot funkcionalnosti

### Preduslov za korišćenje
- Chrome browser mora biti pokrenut
- MCP server mora biti konfigurisan u Claude Code
- Pristup lokalnim portovima (3011 za admin portal)

## 📋 Dostupne MCP funkcije

### Upravljanje stranicama
- `mcp__chrome-devtools__list_pages` - Lista otvorenih stranica
- `mcp__chrome-devtools__new_page` - Otvori novu stranicu
- `mcp__chrome-devtools__select_page` - Selektuj stranicu za rad
- `mcp__chrome-devtools__close_page` - Zatvori stranicu
- `mcp__chrome-devtools__navigate_page` - Navigiraj na URL
- `mcp__chrome-devtools__navigate_page_history` - Back/Forward navigacija

### Snapshot i Screenshot
- `mcp__chrome-devtools__take_snapshot` - Uzmi DOM snapshot (tekstualni)
- `mcp__chrome-devtools__take_screenshot` - Uzmi screenshot (PNG/JPEG)

### Interakcija sa elementima
- `mcp__chrome-devtools__click` - Klikni na element
- `mcp__chrome-devtools__fill` - Popuni input/textarea/select
- `mcp__chrome-devtools__fill_form` - Popuni više elemenata odjednom
- `mcp__chrome-devtools__hover` - Hover preko elementa
- `mcp__chrome-devtools__drag` - Drag & drop funkcionalnost
- `mcp__chrome-devtools__upload_file` - Upload fajla

### Monitoring i debugging
- `mcp__chrome-devtools__list_network_requests` - Lista svih network zahteva
- `mcp__chrome-devtools__get_network_request` - Detalji specifičnog zahteva
- `mcp__chrome-devtools__list_console_messages` - Console.log poruke
- `mcp__chrome-devtools__handle_dialog` - Upravljaj alert/confirm/prompt

### Performance analiza
- `mcp__chrome-devtools__performance_start_trace` - Započni performance trace
- `mcp__chrome-devtools__performance_stop_trace` - Zaustavi trace
- `mcp__chrome-devtools__performance_analyze_insight` - Analiziraj performance

### JavaScript izvršavanje
- `mcp__chrome-devtools__evaluate_script` - Izvrši JavaScript u stranici
- `mcp__chrome-devtools__wait_for` - Čekaj da se pojavi tekst na stranici

### Emulacija
- `mcp__chrome-devtools__resize_page` - Promeni dimenzije viewport-a
- `mcp__chrome-devtools__emulate_cpu` - CPU throttling (1-20x)
- `mcp__chrome-devtools__emulate_network` - Network throttling (3G/4G)

## 🎯 Praktični primeri za Smart City projekat

### 1. Testiranje login funkcionalnosti
```typescript
// Navigiraj na admin portal
await mcp__chrome-devtools__navigate_page({
  url: "http://localhost:3011"
});

// Uzmi snapshot da dobiješ UID-jeve elemenata
const snapshot = await mcp__chrome-devtools__take_snapshot();

// Popuni login formu
await mcp__chrome-devtools__fill({
  uid: "email-input-uid",
  value: "admin@smart-city.rs"
});

await mcp__chrome-devtools__fill({
  uid: "password-input-uid",
  value: "Test123!"
});

// Klikni na login
await mcp__chrome-devtools__click({
  uid: "login-button-uid"
});

// Proveri da li je login uspešan
await mcp__chrome-devtools__wait_for({
  text: "Dashboard"
});
```

### 2. Testiranje GPS Sync funkcionalnosti
```typescript
// Navigiraj na GPS Sync stranicu
await mcp__chrome-devtools__navigate_page({
  url: "http://localhost:3011/gps-sync"
});

// Selektuj vozila
await mcp__chrome-devtools__click({
  uid: "vehicle-460-checkbox"
});

// Pokreni sinhronizaciju
await mcp__chrome-devtools__click({
  uid: "start-sync-button"
});

// Proveri network zahteve
const requests = await mcp__chrome-devtools__list_network_requests();
const syncRequest = requests.find(r => r.url.includes('/api/gps-sync/start'));
```

### 3. Performance testiranje
```typescript
// Započni trace pre učitavanja stranice
await mcp__chrome-devtools__performance_start_trace({
  reload: true,
  autoStop: true
});

// Navigiraj na stranicu
await mcp__chrome-devtools__navigate_page({
  url: "http://localhost:3011/vehicles"
});

// Zaustavi trace i analiziraj
await mcp__chrome-devtools__performance_stop_trace();
await mcp__chrome-devtools__performance_analyze_insight({
  insightName: "LCPBreakdown"
});
```

### 4. Screenshot za dokumentaciju
```typescript
// Navigiraj na stranicu
await mcp__chrome-devtools__navigate_page({
  url: "http://localhost:3011/dashboard"
});

// Sačekaj da se učita
await mcp__chrome-devtools__wait_for({
  text: "Statistike vozila"
});

// Uzmi screenshot cele stranice
await mcp__chrome-devtools__take_screenshot({
  fullPage: true,
  format: "png"
});

// Ili screenshot specifičnog elementa
await mcp__chrome-devtools__take_screenshot({
  uid: "vehicle-stats-chart",
  format: "png"
});
```

### 5. Testiranje real-time funkcionalnosti
```typescript
// Otvori console monitoring
const consoleBefore = await mcp__chrome-devtools__list_console_messages();

// Navigiraj na dispatcher modul
await mcp__chrome-devtools__navigate_page({
  url: "http://localhost:3011/dispatcher"
});

// Proveri WebSocket konekciju kroz console
await mcp__chrome-devtools__evaluate_script({
  function: `() => {
    console.log('WebSocket status:', window.socketStatus);
    return window.socketStatus;
  }`
});

// Proveri nove console poruke
const consoleAfter = await mcp__chrome-devtools__list_console_messages();
```

## 🔧 Debug saveti

### Kako dobiti UID elemenata?
1. Uvek prvo pozovi `take_snapshot()`
2. Snapshot vraća listu elemenata sa njihovim UID-jevima
3. Koristi te UID-jeve za interakciju

### Problem: Element nije pronađen
```typescript
// Dodaj wait pre interakcije
await mcp__chrome-devtools__wait_for({
  text: "Tekst koji treba da se pojavi"
});

// Ili koristi evaluate_script za custom čekanje
await mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    await new Promise(r => setTimeout(r, 2000));
    return document.querySelector('.my-element') !== null;
  }`
});
```

### Network debugging
```typescript
// Proveri sve API pozive
const requests = await mcp__chrome-devtools__list_network_requests();
const apiRequests = requests.filter(r => r.url.includes('/api/'));

// Detalji specifičnog zahteva
const details = await mcp__chrome-devtools__get_network_request({
  url: "http://localhost:3010/api/auth/login"
});
```

## ⚠️ Važne napomene

1. **UID-jevi su privremeni** - Svaki `take_snapshot` generiše nove UID-jeve
2. **Asinhrono izvršavanje** - Sve MCP funkcije su asinhrone
3. **Error handling** - Uvek dodaj try/catch blokove
4. **Performance** - Koristi `wait_for` umesto `setTimeout`
5. **Cleanup** - Zatvori nepotrebne stranice sa `close_page`

## 🚀 Najbolje prakse

### Pre testiranja
- Proveri da je backend pokrenut (port 3010)
- Proveri da je admin portal pokrenut (port 3011)
- Resetuj bazu na poznato stanje ako je potrebno

### Tokom testiranja
- Koristi snapshot pre svake interakcije
- Logiraj važne korake za lakši debugging
- Snimaj screenshot-ove kritičnih momenata
- Proveri network i console za greške

### Posle testiranja
- Zatvori sve otvorene stranice
- Analiziraj performance metrike
- Dokumentuj pronađene probleme

## 📚 Dodatni resursi

- [MCP Protocol Specifikacija](https://github.com/anthropics/mcp)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Playwright API](https://playwright.dev/) - Slična funkcionalnost