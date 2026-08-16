import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { loadGoogleFonts, restoreCustomFonts } from './fonts/fonts'

loadGoogleFonts()
void restoreCustomFonts()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
