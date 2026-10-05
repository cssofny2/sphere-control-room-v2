import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import MetrologyLab from './MetrologyLab'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MetrologyLab />
    <Analytics />
  </React.StrictMode>,
)
