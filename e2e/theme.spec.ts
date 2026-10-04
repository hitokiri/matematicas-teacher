import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
  });

  test('theme toggle button is visible', async ({ page }) => {
    await expect(page.locator('.theme-toggle')).toBeVisible();
  });

  test('default theme is light', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
  });

  test('toggling theme switches to dark', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle');
    await themeToggle.click();
    
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('toggling theme switches back to light', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle');
    await themeToggle.click();
    await themeToggle.click();
    
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
  });

  test('theme preference is persisted in localStorage', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle');
    await themeToggle.click();
    
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    
    await page.reload();
    await page.waitForSelector('.input-section', { timeout: 15000 });
    
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});
