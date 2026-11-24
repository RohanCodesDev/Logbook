/**
 * Card — Soft Alabaster surface with Light Stone border and optional padding.
 */
export default function Card({ children, className = '', noPad = false }) {
  return (
    <div className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] shadow-sm ${noPad ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  )
}
