import { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Menu, Pencil, Plus } from 'lucide-react'
import Button from '../ui/Button'
import { Magnetic } from '../ui/Magnetic'

const routeLabels = {
  '/':           'Dashboard',
  '/projects':   'Your Projects',
  '/crew':       'Workforce',
  '/agreements': 'Agreements',
  '/reports':    'Reports',
  '/settings':   'Settings',
}

export default function TopBar({ actions = null, customTitle = null, onRenameTitle = null, onOpenMenu, onOpenQuickLog }) {
  const location = useLocation()
  const isWorkspace = location.pathname.startsWith('/projects/')
  const isAgreementDetail = location.pathname.startsWith('/agreements/')
  const isDetailPage = isWorkspace || isAgreementDetail
  const currentLabel =
    customTitle ||
    (isWorkspace
      ? 'Project Workspace'
      : isAgreementDetail
        ? 'Agreement Section'
        : routeLabels[location.pathname] ?? 'Overview')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(currentLabel)
  const inputRef = useRef(null)

  useEffect(() => {
    setDraft(currentLabel)
    setEditing(false)
  }, [currentLabel, location.pathname])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitRename = async () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (!trimmed || trimmed === currentLabel || !onRenameTitle) {
      setDraft(currentLabel)
      return
    }
    try {
      await onRenameTitle(trimmed)
    } catch {
      setDraft(currentLabel)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 h-14 sm:h-16 px-4 sm:px-6 lg:px-8 liquid-glass-light">
      {/* Left: Menu trigger on mobile + Minimal Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!isDetailPage && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 rounded-xl text-slate-600 hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {isDetailPage && (
          <Link
            to={isWorkspace ? '/projects' : '/agreements'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-input)] text-slate-600 hover:bg-[#E6E1D6] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            title={isWorkspace ? 'Back to Your Projects' : 'Back to Agreements'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span className="text-slate-400 font-medium hidden sm:inline">Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline flex-shrink-0" />
          {isDetailPage && (
            <>
              <Link
                to={isWorkspace ? '/projects' : '/agreements'}
                className="text-slate-500 hover:text-slate-900 font-medium transition-colors hidden sm:inline"
              >
                {isWorkspace ? 'Projects' : 'Agreements'}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline flex-shrink-0" />
            </>
          )}

          {onRenameTitle && editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraft(currentLabel)
                  setEditing(false)
                }
              }}
              className="px-2 py-1 text-base font-bold text-[var(--text-primary)] bg-[var(--bg-input)] border border-[#E08A1E] rounded-lg focus:outline-none min-w-[140px] max-w-xs"
            />
          ) : onRenameTitle ? (
            <button
              type="button"
              onClick={() => {
                setDraft(currentLabel)
                setEditing(true)
              }}
              title="Click to rename"
              className="group inline-flex items-center gap-1.5 text-base font-bold text-slate-900 hover:text-[#C97814] truncate rounded-lg px-1.5 py-0.5 -ml-1.5 hover:bg-[var(--bg-input)]/70 transition-colors min-w-0"
            >
              <span className="truncate">{currentLabel}</span>
              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ) : (
            <h1 className="text-base font-bold text-slate-900 truncate">{currentLabel}</h1>
          )}
        </nav>
      </div>

      {/* Right: Contextual Page Actions + Global + Log Spend */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {onOpenQuickLog && !isDetailPage && (
          <Magnetic strength={0.18}>
            <Button variant="obsidian" size="sm" onClick={onOpenQuickLog}>
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Log Spend</span>
            </Button>
          </Magnetic>
        )}
      </div>
    </header>
  )
}
