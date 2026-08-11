import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Check for a new deployed build on every load, and reload automatically
// once it takes over - without this the installed SW keeps serving the
// build it was installed with until some unrelated later visit picks up
// the update, which looks like the app is stuck needing a hard refresh.
//
// A load-time check alone isn't enough for an installed app that people
// leave open for days without navigating anywhere - so this also polls for
// a new build on an interval, and immediately whenever the tab/window
// regains focus (the most common "did I get today's update?" moment).
const ONE_HOUR = 60 * 60 * 1000

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), ONE_HOUR)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})

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
