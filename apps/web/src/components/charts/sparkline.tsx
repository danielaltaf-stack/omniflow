'use client'

import { useEffect, useRef } from 'react'

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  animated?: boolean
  strokeWidth?: number
  showGradient?: boolean
  className?: string
}

/**
 * SVG-only sparkline with Catmull-Rom interpolation for smooth curves.
 * Zero dependencies — no Recharts needed.
 */
export function Sparkline({
  data,
  color = '#6C5CE7',
  width = 60,
  height = 24,
  animated = true,
  strokeWidth = 1.5,
  showGradient = true,
  className = '',
}: SparklineProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`

  if (!data || data.length < 2) return null

  const padding = 2
  const w = width - padding * 2
  const h = height - padding * 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Map data to points
  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * w,
    y: padding + h - ((v - min) / range) * h,
  }))

  // Catmull-Rom to Bezier conversion for smooth curves
  const catmullRomToBezier = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return ''
    const first = pts[0]!
    const second = pts[1]!
    if (pts.length === 2) {
      return `M${first.x},${first.y} L${second.x},${second.y}`
    }

    let d = `M${first.x},${first.y}`
    const tension = 0.3

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]!
      const p1 = pts[i]!
      const p2 = pts[i + 1]!
      const p3 = pts[Math.min(pts.length - 1, i + 2)]!

      const cp1x = p1.x + ((p2.x - p0.x) * tension)
      const cp1y = p1.y + ((p2.y - p0.y) * tension)
      const cp2x = p2.x - ((p3.x - p1.x) * tension)
      const cp2y = p2.y - ((p3.y - p1.y) * tension)

      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }

    return d
  }

  const linePath = catmullRomToBezier(points)
  const lastPt = points[points.length - 1]!
  const firstPt = points[0]!
  const areaPath = `${linePath} L${lastPt.x},${height} L${firstPt.x},${height} Z`

  // Animate draw-in
  useEffect(() => {
    if (!animated || !pathRef.current) return
    const path = pathRef.current
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    path.style.transition = 'none'

    // Force reflow
    path.getBoundingClientRect()

    path.style.transition = 'stroke-dashoffset 600ms ease-out'
    path.style.strokeDashoffset = '0'
  }, [animated, data])

  // Determine trend color
  const isPositive = (data[data.length - 1] ?? 0) >= (data[0] ?? 0)
  const trendColor = color === '#6C5CE7' ? (isPositive ? '#00D68F' : '#FF4757') : color

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill */}
      {showGradient && (
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          opacity={animated ? 0.8 : 1}
        />
      )}

      {/* Line */}
      <path
        ref={pathRef}
        d={linePath}
        fill="none"
        stroke={trendColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
