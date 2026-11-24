import { Plus, FileSpreadsheet } from 'lucide-react'

/**
 * SectionTabs — Excel-style workbook sheet tabs.
 * Tab pills are strictly for switching sheets (Rename / Delete live in the toolbar menu).
 */
export default function SectionTabs({
  sections,
  activeSectionId,
  onSelect,
  onAddSection,
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
      {sections.map((sec) => {
        const isActive = sec.id === activeSectionId
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => onSelect(sec.id)}
            className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all select-none ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
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
        )
      })}

      {/* Add New Sheet Button */}
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
