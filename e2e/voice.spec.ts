import { test, expect } from '@playwright/test'

test.describe('Voz de la maestra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: /configuración|configuracion/i }).first().click()
  })

  test('se descarga una voz, se elige y se puede borrar', async ({ page }) => {
    const group = page.getByRole('radiogroup')
    await expect(group).toBeVisible()
    await expect(page.getByRole('radio', { name: /Piper · Claude/ })).toBeDisabled()

    await page.getByRole('button', { name: 'Descargar la voz Piper · Claude (México)' }).click()
    const radio = page.getByRole('radio', { name: /Piper · Claude/ })
    await expect(radio).toBeEnabled()
    await radio.check()
    await expect(radio).toBeChecked()

    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Eliminar la voz Piper · Claude (México)' }).click()
    await expect(page.getByRole('radio', { name: /Voz del sistema/ })).toBeChecked()
  })
})
