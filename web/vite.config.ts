import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // La malla, la plantilla y los pesos viven en ../data (contrato compartido con model/ y api/).
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
  },
})
