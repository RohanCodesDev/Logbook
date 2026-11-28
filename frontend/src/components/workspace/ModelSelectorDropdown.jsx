import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Check, Search, Plus, X, Truck, Wrench } from 'lucide-react'

/**
 * ModelSelectorDropdown — Searchable portal dropdown placed at the top-right
 * of the sheet tabs row for filtering & adding Machine / Hyva models inside a single sheet.
 */
export default function ModelSelectorDropdown({
  isHyva = false,
  selectedModel = '',
  models = [],
  countsByModel = {},
  onSelectModel,
  onAddModel,
  onRemoveModel,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [newModel, setNewModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [pos, setPos] = useState(null)

  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const searchInputRef = useRef(null)

  const Icon = isHyva ? Truck : Wrench
  const allLabel = isHyva ? 'All Hyvas' : 'All Machines'
  const nounSingular = isHyva ? 'Hyva / Model' : 'Model'

  const computePos = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const width = 276
    const rawLeft = rect.right - width
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8))
    const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 80))
    return { top, left, width }
  }

  const toggleOpen = () => {
    if (open) {
      setOpen(false)
      return
    }
    const nextPos = computePos()
    if (nextPos) setPos(nextPos)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const updateOnResize = () => {
      const nextPos = computePos()
      if (nextPos) setPos(nextPos)
    }
    const timer = setTimeout(() => searchInputRef.current?.focus(), 40)
    const onOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updateOnResize)
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('keydown', onEsc)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateOnResize)
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => m.toLowerCase().includes(q))
  }, [models, query])

  const handleAdd = async (e) => {
    e?.preventDefault()
    const clean = newModel.trim()
    if (!clean || saving) return
    setSaving(true)
    try {
      await onAddModel?.(clean)
      setNewModel('')
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Show machine/hyva count when viewing "All", or that machine's entry count when a model is selected
  const activeBadgeCount = selectedModel
    ? (countsByModel[selectedModel] ?? 0)
    : models.length

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        title={`Select ${nounSingular} records to view`}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          selectedModel
            ? 'bg-[#18181B] text-white border-[#18181B] shadow-sm'
            : 'bg-[var(--bg-card)] text-zinc-800 border-[var(--border-subtle)] hover:border-[#D6CFC2] hover:bg-[var(--bg-input)]'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${selectedModel ? 'text-amber-400' : 'text-[#E08A1E]'}`} />
        <span className="max-w-[160px] truncate">
          {selectedModel || allLabel}
        </span>
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums font-bold ${
            selectedModel ? 'bg-white/15 text-amber-300' : 'bg-[var(--bg-input)] text-slate-600'
          }`}
        >
          {activeBadgeCount}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''} ${selectedModel ? 'text-zinc-400' : 'text-slate-400'}`} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                style={{ top: pos.top, left: pos.left, width: pos.width, transformOrigin: 'top right' }}
                className="fixed z-[9999] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
              >
                {/* Search box for 20-30+ models */}
                <div className="p-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search ${models.length} ${isHyva ? 'hyvas' : 'models'}...`}
                      className="w-full h-8 pl-8 pr-7 rounded-lg bg-white border border-[var(--border-subtle)] text-xs text-zinc-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E08A1E]"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Model Options List */}
                <div className="max-h-60 overflow-y-auto py-1">
                  {!query.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectModel('')
                        setOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                        selectedModel === ''
                          ? 'bg-[#FEF6E9] text-[#92400E]'
                          : 'text-zinc-800 hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Check className={`w-3.5 h-3.5 ${selectedModel === '' ? 'text-[#E08A1E]' : 'opacity-0'}`} />
                        <span>{allLabel}</span>
                      </span>
                      <span className="text-[11px] tabular-nums text-zinc-500">
                        {models.length} {isHyva ? (models.length === 1 ? 'hyva' : 'hyvas') : (models.length === 1 ? 'machine' : 'machines')}
                      </span>
                    </button>
                  )}

                  {filteredModels.length === 0 ? (
                    <div className="px-3.5 py-4 text-center text-xs text-slate-400">
                      {models.length === 0
                        ? `No ${isHyva ? 'hyvas' : 'models'} added yet.`
                        : `No match for "${query}"`}
                    </div>
                  ) : (
                    filteredModels.map((modelName) => {
                      const isActive = selectedModel === modelName
                      const count = countsByModel[modelName] ?? 0
                      return (
                        <div
                          key={modelName}
                          className={`group flex items-center justify-between gap-1 px-2 py-0.5 ${
                            isActive ? 'bg-[#FEF6E9]' : 'hover:bg-[var(--bg-input)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectModel(modelName)
                              setOpen(false)
                            }}
                            className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-1.5 py-1.5 text-xs text-left cursor-pointer ${
                              isActive ? 'font-bold text-[#92400E]' : 'font-medium text-zinc-800'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#E08A1E]' : 'opacity-0'}`} />
                              <span className="truncate">{modelName}</span>
                            </span>
                            <span className="text-[11px] tabular-nums text-zinc-500 flex-shrink-0">
                              {count}
                            </span>
                          </button>

                          {onRemoveModel && count === 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onRemoveModel(modelName)
                              }}
                              title={`Remove ${modelName}`}
                              className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Inline + Add New Model */}
                <form
                  onSubmit={handleAdd}
                  className="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder={`Add ${nounSingular}...`}
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-white border border-[var(--border-subtle)] text-xs text-zinc-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E08A1E]"
                  />
                  <button
                    type="submit"
                    disabled={!newModel.trim() || saving}
                    className="h-8 px-2.5 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Add</span>
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
