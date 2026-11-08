import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import MetrologyLab from './MetrologyLabV3'
import './index.css'

// Offline support: register the service worker in production builds only (it would fight the dev server's hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }); });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MetrologyLab />
    <Analytics />
  </React.StrictMode>,
)
