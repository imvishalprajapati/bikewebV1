import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { componentMap } from '../data/components.js'
import ComponentViewer from '../components/ComponentViewer.jsx'
import InfoPanel from '../components/InfoPanel.jsx'

const catColor = {
  'Engine': 'rgb(7, 135, 60)',
  'Engine Control Units': 'rgb(7, 135, 60)',
  'Transmission': 'rgb(7, 135, 60)',
  'Chassis': 'rgb(7, 135, 60)',
  'Electrification': 'rgb(7, 135, 60)',
}

export default function ComponentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const pageRef = useRef()
  const [scrollProgress, setScrollProgress] = useState(0)
  const component = componentMap[id]

  // Detect if we are on a phone-sized viewport for label shortening
  const [isPhone, setIsPhone] = useState(window.innerWidth < 768)
  useEffect(() => {
    function checkSize() { setIsPhone(window.innerWidth < 768) }
    window.addEventListener('resize', checkSize)
    window.addEventListener('orientationchange', checkSize)
    return () => {
      window.removeEventListener('resize', checkSize)
      window.removeEventListener('orientationchange', checkSize)
    }
  }, [])

  useEffect(() => {
    if (!pageRef.current) return
    gsap.fromTo(pageRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out' }
    )
  }, [id])

  // Scroll-based explode progress (on the info pane)
  const handleScroll = (e) => {
    const el = e.currentTarget
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight)
    setScrollProgress(Math.min(Math.max(progress, 0), 1))
  }

  if (!component) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>⚠</div>
        <div style={{ color: 'var(--text-secondary)' }}>Component not found</div>
        <button className="back-button" style={{ position: 'static' }} onClick={() => navigate('/')}>← Back to Showroom</button>
      </div>
    )
  }

  const color = catColor[component.category] || '#00893D'

  return (
    <div className="detail-page page-enter" ref={pageRef}>
      {/* Back button — shorter label on phone to save space */}
      <button className="back-button" onClick={() => navigate('/')}>
        <span className="back-arrow">←</span>
        {isPhone ? 'Back' : 'Back to Showroom'}
      </button>

      {/* Left / Top: 3D Viewer */}
      <div className="detail-viewer-pane">
        <ComponentViewer
          componentId={component.id}
          modelFile={component.model}
          color={color}
          scrollProgress={component.hasExplodedView && component.explodeTrigger !== 'zoom' ? scrollProgress : 0}
          explodeTrigger={component.explodeTrigger}
        />

        {/* Component label */}
        <div className="viewer-label-overlay">
          <div className="viewer-component-name">{component.id.replace(/_/g, ' ')}</div>
          <div className="viewer-orbit-hint">Drag to rotate · {component.explodeTrigger === 'zoom' ? 'Zoom to explode' : 'Scroll to zoom'}</div>
        </div>

        {/* Scroll-driven explode progress bar — hidden on phone via CSS */}
        {component.hasExplodedView && (
          <div className="explode-progress">
            <div className="explode-label">Explode</div>
            <div className="explode-track">
              <div className="explode-fill" style={{ height: `${scrollProgress * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}88)` }} />
            </div>
          </div>
        )}

        {/* Scroll hint */}
        {scrollProgress < 0.05 && component.hasExplodedView && (
          <div className="scroll-hint">
            <div className="scroll-hint-wheel" style={{ borderColor: color }} />
            <div className="scroll-hint-text" style={{ color }}>{component.explodeTrigger === 'zoom' ? 'Zoom to explode' : 'Scroll to explode'}</div>
          </div>
        )}
      </div>

      {/* Right / Bottom: Info Panel — -webkit-overflow-scrolling for smooth iOS/Android scroll */}
      <div
        className="detail-info-pane"
        onScroll={handleScroll}
        style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        <InfoPanel component={component} scrollProgress={scrollProgress} />
      </div>
    </div>
  )
}
