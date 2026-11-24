const variants = {
  primary: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/30 active:scale-95',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:scale-95',
  ghost: 'text-slate-600 hover:bg-slate-100 active:scale-95',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
  icon: 'p-2',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  title,
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-all duration-150 cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </button>
  )
}
