import { test, expect, Page } from '@playwright/test';

// Usa el mock con estado de e2e/tauri-mock.ts (cargado por main.tsx con VITE_E2E_TEST)
async function openSettings(page: Page) {
  await page.locator('button', { hasText: /configuraci[oó]n/i }).click();
  await expect(page.locator('.models-page')).toBeVisible({ timeout: 5000 });
}

const card = (page: Page, name: string) =>
  page.locator('.model-card', { hasText: name });

async function downloadSmall(page: Page) {
  await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /descargar/i }).click();
  await expect(card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /eliminar/i }))
    .toBeVisible({ timeout: 10000 });
}

test.describe('Flujo completo de modelos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
    await openSettings(page);
  });

  test('los modelos no descargados tienen botón Descargar y no Eliminar', async ({ page }) => {
    for (const name of ['Llama 3.1 8B', 'Qwen 2.5 1.5B']) {
      await expect(card(page, name).getByRole('button', { name: /descargar/i })).toBeVisible();
      await expect(card(page, name).getByRole('button', { name: /eliminar/i })).toHaveCount(0);
    }
  });

  test('descargar muestra progreso y deja el modelo en Descargados con Usar y Eliminar', async ({ page }) => {
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /descargar/i }).click();
    await expect(card(page, 'Qwen 2.5 1.5B').locator('.download-progress')).toBeVisible({ timeout: 5000 });

    const done = card(page, 'Qwen 2.5 1.5B');
    await expect(done.getByRole('button', { name: /^usar /i })).toBeVisible({ timeout: 10000 });
    await expect(done.getByRole('button', { name: /eliminar/i })).toBeVisible();
    await expect(page.locator('.models-section', { hasText: 'Modelos descargados' })
      .locator('.model-card', { hasText: 'Qwen 2.5 1.5B' })).toHaveCount(1);
  });

  test('cancelar una descarga devuelve el modelo a disponibles', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /descargar/i }).click();
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /cancelar/i }).click();
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /descargar/i }))
      .toBeVisible({ timeout: 5000 });
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /eliminar/i })).toHaveCount(0);
  });

  test('seleccionar marca el modelo como activo', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /^usar /i }).click();
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
    await expect(card(page, 'Qwen 2.5 1.5B').locator('.status-active')).toBeVisible();
  });

  test('el modelo activo persiste tras cerrar y reabrir configuracion', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /^usar /i }).click();
    await page.locator('.modal-back-btn').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

    await openSettings(page);
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
  });

  test('el modelo activo y las descargas persisten tras recargar la app', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /^usar /i }).click();

    await page.reload();
    await page.waitForSelector('.input-section', { timeout: 15000 });
    await openSettings(page);
    await expect(card(page, 'Qwen 2.5 1.5B')).toHaveClass(/active/);
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /descargar/i })).toBeVisible();
  });

  test('borrar el modelo activo lo quita de descargados y limpia el activo', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await downloadSmall(page);
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /^usar /i }).click();
    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /eliminar/i }).click();

    const c = card(page, 'Qwen 2.5 1.5B');
    await expect(c.getByRole('button', { name: /descargar/i })).toBeVisible({ timeout: 5000 });
    await expect(c).not.toHaveClass(/active/);
    await expect(c.getByRole('button', { name: /eliminar/i })).toHaveCount(0);
  });

  test('cambiar de modelo activo deja solo uno activo', async ({ page }) => {
    await downloadSmall(page);
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /descargar/i }).click();
    await expect(card(page, 'Llama 3.1 8B').getByRole('button', { name: /^usar /i }))
      .toBeVisible({ timeout: 10000 });

    await card(page, 'Qwen 2.5 1.5B').getByRole('button', { name: /^usar /i }).click();
    await card(page, 'Llama 3.1 8B').getByRole('button', { name: /^usar /i }).click();
    await expect(page.locator('.model-card.active')).toHaveCount(1);
    await expect(card(page, 'Llama 3.1 8B')).toHaveClass(/active/);
  });
});
