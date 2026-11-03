import { test, expect } from '@playwright/test';

test.describe('MainApp - Problem Solver', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
  });

  test('renders main app with problem input', async ({ page }) => {
    await expect(page.locator('h2', { hasText: /escribe o dibuja tu problema matem[aá]tico/i })).toBeVisible();
    await expect(page.locator('.problem-input')).toBeVisible();
    await expect(page.locator('button', { hasText: /resolver problema/i })).toBeVisible();
  });

  test('input mode tabs are visible', async ({ page }) => {
    await expect(page.locator('.tab', { hasText: /texto/i })).toBeVisible();
    await expect(page.locator('.tab', { hasText: /dibujar/i })).toBeVisible();
    await expect(page.locator('.tab', { hasText: /texto/i })).toHaveClass(/active/);
  });

  test('solving with empty problem is disabled', async ({ page }) => {
    const solveButton = page.locator('button', { hasText: /resolver problema/i });
    await expect(solveButton).toBeDisabled();
  });

  test('user can type a math problem', async ({ page }) => {
    const input = page.locator('.problem-input');
    await input.fill('2 + 2 = ?');
    await expect(input).toHaveValue('2 + 2 = ?');
    
    const solveButton = page.locator('button', { hasText: /resolver problema/i });
    await expect(solveButton).toBeEnabled();
  });

  test('user can switch to draw mode', async ({ page }) => {
    const drawTab = page.locator('.tab', { hasText: /dibujar/i });
    await drawTab.click();
    
    await expect(drawTab).toHaveClass(/active/);
    await expect(page.locator('.tab', { hasText: /texto/i })).not.toHaveClass(/active/);
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('user can switch back to text mode', async ({ page }) => {
    const drawTab = page.locator('.tab', { hasText: /dibujar/i });
    const textTab = page.locator('.tab', { hasText: /texto/i });
    
    await drawTab.click();
    await expect(page.locator('canvas')).toBeVisible();
    
    await textTab.click();
    await expect(textTab).toHaveClass(/active/);
    await expect(page.locator('.problem-input')).toBeVisible();
  });
  test('con la pizarra a la vista la entrada se reduce a una barra y se reabre', async ({ page }) => {
    await page.locator('.problem-input').fill('47 + 38');
    await page.getByRole('button', { name: /resolver problema/i }).click();
    await expect(page.locator('.chalk-pages')).toBeVisible();

    await expect(page.locator('.problem-input')).toBeHidden();
    await expect(page.locator('.problem-bar')).toContainText('47 + 38');

    await page.getByRole('button', { name: /nuevo problema/i }).click();
    await expect(page.locator('.problem-input')).toBeVisible();
    await expect(page.locator('.problem-input')).toBeFocused();
  });
  test('sin modelo: el aviso lleva a Ajustes y un problema que necesita IA lo explica', async ({ page }) => {
    const warning = page.locator('.warning-message');
    await expect(warning).toBeVisible();

    // Un problema que la app no resuelve sola pide un modelo, sin llamar al backend
    await page.locator('.problem-input').fill('un tren sale a las 3 y viaja 2 horas');
    await page.getByRole('button', { name: /resolver problema/i }).click();
    const error = page.getByRole('alert').filter({ hasText: /necesita un modelo/i });
    await expect(error).toBeVisible();
    await expect(warning).toBeHidden(); // el error ya trae su propio boton

    await error.getByRole('button', { name: /elegir un modelo/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('sin modelo: las cuentas se siguen resolviendo en la pizarra', async ({ page }) => {
    await page.locator('.problem-input').fill('47 + 38');
    await page.getByRole('button', { name: /resolver problema/i }).click();
    await expect(page.locator('.chalk-pages')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /necesita un modelo/i })).toHaveCount(0);
  });
});

test.describe('MainApp - móvil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el chat es una hoja plegable: cerrada por defecto, se abre y se cierra con Esc', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
    await page.locator('.problem-input').fill('47 + 38');
    await page.getByRole('button', { name: /resolver problema/i }).click();
    await expect(page.locator('.chalk-pages')).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Preguntas' });
    const question = page.getByLabel('Tu pregunta para la maestra');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(question).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(question).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(question).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
});

test.describe('MainApp - motivo de Resolver deshabilitado', () => {
  test('explica por qué no se puede resolver y desaparece al haber algo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
    const solve = page.getByRole('button', { name: /resolver problema/i });
    await expect(solve).toBeDisabled();
    await expect(solve).toHaveAccessibleDescription(/escribe un problema/i);
    await expect(page.locator('.solve-hint')).toBeVisible();

    await page.locator('.problem-input').fill('2 + 2');
    await expect(solve).toBeEnabled();
    await expect(page.locator('.solve-hint')).toHaveCount(0);

    await page.locator('.problem-input').fill('');
    await page.locator('.tab', { hasText: /dibujar/i }).click();
    await expect(solve).toHaveAccessibleDescription(/dibuja el problema/i);
  });
});
