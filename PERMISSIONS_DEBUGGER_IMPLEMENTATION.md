# 🛡️ Permissions Debugger - Plan Implementacije

## 📋 Pregled funkcionalnosti
Diskretni sistem za prikaz i debugging permisija na svakoj stranici aplikacije, koji omogućava korisnicima i administratorima lak uvid u potrebne i dostupne permisije.

## 🎯 Ciljevi
- Transparentnost permisija za sve korisnike
- Lakše debugovanje problema sa pristupom
- Brže rešavanje support tiketa
- Bolje razumevanje sistema od strane korisnika

## 🏗️ Arhitektura rešenja

### Komponente
1. **PermissionsDebugger** - Glavna komponenta (FAB ikonica)
2. **PermissionsModal** - Modal sa detaljnim informacijama
3. **PermissionsProvider** - Context provider za globalno stanje
4. **usePermissionsDebugger** - Custom hook za logiku

### Pozicija u aplikaciji
- Renderuje se u `MainLayout.tsx` (admin-portal)
- Fiksirana pozicija (bottom-right corner)
- Z-index: 9999 (iznad svega osim modala)

## ✅ TODO Lista Implementacije

### Phase 1: Backend Priprema
- [ ] **1.1** Kreirati endpoint `/api/permissions/debug-info`
  - Vraća sve permisije sa opisima
  - Grupisane po resursima
  - Sa metadata o stranicama
  
- [ ] **1.2** Proširiti postojeće permission tabele
  - Dodati `description_sr` kolonu za srpski opis
  - Dodati `ui_route` kolonu za mapiranje ruta
  - Dodati `category` kolonu za grupisanje

- [ ] **1.3** Kreirati permission mapping servis
  - Mapiranje ruta na potrebne permisije
  - Cache mehanizam za performanse

### Phase 2: Frontend Infrastruktura
- [ ] **2.1** Kreirati PermissionsDebuggerProvider
  ```typescript
  // apps/admin-portal/src/providers/PermissionsDebuggerProvider.tsx
  - Context setup
  - Global state management
  - Permission fetching logic
  ```

- [ ] **2.2** Kreirati usePermissionsDebugger hook
  ```typescript
  // apps/admin-portal/src/hooks/usePermissionsDebugger.ts
  - Get current route permissions
  - Check user permissions
  - Calculate missing permissions
  ```

- [ ] **2.3** Kreirati tipove
  ```typescript
  // apps/admin-portal/src/types/permissions-debugger.ts
  - DebugInfo interface
  - RoutePermissions interface
  - PermissionDetails interface
  ```

### Phase 3: UI Komponente
- [ ] **3.1** Kreirati PermissionsDebugger FAB
  ```typescript
  // apps/admin-portal/src/components/permissions/PermissionsDebugger.tsx
  - Floating action button
  - Badge sa brojem permisija
  - Tooltip na hover
  - Animacije
  ```

- [ ] **3.2** Kreirati PermissionsModal
  ```typescript
  // apps/admin-portal/src/components/permissions/PermissionsModal.tsx
  - Tab 1: Trenutna stranica
  - Tab 2: Sve korisničke permisije
  - Tab 3: Nedostupne funkcionalnosti
  - Tab 4: Request Access forma
  ```

- [ ] **3.3** Kreirati PermissionsList komponente
  ```typescript
  // apps/admin-portal/src/components/permissions/PermissionsList.tsx
  - PermissionItem komponenta
  - PermissionCategory komponenta
  - SearchablePermissions komponenta
  ```

### Phase 4: Stilizovanje
- [ ] **4.1** Kreirati stilove za FAB
  - Respektovati trenutnu temu (Ant Design)
  - Responsive design
  - Dark mode podrška

- [ ] **4.2** Kreirati stilove za Modal
  - Maksimalna visina sa scroll
  - Responsive tabovi
  - Animacije za smooth UX

- [ ] **4.3** Kreirati status indikatore
  - Zelena: ima permisiju ✅
  - Crvena: nema permisiju ❌
  - Žuta: delimična permisija ⚠️
  - Siva: nije potrebna ➖

### Phase 5: Integracija
- [ ] **5.1** Integracija u MainLayout
  ```typescript
  // apps/admin-portal/src/components/layout/MainLayout.tsx
  - Import PermissionsDebugger
  - Conditional rendering (dev/staging)
  - Props passing
  ```

- [ ] **5.2** Route mapping konfiguracija
  ```typescript
  // apps/admin-portal/src/config/route-permissions.ts
  - Mapiranje svih ruta na potrebne permisije
  - Export za debugging
  ```

- [ ] **5.3** Zustand store integracija
  ```typescript
  // apps/admin-portal/src/stores/permissions-debugger.store.ts
  - State management
  - Persist opcija u localStorage
  - Actions za toggle, search, filter
  ```

### Phase 6: Feature Flags
- [ ] **6.1** Environment varijable
  ```env
  VITE_ENABLE_PERMISSIONS_DEBUGGER=true
  VITE_PERMISSIONS_DEBUGGER_ROLES=SUPER_ADMIN,ADMIN
  ```

- [ ] **6.2** User preferences
  - Dodati opciju u user settings
  - Čuvati u localStorage
  - Sync sa backend (optional)

### Phase 7: Dodatne funkcionalnosti
- [ ] **7.1** Export funkcionalnost
  - Export u CSV
  - Export u JSON
  - Copy to clipboard

- [ ] **7.2** Request Access sistem
  - Forma za slanje zahteva
  - Email notifikacija adminu
  - Praćenje statusa zahteva

- [ ] **7.3** Istorija promena
  - Log promena permisija
  - Ko je i kada dodelio/oduzeo
  - Audit trail

- [ ] **7.4** Smart suggestions
  - "Često tražene permisije"
  - "Slične role imaju..."
  - "Za ovu akciju potrebno je..."

### Phase 8: Testing
- [ ] **8.1** Unit testovi
  - Hook testovi
  - Komponenta testovi
  - Service testovi

- [ ] **8.2** Integration testovi
  - Route permission mapping
  - API calls
  - State management

- [ ] **8.3** E2E testovi
  - User flow testovi
  - Permission check scenarios

### Phase 9: Dokumentacija
- [ ] **9.1** Tehnička dokumentacija
  - API dokumentacija
  - Component dokumentacija
  - Hook dokumentacija

- [ ] **9.2** User guide
  - Kako koristiti debugger
  - Objašnjenje permisija
  - FAQ

- [ ] **9.3** Admin guide
  - Konfiguracija
  - Upravljanje
  - Troubleshooting

### Phase 10: Deployment
- [ ] **10.1** Development deployment
  - Enable po defaultu
  - Svi korisnici

- [ ] **10.2** Staging deployment
  - Enable za admins
  - Feature flag testing

- [ ] **10.3** Production deployment
  - Samo za specifične role
  - Monitoring i analytics

## 🎨 UI/UX Specifikacija

### FAB Ikonica
- **Pozicija:** `position: fixed; bottom: 24px; right: 24px;`
- **Veličina:** 48x48px
- **Ikonica:** Shield ili Key sa badge brojem
- **Boje:** 
  - Default: primary color sa 0.9 opacity
  - Hover: full opacity + elevation
  - Active: pressed state

### Modal
- **Širina:** 800px (max 90vw)
- **Visina:** 600px (max 80vh)
- **Overlay:** Dark sa 0.5 opacity
- **Animacija:** Slide up + fade in

## 📊 Metrike za praćenje
- Broj otvaranja debugger-a po korisniku
- Najčešće tražene permisije
- Vreme provedeno u debugger-u
- Request Access konverzija

## 🚀 Estimacija vremena
- **Phase 1-3:** 2-3 dana (osnovna funkcionalnost)
- **Phase 4-6:** 1-2 dana (stilizovanje i integracija)
- **Phase 7:** 2-3 dana (dodatne funkcionalnosti)
- **Phase 8-9:** 2 dana (testing i dokumentacija)
- **Phase 10:** 1 dan (deployment)

**Ukupno:** ~10 radnih dana za kompletnu implementaciju

## 📝 Napomene
- Prioritet je Phase 1-5 za MVP
- Phase 6-10 mogu biti iterativni
- Monitoring analytics može biti dodat kasnije
- Razmotriti integraciju sa postojećim support sistemom

## 🔗 Reference
- [Ant Design Floating Button](https://ant.design/components/float-button)
- [React Context Best Practices](https://react.dev/learn/passing-data-deeply-with-context)
- [Zustand Documentation](https://github.com/pmndrs/zustand)