const variants = {
  active:    'bg-emerald-50/90 text-emerald-700 ring-1 ring-emerald-200/80',
  paused:    'bg-amber-50/90 text-amber-800 ring-1 ring-amber-200/80',
  completed: 'bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800',
  archived:  'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/80',
  planning:  'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80',
}

const dots = {
  active:    'bg-emerald-500',
  paused:    'bg-amber-500',
  completed: 'bg-zinc-300',
  archived:  'bg-zinc-400',
  planning:  'bg-zinc-500',
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
