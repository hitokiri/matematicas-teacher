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

  test('cuenta escrita: la pizarra la resuelve paso a paso sin usar el modelo', async ({ page }) => {
    await page.locator('.problem-input').fill('10 x 20');
    await solveButton(page).click();

    await expect(page.locator('.chalkboard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.chalk-narration')).toContainText('Escribimos 10 arriba y 20 abajo');
    await page.getByRole('button', { name: /pausa/i }).click();

    // Avanzar a mano hasta el final
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalk-answer')).toContainText('200');
    await expect(page.locator('.chalk-narration')).toContainText('10 × 20 = 200');

    // Volver un paso atras
    await page.getByRole('button', { name: /anterior/i }).click();
    await expect(page.locator('.chalk-answer')).toHaveCount(0);

    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args).toBeUndefined();
  });

  test('ecuacion: la app la resuelve con una balanza', async ({ page }) => {
    await page.locator('.problem-input').fill('2x + 4 = 10');
    await solveButton(page).click();

    await expect(page.locator('.board-visual')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /pausa/i }).click();
    // Inicio: 2 bolsas x
    await expect(page.locator('.pan-bag')).toHaveCount(2);
    const next = page.getByRole('button', { name: /siguiente/i });
    await next.click();
    // Quitar 4 de cada lado: 8 pesas tachadas
    await expect(page.locator('.pan-item.removed')).toHaveCount(8);
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalk-answer')).toContainText('x = 3');
    await expect(page.locator('.chalkboard')).toContainText('2 × 3 + 4 = 10');
    expect(await page.evaluate(() => (window as any).__lastSolveArgs)).toBeUndefined();
  });

  test('otro problema: el modelo explica y la pizarra escribe cada paso', async ({ page }) => {
    await page.locator('.problem-input').fill('Ana tiene 3 dulces y le dan 6');
    await solveButton(page).click();

    await expect(page.locator('.chalkboard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.chalkboard')).toContainText('Ana tiene 3 dulces y le dan 6');
    await page.getByRole('button', { name: /pausa/i }).click();
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalkboard')).toContainText('3 x 6 = 18');
    await expect(page.locator('.chalk-answer')).toContainText('18');

    // La explicacion en texto sigue disponible
    await page.getByText(/ver la explicación en texto/i).click();
    await expect(page.locator('.solution-steps')).toContainText('Multiplicamos');

    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args.problemText).toBe('Ana tiene 3 dulces y le dan 6');
  });

  test('dibujo: el boton Resolver se habilita al dibujar y envia la imagen', async ({ page }) => {
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await expect(solveButton(page)).toBeDisabled();

    await drawStroke(page);
    await expect(solveButton(page)).toBeEnabled();
  });

  test('dibujo: el modelo solo lo lee y la app lo resuelve si es una cuenta', async ({ page }) => {
    await page.evaluate(() => { (window as any).__readResult = '⁵√32' });
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await drawStroke(page);
    await solveButton(page).click();

    await expect(page.locator('.read-input')).toHaveValue('⁵√32', { timeout: 5000 });
    await expect(page.locator('.chalkboard')).toBeVisible();
    const read = await page.evaluate(() => (window as any).__lastReadArgs);
    expect(read.problemImage).toMatch(/^data:image\/png;base64,/);
    // La app hizo la raiz: no hizo falta pedirle la explicacion al modelo
    expect(await page.evaluate(() => (window as any).__lastSolveArgs)).toBeUndefined();

    await page.getByRole('button', { name: /pausa/i }).click();
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalk-answer')).toContainText('2');
  });

  test('dibujo mal leido: se corrige lo que leyo y se vuelve a resolver', async ({ page }) => {
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await drawStroke(page);
    await solveButton(page).click();

    // El modelo leyo una x donde habia un 7: no es una cuenta, asi que lo explica el modelo
    await expect(page.locator('.read-input')).toHaveValue('√(3 × x × 6 + 12)', { timeout: 5000 });
    await expect(page.locator('.chalkboard')).toBeVisible();
    const solved = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(solved.problemText).toBe('√(3 × x × 6 + 12)');
    expect(solved.problemImage).toBeNull();

    // Corregir la x por 7 y resolver: ahora lo hace la app con todo el procedimiento
    await page.locator('.read-input').fill('√(3 × 7 × 6 + 12)');
    await page.getByRole('button', { name: /resolver esto/i }).click();
    await expect(page.locator('.chalkboard')).toContainText('√(3 × 7 × 6 + 12)');
    await page.getByRole('button', { name: /pausa/i }).click();
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalkboard')).toContainText('≈ 11.75');
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

    await page.locator('.problem-input').fill('Ana tiene 3 dulces y le dan 6');
    await solveButton(page).click();
    await expect(page.locator('.chalkboard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toHaveCount(0);
    const args = await page.evaluate(() => (window as any).__lastSolveArgs);
    expect(args.problemImage).toBeNull();
  });
});
