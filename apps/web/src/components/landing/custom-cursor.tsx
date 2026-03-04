'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<HTMLDivElement>(null)
  const [cursorVariant, setCursorVariant] = useState<'default' | 'link' | 'stat'>('default')
  const [isVisible, setIsVisible] = useState(false)
  const mouse = useRef({ x: -100, y: -100 })
  const cursor = useRef({ x: -100, y: -100 })
  const trail = useRef({ x: -100, y: -100 })

  const onMouseMove = useCallback((e: MouseEvent) => {
    mouse.current = { x: e.clientX, y: e.clientY }
    if (!isVisible) setIsVisible(true)
  }, [isVisible])

  const onMouseLeave = useCallback(() => {
    setIsVisible(false)
  }, [])

  useEffect(() => {
    // Detect touch device → disable custom cursor
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    const handleHoverStart = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-cursor="stat"]')) {
        setCursorVariant('stat')
      } else if (target.closest('a, button, [role="button"], [data-cursor="link"]')) {
        setCursorVariant('link')
      }
    }
    const handleHoverEnd = () => setCursorVariant('default')

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseover', handleHoverStart)
    document.addEventListener('mouseout', handleHoverEnd)

    // Lerp animation loop
    let raf: number
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const animate = () => {
      cursor.current.x = lerp(cursor.current.x, mouse.current.x, 0.15)
      cursor.current.y = lerp(cursor.current.y, mouse.current.y, 0.15)
      trail.current.x = lerp(trail.current.x, mouse.current.x, 0.08)
      trail.current.y = lerp(trail.current.y, mouse.current.y, 0.08)

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursor.current.x}px, ${cursor.current.y}px, 0)`
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate3d(${trail.current.x}px, ${trail.current.y}px, 0)`
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseover', handleHoverStart)
      document.removeEventListener('mouseout', handleHoverEnd)
      cancelAnimationFrame(raf)
    }
  }, [onMouseMove, onMouseLeave])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null
  }

  const cursorSize = cursorVariant === 'link' ? 40 : cursorVariant === 'stat' ? 50 : 20
  const trailSize = 40

  return (
    <>
      {/* Main cursor dot */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] mix-blend-difference"
        style={{
          width: cursorSize,
          height: cursorSize,
          marginLeft: -cursorSize / 2,
          marginTop: -cursorSize / 2,
          borderRadius: '50%',
          border: cursorVariant === 'stat' ? 'none' : '1.5px solid rgba(108, 92, 231, 0.8)',
          backgroundColor: cursorVariant === 'link'
            ? 'rgba(108, 92, 231, 0.15)'
            : cursorVariant === 'stat'
              ? 'rgba(108, 92, 231, 0.2)'
              : 'transparent',
          transition: 'width 0.3s ease, height 0.3s ease, margin 0.3s ease, background-color 0.3s ease, border 0.3s ease',
          opacity: isVisible ? 1 : 0,
          willChange: 'transform',
        }}
      >
        {cursorVariant === 'stat' && (
          <svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(108, 92, 231, 0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        )}
      </div>

      {/* Trail (larger, blurred) */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed left-0 top-0 z-[9998]"
        style={{
          width: trailSize,
          height: trailSize,
          marginLeft: -trailSize / 2,
          marginTop: -trailSize / 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108, 92, 231, 0.12) 0%, transparent 70%)',
          filter: 'blur(8px)',
          opacity: isVisible ? 1 : 0,
          willChange: 'transform',
          transition: 'opacity 0.3s ease',
        }}
      />
    </>
  )
}
