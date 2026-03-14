import React, { memo } from "react"
import s from "./Modal.module.css"

interface ModalProps {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
  width?: string | number
  maxWidth?: string | number
  height?: string | number
  maxHeight?: string | number
  zIndex?: number
  padding?: string | number
  innerStyle?: React.CSSProperties
}

export default memo(function Modal({ open, onClose, children, width, maxWidth, height, maxHeight, zIndex = 9997, padding, innerStyle }: ModalProps) {
  if (!open) return null
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
      className={s.overlay}
      style={{ zIndex }}>
      <div className={`up ${s.inner}`} style={{
        width: width || "auto", maxWidth: maxWidth || "95vw",
        height: height || "auto", maxHeight: maxHeight || "90vh",
        padding: padding || 0,
        ...innerStyle
      }}>
        {children}
      </div>
    </div>
  )
})
