import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  HardHat,
  LayoutDashboard,
  FolderOpen,
  Users,
  ScrollText,
  FileBarChart2,
  Settings,
  X,
} from 'lucide-react'
import { Magnetic } from '../ui/Magnetic'

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/projects',   label: 'Projects',   icon: FolderOpen,      matchPrefix: '/projects' },
  { to: '/crew',       label: 'Workforce',  icon: Users },
  { to: '/agreements', label: 'Agreements', icon: ScrollText },
  { to: '/reports',    label: 'Reports',    icon: FileBarChart2 },
  { to: '/settings',   label: 'Settings',   icon: Settings },
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
    subtitle: 'Construction OS',
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col justify-between bg-[#09090B] text-zinc-400 border-r border-white/[0.08] select-none transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Brand */}
          <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex-shrink-0">
                <HardHat className="w-4 h-4" />
              </span>
              <div className="leading-tight min-w-0">
                <p className="font-heading font-semibold text-sm text-zinc-100 tracking-tight truncate">
                  {profile.businessName || 'BuildLogic'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {profile.subtitle || 'Construction OS'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.06] lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Menu
            </p>
            {navItems.map(({ to, label, icon: Icon, end, matchPrefix }) => {
              const isMatchedPrefix = matchPrefix && location.pathname.startsWith(matchPrefix)
              return (
                <Magnetic key={to} strength={0.18} className="block w-full">
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => {
                      const active = isActive || isMatchedPrefix
                      return `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'text-zinc-100 bg-white/[0.06] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                          : 'text-zinc-400 border border-transparent hover:bg-white/[0.03] hover:text-zinc-100'
                      }`
                    }}
                  >
                    {({ isActive }) => {
                      const active = isActive || isMatchedPrefix
                      return (
                        <>
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-amber-500"
                            />
                          )}
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 transition-colors ${
                              active ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-200'
                            }`}
                          />
                          <span className="flex-1 whitespace-nowrap">{label}</span>
                        </>
                      )
                    }}
                  </NavLink>
                </Magnetic>
              )
            })}
          </nav>
        </div>

        {/* Bottom personal account card */}
        <div className="p-3 border-t border-white/[0.06]">
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-semibold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="leading-tight flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">
                {profile.ownerName || 'Business Owner'}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">Personal Business</p>
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
