// src/main.jsx (Contoh)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // Asumsi file App utama Anda
import { BrowserRouter } from 'react-router-dom'
import { MQTTProvider } from './hooks/useMQTT' // <-- IMPORT

import './index.css' // Asumsi file CSS Anda

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MQTTProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MQTTProvider>
  </React.StrictMode>,
)