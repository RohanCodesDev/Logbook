import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Menu } from 'lucide-react'

const routeLabels = {
  '/':         'Dashboard',
  '/projects': 'Your Projects',
  '/reports':  'Reports',
  '/settings': 'Settings',
}

export default function TopBar({ actions = null, customTitle = null, onOpenMenu }) {
  const location = useLocation()
  const isWorkspace = location.pathname.startsWith('/projects/')
  const currentLabel = customTitle || (isWorkspace ? 'Project Workspace' : routeLabels[location.pathname] ?? 'Overview')

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 h-14 sm:h-16 px-4 sm:px-6 lg:px-8 bg-[#FCFBF8]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
      {/* Left: Menu trigger on mobile + Minimal Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {!isWorkspace && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 rounded-xl text-slate-600 hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {isWorkspace && (
          <Link
            to="/projects"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-input)] text-slate-600 hover:bg-[#E6E1D6] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            title="Back to Your Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-slate-400 font-medium hidden sm:inline">Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline flex-shrink-0" />
          {isWorkspace && (
            <>
              <Link
                to="/projects"
                className="text-slate-500 hover:text-slate-900 font-medium transition-colors hidden sm:inline"
              >
                Projects
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline flex-shrink-0" />
            </>
          )}
          <h1 className="text-base font-bold text-slate-900 truncate">{currentLabel}</h1>
        </nav>
      </div>

      {/* Right: Contextual Page Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
      </div>
    </header>
  )
}
