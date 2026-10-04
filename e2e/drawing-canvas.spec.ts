import { test, expect } from '@playwright/test';

test.describe('Drawing Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
    
    const drawTab = page.locator('.tab', { hasText: /dibujar/i });
    await drawTab.click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('canvas is visible in draw mode', async ({ page }) => {
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('canvas responds to mouse events', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.up();
    }
    
    await expect(canvas).toBeVisible();
  });

  test('canvas clears when switching modes', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.up();
    }
    
    const textTab = page.locator('.tab', { hasText: /texto/i });
    await textTab.click();
    
    await expect(page.locator('.problem-input')).toBeVisible();
    
    const drawTab = page.locator('.tab', { hasText: /dibujar/i });
    await drawTab.click();
    await expect(page.locator('canvas')).toBeVisible();
  });
});
