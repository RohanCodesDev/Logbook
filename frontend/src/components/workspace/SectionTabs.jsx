import { Plus, Pencil, Trash2, FileSpreadsheet } from 'lucide-react'

/**
 * SectionTabs — Excel-style workbook sheet tabs.
 * Clean, compact, swipeable tabs with a "+ Sheet" tab button.
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
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
      {sections.map((sec) => {
        const isActive = sec.id === activeSectionId
        return (
          <div
            key={sec.id}
            className={`flex-shrink-0 inline-flex items-center rounded-xl border text-sm transition-all select-none ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(sec.id)}
              className="inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{sec.name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums font-bold ${
                  isActive ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-500'
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
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Rename Sheet"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSection(sec)}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  title="Delete Sheet"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Excel "+ Sheet" Button */}
      <button
        type="button"
        onClick={onAddSection}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-slate-600 hover:text-amber-700 text-xs sm:text-sm font-semibold transition-colors"
        title="Add New Sheet / Section"
      >
        <Plus className="w-3.5 h-3.5 text-amber-500" />
        <span>New Sheet</span>
      </button>
    </div>
  )
}
