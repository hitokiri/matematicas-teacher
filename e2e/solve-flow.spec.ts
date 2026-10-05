import { test, expect, Page } from '@playwright/test';

const solveButton = (page: Page) => page.locator('button', { hasText: /resolver problema/i });

async function drawStroke(page: Page) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
  await page.mouse.move(box.x + 30, box.y + 90, { steps: 5 });
  await page.mouse.up();
}

test.describe('Flujo de resolver problemas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
  });

  test('texto: escribir, resolver y ver pasos y respuesta final', async ({ page }) => {
    await page.locator('.problem-input').fill('3 x 6');
    await solveButton(page).click();

    await expect(page.locator('.solution-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.solution-problem')).toContainText('3 x 6');
    await expect(page.locator('.solution-steps')).toContainText('Multiplicamos');
    await expect(page.locator('.solution-section')).toContainText('18');

    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args.problemText).toBe('3 x 6');
    expect(args.problemImage).toBeNull();
  });

  test('dibujo: el boton Resolver se habilita al dibujar y envia la imagen', async ({ page }) => {
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await expect(solveButton(page)).toBeDisabled();

    await drawStroke(page);
    await expect(solveButton(page)).toBeEnabled();
  });

  test('dibujo con proveedor local resuelve y envia la imagen', async ({ page }) => {
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await drawStroke(page);
    await solveButton(page).click();

    await expect(page.locator('.solution-section')).toContainText('18', { timeout: 5000 });
    await expect(page.locator('.error-message')).toHaveCount(0);
    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args.problemImage).toMatch(/^data:image\/png;base64,/);
    expect(args.problemText).toBe('');
  });

  test('dibujo con modelo local activo resuelve y envia la imagen', async ({ page }) => {
    // El mock lee su estado al cargar: recargar para tomar el modelo activo
    await page.evaluate(() => localStorage.setItem('__e2e_state__', JSON.stringify({
      settings: { active_model_id: 'm-small' },
      models: [{ id: 'm-small', name: 'Qwen 2.5 1.5B Instruct', description: 'Modelo ligero', filename: 'small.gguf', size_mb: 1024, recommended_for: ['rapido'], tags: ['1.5B'], downloaded: true }],
    })));
    await page.reload();
    await page.waitForSelector('.input-section', { timeout: 15000 });

    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await drawStroke(page);
    await solveButton(page).click();

    await expect(page.locator('.solution-section')).toContainText('18', { timeout: 5000 });
    await expect(page.locator('.error-message')).toHaveCount(0);
  });

  test('un fallo del backend se muestra como error y no como solucion', async ({ page }) => {
    await page.locator('.problem-input').fill('fallo');
    await solveButton(page).click();
    await expect(page.locator('.error-message')).toContainText(/no se pudo conectar/i);
    await expect(page.locator('.solution-section')).toHaveCount(0);
  });

  test('cambiar de dibujo a texto y volver descarta el dibujo anterior', async ({ page }) => {
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await drawStroke(page);
    await expect(solveButton(page)).toBeEnabled();

    await page.locator('.tab', { hasText: /texto/i }).click();
    await expect(solveButton(page)).toBeDisabled();
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await expect(solveButton(page)).toBeDisabled();
  });

  test('el error desaparece al cambiar de pestaña y resolver funciona', async ({ page }) => {
    await page.locator('.problem-input').fill('fallo');
    await solveButton(page).click();
    await expect(page.locator('.error-message')).toBeVisible();

    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await expect(page.locator('.error-message')).toHaveCount(0);
    await page.locator('.tab', { hasText: /texto/i }).click();

    await page.locator('.problem-input').fill('2x5');
    await solveButton(page).click();
    await expect(page.locator('.solution-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toHaveCount(0);
    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args.problemImage).toBeNull();
  });
});
