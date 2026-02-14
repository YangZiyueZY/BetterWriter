import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initClientLogger } from './lib/clientLogger'
import { initPerfMonitoring, markPerf, measurePerf } from './lib/perfMonitoring'

initPerfMonitoring()
markPerf('bw_bootstrap_start')
initClientLogger()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    markPerf('bw_first_render')
    measurePerf('bootstrap_to_first_render_ms', 'bw_bootstrap_start', 'bw_first_render')
  })
})
