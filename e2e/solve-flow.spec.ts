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

  test('fracciones: la app las resuelve con pizzas', async ({ page }) => {
    await page.locator('.problem-input').fill('1/2 + 1/4');
    await solveButton(page).click();

    await expect(page.locator('.board-visual')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /pausa/i }).click();
    // Inicio: dos pizzas (medios y cuartos) con 1 rebanada tomada cada una
    await expect(page.locator('.pizza')).toHaveCount(2);
    await expect(page.locator('.slice.taken')).toHaveCount(2);
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalk-answer')).toContainText('3/4');
    expect(await page.evaluate(() => (window as any).__lastSolveArgs)).toBeUndefined();
  });

  test('chat: preguntar por un paso pulsando su numero en la pizarra', async ({ page }) => {
    await page.locator('.problem-input').fill('2x + 4 = 10');
    await solveButton(page).click();
    await expect(page.locator('.step-chat')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /pausa/i }).click();
    const next = page.getByRole('button', { name: /siguiente/i });
    await next.click();
    await next.click();

    // Cada renglon tiene su numero de paso
    await expect(page.locator('.step-badge')).toHaveCount(3);
    await page.getByRole('button', { name: 'Preguntar por el paso 2' }).click();
    const box = page.locator('.step-chat-form textarea');
    await expect(box).toHaveValue('Tengo una duda con el paso 2: ');
    await box.fill('Tengo una duda con el paso 2: ¿por qué quitamos 4?');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.locator('.chat-msg.assistant')).toContainText('quitamos la raíz');
    await expect(page.locator('.chat-msg.assistant strong')).toHaveText('quitamos la raíz');
    const ask = await page.evaluate(() => (window as any).__lastAskArgs);
    expect(ask.messages.at(-1)).toEqual({ role: 'user', content: 'Tengo una duda con el paso 2: ¿por qué quitamos 4?' });
    // La maestra sabe los pasos numerados y en cual va el nino
    expect(ask.context).toContain('Paso 2: [en la pizarra: 2x + 4 − 4 = 10 − 4]');
    expect(ask.context).toContain('El niño está viendo el paso 3');

    // Boton rapido sobre el paso actual
    await page.getByRole('button', { name: 'No entendí el paso 3' }).click();
    await expect(page.locator('.chat-msg.user')).toHaveCount(2);
  });

  test('dos signos seguidos: avisa en vez de adivinar', async ({ page }) => {
    await page.locator('.problem-input').fill('1/2+1/4+*10');
    await solveButton(page).click();
    await expect(page.locator('.error-message')).toContainText('dos signos seguidos');
    await expect(page.locator('.chalkboard')).toHaveCount(0);

    await page.locator('.problem-input').fill('1/2+1/4+10');
    await solveButton(page).click();
    await page.getByRole('button', { name: /pausa/i }).click();
    const next = page.getByRole('button', { name: /siguiente/i });
    while (await next.isEnabled()) await next.click();
    await expect(page.locator('.chalk-answer')).toContainText('43/4 = 10 y 3/4');
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
