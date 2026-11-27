import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const MENU_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
}

/**
 * AnimatedMenuItem — Staggered animated item for use inside AnimatedPortalMenu.
 */
export function AnimatedMenuItem({
  children,
  onClick,
  disabled = false,
  className,
  role = 'menuitem',
}) {
  return (
    <motion.button
      type="button"
      role={role}
      disabled={disabled}
      variants={ITEM_VARIANTS}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-left transition-colors duration-150 disabled:opacity-40',
        className
      )}
    >
      {children}
    </motion.button>
  )
}

/**
 * AnimatedPortalMenu — Reusable framer-motion dropdown panel rendered in document.body
 * with smart viewport clamping so table/modal overflow containers never clip it.
 */
export function AnimatedPortalMenu({
  open,
  onClose,
  anchorRef,
  align = 'right',
  widthPx = 196,
  matchAnchorWidth = false,
  className,
  children,
  onMenuClick,
}) {
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: widthPx })

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const effectiveWidth = matchAnchorWidth ? Math.max(rect.width, 140) : widthPx
      const rawLeft = align === 'left'
        ? rect.left
        : align === 'center'
          ? rect.left + rect.width / 2 - effectiveWidth / 2
          : rect.right - effectiveWidth
      const left = Math.max(8, Math.min(rawLeft, window.innerWidth - effectiveWidth - 8))

      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const estimatedHeight = Math.min(menuRef.current?.offsetHeight || 220, 280)
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
      const top = openAbove
        ? Math.max(8, rect.top - estimatedHeight - 6)
        : Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 60))

      setPos({ top, left, width: effectiveWidth })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [open, anchorRef, align, widthPx, matchAnchorWidth])

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (
        anchorRef?.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return
      }
      onClose?.()
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const handleScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return
      onClose?.()
    }

    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open, onClose, anchorRef])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          role="listbox"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onClick={onMenuClick}
          className={cn(
            'fixed z-[9999] overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl py-1 max-h-72 overflow-y-auto',
            className
          )}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={MENU_VARIANTS}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/**
 * AnimatedDropdown — Smooth framer-motion select/dropdown control (emerald-ui style,
 * adapted to Warm Sand & Oat + body portal for modals and grids).
 *
 * Supports:
 * - Controlled form select: options=[{ value, label }] or string[], value, onChange(val)
 * - Link demo mode: items=[{ name, link }], text
 */
export default function AnimatedDropdown({
  options,
  items,
  value,
  onChange,
  placeholder = 'Select Option',
  text,
  disabled = false,
  className,
  buttonClassName,
  align = 'left',
  defaultOpen = false,
  onCloseComplete,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const triggerRef = useRef(null)

  const normalizedOptions = options
    ? options.map((opt) =>
        typeof opt === 'string'
          ? { value: opt, label: opt }
          : { value: String(opt.value), label: opt.label, icon: opt.icon }
      )
    : (items || []).map((item) => ({
        value: item.link || item.name,
        label: item.name,
        href: item.link,
      }))

  const selectedOption = normalizedOptions.find((o) => String(o.value) === String(value))
  const displayLabel = selectedOption?.label || text || placeholder

  const close = () => {
    setIsOpen(false)
    onCloseComplete?.()
  }

  return (
    <div
      data-state={isOpen ? 'open' : 'closed'}
      className={cn('relative inline-block w-full', className)}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-base sm:text-sm text-[var(--text-primary)] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#E08A1E] disabled:opacity-50 disabled:cursor-not-allowed',
          !selectedOption && !text && 'text-slate-400',
          buttonClassName
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex-shrink-0 text-slate-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatedPortalMenu
        open={isOpen}
        onClose={close}
        anchorRef={triggerRef}
        align={align}
        matchAnchorWidth={true}
      >
        {normalizedOptions.length === 0 ? (
          <div className="px-3.5 py-2.5 text-xs text-slate-400">No options available</div>
        ) : (
          normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value)
            if (opt.href && !onChange) {
              return (
                <motion.a
                  key={`${opt.value}-${idx}`}
                  href={opt.href}
                  variants={ITEM_VARIANTS}
                  onClick={close}
                  className="flex items-center justify-between w-full px-3.5 py-2 text-sm border-b border-[var(--border-subtle)] last:border-b-0 bg-[var(--bg-card)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] no-underline transition-colors"
                >
                  <span className="truncate">{opt.label}</span>
                </motion.a>
              )
            }

            return (
              <motion.button
                key={`${opt.value}-${idx}`}
                type="button"
                variants={ITEM_VARIANTS}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange?.(opt.value)
                  close()
                }}
                className={cn(
                  'flex items-center justify-between gap-2 w-full px-3.5 py-2 text-xs sm:text-sm text-left border-b border-[var(--border-subtle)]/60 last:border-b-0 transition-colors',
                  isSelected
                    ? 'bg-[#FEF6E9] text-[#C97814] font-semibold'
                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-input)] text-[var(--text-primary)]'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#E08A1E] flex-shrink-0" />}
              </motion.button>
            )
          })
        )}
      </AnimatedPortalMenu>
    </div>
  )
}
