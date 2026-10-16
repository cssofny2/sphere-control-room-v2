import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin, VERSION, buildDate, commitShort, SITE, copyrightYears } from './scripts/seo-plugin.mjs'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), seoPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __BUILD_DATE__: JSON.stringify(buildDate()),
    __COMMIT__: JSON.stringify(commitShort()),
    __COPYRIGHT_YEARS__: JSON.stringify(copyrightYears()),
    __SITE__: JSON.stringify(SITE),
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\/](recharts|d3-[^\/]+|victory-vendor)[\/]/, priority: 20 },
            { name: 'three', test: /node_modules[\/]three[\/]/, priority: 20 },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 10 }
          ]
        }
      }
    }
  }
})
