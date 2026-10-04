import { test, expect } from '@playwright/test';
import fs from 'fs';

const tauriMockCode = fs.readFileSync('./e2e/tauri-mock.ts', 'utf-8');

test.describe('Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMockCode);
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
  });

  test('settings modal opens when clicking settings button', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('settings modal shows provider options', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.provider-option')).toHaveCount(3);
  });

  test('settings modal has save button', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /guardar/i })).toBeVisible();
  });

  test('closing settings modal hides it', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    
    // Click on the back button to close the modal
    await page.locator('.modal-back-btn').click();
    
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
  });

  test('settings modal shows active model info', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.models-page')).toBeVisible();
  });
});
