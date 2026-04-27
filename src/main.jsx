import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom';
import { useGLTF } from '@react-three/drei'
import App from './App.jsx'
import './index.css'
import { resolveAsset } from './utils/resolveAsset.js'

// ── Global Draco decoder path ─────────────────────────────────
// resolveAsset() automatically selects absolute (browser) or relative (Electron) path.
useGLTF.setDecoderPath(resolveAsset('/draco/'))

// ── Preload the main bike model as early as possible ──────────
// Runs at module import time — before React mounts.
useGLTF.preload(resolveAsset('/models/Grops_Bikes1_draco.glb'), resolveAsset('/draco/'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <App />
  </HashRouter>
)
