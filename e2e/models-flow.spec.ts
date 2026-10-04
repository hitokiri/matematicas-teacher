import { test, expect, Page } from '@playwright/test';

// Usa el mock con estado de e2e/tauri-mock.ts (cargado por main.tsx con VITE_E2E_TEST)
async function openSettings(page: Page) {
  await page.locator('button', { hasText: /configuracion/i }).click();
  await expect(page.locator('.models-page')).toBeVisible({ timeout: 5000 });
}

const card = (page: Page, name: string) =>
  page.locator('.model-card', { hasText: name });

async function downloadSmall(page: Page) {
  await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /download/i }).click();
  await expect(card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /delete/i }))
    .toBeVisible({ timeout: 10000 });
}

test.describe('Flujo completo de modelos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
    await openSettings(page);
  });

  test('los modelos no descargados tienen boton Download y no Delete', async ({ page }) => {
    for (const name of ['Llama 3.1 8B', 'Qwen 2.5 1.5B']) {
      await expect(card(page, name).getByRole('button', { name: /download/i })).toBeVisible();
      await expect(card(page, name).getByRole('button', { name: /delete/i })).toHaveCount(0);
    }
  });

  test('descargar muestra progreso y deja el modelo en Downloaded con Select y Delete', async ({ page }) => {
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /download/i }).click();
    await expect(card(page, 'Qwen 2.5 1.5B').locator('.download-progress')).toBeVisible({ timeout: 5000 });

    const done = card(page, 'Qwen 2.5 1.5B');
    await expect(done.getByRole('button', { name: /select/i })).toBeVisible({ timeout: 10000 });
    await expect(done.getByRole('button', { name: /delete/i })).toBeVisible();
    await expect(page.locator('.models-section', { hasText: 'Downloaded Models' })
      .locator('.model-card', { hasText: 'Qwen 2.5 1.5B' })).toHaveCount(1);
  });

  test('cancelar una descarga devuelve el modelo a disponibles', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /download/i }).click();
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /cancel/i }).click();
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /download/i }))
      .toBeVisible({ timeout: 5000 });
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /delete/i })).toHaveCount(0);
  });

  test('seleccionar marca el modelo como activo', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /select/i }).click();
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
    await expect(card(page, 'Qwen 2.5 1.5B').locator('.status-active')).toBeVisible();
  });

  test('el modelo activo persiste tras guardar y reabrir configuracion', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /select/i }).click();
    await page.getByRole('button', { name: /guardar/i }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    await openSettings(page);
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
  });

  test('el modelo activo y las descargas persisten tras recargar la app', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /select/i }).click();
    await page.getByRole('button', { name: /guardar/i }).click();

    await page.reload();
    await page.waitForSelector('.input-section', { timeout: 15000 });
    await openSettings(page);
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /download/i })).toBeVisible();
  });

  test('borrar el modelo activo lo quita de descargados y limpia el activo', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /select/i }).click();
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /delete/i }).click();

    const c = card(page, 'Qwen 2.5 1.5B');
    await expect(c.getByRole('button', { name: /download/i })).toBeVisible({ timeout: 5000 });
    await expect(c).not.toHaveClass(/active/);
    await expect(c.getByRole('button', { name: /delete/i })).toHaveCount(0);
  });

  test('cambiar de modelo activo deja solo uno activo', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /download/i }).click();
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /select/i }))
      .toBeVisible({ timeout: 10000 });

    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /select/i }).click();
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /select/i }).click();
    await expect(page.locator('.model-card.active')).toHaveCount(1);
    await expect(card(page, 'Llama 3.1 8B')).toHaveClass(/active/);
  });
});
