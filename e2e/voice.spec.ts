import { test, expect } from '@playwright/test'

test.describe('Voz de la maestra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: /configuración|configuracion/i }).first().click()
  })

  test('solo se puede elegir una voz ya descargada; se descarga con su botón y se puede borrar', async ({ page }) => {
    await expect(page.getByRole('radiogroup')).toBeVisible()
    const radio = page.getByRole('radio', { name: /Piper · Claude/ })
    await expect(radio).toBeDisabled()

    // Un clic en la fila de una voz sin descargar no hace nada
    await page.getByText('Ligera y rápida, aun en computadoras modestas.').first().click({ force: true })
    await expect(radio).not.toBeChecked()

    await page.getByRole('button', { name: 'Descargar la voz Piper · Claude (mujer)' }).click()
    await expect(radio).toBeEnabled()
    await radio.check()
    await expect(radio).toBeChecked()
    // Elegir una voz natural enciende la lectura en voz alta
    await expect(page.getByRole('switch', { name: 'Leer la explicación en voz alta' })).toHaveAttribute('aria-checked', 'true')

    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Eliminar la voz Piper · Claude (mujer)' }).click()
    await expect(radio).not.toBeChecked()
  })

  test('hay una voz de hombre de Piper en cada idioma', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Piper · Aldo (hombre)' })).toBeVisible()
    await page.getByRole('dialog').getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('radio', { name: 'Piper · Joe (male)' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Piper · Aldo (hombre)' })).toHaveCount(0)
  })

  test('la voz del sistema que falta explica qué instalar y se puede volver a comprobar', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined }))
    await page.reload()
    await page.getByRole('button', { name: /configuraci[oó]n/i }).first().click()
    const radio = page.getByRole('radio', { name: /Voz del sistema/ })
    await expect(radio).toBeDisabled()
    await expect(page.getByText('sudo apt install espeak-ng')).toBeVisible()
    await expect(page.getByText(/Ubuntu 24\.04\.5 LTS/)).toBeVisible()

    // Se instala (simulado) y se vuelve a comprobar
    await page.evaluate(() => { (window as any).__systemVoice = { available: true, engine: 'espeak-ng', os: 'Ubuntu', install_command: null } })
    await page.getByRole('button', { name: 'Volver a comprobar' }).click()
    await expect(radio).toBeEnabled()
    await radio.check()
    await expect(radio).toBeChecked()
  })
})
