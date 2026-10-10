import { test, type Page } from '@playwright/test';

const DIR = 'docs/capturas';

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/');
  await page.waitForSelector('.input-section', { timeout: 15000 });
}

async function solve(page: Page, text: string) {
  await page.locator('.problem-input').fill(text);
  await page.locator('button', { hasText: /resolver problema/i }).click();
  await page.waitForSelector('.chalk-pages');
  await page.getByRole('button', { name: /pausa/i }).click();
}

async function goToStep(page: Page, n: number) {
  const next = page.getByRole('button', { name: /siguiente/i });
  for (let i = 1; i < n && (await next.isEnabled()); i++) await next.click();
  await chalkDone(page);
}

/** Esperar a que la tiza termine de escribir el paso */
const chalkDone = (page: Page) => page.waitForTimeout(2500);

async function toEnd(page: Page) {
  const next = page.getByRole('button', { name: /siguiente/i });
  while (await next.isEnabled()) await next.click();
  await chalkDone(page);
}

test('pantalla principal', async ({ page }) => {
  await open(page);
  await page.locator('.problem-input').fill('x + y = 5\nx - y = 1');
  await page.screenshot({ path: `${DIR}/principal.png`, fullPage: true });
});

test('panel de temas', async ({ page }) => {
  await open(page);
  await page.getByText(/hasta dónde llega la maestra/i).click();
  await page.locator('.levels-panel').screenshot({ path: `${DIR}/temas.png` });
});

test('sistema de dos ecuaciones', async ({ page }) => {
  await open(page);
  await solve(page, 'x + y = 5\nx - y = 1');
  await goToStep(page, 6);
  await page.locator('.workspace').screenshot({ path: `${DIR}/sistema.png` });
});

test('pizarras de una en una', async ({ page }) => {
  await open(page);
  await solve(page, '2x + 3y = 6');
  await toEnd(page);
  await page.locator('.chalkboard-section').screenshot({ path: `${DIR}/pizarras.png` });
});

test('ecuacion con balanza', async ({ page }) => {
  await open(page);
  await solve(page, '2x + 4 = 10');
  await goToStep(page, 2);
  await page.locator('.chalkboard-section').screenshot({ path: `${DIR}/balanza.png` });
});

test('configuracion de la interfaz', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /configuracion/i }).click();
  await page.waitForSelector('.ui-prefs');
  await page.locator('.provider-section').first().screenshot({ path: `${DIR}/configuracion.png` });
});
