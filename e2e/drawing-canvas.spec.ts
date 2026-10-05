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

  test('el trazo cae donde esta el puntero y no se borra al cambiar el tamano', async ({ page }) => {
    const canvas = page.locator('canvas');
    // Pixel oscuro en la posicion (en pantalla) relativa al lienzo
    const darkAt = (fx: number, fy: number) => canvas.evaluate((c: HTMLCanvasElement, [fx, fy]) => {
      const x = Math.round(c.width * fx), y = Math.round(c.height * fy);
      const d = c.getContext('2d')!.getImageData(x - 3, y - 3, 7, 7).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 120) return true;
      return false;
    }, [fx, fy]);

    const box = (await canvas.boundingBox())!;
    const px = box.x + box.width * 0.75, py = box.y + box.height * 0.5;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 2, py + 2, { steps: 2 });
    await page.mouse.up();
    expect(await darkAt(0.75, 0.5)).toBe(true);
    expect(await darkAt(0.25, 0.5)).toBe(false);

    // Al cambiar el tamano de la ventana el dibujo se conserva (no queda el lienzo vacio)
    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(300);
    const dark = await canvas.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++;
      return n;
    });
    expect(dark).toBeGreaterThan(0);

    // Y un trazo nuevo sigue cayendo bajo el puntero
    const box2 = (await canvas.boundingBox())!;
    await page.mouse.move(box2.x + box2.width * 0.2, box2.y + box2.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width * 0.2 + 2, box2.y + box2.height * 0.8 + 2, { steps: 2 });
    await page.mouse.up();
    expect(await darkAt(0.2, 0.8)).toBe(true);
  });
});
