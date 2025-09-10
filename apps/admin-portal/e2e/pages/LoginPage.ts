import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"], input#email');
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input#password');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Prijavite se"), button:has-text("Login")');
    this.errorMessage = page.locator('.ant-message-error, .error-message, [role="alert"]');
    this.loadingSpinner = page.locator('.ant-spin, .loading-spinner');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async waitForLoginSuccess() {
    // Čeka da se preusmeri sa login stranice
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000
    });
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 3000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }
}