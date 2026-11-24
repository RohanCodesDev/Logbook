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
                ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-sm font-semibold'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[#D6CFC2] hover:bg-[var(--bg-input)]'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isActive ? 'text-[#E08A1E]' : 'text-slate-400'}`} />
            <span>{sec.name}</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums font-bold ${
                isActive ? 'bg-[#2B333C] text-[#F5BD6E]' : 'bg-[var(--bg-input)] text-slate-600'
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
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#D6CFC2] hover:border-[#E08A1E] bg-[var(--bg-card)] hover:bg-[#FEF6E9] text-slate-600 hover:text-[#C97814] text-xs sm:text-sm font-semibold transition-colors"
        title="Add New Sheet / Section"
      >
        <Plus className="w-3.5 h-3.5 text-[#E08A1E]" />
        <span>New Sheet</span>
      </button>
    </div>
  )
}
