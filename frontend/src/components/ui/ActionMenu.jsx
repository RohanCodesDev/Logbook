import { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'

/**
 * ActionMenu — Clean kebab (⋮) dropdown menu for row-level actions.
 * Stops click propagation so it works safely inside clickable table rows.
 */
export default function ActionMenu({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={`p-2 rounded-lg transition-colors ${
          open
            ? 'bg-slate-200/80 text-slate-900'
            : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-44 origin-top-right rounded-xl bg-[var(--bg-card)] shadow-lg ring-1 ring-[var(--border-subtle)] py-1.5 z-40"
        >
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={item.label || idx}>
                {item.dividerBefore && <div className="my-1 border-t border-slate-100" />}
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
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
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
        </div>
      )}
    </div>
  )
}
