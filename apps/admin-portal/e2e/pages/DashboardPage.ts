import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly userMenu: Locator;
  readonly sidebar: Locator;
  readonly pageTitle: Locator;
  readonly logoutButton: Locator;
  readonly notificationBell: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userMenu = page.locator('.user-menu, .ant-dropdown-trigger, [data-testid="user-menu"]');
    this.sidebar = page.locator('.ant-menu, .sidebar, aside');
    this.pageTitle = page.locator('h1, .page-title, .ant-page-header-title');
    this.logoutButton = page.locator('button:has-text("Odjavi se"), button:has-text("Logout")');
    this.notificationBell = page.locator('.notification-bell, .ant-badge');
  }

  async waitForDashboard() {
    await this.sidebar.waitFor({ state: 'visible' });
  }

  async getUserName(): Promise<string | null> {
    return await this.userMenu.textContent();
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async navigateToSection(sectionName: string) {
    await this.sidebar.locator(`text=${sectionName}`).click();
  }

  async hasPermissionForSection(sectionName: string): Promise<boolean> {
    return await this.sidebar.locator(`text=${sectionName}`).isVisible();
  }
}