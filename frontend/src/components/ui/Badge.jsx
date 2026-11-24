const variants = {
  active:    'bg-[#DCFCE7] text-[#166534] ring-1 ring-[#BBF7D0]',
  paused:    'bg-[#FEF3C7] text-[#92400E] ring-1 ring-[#FDE68A]',
  completed: 'bg-[#DBEAFE] text-[#1E40AF] ring-1 ring-[#BFDBFE]',
  archived:  'bg-[#EFECE4] text-[#57534E] ring-1 ring-[#E6E1D6]',
  planning:  'bg-[#EDE9FE] text-[#5B21B6] ring-1 ring-[#DDD6FE]',
}

const dots = {
  active:    'bg-[#16A34A]',
  paused:    'bg-[#D97706]',
  completed: 'bg-[#2563EB]',
  archived:  'bg-[#78716C]',
  planning:  'bg-[#7C3AED]',
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
