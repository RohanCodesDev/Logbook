import { Plus, FileSpreadsheet } from 'lucide-react'

const FLEET_SHEET_RE = /\b(machines?|machinery|equipments?|hyvas?|tippers?|dumpers?|vehicles?|trucks?|excavators?|loaders?|cranes?|rollers?|jcb|fleet)\b/i

/**
 * SectionTabs — Excel-style workbook sheet tabs.
 * Tab pills are strictly for switching sheets (Rename / Delete live in the toolbar menu).
 */
export default function SectionTabs({
  sections,
  activeSectionId,
  activeFleetModelCount = null,
  onSelect,
  onAddSection,
  rightSlot = null,
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 pb-1 pt-0.5">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
        {sections.map((sec) => {
          const isActive = sec.id === activeSectionId
          const isFleet = FLEET_SHEET_RE.test(sec.name || '') || (sec.models?.length || 0) > 0
          const badgeCount = isFleet
            ? (isActive && activeFleetModelCount !== null ? activeFleetModelCount : (sec.modelCount ?? sec.models?.length ?? 0))
            : (sec.recordCount ?? 0)
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => onSelect(sec.id)}
              className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all select-none cursor-pointer ${
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
                {badgeCount}
              </span>
            </button>
          )
        })}

        {/* Add New Sheet Button */}
        <button
          type="button"
          onClick={onAddSection}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#D6CFC2] hover:border-[#E08A1E] bg-[var(--bg-card)] hover:bg-[#FEF6E9] text-slate-600 hover:text-[#C97814] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          title="Add New Sheet / Section"
        >
          <Plus className="w-3.5 h-3.5 text-[#E08A1E]" />
          <span>New Sheet</span>
        </button>
      </div>

      {rightSlot && (
        <div className="flex-shrink-0">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
