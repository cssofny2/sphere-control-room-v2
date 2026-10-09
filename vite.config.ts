import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\/](recharts|d3-[^\/]+|victory-vendor)[\/]/, priority: 20 },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 10 }
          ]
        }
      }
    }
  }
})
