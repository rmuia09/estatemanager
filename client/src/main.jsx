import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

import { initAnalytics } from './analytics.js'

let deviceStamp = ''
try {
  const found = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('yane_did='))
  if (found) deviceStamp = decodeURIComponent(found.slice('yane_did='.length))
  else {
    deviceStamp = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, '')
    document.cookie = `yane_did=${deviceStamp}; path=/; max-age=31536000; SameSite=Lax`
  }
} catch {}

initAnalytics(deviceStamp)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)