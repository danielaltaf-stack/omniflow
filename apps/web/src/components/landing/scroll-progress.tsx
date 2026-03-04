'use client'

import { useEffect, useRef } from 'react'

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      if (!barRef.current) return
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      barRef.current.style.width = `${progress}%`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed left-0 top-0 z-[100] h-[2px] w-full bg-transparent">
      <div
        ref={barRef}
        className="h-full w-0 bg-gradient-to-r from-brand via-brand-light to-brand"
        style={{
          willChange: 'width',
          transition: 'width 0.05s linear',
          boxShadow: '0 0 10px rgba(108, 92, 231, 0.5), 0 0 30px rgba(108, 92, 231, 0.2)',
        }}
      />
    </div>
  )
}
