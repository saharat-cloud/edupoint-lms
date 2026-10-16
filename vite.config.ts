import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      buildStart() {
        const publicDir = path.resolve(__dirname, 'public')
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }
        const versionData = {
          buildTime: Date.now(),
          builtAt: new Date().toISOString(),
        }
        fs.writeFileSync(path.resolve(publicDir, 'version.json'), JSON.stringify(versionData, null, 2))
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
