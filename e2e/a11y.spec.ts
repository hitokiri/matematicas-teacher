import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Reglas WCAG 2.x A y AA (y las buenas practicas de axe). Cualquier violacion hace fallar la prueba.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length} · ${v.nodes[0]?.target?.join(' ')} — ${v.help}`)
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([])
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: /configuraci[oó]n|settings/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Accesibilidad (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(t => { localStorage.setItem('theme', t) }, theme)
      await page.goto('/')
      await page.waitForSelector('.input-section')
    })

    test('pantalla principal', async ({ page }) => {
      await audit(page, 'principal')
    })

    test('panel de temas abierto', async ({ page }) => {
      await page.getByText(/hasta dónde llega la maestra/i).click()
      await audit(page, 'panel de temas')
    })

    test('pizarra resuelta con chat', async ({ page }) => {
      await page.getByLabel('Tu problema matemático').fill('47 + 38')
      await page.getByRole('button', { name: /resolver problema/i }).click()
      await expect(page.locator('.chalk-pages')).toBeVisible()
      await page.getByRole('button', { name: 'Pausa' }).click()
      await audit(page, 'pizarra')
    })

    test('configuración', async ({ page }) => {
      await openSettings(page)
      await audit(page, 'configuración')
    })

    test('registro abierto', async ({ page }) => {
      await openSettings(page)
      await page.getByText('Ver el registro').click()
      await expect(page.getByRole('log')).toBeVisible()
      await audit(page, 'registro')
    })
  })
}

test.describe('Teclado y lectores de pantalla', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.input-section')
  })

  test('el enlace para saltar al contenido es lo primero que se enfoca y lleva al contenido', async ({ page }) => {
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Saltar al contenido' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#contenido')).toBeFocused()
  })

  test('el diálogo atrapa el foco, se cierra con Esc y devuelve el foco al botón', async ({ page }) => {
    const opener = page.getByRole('button', { name: /configuraci[oó]n/i })
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: /configuraci[oó]n/i })
    await expect(dialog).toBeVisible()
    // Tab muchas veces: el foco nunca sale del dialogo
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('con el diálogo abierto el fondo no se puede enfocar ni leer (inert)', async ({ page }) => {
    await page.getByRole('button', { name: /configuraci[oó]n/i }).click()
    await expect(page.locator('main')).toHaveAttribute('inert', '')
    await expect(page.locator('header')).toHaveAttribute('inert', '')
  })

  test('los botones de modo se anuncian como presionados', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Texto' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Dibujar' }).click()
    await expect(page.getByRole('button', { name: 'Dibujar' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('con prefers-reduced-motion la pizarra sigue mostrando todo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByLabel('Tu problema matemático').fill('10 x 20')
    await page.getByRole('button', { name: /resolver problema/i }).click()
    await expect(page.locator('.chalk-pages')).toBeVisible()
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.locator('.chalk-text').first()).toBeVisible()
  })
})

test.describe('Idioma', () => {
  test('cambia entre español e inglés, se recuerda y actualiza <html lang>', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.input-section')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')

    await page.getByRole('group', { name: 'Idioma de la app' }).getByRole('button', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: 'Type or draw your math problem' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

    await page.reload()
    await page.waitForSelector('.input-section')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Desde Configuración también se escoge
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('dialog').getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })

  test('sin idioma guardado, un navegador en inglés abre la app en inglés', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()
    await page.goto('http://localhost:5174/')
    await page.waitForSelector('.input-section')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await context.close()
  })

  test('el inglés también cumple accesibilidad', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang', 'en'))
    await page.goto('/')
    await page.waitForSelector('.input-section')
    await audit(page, 'principal en inglés')
    await page.getByRole('button', { name: 'Settings' }).click()
    await audit(page, 'configuración en inglés')
  })
})
