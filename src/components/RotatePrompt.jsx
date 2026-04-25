import { useState, useEffect } from 'react'

/**
 * RotatePrompt
 * Shows a full-screen rotate-to-landscape overlay ONLY on phones
 * (viewport width < 768px) when they are held in portrait orientation.
 * Automatically disappears when the device is rotated to landscape.
 * Has no effect on tablets (≥ 768px CSS width).
 */
export default function RotatePrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function check() {
      const w = window.innerWidth
      const h = window.innerHeight
      // Only phones (< 768px) in portrait mode
      setShow(w < 768 && h > w)
    }

    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Logo area */}
      <img
        src="./SchaefflerLogo.png"
        alt="Schaeffler"
        style={{ height: '28px', objectFit: 'contain', opacity: 0.85 }}
        onError={(e) => { e.target.style.display = 'none' }}
      />

      {/* Animated phone icon */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        {/* Outer pulse ring */}
        <div style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          border: '1.5px solid rgba(0,137,61,0.25)',
          animation: 'rotatePulse 2s ease-in-out infinite',
        }} />

        {/* Phone silhouette — rotates 90° */}
        <div style={{
          width: 80,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'rotatePhone 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }}>
          <svg
            viewBox="0 0 24 24"
            width="52"
            height="52"
            fill="none"
            stroke="rgb(7,135,60)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Phone body */}
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            {/* Home button */}
            <line x1="12" y1="18" x2="12" y2="18.5" strokeWidth="2" />
          </svg>
        </div>

        {/* Rotation arrow */}
        <div style={{
          position: 'absolute',
          bottom: -10,
          right: -10,
          fontSize: '1.2rem',
          color: 'rgb(7,135,60)',
          animation: 'arrowBounce 2.4s ease-in-out infinite',
        }}>
          ↻
        </div>
      </div>

      {/* Message */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 280 }}>
        <p style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#121212',
          margin: 0,
          lineHeight: 1.3,
        }}>
          Rotate your device
        </p>
        <p style={{
          fontSize: '0.82rem',
          color: '#7A7A7A',
          margin: 0,
          lineHeight: 1.5,
          letterSpacing: '0.01em',
        }}>
          For the best 3D showroom experience, please hold your device in <strong style={{ color: '#121212' }}>landscape</strong> orientation.
        </p>
      </div>

      {/* Green accent bar */}
      <div style={{
        width: 48,
        height: 3,
        borderRadius: 2,
        background: 'linear-gradient(90deg, rgb(0,92,41), rgb(0,176,80))',
      }} />

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes rotatePhone {
          0%, 30% { transform: rotate(0deg); }
          55%, 85% { transform: rotate(-90deg); }
          100%     { transform: rotate(0deg); }
        }
        @keyframes rotatePulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes arrowBounce {
          0%, 30%  { opacity: 0; transform: scale(0.6) rotate(0deg); }
          50%, 75% { opacity: 1; transform: scale(1) rotate(0deg); }
          100%     { opacity: 0; transform: scale(0.8) rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
