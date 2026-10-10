import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon.tsx'
import './Modal.css'

interface ModalProps {
  title?: ReactNode
  onClose?: () => void
  children: ReactNode
  className?: string
}

export function Modal({ title, onClose, children, className }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation()
      onClose()
    }
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => handleKey(e)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={dialogRef}
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {(title || onClose) && (
          <header className="modal-header">
            {title && <h2 id={titleId}>{title}</h2>}
            {onClose && (
              <button type="button" className="btn btn-ghost icon-btn modal-close" onClick={onClose} aria-label="Đóng">
                <Icon name="close" />
              </button>
            )}
          </header>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
