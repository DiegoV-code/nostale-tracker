import { memo, useRef, type ReactNode } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

interface Props<T> {
  items: T[]
  estimateSize: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  overscan?: number
  gap?: number
}

function VirtualListInner<T>({
  items,
  estimateSize: estSize,
  renderItem,
  className,
  overscan = 5,
  gap = 0,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estSize + gap,
    overscan,
  })

  return (
    <div ref={parentRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map(vr => (
          <div
            key={vr.key}
            data-index={vr.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vr.start}px)`,
              paddingBottom: gap || undefined,
            }}
          >
            {renderItem(items[vr.index], vr.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Cast preserves generic type parameter through memo()
export default memo(VirtualListInner) as typeof VirtualListInner
