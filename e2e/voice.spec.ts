import { test, expect } from '@playwright/test'

test.describe('Voz de la maestra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: /configuración|configuracion/i }).first().click()
  })

  test('elegir una voz sin descargar la descarga y la activa; se puede borrar', async ({ page }) => {
    await expect(page.getByRole('radiogroup')).toBeVisible()
    const radio = page.getByRole('radio', { name: /Piper · Claude/ })
    await expect(radio).toBeEnabled()
    await expect(radio).not.toBeChecked()

    // Un clic en la voz (en cualquier parte de su fila) la descarga y la activa sola
    await page.getByText('Ligera y rápida, aun en computadoras modestas.').click()
    await expect(radio).toBeChecked()
    // Elegir una voz natural enciende la lectura en voz alta
    await expect(page.getByRole('switch', { name: 'Leer la explicación en voz alta' })).toHaveAttribute('aria-checked', 'true')

    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Eliminar la voz Piper · Claude (México)' }).click()
    await expect(radio).not.toBeChecked()
  })

  test('la voz del sistema que no existe explica por qué no se puede elegir', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined }))
    await page.reload()
    await page.getByRole('button', { name: /configuraci[oó]n/i }).first().click()
    await expect(page.getByRole('radio', { name: /Voz del sistema/ })).toBeDisabled()
    await expect(page.getByText(/No disponible: la app no encuentra una voz/)).toBeVisible()
  })
})
