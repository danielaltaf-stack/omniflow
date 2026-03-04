'use client'

import { useEffect, useRef } from 'react'

export function NoiseOverlay() {
  const filterRef = useRef<SVGFETurbulenceElement>(null)

  useEffect(() => {
    let seed = 0
    const animate = () => {
      seed = (seed + 1) % 100
      if (filterRef.current) {
        filterRef.current.setAttribute('seed', String(seed))
      }
    }
    // ~12fps for visible grain animation
    const interval = setInterval(animate, 83)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[999]"
      style={{ opacity: 0.12 }}
      aria-hidden="true"
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="omniflow-grain">
          <feTurbulence
            ref={filterRef}
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="4"
            stitchTiles="stitch"
            seed="0"
          />
          <feColorMatrix
            type="matrix"
            values="0.8 0.1 0.1 0 0
                    0.1 0.3 0.6 0 0
                    0.3 0.1 0.8 0 0
                    0   0   0   0.6 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#omniflow-grain)" />
      </svg>
    </div>
  )
}
