import { useRef, useState } from 'react'

/**
 * Magnetic — Tight, mature magnetic cursor pull (clamped to ±6px) for primary buttons & nav items.
 * Avoid using on dense table rows so cell clicking remains rock-steady.
 */
export function Magnetic({
  children,
  strength = 0.2,
  maxOffset = 6,
  className = 'inline-block',
}) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const clamp = (v) => Math.max(-maxOffset, Math.min(maxOffset, v))

  const handleMouseMove = (e) => {
    if (!ref.current) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const x = clamp((e.clientX - (left + width / 2)) * strength)
    const y = clamp((e.clientY - (top + height / 2)) * strength)
    setPos({ x, y })
  }

  const handleMouseLeave = () => setPos({ x: 0, y: 0 })

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transition:
          pos.x === 0 && pos.y === 0
            ? 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'transform 0.12s ease-out',
      }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </div>
  )
}

export default Magnetic
