import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import Button from '../ui/Button'

/**
 * SectionTabs — Scrollable horizontal tabs on mobile, wrapping tabs on desktop.
 */
export default function SectionTabs({
  sections,
  activeSectionId,
  onSelect,
  onAddSection,
  onEditSection,
  onDeleteSection,
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-1">
      {sections.map((sec) => {
        const isActive = sec.id === activeSectionId
        return (
          <div
            key={sec.id}
            className={`flex-shrink-0 inline-flex items-center rounded-xl border transition-all ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(sec.id)}
              className="inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 text-sm font-medium whitespace-nowrap"
            >
              <Layers className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{sec.name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums font-semibold ${
                  isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {sec.recordCount ?? 0}
              </span>
            </button>

            {isActive && (
              <div className="flex items-center pr-1.5 gap-0.5 border-l border-slate-700/80 pl-1">
                <button
                  type="button"
                  onClick={() => onEditSection(sec)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Rename Section"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSection(sec)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  title="Delete Section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={onAddSection}
        className="flex-shrink-0 rounded-xl border-dashed whitespace-nowrap"
      >
        <Plus className="w-3.5 h-3.5" />
        New Section
      </Button>
    </div>
  )
}
