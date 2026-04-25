import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import RotatePrompt from './components/RotatePrompt.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const ComponentDetail = lazy(() => import('./pages/ComponentDetail.jsx'))

export default function App() {
  return (
    <>
      {/* Rotate-to-landscape overlay — phones in portrait only */}
      <RotatePrompt />

      <Navbar />
      <Suspense fallback={<LoadingScreen progress={0} message="Loading..." />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/component/:id" element={<ComponentDetail />} />
        </Routes>
      </Suspense>
    </>
  )
}
