import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupMockAPI } from './mocks/api.ts'

// تهيئة واجهة API الوهمية في بيئة التطوير
if (import.meta.env.DEV) {
  setupMockAPI();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
