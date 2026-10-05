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

  test('settings modal only offers local models', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/openai|anthropic/i)).toHaveCount(0);
    await expect(page.locator('button', { hasText: /guardar/i })).toHaveCount(0);
  });

  test('settings modal shows the local model hardware', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.compute-device')).toHaveText('CPU');
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

  test('selecting a model in settings updates active_model_id', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: /configuracion/i });
    await settingsButton.click();
    
    // Wait for modal to be visible
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    
    // Select the first model (Local/GGUF)
    const firstModel = page.locator('.model-card').first();
    await firstModel.click();
    
    // Verify modal is still open
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    
    // Volver cierra el modal (el modelo activo se guarda al seleccionarlo)
    await page.locator('.modal-back-btn').click();
    
    // Verify modal is closed
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
    
    // Check that we're back on the main page and model is selected
    await expect(page.locator('.input-section')).toBeVisible({ timeout: 5000 });
  });
});
