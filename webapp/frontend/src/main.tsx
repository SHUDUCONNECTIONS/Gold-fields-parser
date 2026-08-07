import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Check for a new deployed build on every load, and reload automatically
// once it takes over - without this the installed SW keeps serving the
// build it was installed with until some unrelated later visit picks up
// the update, which looks like the app is stuck needing a hard refresh.
registerSW({ immediate: true })

if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
