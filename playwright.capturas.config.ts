import { defineConfig, devices } from '@playwright/test';

// Capturas de la interfaz para el README: `npm run capturas` las guarda en docs/capturas/
export default defineConfig({
  testDir: './scripts/capturas',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5174',
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
  },
  // Puerto propio (5174) para no reutilizar un `npm run dev` normal, que no tiene el backend simulado
  webServer: {
    command: 'VITE_E2E_TEST=true npm run dev -- --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
