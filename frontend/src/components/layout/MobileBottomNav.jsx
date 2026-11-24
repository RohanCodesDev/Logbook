import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, FileBarChart2, Settings } from 'lucide-react'

const navItems = [
  { to: '/',         label: 'Home',     icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderOpen,      matchPrefix: '/projects' },
  { to: '/reports',  label: 'Reports',  icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/**
 * MobileBottomNav — Thumb-friendly fixed bottom navigation bar shown on mobile/tablet screens (< lg).
 */
export default function MobileBottomNav() {
  const location = useLocation()

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
        {navItems.map(({ to, label, icon: Icon, end, matchPrefix }) => {
          const isMatchedPrefix = matchPrefix && location.pathname.startsWith(matchPrefix)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = isActive || isMatchedPrefix
                return `flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  active ? 'text-amber-600' : 'text-slate-400 hover:text-slate-700'
                }`
              }}
            >
              {({ isActive }) => {
                const active = isActive || isMatchedPrefix
                return (
                  <>
                    <span className={`px-3 py-1 rounded-full transition-colors ${active ? 'bg-amber-100/80' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span>{label}</span>
                  </>
                )
              }}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
