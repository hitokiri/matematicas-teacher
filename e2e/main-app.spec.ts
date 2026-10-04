import { test, expect } from '@playwright/test';

test.describe('MainApp - Problem Solver', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.input-section', { timeout: 15000 });
  });

  test('renders main app with problem input', async ({ page }) => {
    await expect(page.locator('h2', { hasText: /escribe o dibuja tu problema matematico/i })).toBeVisible();
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
});
