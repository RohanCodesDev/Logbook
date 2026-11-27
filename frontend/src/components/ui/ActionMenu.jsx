import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

/**
 * ActionMenu — Clean kebab (⋮) dropdown menu rendered in a body portal
 * so table overflow-x-auto containers never clip or overlap the menu.
 */
export default function ActionMenu({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const toggleMenu = (e) => {
    e.stopPropagation()
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = 176
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
      const top = Math.min(rect.bottom + 6, window.innerHeight - 190)
      setMenuPos({ top: Math.max(8, top), left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return
      }
      setOpen(false)
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleScroll = () => setOpen(false)

    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  return (
    <div
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggleMenu}
        className={`p-2 rounded-lg transition-colors ${
          open
            ? 'bg-[var(--bg-input)] text-[var(--text-primary)]'
            : 'text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed w-44 rounded-xl bg-[var(--bg-card)] shadow-2xl ring-1 ring-[var(--border-subtle)] py-1.5 z-[9999]"
        >
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={item.label || idx}>
                {item.dividerBefore && <div className="my-1 border-t border-[var(--border-subtle)]" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {Icon && (
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        item.danger ? 'text-red-500' : 'text-slate-400'
                      }`}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
