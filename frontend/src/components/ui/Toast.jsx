import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error:   AlertCircle,
  info:    Info,
}

const STYLES = {
  success: 'bg-slate-900 text-white border-emerald-500/40',
  error:   'bg-red-950 text-white border-red-500/40',
  info:    'bg-slate-900 text-white border-amber-500/40',
}

const ICON_COLORS = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  info:    'text-amber-400',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, typeOrOptions = 'success', maybeOptions = {}) => {
    const opts = typeof typeOrOptions === 'string'
      ? { type: typeOrOptions, ...maybeOptions }
      : { type: 'success', ...(typeOrOptions || {}) }

    const { type = 'success', duration = 3500, actionLabel = null, onAction = null } = opts
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type, actionLabel, onAction }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <div className="no-print fixed bottom-20 lg:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[100] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium transition-all ${STYLES[t.type] || STYLES.info}`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${ICON_COLORS[t.type] || ICON_COLORS.info}`} />
              <span className="flex-1">{t.message}</span>
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction()
                    dismiss(t.id)
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#F5BD6E] text-xs font-bold uppercase tracking-wider transition-colors flex-shrink-0"
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
