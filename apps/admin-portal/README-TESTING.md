# 🧪 Playwright Testing - Smart City Admin Portal

## Instalacija je završena! ✅

Playwright je uspešno instaliran i konfigurisan za Smart City Admin Portal sa podrškom za **Chromium** browser engine.

## 📁 Struktura testova

```
apps/admin-portal/
├── playwright.config.ts      # Glavna konfiguracija
├── e2e/
│   ├── fixtures/             # Test podaci
│   │   └── test-users.ts     # Korisnici za različite role
│   ├── pages/                # Page Object Model
│   │   ├── LoginPage.ts      # Login stranica
│   │   └── DashboardPage.ts  # Dashboard stranica
│   └── tests/                # Test fajlovi
│       └── auth.spec.ts      # Autentifikacija i RBAC testovi
```

## 🚀 Pokretanje testova

```bash
# Svi testovi (headless)
npm run test:e2e

# Sa vizuelnim prikazom browsera
npm run test:e2e:headed

# Interaktivni UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Samo Chromium
npm run test:e2e -- --project=chromium

# Samo jedan test
npm run test:e2e -- --grep "Uspešna prijava"
```

## 📊 Test Report

Nakon izvršavanja testova:
```bash
npm run test:e2e:report
```

## 🎯 Pokriveni scenariji

### Autentifikacija
- ✅ Uspešna prijava sa validnim kredencijalima
- ✅ Neuspešna prijava sa pogrešnim kredencijalima
- ✅ Validacija praznih polja
- ✅ Odjava iz sistema
- ✅ Zaštićene rute bez autentifikacije

### RBAC (Role Based Access Control)
- ✅ SUPER_ADMIN pristup svim sekcijama
- ✅ OPERATOR ograničen pristup

## 🔧 Dodavanje novih testova

### 1. Kreiraj Page Object
```typescript
// e2e/pages/TransportPage.ts
export class TransportPage {
  constructor(page: Page) {
    this.page = page;
    // locators...
  }
}
```

### 2. Napravi test
```typescript
// e2e/tests/transport.spec.ts
import { test, expect } from '@playwright/test';

test('GPS tracking', async ({ page }) => {
  // test logic...
});
```

## 🌐 Chromium prednosti

- **Realan browser engine** - isti koji koriste Chrome i Edge
- **Headless mode** - brže izvršavanje na CI/CD
- **Network interception** - mockovanje API poziva
- **Screenshot/Video** - automatsko snimanje pri greškama
- **DevTools protokol** - pristup browser debugging alatima

## 📈 Sledeći koraci

1. **Proširiti test pokrivanje:**
   - Transport modul (GPS, vozila)
   - Dashboard widgets
   - Leaflet mape
   - TimescaleDB integracija

2. **CI/CD integracija:**
   ```yaml
   # .github/workflows/test.yml
   - name: Run E2E tests
     run: npm run test:e2e
   ```

3. **Visual regression:**
   ```bash
   npm install -D @playwright/test@latest
   # Dodaj screenshot testove
   ```

4. **API testing:**
   - Mock backend responses
   - Test WebSocket konekcije
   - JWT token handling

## 🐛 Troubleshooting

### Port 3011 zauzet
```bash
# Promeni port u playwright.config.ts
baseURL: 'http://localhost:3012'
```

### Browser ne može da se pokrene
```bash
# Reinstaliraj browsere
npx playwright install --force chromium
```

### Timeout greške
```typescript
// Povećaj timeout u konfiguraciji
use: {
  actionTimeout: 20000,
  navigationTimeout: 60000,
}
```

## 📚 Korisni linkovi

- [Playwright dokumentacija](https://playwright.dev)
- [Chromium projekat](https://www.chromium.org)
- [Best practices](https://playwright.dev/docs/best-practices)