/**
 * App.jsx - Main Application Component
 * 
 * This is the root component of the AI Meeting Assistant React application.
 * It renders the UploadComponent which handles the entire user interface.
 * 
 * Features:
 * - Single-page application structure
 * - Clean, responsive design
 * - Integration with UploadComponent for file processing
 */

import React from 'react'
import UploadComponent from './components/UploadComponent.jsx'

function App() {
  return (
    <div className="App">
      {/* Main upload and processing interface */}
      <UploadComponent />
    </div>
  )
}

export default App