import { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Bounds, PerformanceMonitor, Bvh, useProgress } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { useShowroomStore } from '../store/useShowroomStore.js'
import components from '../data/components.js'
import BikeViewer from '../components/BikeViewer.jsx'
import Hotspots from '../components/Hotspots.jsx'

// ── Category colours ─────────────────────────────────────────────────────
const CAT_COLOR = {
  'Engine': ' rgb(7, 135, 60)',
  'Engine Control Units': ' rgb(7, 135, 60)',
  'Transmission': ' rgb(7, 135, 60)',
  'Chassis': ' rgb(7, 135, 60)',
  // 'Electrification': '#9900cc',
}

// ── Sidebar Category Accordion ───────────────────────────────────────────
function SidebarCategory({ category, comps, hoveredComponent, hoveredMeshId, setHoveredComponent, navigate, initiallyOpen }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const selectedComponent = useShowroomStore(state => state.selectedComponent)

  // Auto-expand if one of our components is selected elsewhere (e.g. clicking 3D model)
  useEffect(() => {
    if (selectedComponent && comps.some(c => c.id === selectedComponent)) {
      setIsOpen(true)
    }
  }, [selectedComponent, comps])

  return (
    <div className="sidebar-category-group">
      <button
        className="sidebar-category-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ '--cat-color': CAT_COLOR[category] || '#00893D' }}
      >
        <span className="sidebar-cat-dot" style={{ background: CAT_COLOR[category] || '#00893D' }} />
        <span className="sidebar-cat-name">{category}</span>
        <span className={`sidebar-cat-chevron ${isOpen ? 'open' : ''}`}>›</span>
      </button>

      <div className={`sidebar-category-content ${isOpen ? 'open' : ''}`}>
        {comps.map(comp => {
          const isActive =
            hoveredComponent === comp.id ||
            hoveredMeshId === comp.id ||
            selectedComponent === comp.id

          return (
            <button
              key={comp.id}
              id={`sidebar-btn-${comp.id}`}
              className={`component-btn ${isActive ? 'active' : ''}`}
              style={{ '--cat-color': CAT_COLOR[comp.category] || '#00893D' }}
              onMouseEnter={() => setHoveredComponent(comp.id)}
              onMouseLeave={() => setHoveredComponent(null)}
              onClick={() => useShowroomStore.getState().setSelectedComponent(comp.id)}
            >
              <span className="comp-btn-label">{comp.label}</span>
              {isActive && <span className="comp-btn-arrow">→</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── DOM loading overlay (pure HTML, outside Canvas entirely) ─────────────
// useProgress is from drei and must NOT be used inside Canvas Suspense.
// Here it lives in a normal React component rendered as a DOM div overlay.
function LoadingOverlay() {
  const { progress, active } = useProgress()
  if (!active && progress >= 100) return null

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: '3px solid rgba(0,137,61,0.15)',
        borderTopColor: '#00893D',
        animation: 'spin 0.9s linear infinite',
        marginBottom: 16,
      }} />
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#00893D', fontFamily: 'system-ui, sans-serif', lineHeight: 1 }}>
        {Math.round(progress)}%
      </div>
      <div style={{ fontSize: '0.72rem', color: '#555', fontFamily: 'system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 6 }}>
        Loading model…
      </div>
    </div>
  )
}

// ── ZoomWatcher: maps camera distance → explode progress ─────────────────
// Lives inside Canvas so it can access useThree/useFrame.
// Reads camera distance each frame and pushes explodeProgress to the store.
// Uses getState() to write — avoids cascading React re-renders.
const EXPLODE_NEAR = 2.0   // camera distance where bike is FULLY exploded
const EXPLODE_FAR = 5.5   // camera distance where bike is assembled

function ZoomWatcher() {
  const { camera } = useThree()
  const lastVal = useRef(-1)

  useFrame(() => {
    const dist = camera.position.distanceTo({ x: 0, y: 0, z: 0 })
    // 0 = assembled (far), 1 = exploded (close)
    const raw = 1 - Math.min(1, Math.max(0, (dist - EXPLODE_NEAR) / (EXPLODE_FAR - EXPLODE_NEAR)))
    const t = Math.round(raw * 200) / 200 // quantize to avoid spamming store

    if (Math.abs(t - lastVal.current) > 0.004) {
      lastVal.current = t
      useShowroomStore.getState().setExplodeProgress(t)
    }
  })

  return null
}

// ── Home ─────────────────────────────────────────────────────────────────
export default function Home() {
  const {
    hoveredComponent, setHoveredComponent,
    hoveredMeshId,
  } = useShowroomStore()
  const navigate = useNavigate()

  // ── Mobile detection ──────────────────────────────────────────────────
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  // Start at 1.0 universally — PerformanceMonitor raises/lowers based on real GPU headroom.
  // DPR 1.0 = full-resolution pixels, zero MSAA cost, compatible with every GPU.
  const [dpr, setDpr] = useState(1.0)

  // Device-aware FOV: wider on phone so the bike fits without zooming out
  const [cameraFov, setCameraFov] = useState(() => {
    const w = window.innerWidth
    if (w < 768) return 55
    if (w < 1200) return 48
    return 45
  })

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (w < 768) setCameraFov(55)
      else if (w < 1200) setCameraFov(48)
      else setCameraFov(45)
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  // Ref to the bike group — passed into BikeViewer so it can do worldToLocal
  // for component ID resolution
  const bikeGroupRef = useRef()

  const filteredComponents = components.filter(c => c.category !== 'Electrification')

  return (
    <div className="home-page">

      {/* DOM loading overlay — pure HTML, no Canvas context needed */}
      <LoadingOverlay />

      {/* ── Main 3D Canvas ── */}
      <div className="canvas-wrapper">
        <Canvas
          frameloop="demand"
          camera={{ position: [-6.0, 1.5, 4.0], fov: cameraFov }}
          gl={{
            antialias: false,                  /* HW MSAA off — DPR≥1 gives equivalent quality at lower cost */
            powerPreference: 'high-performance'
          }}
          dpr={dpr}
          style={{ background: 'transparent' }}
        >
          {/* Adaptive quality — lowers DPR to 0.5 on struggling GPUs, raises to 1.5 when headroom exists */}
          <PerformanceMonitor
            onDecline={() => setDpr(prev => Math.max(prev - 0.25, 0.5))}
            onIncline={() => setDpr(prev => Math.min(prev + 0.25, 1.5))}
          />
          <color attach="background" args={['#FFFFFF']} />


          <Suspense fallback={null}>
            {/* Lighting — 2 directional lights only; point + hemisphere removed for GPU budget */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 8, 5]} intensity={1.4} />
            <directionalLight position={[-5, 4, -5]} intensity={0.3} />

            {/* Bike scene */}
            <Bounds fit clip margin={1.7}>
              <Bvh firstHitOnly>
                <group ref={bikeGroupRef} position={[0, -0.8, 0]} scale={0.5}>
                  <BikeViewer groupRef={bikeGroupRef} />
                  <Hotspots />
                </group>
              </Bvh>
            </Bounds>

            {/* hemisphereLight removed — ambientLight covers the fill role */}
          </Suspense>

          {/* ZoomWatcher and OrbitControls live outside Suspense so they
              work during loading and don't get suspended */}
          <ZoomWatcher />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2.0}
            maxDistance={12}
            minPolarAngle={Math.PI / 12}
            maxPolarAngle={Math.PI / 1.8}
            enableDamping={true}
            dampingFactor={isMobileDevice ? 0.08 : 0.05}
            touches={{ ONE: 1, TWO: 2 }}
            makeDefault
          />
        </Canvas>
      </div>


      {/* ── Background gradient overlay ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 80%, rgba(0,137,61,0.00) 0%, transparent 70%)',
        zIndex: 1,
      }} />

      {/* ── Component Sidebar ── */}
      <div className="component-sidebar" style={{ zIndex: 10 }}>
        <div className="sidebar-panel">
          <div className="sidebar-header">
            <div className="sidebar-header-accent" />
            <span>COMPONENTS</span>
            <div className="sidebar-header-count">{filteredComponents.length}</div>
          </div>

          <div className="component-list">
            {Object.entries(
              filteredComponents
                .reduce((acc, comp) => {
                  if (!acc[comp.category]) acc[comp.category] = []
                  acc[comp.category].push(comp)
                  return acc
                }, {})
            ).map(([category, comps], idx) => (
              <SidebarCategory
                key={category}
                category={category}
                comps={comps}
                hoveredComponent={hoveredComponent}
                hoveredMeshId={hoveredMeshId}
                setHoveredComponent={setHoveredComponent}
                navigate={navigate}
                initiallyOpen={idx === 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Watermark ── 
      <div className="home-watermark">
        <div className="watermark-separator" />
        <span className="watermark-text">SK3D</span>
      </div>*/}

      {/* ── Zoom hint — changes based on explode state ── */}
      <ZoomHint />

    </div>
  )
}

// ── Dynamic hint that reads explode progress ─────────────────────────────
function ZoomHint() {
  const [isExploded, setIsExploded] = useState(false)

  // Poll store every 500ms — cheap, doesn't need to be frame-accurate
  // (We don't subscribe with useShowroomStore here to avoid re-renders on every zoom tick)
  useEffect(() => {
    const interval = setInterval(() => {
      const p = useShowroomStore.getState().explodeProgress
      setIsExploded(p > 0.1)
    }, 200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hint-toast" style={{ zIndex: 10 }}>
      <div className="hint-dot" />
      {isExploded
        ? 'Hover a part to identify it • Click to explore details'
        : ''
      }
    </div>
  )
}
