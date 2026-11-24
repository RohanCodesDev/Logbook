import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  HardHat,
  LayoutDashboard,
  FolderOpen,
  FileBarChart2,
  Settings,
  ChevronRight,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects',  icon: FolderOpen,      matchPrefix: '/projects' },
  { to: '/reports',  label: 'Reports',   icon: FileBarChart2 },
  { to: '/settings', label: 'Settings',  icon: Settings },
]

export function getBusinessProfile() {
  try {
    const raw = localStorage.getItem('buildlogic_profile')
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore storage errors
  }
  return {
    businessName: 'BuildLogic',
    subtitle: 'Personal Construction Log',
    ownerName: 'Business Owner',
  }
}

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation()
  const [profile, setProfile] = useState(getBusinessProfile)

  useEffect(() => {
    const onUpdate = () => setProfile(getBusinessProfile())
    window.addEventListener('business-profile-updated', onUpdate)
    return () => window.removeEventListener('business-profile-updated', onUpdate)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    onClose?.()
  }, [location.pathname, onClose])

  const initials = (profile.businessName || 'BL')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'BL'

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-slate-900 text-white border-r border-slate-800 transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500 shadow-lg shadow-amber-500/25 flex-shrink-0">
              <HardHat className="w-5 h-5 text-white" />
            </span>
            <div className="leading-tight min-w-0">
              <p className="font-heading font-bold text-sm text-white tracking-tight truncate">
                {profile.businessName || 'BuildLogic'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {profile.subtitle || 'Construction Records'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Menu
          </p>
          {navItems.map(({ to, label, icon: Icon, end, matchPrefix }) => {
            const isMatchedPrefix = matchPrefix && location.pathname.startsWith(matchPrefix)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => {
                  const active = isActive || isMatchedPrefix
                  return `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  }`
                }}
              >
                {({ isActive }) => {
                  const active = isActive || isMatchedPrefix
                  return (
                    <>
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          active ? 'text-amber-400' : 'text-slate-500 group-hover:text-white'
                        }`}
                      />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                    </>
                  )
                }}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom personal account card */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-800">
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="leading-tight flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {profile.ownerName || 'Business Owner'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">Personal Business</p>
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
