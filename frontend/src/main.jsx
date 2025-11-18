/**
 * main.jsx - React Application Entry Point
 * 
 * This file initializes the React application and renders it to the DOM.
 * It imports the main App component and applies global CSS styles.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Create root element and render the App
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)