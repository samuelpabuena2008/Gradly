import { defineConfig, devices } from '@playwright/test'

const PUERTO = 5199
const URL_BASE = `http://localhost:${PUERTO}`

// E2E y accesibilidad: solo Chromium. El servidor de desarrollo se levanta solo (o se reutiliza el que ya corre).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: URL_BASE,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    // Cada prueba empieza sin notas ni preferencias: es un navegador nuevo.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      // La suite móvil necesita un contexto táctil: solo corre en el proyecto «movil».
      testIgnore: /movil\.spec\.ts/,
    },
    {
      name: 'movil',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      testMatch: /movil\.spec\.ts|a11y\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: URL_BASE,
    // Puerto propio de las pruebas: así nunca se prueba por error otra app que ocupe el 5173.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
