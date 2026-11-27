import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, Users, ScrollText, FileBarChart2 } from 'lucide-react'

const navItems = [
  { to: '/',           label: 'Home',       icon: LayoutDashboard, end: true },
  { to: '/projects',   label: 'Projects',   icon: FolderOpen,      matchPrefix: '/projects' },
  { to: '/crew',       label: 'Workforce',  icon: Users },
  { to: '/agreements', label: 'Agreements', icon: ScrollText },
  { to: '/reports',    label: 'Reports',    icon: FileBarChart2 },
]

/**
 * MobileBottomNav — Thumb-friendly fixed bottom navigation bar shown on mobile/tablet screens (< lg).
 */
export default function MobileBottomNav() {
  const location = useLocation()

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FCFBF8]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
        {navItems.map(({ to, label, icon: Icon, end, matchPrefix }) => {
          const isMatchedPrefix = matchPrefix && location.pathname.startsWith(matchPrefix)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = isActive || isMatchedPrefix
                return `flex flex-col items-center justify-center gap-1 min-w-0 px-0.5 text-[10px] sm:text-[11px] font-semibold transition-colors ${
                  active ? 'text-[#C97814]' : 'text-[#6B7280] hover:text-[#1E242B]'
                }`
              }}
            >
              {({ isActive }) => {
                const active = isActive || isMatchedPrefix
                return (
                  <>
                    <span className={`px-2.5 py-1 rounded-full transition-colors ${active ? 'bg-[#E08A1E]/15' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="truncate max-w-full">{label}</span>
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
