import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startPageTranslator } from './i18n/pageTranslator'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

startPageTranslator()
