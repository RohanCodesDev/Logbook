import { useState, useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { AnimatedPortalMenu, AnimatedMenuItem } from './animated-dropdown'

/**
 * ActionMenu — Clean kebab (⋮) dropdown menu powered by AnimatedPortalMenu.
 */
export default function ActionMenu({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

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
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={`p-2 rounded-lg transition-colors ${
          open
            ? 'bg-[var(--bg-input)] text-[var(--text-primary)]'
            : 'text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <AnimatedPortalMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        align="right"
        widthPx={176}
        onMenuClick={(e) => e.stopPropagation()}
      >
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={item.label || idx}>
              {item.dividerBefore && <div className="my-1 border-t border-[var(--border-subtle)]" />}
              <AnimatedMenuItem
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  item.onClick?.()
                }}
                className={
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                }
              >
                {Icon && (
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      item.danger ? 'text-red-500' : 'text-slate-400'
                    }`}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </AnimatedMenuItem>
            </div>
          )
        })}
      </AnimatedPortalMenu>
    </div>
  )
}
