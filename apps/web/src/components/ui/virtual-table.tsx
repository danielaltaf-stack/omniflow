'use client'

import { useRef, useCallback, useMemo, memo } from 'react'
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window'

/**
 * OmniFlow F1.6 — Virtualized Table Component
 *
 * Wraps react-window FixedSizeList to render only the visible rows.
 * Handles: header row, fixed-width columns, scroll-to-item, overscan.
 *
 * Usage:
 *   <VirtualTable
 *     items={sorted}
 *     rowHeight={44}
 *     height={600}
 *     renderHeader={() => <tr>...</tr>}
 *     renderRow={(item, index, style) => <div style={style}>...</div>}
 *   />
 */

export interface VirtualTableProps<T> {
  items: T[]
  rowHeight: number
  height: number
  overscanCount?: number
  renderHeader: () => React.ReactNode
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  className?: string
  innerClassName?: string
}

function VirtualTableInner<T>({
  items,
  rowHeight,
  height,
  overscanCount = 8,
  renderHeader,
  renderRow,
  className = '',
  innerClassName = '',
}: VirtualTableProps<T>) {
  const listRef = useRef<List>(null)

  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const item = items[index]
    if (!item) return null
    return <>{renderRow(item, index, style)}</>
  }, [items, renderRow]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`rounded-omni-lg border border-border bg-surface overflow-hidden ${className}`}>
      {/* Sticky header */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {renderHeader()}
          </thead>
        </table>
      </div>

      {/* Virtualized body */}
      <div className="overflow-x-auto">
        <List
          ref={listRef}
          height={Math.min(height, items.length * rowHeight)}
          itemCount={items.length}
          itemSize={rowHeight}
          width="100%"
          overscanCount={overscanCount}
          className={innerClassName}
        >
          {Row}
        </List>
      </div>
    </div>
  )
}

export const VirtualTable = memo(VirtualTableInner) as typeof VirtualTableInner
