import { test, expect } from '@playwright/test';

/**
 * DEMO TEST - Pokreni ovaj test da vidiš browser u akciji!
 * 
 * Komande za pokretanje:
 * 1. npm run test:e2e:headed -- demo-visual.spec.ts
 * 2. npm run test:e2e:debug -- demo-visual.spec.ts
 * 3. npm run test:e2e:ui -- demo-visual.spec.ts
 */

test.describe('🎬 Vizuelna Demonstracija', () => {
  
  test('Sporo kretanje kroz aplikaciju - vidi svaki klik!', async ({ page }) => {
    // Usporavamo sve akcije za 500ms da možeš da pratiš
    test.slow();
    
    console.log('🚀 Krećemo sa testom - gledaj browser!');
    
    // Korak 1: Otvori početnu stranicu
    await page.goto('/');
    await page.waitForTimeout(2000); // Pauza 2 sekunde da vidiš
    
    // Korak 2: Kreni na login
    console.log('📍 Idem na login stranicu...');
    await page.goto('/login');
    await page.waitForTimeout(1500);
    
    // Korak 3: Ukucaj email SPORO - slovo po slovo
    console.log('⌨️ Kucam email adresu...');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.click();
    await emailInput.type('admin@smartcity.rs', { delay: 100 }); // 100ms između svakog slova!
    
    // Korak 4: Ukucaj password
    console.log('🔐 Kucam lozinku...');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.click();
    await passwordInput.type('Admin123!', { delay: 100 });
    
    // Korak 5: Napravi screenshot pre klika
    await page.screenshot({ path: 'pre-login.png' });
    console.log('📸 Screenshot snimljen: pre-login.png');
    
    // Korak 6: Klikni login dugme
    console.log('🖱️ Klikćem na Login dugme...');
    await page.waitForTimeout(1000);
    const loginButton = page.locator('button[type="submit"]').first();
    await loginButton.hover(); // Hover preko dugmeta
    await page.waitForTimeout(500);
    await loginButton.click();
    
    // Korak 7: Čekaj dashboard
    console.log('⏳ Čekam da se učita dashboard...');
    await page.waitForTimeout(3000);
    
    // Korak 8: Screenshot dashboard-a
    await page.screenshot({ path: 'dashboard.png', fullPage: true });
    console.log('📸 Screenshot snimljen: dashboard.png');
    
    console.log('✅ Test završen - pogledaj screenshots!');
  });

  test('Interakcija sa menijem - klik po klik', async ({ page, browserName }) => {
    // Različita brzina za različite browsere
    const delay = browserName === 'chromium' ? 300 : 500;
    
    await page.goto('/');
    
    // Animiraj hover preko različitih elemenata
    const menuItems = await page.locator('.menu-item, nav a, .ant-menu-item').all();
    
    console.log(`🎯 Pronašao ${menuItems.length} stavki menija`);
    
    for (const item of menuItems.slice(0, 5)) { // Samo prvih 5
      await item.hover();
      await page.waitForTimeout(delay);
      
      // Highlight element
      await item.evaluate(el => {
        el.style.border = '2px solid red';
        el.style.backgroundColor = 'yellow';
      });
      
      await page.waitForTimeout(delay);
      
      // Vrati na normalno
      await item.evaluate(el => {
        el.style.border = '';
        el.style.backgroundColor = '';
      });
    }
  });

  test('📱 Simulacija mobilnog uređaja', async ({ browser }) => {
    // Kreiraj novi kontekst sa iPhone viewport
    const iPhone = {
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    };
    
    const context = await browser.newContext(iPhone);
    const page = await context.newPage();
    
    console.log('📱 Simuliram iPhone 12 Pro...');
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Touch gestures
    await page.tap('body'); // Tap umesto click na mobile
    
    await page.screenshot({ path: 'mobile-view.png' });
    console.log('📸 Mobile screenshot: mobile-view.png');
    
    await context.close();
  });

  test('🎥 Snimi video celog testa', async ({ browser }) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: './videos/',
        size: { width: 1280, height: 720 }
      }
    });
    
    const page = await context.newPage();
    
    console.log('🎥 Snimam video...');
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Nekoliko navigacija
    await page.goto('/login');
    await page.waitForTimeout(1500);
    
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await context.close(); // Ovo snima video
    console.log('🎬 Video snimljen u ./videos/ folderu!');
  });
});

test.describe('🔍 Debug Helper', () => {
  test('Pauziraj i istraži stranicu', async ({ page }) => {
    await page.goto('/');
    
    // Ova linija će pauzirati test u debug mode-u
    // Možeš da koristiš Playwright Inspector da istražiš DOM
    await page.pause();
    
    console.log('⏸️ Test pauziran - koristi Inspector!');
  });
});