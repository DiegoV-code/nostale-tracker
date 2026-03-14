import { memo } from "react"
import s from "./StatBar.module.css"

export interface StatBarItem {
  l: string
  v: string
  c: string
  sub?: string
  title?: string
  flex?: string
  bg2?: string
  border?: string
  radius?: number
  pad?: string
  big?: boolean
}

interface StatBarProps {
  items: StatBarItem[]
  gap?: number
  mb?: number
}

export default memo(function StatBar({ items, gap = 8, mb = 18 }: StatBarProps) {
  return (
    <div className={s.bar} style={{ gap, marginBottom: mb }}>
      {items.map(i => (
        <div key={i.l} title={i.title || ""} className={s.card}
          style={{
            ...(i.flex ? { flex: i.flex } : undefined),
            ...(i.bg2 ? { background: i.bg2 } : undefined),
            ...(i.border ? { borderColor: i.border } : undefined),
            ...(i.radius ? { borderRadius: i.radius } : undefined),
            ...(i.pad ? { padding: i.pad } : undefined),
            ...(i.title ? { cursor: "help" } : undefined),
          }}>
          <div className={s.label}>{i.l}</div>
          <div className={`${s.value} ${i.big ? s.valueBig : ""}`} style={{ color: i.c }}>{i.v}</div>
          {i.sub && <div className={s.sub}>{i.sub}</div>}
        </div>
      ))}
    </div>
  )
})
