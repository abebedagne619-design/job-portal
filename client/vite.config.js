import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    // አንዳንድ ጊዜ ፖርቱ ከተያዘ በሌላ እንዲከፍት ይህ ይረዳል
    port: 5173,
    strictPort: false,
  },
})