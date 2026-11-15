import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // La malla, la plantilla y los pesos viven en ../data (contrato compartido con model/ y api/).
    fs: { allow: ['..'] },
  },
  build: {
    // El presupuesto del proyecto es JS inicial < 250 kB *gzip* (hoy ≈ 214 kB, ver README). El aviso por defecto
    // mide kB sin comprimir y saltaba con el bundle principal (React + React Flow), que no es el problema.
    chunkSizeWarningLimit: 750,
  },
  test: {
    environment: 'node',
    // Los *.spec.ts de e2e/ son de Playwright (npm run test:e2e), no de Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Con las 40 suites en paralelo, las pruebas con temporizadores del Laboratorio rozaban los 5 s por defecto.
    testTimeout: 15_000,
  },
})
