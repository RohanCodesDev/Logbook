/**
 * Card — generic white surface with optional padding and shadow.
 * Usage: <Card className="...">...</Card>
 */
export default function Card({ children, className = '', noPad = false }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${noPad ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  )
}
