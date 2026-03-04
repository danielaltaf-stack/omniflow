'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
} from 'recharts'
import { formatAmount } from '@/lib/format'

interface AllocationEntry {
  name: string
  value: number // centimes
}

interface AllocationDonutProps {
  data: AllocationEntry[]
  title?: string
  isLoading?: boolean
}

const COLORS = [
  '#6366f1', // Indigo (brand)
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#64748b', // Slate
]

/**
 * Interactive donut chart for asset allocation / category breakdown.
 */
export function AllocationDonut({ data, title, isLoading }: AllocationDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  if (isLoading) {
    return (
      <div className="rounded-omni-lg border border-border bg-surface p-5 animate-pulse">
        <div className="h-4 w-28 bg-surface-elevated rounded mb-4" />
        <div className="h-48 w-48 mx-auto bg-surface-elevated rounded-full" />
      </div>
    )
  }

  // Filter out zero/negative values 
  const chartData = data.filter((d) => d.value > 0).map((d) => ({
    name: d.name,
    value: d.value / 100, // to euros
    centimes: d.value,
  }))

  if (!chartData.length) return null

  const totalEur = chartData.reduce((s, d) => s + d.value, 0)

  // Active sector renderer
  const renderActiveShape = (props: any) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value,
    } = props

    if (activeIndex === undefined) {
      // When nothing is hovered, show the total in center
      return (
        <g>
          <text x={cx} y={cy - 4} textAnchor="middle" className="text-[10px] fill-foreground-tertiary">
            Total
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="text-sm font-bold fill-foreground">
            {formatAmount(Math.round(totalEur * 100))}
          </text>
          <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
          />
        </g>
      )
    }

    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" className="text-xs fill-foreground-secondary">
          {payload.name}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-sm font-bold fill-foreground">
          {formatAmount(Math.round(value * 100))}
        </text>
        <text x={cx} y={cy + 28} textAnchor="middle" className="text-[10px] fill-foreground-tertiary">
          {totalEur > 0 ? ((value / totalEur) * 100).toFixed(1) : 0}%
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 3}
          outerRadius={innerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.3}
        />
      </g>
    )
  }

  return (
    <div className="rounded-omni-lg border border-border bg-surface p-3 sm:p-5">
      {title && <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <ResponsiveContainer width="100%" height={200} className="max-w-[200px]">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              strokeWidth={0}
              isAnimationActive={true}
              animationDuration={1000}
              animationBegin={100}
              animationEasing="ease-out"
              {...({ activeIndex: activeIndex ?? 0, activeShape: renderActiveShape } as any)}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                return null // Using active shape instead
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 min-w-0">
          {chartData.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-surface-elevated/50 rounded px-1.5 py-1 transition-colors"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-foreground-secondary truncate flex-1">{entry.name}</span>
              <span className="text-foreground font-medium tabular-nums">
                {formatAmount(entry.centimes)}
              </span>
              <span className="text-foreground-tertiary tabular-nums w-10 text-right">
                {totalEur > 0 ? ((entry.value / totalEur) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
