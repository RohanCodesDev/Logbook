export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-base sm:text-sm text-[var(--text-primary)] bg-[var(--bg-card)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:border-transparent transition-all'

/**
 * InputField — Reusable form field wrapper with consistent label and optional helper/error.
 */
export default function InputField({ label, required = false, hint, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
