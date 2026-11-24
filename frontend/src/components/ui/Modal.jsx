import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Modal — Responsive modal: slides up as a bottom sheet on mobile, centered dialog on desktop.
 */
export default function Modal({ open, onClose, title, children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:fade-in duration-200">
        {/* Mobile bottom-sheet grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate pr-4">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 pb-6 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}
