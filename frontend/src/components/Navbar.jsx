import { Link, useLocation } from 'react-router-dom'
import { BookOpen, LayoutDashboard, Info, Home as HomeIcon } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/about', label: 'About', icon: Info },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl text-slate-900 hover:text-indigo-600 transition-colors">
          <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
            <BookOpen className="w-5 h-5" />
          </span>
          <span>Logbook</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
