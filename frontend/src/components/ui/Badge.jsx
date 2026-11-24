const variants = {
  active:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  paused:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  completed:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  archived:   'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  planning:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const dots = {
  active:    'bg-emerald-500',
  paused:    'bg-amber-500',
  completed: 'bg-blue-500',
  archived:  'bg-slate-400',
  planning:  'bg-purple-500',
}

export default function Badge({ status = 'active', label }) {
  const text = label ?? status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${variants[status] ?? variants.active}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? dots.active}`} />
      {text}
    </span>
  )
}
