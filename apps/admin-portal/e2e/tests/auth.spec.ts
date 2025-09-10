import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { testUsers } from '../fixtures/test-users';

test.describe('Autentifikacija', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('Uspešna prijava sa validnim kredencijalima', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.superAdmin.email, testUsers.superAdmin.password);
    await loginPage.waitForLoginSuccess();
    
    // Verifikuj da je korisnik na dashboard stranici
    await dashboardPage.waitForDashboard();
    const userName = await dashboardPage.getUserName();
    expect(userName).toContain(testUsers.superAdmin.name);
  });

  test('Neuspešna prijava sa pogrešnim kredencijalima', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('pogresanemail@test.com', 'PogresanPassword123!');
    
    // Verifikuj error poruku
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    
    // Verifikuj da smo još uvek na login stranici
    expect(page.url()).toContain('/login');
  });

  test('Validacija praznih polja', async ({ page }) => {
    await loginPage.goto();
    
    // Pokušaj prijave bez unosa podataka
    await loginPage.loginButton.click();
    
    // Verifikuj da forma prikazuje validacione poruke
    const emailError = await page.locator('text=/email.*obavezan|required/i').isVisible();
    const passwordError = await page.locator('text=/lozinka.*obavezna|password.*required/i').isVisible();
    
    expect(emailError || passwordError).toBeTruthy();
  });

  test('Odjava iz sistema', async ({ page }) => {
    // Prvo se prijavi
    await loginPage.goto();
    await loginPage.login(testUsers.superAdmin.email, testUsers.superAdmin.password);
    await loginPage.waitForLoginSuccess();
    await dashboardPage.waitForDashboard();
    
    // Odjavi se
    await dashboardPage.logout();
    
    // Verifikuj da smo vraćeni na login stranicu
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('Pristup zaštićenoj ruti bez autentifikacije', async ({ page }) => {
    // Pokušaj direktnog pristupa dashboard-u
    await page.goto('/dashboard');
    
    // Treba biti preusmeren na login
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});

test.describe('RBAC - Role Based Access Control', () => {
  test('SUPER_ADMIN ima pristup svim sekcijama', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    
    await loginPage.goto();
    await loginPage.login(testUsers.superAdmin.email, testUsers.superAdmin.password);
    await loginPage.waitForLoginSuccess();
    await dashboardPage.waitForDashboard();
    
    // Proveri pristup kritičnim sekcijama
    const sections = ['Korisnici', 'Permisije', 'Postavke', 'Transport', 'Analitika'];
    
    for (const section of sections) {
      const hasAccess = await dashboardPage.hasPermissionForSection(section);
      expect(hasAccess).toBeTruthy();
    }
  });

  test('OPERATOR ima ograničen pristup', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    
    await loginPage.goto();
    await loginPage.login(testUsers.operator.email, testUsers.operator.password);
    await loginPage.waitForLoginSuccess();
    await dashboardPage.waitForDashboard();
    
    // Operator ne treba imati pristup admin sekcijama
    const restrictedSections = ['Korisnici', 'Permisije', 'Postavke'];
    const allowedSections = ['Transport', 'Monitoring'];
    
    for (const section of restrictedSections) {
      const hasAccess = await dashboardPage.hasPermissionForSection(section);
      expect(hasAccess).toBeFalsy();
    }
    
    for (const section of allowedSections) {
      const hasAccess = await dashboardPage.hasPermissionForSection(section);
      expect(hasAccess).toBeTruthy();
    }
  });
});