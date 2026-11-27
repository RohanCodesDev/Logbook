import { Fragment, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Trash2, Search, Download, Plus, Pencil, Copy,
  CheckCircle2, Minus, Loader2, SlidersHorizontal,
  Table as TableIcon, LayoutList, IndianRupee, Hash, Calendar, Type, List, CheckSquare,
  Calculator, Sigma, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Filter, X, MoreVertical, FileSpreadsheet, Eye
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import ActionMenu from '../ui/ActionMenu'
import AnimatedDropdown, { AnimatedPortalMenu, AnimatedMenuItem } from '../ui/animated-dropdown'
import { Dock, DockIcon, DockItem, DockLabel } from '../ui/dock'
import SortModal from './SortModal'
import FilterModal from './FilterModal'
import TotalsModal from './TotalsModal'
import {
  CURRENCY_NAME_RE,
  formatHumanDate,
  formatPlainValue,
  getEffectiveCellValue,
  getRecordDateKey,
  groupRecordsByDate,
  isCurrencyField,
  isNumericColumn,
  buildDisplayLabels,
  resolveSortKind,
  sortRecords,
  filterRecords,
  computeSheetStats,
} from '../../utils/sheetUtils'

function getColumnWidthClass(fieldType) {
  switch (fieldType) {
    case 'date':
      return 'w-[126px] min-w-[116px] max-w-[136px]'
    case 'checkbox':
      return 'w-[92px] min-w-[84px] max-w-[100px]'
    case 'number':
    case 'currency':
    case 'formula':
      return 'w-[132px] min-w-[116px]'
    default:
      return 'min-w-[155px]'
  }
}

/**
 * Returns icon corresponding to column data type or semantic currency/number name
 */
function getFieldIcon(field) {
  if (!field) return <Type className="w-3 h-3 text-slate-400" />
  if (field.fieldType === 'formula') return <Calculator className="w-3 h-3 text-[#C97814]" />
  if (isCurrencyField(field)) return <IndianRupee className="w-3 h-3 text-emerald-600" />
  if (field.fieldType === 'number') return <Hash className="w-3 h-3 text-blue-600" />
  if (field.fieldType === 'date') return <Calendar className="w-3 h-3 text-[#E08A1E]" />
  if (field.fieldType === 'select') return <List className="w-3 h-3 text-purple-600" />
  if (field.fieldType === 'checkbox') return <CheckSquare className="w-3 h-3 text-teal-600" />
  return <Type className="w-3 h-3 text-slate-400" />
}

/**
 * Formats a field value cleanly for mobile cards & grid cells
 */
function formatDisplayValue(field, value) {
  if (field.fieldType === 'checkbox') {
    const isChecked = Boolean(value)
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          isChecked
            ? 'bg-[#DCFCE7] text-[#166534] ring-1 ring-[#BBF7D0]'
            : 'bg-[var(--bg-input)] text-slate-500'
        }`}
      >
        {isChecked ? <CheckCircle2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        <span>{isChecked ? 'Yes' : 'No'}</span>
      </span>
    )
  }

  const hasValue = value !== undefined && value !== null && String(value).trim() !== ''
  if (!hasValue) {
    return <span className="text-slate-300 text-xs">—</span>
  }

  if (field.fieldType === 'date') {
    return (
      <span className="text-[var(--text-primary)] font-medium tabular-nums">
        {formatHumanDate(value)}
      </span>
    )
  }

  if (field.fieldType === 'formula') {
    const num = Number(value)
    if (Number.isNaN(num)) return <span className="text-slate-300 text-xs">—</span>
    const isCurr = field.formula?.format === 'currency'
    return (
      <span className="font-semibold text-[#C97814] tabular-nums">
        {isCurr
          ? `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
          : num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'currency') {
    const num = Number(value)
    if (Number.isNaN(num)) return <span className="text-sm text-[var(--text-primary)]">{String(value)}</span>
    return (
      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
        ₹{num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'number') {
    const num = Number(value)
    if (Number.isNaN(num)) return <span className="text-sm text-[var(--text-primary)]">{String(value)}</span>
    return (
      <span className="font-medium text-[var(--text-primary)] tabular-nums">
        {num.toLocaleString('en-IN')}
      </span>
    )
  }

  if (
    field.fieldType === 'text' &&
    CURRENCY_NAME_RE.test(field.name) &&
    /^-?\d+(\.\d{1,2})?$/.test(String(value).trim())
  ) {
    const num = Number(String(value).trim())
    return (
      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
        ₹{num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'select') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEF6E9] text-[#92400E] text-xs font-semibold border border-[#FDE68A]">
        {value}
      </span>
    )
  }

  return <span className="text-[var(--text-primary)] break-words">{String(value)}</span>
}

/**
 * Fast inline cell editor / viewer for Excel Grid view
 */
function EditableCell({ field, value, onSave, onEditFormulaColumn }) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value ?? '')
  const inputRef = useRef(null)

  useEffect(() => {
    setTempVal(value ?? '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [isEditing])

  if (field.fieldType === 'formula') {
    return (
      <div
        onClick={() => onEditFormulaColumn?.(field.id)}
        title="Auto-calculated formula column (click to configure)"
        className="w-full min-h-[42px] px-3 py-2 flex items-center justify-between gap-2 cursor-pointer select-none text-sm bg-[#FEF6E9]/25 hover:bg-[#FEF6E9]/60 transition-colors"
      >
        {formatDisplayValue(field, value)}
      </div>
    )
  }

  const commitChange = (nextVal) => {
    setIsEditing(false)
    const valToSave = nextVal !== undefined ? nextVal : tempVal
    if (valToSave !== value) {
      onSave(valToSave)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitChange()
    } else if (e.key === 'Escape') {
      setTempVal(value ?? '')
      setIsEditing(false)
    }
  }

  if (field.fieldType === 'checkbox') {
    const isChecked = Boolean(value)
    return (
      <div
        className="w-full h-full flex items-center justify-center p-2 cursor-pointer select-none"
        onClick={() => onSave(!isChecked)}
      >
        {formatDisplayValue(field, value)}
      </div>
    )
  }

  if (isEditing) {
    if (field.fieldType === 'select') {
      return (
        <AnimatedDropdown
          defaultOpen={true}
          placeholder="Select..."
          value={tempVal}
          onChange={(nextVal) => {
            setTempVal(nextVal)
            commitChange(nextVal)
          }}
          onCloseComplete={() => setIsEditing(false)}
          options={[
            { value: '', label: '— Clear —' },
            ...(field.options || []).map((opt) => ({ value: opt, label: opt })),
          ]}
          buttonClassName="h-10 px-2 py-1 rounded bg-[#FEF6E9] border-[#E08A1E] text-sm"
        />
      )
    }

    if (field.fieldType === 'currency' || (field.fieldType === 'text' && CURRENCY_NAME_RE.test(field.name))) {
      return (
        <div className="relative flex items-center w-full">
          <span className="absolute left-2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
          <input
            ref={inputRef}
            type="number"
            step="any"
            inputMode="decimal"
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            onBlur={() => commitChange()}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className="w-full h-10 pl-6 pr-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-semibold border border-[#E08A1E] rounded focus:outline-none"
          />
        </div>
      )
    }

    if (field.fieldType === 'number') {
      return (
        <input
          ref={inputRef}
          type="number"
          step="any"
          inputMode="decimal"
          value={tempVal}
          onChange={(e) => setTempVal(e.target.value)}
          onBlur={() => commitChange()}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="w-full h-10 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
        />
      )
    }

    if (field.fieldType === 'date') {
      return (
        <input
          ref={inputRef}
          type="date"
          value={tempVal}
          onChange={(e) => {
            setTempVal(e.target.value)
            commitChange(e.target.value)
          }}
          onBlur={() => commitChange()}
          onKeyDown={handleKeyDown}
          className="w-full h-10 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
        />
      )
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={tempVal}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={() => commitChange()}
        onKeyDown={handleKeyDown}
        placeholder="Type here..."
        className="w-full h-10 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setIsEditing(true)
        }
      }}
      className="w-full min-h-[42px] px-3 py-2 flex items-center cursor-pointer transition-colors select-none text-sm rounded hover:bg-[#FEF6E9]/70 text-[var(--text-primary)]"
    >
      {formatDisplayValue(field, value)}
    </div>
  )
}

/**
 * Column Header with click-to-sort and hover-only Column Options menu (via body portal)
 */
function ColumnHeaderCell({
  field,
  index,
  totalCount,
  displayLabel,
  activeSort,
  hasFilter,
  onQuickSort,
  onOpenSortModal,
  onOpenFilterForColumn,
  onEditField,
  onMoveField,
  onDeleteField,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef(null)

  const effectiveKind = resolveSortKind(field, 'auto')
  const ascLabel = effectiveKind === 'numeric'
    ? 'Sort Low → High'
    : effectiveKind === 'date'
      ? 'Sort Oldest → Newest'
      : effectiveKind === 'checkbox'
        ? 'Sort Yes First'
        : 'Sort A → Z'
  const descLabel = effectiveKind === 'numeric'
    ? 'Sort High → Low'
    : effectiveKind === 'date'
      ? 'Sort Newest → Oldest'
      : effectiveKind === 'checkbox'
        ? 'Sort No First'
        : 'Sort Z → A'

  return (
    <th
      className={`group/th relative px-3 py-2.5 border-r border-[var(--border-subtle)] uppercase tracking-wider text-[11px] font-bold text-slate-700 whitespace-nowrap select-none ${getColumnWidthClass(field.fieldType)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onQuickSort(field)}
          className="inline-flex items-center gap-1.5 min-w-0 hover:text-[#C97814] transition-colors text-left"
          title="Click to sort by this column"
        >
          {getFieldIcon(field)}
          <span className="truncate">{displayLabel}</span>
          {field.isRequired && <span className="text-red-500 text-xs">*</span>}
          {activeSort?.direction === 'asc' && (
            <ArrowUp className="w-3 h-3 text-[#E08A1E] flex-shrink-0" />
          )}
          {activeSort?.direction === 'desc' && (
            <ArrowDown className="w-3 h-3 text-[#E08A1E] flex-shrink-0" />
          )}
          {hasFilter && (
            <Filter className="w-3 h-3 text-[#C97814] flex-shrink-0" />
          )}
        </button>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-[#E6E1D6]/70 transition-all flex-shrink-0 ${
            menuOpen ? 'opacity-100' : 'sm:opacity-0 sm:group-hover/th:opacity-100 focus-visible:opacity-100'
          }`}
          title="Column Options"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatedPortalMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={triggerRef}
        align="right"
        widthPx={192}
        className="font-normal normal-case tracking-normal text-left"
        onMenuClick={() => setMenuOpen(false)}
      >
        <AnimatedMenuItem
          onClick={() => onQuickSort(field, 'asc')}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
          <span>{ascLabel}</span>
        </AnimatedMenuItem>

        <AnimatedMenuItem
          onClick={() => onQuickSort(field, 'desc')}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          <span>{descLabel}</span>
        </AnimatedMenuItem>

        <AnimatedMenuItem
          onClick={() => onOpenSortModal(field.id)}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#E08A1E]" />
          <span>More Sort Kinds...</span>
        </AnimatedMenuItem>

        <AnimatedMenuItem
          onClick={() => onOpenFilterForColumn(field.id)}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter Column</span>
        </AnimatedMenuItem>

        <div className="my-1 border-t border-[var(--border-subtle)]" />

        <AnimatedMenuItem
          onClick={() => onEditField(field.id)}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span>Edit Column</span>
        </AnimatedMenuItem>

        {index > 0 && (
          <AnimatedMenuItem
            onClick={() => onMoveField(index, -1)}
            className="text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Move Left</span>
          </AnimatedMenuItem>
        )}

        {index < totalCount - 1 && (
          <AnimatedMenuItem
            onClick={() => onMoveField(index, 1)}
            className="text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span>Move Right</span>
          </AnimatedMenuItem>
        )}

        <div className="my-1 border-t border-[var(--border-subtle)]" />

        <AnimatedMenuItem
          onClick={() => {
            if (window.confirm(`Delete column "${field.name}"? Data in this column will be removed.`)) {
              onDeleteField(field.id)
            }
          }}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Column</span>
        </AnimatedMenuItem>
      </AnimatedPortalMenu>
    </th>
  )
}

/**
 * Slim center-aligned Date Group Banner:
 * Center: "27 Nov 2026 · Fri" + TODAY pill (clearly distinct from cell values)
 * Right: bold day subtotal ("₹78,542") + subtle "+" icon
 */
function DateGroupBanner({ group, onAddForDate }) {
  const { title, relativeTag, weekday, dateKey, stats } = group
  const primaryField = stats.summaryFields[0]
  const primarySummary = primaryField ? stats.byField[primaryField.id] : null
  const shortDay = weekday ? weekday.slice(0, 3) : ''

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5 py-2 select-none">
      {/* Left divider line */}
      <div className="flex items-center">
        <span className="h-px w-full bg-[var(--border-subtle)]/80" />
      </div>

      {/* Center-aligned Date pill */}
      <div className="inline-flex items-center justify-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-xs whitespace-nowrap">
        <Calendar className="w-3 h-3 text-[#E08A1E] flex-shrink-0" />
        <span className="font-heading text-xs font-bold text-[var(--text-primary)] tracking-tight">
          {title}{shortDay ? ` · ${shortDay}` : ''}
        </span>
        {relativeTag && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#FEF6E9] text-[#C97814] border border-[#FDE68A]">
            {relativeTag}
          </span>
        )}
      </div>

      {/* Right: divider line + Bold day total + subtle "+" icon */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        <span className="h-px flex-1 bg-[var(--border-subtle)]/80 hidden sm:block" />
        {primarySummary && (
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
            {primarySummary.isCurrency
              ? `₹${primarySummary.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : primarySummary.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        )}
        {onAddForDate && (
          <button
            type="button"
            onClick={() => onAddForDate(dateKey)}
            className="p-1 rounded-lg text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors flex-shrink-0"
            title={`Add entry for ${title}`}
            aria-label={`Add entry for ${title}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Mobile Stacked Entry Card — shows visible columns cleanly without repeating the group date.
 */
function MobileEntryCard({
  record,
  index,
  showSerial,
  fields,
  displayLabels,
  onEdit,
}) {
  const headlineField =
    fields.find((f) => f.fieldType === 'text' && !CURRENCY_NAME_RE.test(f.name)) ||
    fields.find((f) => f.fieldType === 'select') ||
    fields[0]

  const amountField =
    fields.find((f) => f.id !== headlineField?.id && f.fieldType === 'formula' && f.formula?.format === 'currency') ||
    fields.find((f) => f.id !== headlineField?.id && isCurrencyField(f)) ||
    fields.find((f) => f.id !== headlineField?.id && f.fieldType === 'number')

  const remainingFields = fields.filter(
    (f) => f.id !== headlineField?.id && f.id !== amountField?.id
  )

  const headlineVal = getEffectiveCellValue(headlineField, record.data, fields)
  const hasHeadline = headlineVal !== undefined && headlineVal !== null && String(headlineVal).trim() !== ''

  return (
    <div
      onClick={() => onEdit(record)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(record)
        }
      }}
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-3.5 shadow-xs active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            {showSerial && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-slate-600 text-[10px] font-bold tabular-nums uppercase">
                SL {String(index + 1).padStart(2, '0')}
              </span>
            )}
            {headlineField && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                {displayLabels[headlineField.id]}
              </span>
            )}
          </div>
          {headlineField && (
            <div className="text-sm font-bold text-[var(--text-primary)] truncate pt-0.5">
              {hasHeadline
                ? formatDisplayValue(headlineField, headlineVal)
                : <span className="text-slate-300 font-normal">Untitled entry</span>}
            </div>
          )}
        </div>

        {amountField && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {displayLabels[amountField.id]}
            </p>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {formatDisplayValue(amountField, getEffectiveCellValue(amountField, record.data, fields))}
            </div>
          </div>
        )}
      </div>

      {remainingFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-[var(--border-subtle)]">
          {remainingFields.map((f) => (
            <div key={f.id} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                {displayLabels[f.id]}
              </p>
              <div className="text-xs font-medium text-[var(--text-primary)] mt-0.5 truncate">
                {formatDisplayValue(f, getEffectiveCellValue(f, record.data, fields))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * RecordRegisterTable — Single-row Dock toolbar + quiet Excel Grid / Mobile Cards.
 */
export default function RecordRegisterTable({
  section,
  records,
  loading,
  onAddEntry,
  onEditEntry,
  onDuplicateRecord,
  onInlineUpdateRecord,
  onDeleteRecord,
  onDeleteField,
  onReorderFields,
  onCustomizeFields,
  onEditSection,
  onDeleteSection,
  deletingRecordId,
}) {
  const [search, setSearch]                 = useState('')
  const [sortLevels, setSortLevels]         = useState([])
  const [columnFilters, setColumnFilters]   = useState([])
  const [groupByDate, setGroupByDate]       = useState(true)
  const [viewModeOverride, setViewModeOverride] = useState(null)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  )

  const [sortModalOpen, setSortModalOpen]       = useState(false)
  const [sortSeedFieldId, setSortSeedFieldId]   = useState(null)
  const [filterModalOpen, setFilterModalOpen]   = useState(false)
  const [filterSeedFieldId, setFilterSeedFieldId] = useState(null)
  const [totalsModalOpen, setTotalsModalOpen]   = useState(false)

  // Floating Dock dropdowns (View & More ⋮) rendered cleanly via AnimatedPortalMenu
  const [viewMenuOpen, setViewMenuOpen]     = useState(false)
  const [sheetMenuOpen, setSheetMenuOpen]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const viewTriggerRef = useRef(null)
  const sheetTriggerRef = useRef(null)
  const tableScrollRef = useRef(null)

  const fields = section?.fields || []
  const effectiveView = viewModeOverride || (isMobileViewport ? 'cards' : 'grid')
  const displayLabels = useMemo(() => buildDisplayLabels(fields), [fields])

  // Auto-hide redundant Date column when By Date grouping is active
  const soleDateCol = fields.filter((f) => f.fieldType === 'date').length === 1
  const visibleFields = useMemo(
    () =>
      groupByDate
        ? fields.filter((f) => !(f.fieldType === 'date' && (/^date$/i.test(f.name.trim()) || soleDateCol)))
        : fields,
    [fields, groupByDate, soleDateCol]
  )

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setSearch('')
    setSortLevels([])
    setColumnFilters([])
  }, [section?.id])

  const processedRecords = useMemo(() => {
    const filtered = filterRecords(records, search, columnFilters, fields)
    return sortRecords(filtered, sortLevels, fields)
  }, [records, search, columnFilters, sortLevels, fields])

  const entryDateSort = sortLevels.find((l) => l.key === '__entryDate')
  const dateDirection = entryDateSort?.direction || 'desc'

  const dateGroups = useMemo(
    () => (groupByDate ? groupRecordsByDate(processedRecords, fields, dateDirection) : []),
    [groupByDate, processedRecords, fields, dateDirection]
  )

  const { summaryFields, byField: statsByField } = useMemo(
    () => computeSheetStats(processedRecords, fields),
    [processedRecords, fields]
  )

  const checkTableScroll = useCallback(() => {
    const el = tableScrollRef.current
    if (!el) {
      setCanScrollRight(false)
      return
    }
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
  }, [])

  useEffect(() => {
    checkTableScroll()
    window.addEventListener('resize', checkTableScroll)
    return () => window.removeEventListener('resize', checkTableScroll)
  }, [checkTableScroll, visibleFields.length, processedRecords.length, effectiveView])

  const handleCellChange = (record, fieldId, nextVal) => {
    const updatedData = {
      ...(record.data || {}),
      [String(fieldId)]: nextVal,
    }
    onInlineUpdateRecord(record.id, updatedData)
  }

  const handleQuickSort = (field, forcedDirection = null) => {
    const key = String(field.id)
    setSortLevels((prev) => {
      const existing = prev[0]
      if (forcedDirection) {
        return [{ key, kind: 'auto', direction: forcedDirection, blanks: 'last' }]
      }
      if (existing && String(existing.key) === key) {
        if (existing.direction === 'asc') {
          return [{ ...existing, direction: 'desc' }]
        }
        return []
      }
      return [{ key, kind: 'auto', direction: 'asc', blanks: 'last' }]
    })
  }

  const handleMoveField = async (visibleIdx, delta) => {
    if (!onReorderFields) return
    const targetField = visibleFields[visibleIdx]
    const swapField = visibleFields[visibleIdx + delta]
    if (!targetField || !swapField) return

    const idxA = fields.findIndex((f) => f.id === targetField.id)
    const idxB = fields.findIndex((f) => f.id === swapField.id)
    if (idxA === -1 || idxB === -1) return

    const ordered = [...fields]
    const tmp = ordered[idxA]
    ordered[idxA] = ordered[idxB]
    ordered[idxB] = tmp
    await onReorderFields(ordered.map((f) => f.id))
  }

  const handleExportCsv = () => {
    if (!fields.length || !processedRecords.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Entry Date', ...visibleFields.map((f) => esc(displayLabels[f.id]))].join(',')
    const rows = processedRecords.map((rec) =>
      [
        esc(formatHumanDate(getRecordDateKey(rec, fields))),
        ...visibleFields.map((f) => esc(formatPlainValue(f, getEffectiveCellValue(f, rec.data, fields)))),
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(section.name || 'register').toLowerCase().replace(/\s+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasActiveControls = sortLevels.length > 0 || columnFilters.length > 0 || Boolean(search.trim())
  const totalGridCols = visibleFields.length + (groupByDate ? 0 : 1) + 1 // optional SL + visibleFields + Actions

  return (
    <div className="relative">
      {/* ─── Single Clean Toolbar Row (Search Left + Dock Toolbar Right) ─── */}
      <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        {fields.length > 0 && records.length > 0 ? (
          <div className="relative flex items-center flex-1 sm:max-w-xs min-w-0">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${section.name}...`}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:bg-[var(--bg-card)] transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-[#E08A1E] flex-shrink-0" />
            <span className="text-sm font-bold text-[var(--text-primary)] truncate">{section.name}</span>
          </div>
        )}

        {/* Right: Apple-style Framer Motion Dock Toolbar */}
        <div className="flex-shrink-0">
          <Dock>
            {fields.length > 0 && (
              <>
                {/* Filter */}
                <DockItem
                  ariaLabel="Filter entries"
                  onClick={() => {
                    setFilterSeedFieldId(null)
                    setFilterModalOpen(true)
                  }}
                  className={
                    columnFilters.length > 0
                      ? 'bg-[#1E242B] text-[#F2A649]'
                      : 'bg-[var(--bg-card)] text-slate-600 hover:text-[var(--text-primary)]'
                  }
                >
                  <DockLabel>
                    {columnFilters.length > 0 ? `Filter (${columnFilters.length})` : 'Filter'}
                  </DockLabel>
                  <DockIcon>
                    <div className="relative w-full h-full flex items-center justify-center">
                      <Filter className="w-full h-full" />
                      {columnFilters.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#E08A1E]" />
                      )}
                    </div>
                  </DockIcon>
                </DockItem>

                {/* View Menu (By Date + Card/Grid + Sort) */}
                <span ref={viewTriggerRef} className="inline-flex">
                  <DockItem
                    ariaLabel="View options"
                    onClick={() => {
                      setSheetMenuOpen(false)
                      setViewMenuOpen((prev) => !prev)
                    }}
                    className={
                      viewMenuOpen
                        ? 'bg-[#1E242B] text-white'
                        : 'bg-[var(--bg-card)] text-slate-600 hover:text-[var(--text-primary)]'
                    }
                  >
                    <DockLabel>View</DockLabel>
                    <DockIcon>
                      <Eye className="w-full h-full" />
                    </DockIcon>
                  </DockItem>
                </span>
              </>
            )}

            {/* + Add Entry (or + Column if 0 columns) */}
            <DockItem
              ariaLabel={fields.length > 0 ? 'Add entry' : 'Add column'}
              onClick={() => (fields.length > 0 ? onAddEntry() : onCustomizeFields(null))}
              className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] shadow-xs"
            >
              <DockLabel>{fields.length > 0 ? 'Add Entry' : 'Add Column'}</DockLabel>
              <DockIcon>
                <Plus className="w-full h-full stroke-[2.4]" />
              </DockIcon>
            </DockItem>

            {/* More (⋮) -> Columns, Totals, Export CSV, Rename, Delete */}
            <span ref={sheetTriggerRef} className="inline-flex">
              <DockItem
                ariaLabel="Sheet options"
                onClick={() => {
                  setViewMenuOpen(false)
                  setSheetMenuOpen((prev) => !prev)
                }}
                className={
                  sheetMenuOpen
                    ? 'bg-[#1E242B] text-white'
                    : 'bg-[var(--bg-card)] text-slate-600 hover:text-[var(--text-primary)]'
                }
              >
                <DockLabel>More</DockLabel>
                <DockIcon>
                  <MoreVertical className="w-full h-full" />
                </DockIcon>
              </DockItem>
            </span>
          </Dock>
        </div>
      </div>

      {/* View Animated Dropdown Portal */}
      <AnimatedPortalMenu
        open={viewMenuOpen}
        onClose={() => setViewMenuOpen(false)}
        anchorRef={viewTriggerRef}
        align="right"
        widthPx={208}
      >
        <AnimatedMenuItem
          onClick={() => setGroupByDate((prev) => !prev)}
          className="justify-between text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <span className="inline-flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#E08A1E]" />
            <span>Group by Date</span>
          </span>
          <span
            className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
              groupByDate ? 'bg-[#E08A1E] justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
          </span>
        </AnimatedMenuItem>

        <AnimatedMenuItem
          onClick={() => {
            setViewModeOverride(effectiveView === 'cards' ? 'grid' : 'cards')
            setViewMenuOpen(false)
          }}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          {effectiveView === 'cards'
            ? <TableIcon className="w-3.5 h-3.5 text-slate-500" />
            : <LayoutList className="w-3.5 h-3.5 text-slate-500" />
          }
          <span>{effectiveView === 'cards' ? 'Switch to Grid View' : 'Switch to Card View'}</span>
        </AnimatedMenuItem>

        <div className="my-1 border-t border-[var(--border-subtle)]" />

        <AnimatedMenuItem
          onClick={() => {
            setViewMenuOpen(false)
            setSortSeedFieldId(null)
            setSortModalOpen(true)
          }}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span>Sort Options...</span>
        </AnimatedMenuItem>
      </AnimatedPortalMenu>

      {/* More (⋮) Sheet Animated Dropdown Portal */}
      <AnimatedPortalMenu
        open={sheetMenuOpen}
        onClose={() => setSheetMenuOpen(false)}
        anchorRef={sheetTriggerRef}
        align="right"
        widthPx={192}
        onMenuClick={() => setSheetMenuOpen(false)}
      >
        <AnimatedMenuItem
          onClick={() => onCustomizeFields(null)}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#E08A1E]" />
          <span>Columns</span>
        </AnimatedMenuItem>

        {fields.length > 0 && (
          <AnimatedMenuItem
            onClick={() => setTotalsModalOpen(true)}
            className="text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <Sigma className="w-3.5 h-3.5 text-slate-400" />
            <span>Totals & Averages</span>
          </AnimatedMenuItem>
        )}

        {processedRecords.length > 0 && (
          <AnimatedMenuItem
            onClick={handleExportCsv}
            className="text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </AnimatedMenuItem>
        )}

        <div className="my-1 border-t border-[var(--border-subtle)]" />

        <AnimatedMenuItem
          onClick={() => onEditSection(section)}
          className="text-slate-700 hover:bg-[var(--bg-input)]"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span>Rename Sheet</span>
        </AnimatedMenuItem>

        <AnimatedMenuItem
          onClick={() => onDeleteSection(section)}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Sheet</span>
        </AnimatedMenuItem>
      </AnimatedPortalMenu>

      {/* ─── Active Sort & Filter Summary Pills ─────────────────────── */}
      {hasActiveControls && records.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 sm:px-6 py-2 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] text-xs">
          {sortLevels.map((lvl, idx) => {
            const f = fields.find((x) => String(x.id) === String(lvl.key))
            const label = f
              ? (displayLabels[f.id] || f.name)
              : lvl.key === '__entryDate'
                ? 'Entry Date'
                : lvl.key === '__updatedAt'
                  ? 'Updated'
                  : 'Created'
            return (
              <span
                key={`sort-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium"
              >
                <ArrowUpDown className="w-3 h-3 text-[#E08A1E]" />
                <span>{label} ({lvl.direction === 'desc' ? '↓' : '↑'})</span>
                <button
                  type="button"
                  onClick={() => setSortLevels((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-slate-700 ml-0.5"
                  aria-label="Remove sort"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}

          {columnFilters.map((rule, idx) => {
            const f = fields.find((x) => String(x.id) === String(rule.fieldId))
            const label = rule.fieldId === '__entryDate'
              ? 'Entry Date'
              : (f ? (displayLabels[f.id] || f.name) : 'Column')
            const desc = rule.op === 'in'
              ? (rule.values || []).join(', ')
              : rule.op === 'between'
                ? `${rule.value || '…'} – ${rule.value2 || '…'}`
                : rule.value || rule.op.replace('_', ' ')
            return (
              <span
                key={`filter-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF6E9] border border-[#FDE68A] text-[#92400E] font-medium"
              >
                <Filter className="w-3 h-3" />
                <span>{label}: {desc}</span>
                <button
                  type="button"
                  onClick={() => setColumnFilters((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-[#92400E]/70 hover:text-[#92400E] ml-0.5"
                  aria-label="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}

          <button
            type="button"
            onClick={() => {
              setSearch('')
              setSortLevels([])
              setColumnFilters([])
            }}
            className="text-[11px] font-semibold text-slate-500 hover:text-[#C97814] px-2 py-0.5 underline"
          >
            Reset all
          </button>
        </div>
      )}

      {/* ─── Content Body ───────────────────────────────────────────── */}
      {fields.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title={`No columns in ${section.name} yet`}
          description="Add your first column (such as Item, Qty, Rate, or Total) to start logging entries."
          action={
            <Button variant="primary" onClick={() => onCustomizeFields(null)}>
              <Plus className="w-4 h-4" />
              Add Columns
            </Button>
          }
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading entries...
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={`No entries in ${section.name} yet`}
          description={`Start logging records across your ${fields.length} ${fields.length === 1 ? 'column' : 'columns'}.`}
          action={
            <Button variant="primary" onClick={() => onAddEntry()}>
              <Plus className="w-4 h-4" />
              Add First Entry
            </Button>
          }
        />
      ) : processedRecords.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching entries"
          description="No entries match your active search or column filters."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setColumnFilters([])
              }}
            >
              Clear Search & Filters
            </Button>
          }
        />
      ) : (
        <>
          {effectiveView === 'cards' ? (
            /* ─── Mobile / Card View ─────────────────────────────────── */
            <div className="p-3.5 sm:p-5 space-y-4 bg-[var(--bg-canvas)]/70">
              {groupByDate ? (
                dateGroups.map((group) => (
                  <section key={group.dateKey} className="space-y-2.5">
                    <div className="rounded-xl bg-[var(--bg-input)]/70 border border-[var(--border-subtle)]">
                      <DateGroupBanner group={group} onAddForDate={onAddEntry} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group.records.map((rec, idx) => (
                        <MobileEntryCard
                          key={rec.id}
                          record={rec}
                          index={idx}
                          showSerial={false}
                          fields={visibleFields}
                          displayLabels={displayLabels}
                          onEdit={onEditEntry}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {processedRecords.map((rec, idx) => (
                    <MobileEntryCard
                      key={rec.id}
                      record={rec}
                      index={idx}
                      showSerial={true}
                      fields={visibleFields}
                      displayLabels={displayLabels}
                      onEdit={onEditEntry}
                    />
                  ))}
                </div>
              )}

              {/* Default Totals summary strip when numeric/currency columns exist */}
              {summaryFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTotalsModalOpen(true)}
                  className="flex flex-wrap items-center gap-3 px-1 pt-1 text-[11px] text-slate-500 font-medium text-left hover:text-[#C97814] transition-colors"
                >
                  {summaryFields.map((f) => {
                    const s = statsByField[f.id]
                    if (!s) return null
                    return (
                      <span key={f.id} className="tabular-nums">
                        Total {displayLabels[f.id]}:{' '}
                        <strong className="text-[var(--text-primary)] font-semibold">
                          {s.isCurrency
                            ? `₹${s.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                            : s.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                    )
                  })}
                </button>
              )}
            </div>
          ) : (
            /* ─── Quiet Excel Spreadsheet Grid View ──────────────────── */
            <div className="relative">
              <div
                ref={tableScrollRef}
                onScroll={checkTableScroll}
                className="overflow-x-auto"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-input)]/75 text-slate-600 border-b border-[var(--border-subtle)] text-xs font-bold select-none">
                      {!groupByDate && (
                        <th className="sticky left-0 z-20 bg-[var(--bg-input)] px-3 py-2.5 w-12 text-center border-r border-[var(--border-subtle)] text-slate-500 text-[11px] uppercase tracking-wider tabular-nums">
                          SL
                        </th>
                      )}

                      {visibleFields.map((f, idx) => {
                        const activeSort = sortLevels[0] && String(sortLevels[0].key) === String(f.id)
                          ? sortLevels[0]
                          : null
                        const hasFilter = columnFilters.some((r) => String(r.fieldId) === String(f.id))
                        return (
                          <ColumnHeaderCell
                            key={f.id}
                            field={f}
                            index={idx}
                            totalCount={visibleFields.length}
                            displayLabel={displayLabels[f.id]}
                            activeSort={activeSort}
                            hasFilter={hasFilter}
                            onQuickSort={handleQuickSort}
                            onOpenSortModal={(fid) => {
                              setSortSeedFieldId(fid)
                              setSortModalOpen(true)
                            }}
                            onOpenFilterForColumn={(fid) => {
                              setFilterSeedFieldId(fid)
                              setFilterModalOpen(true)
                            }}
                            onEditField={(fid) => onCustomizeFields(fid)}
                            onMoveField={handleMoveField}
                            onDeleteField={onDeleteField}
                          />
                        )
                      })}

                      <th className="px-2 py-2.5 w-20 sm:w-24 text-right text-[11px] uppercase tracking-wider text-slate-400" />
                    </tr>
                  </thead>

                  <tbody>
                    {(groupByDate
                      ? dateGroups
                      : [{ dateKey: '__all', records: processedRecords }]
                    ).map((group) => (
                      <Fragment key={group.dateKey}>
                        {groupByDate && (
                          <tr className="bg-[var(--bg-canvas)] border-y border-[var(--border-subtle)]">
                            <td colSpan={totalGridCols} className="p-0">
                              <div className="sticky left-0 max-w-[calc(100vw-2.25rem)] sm:max-w-full">
                                <DateGroupBanner group={group} onAddForDate={onAddEntry} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {group.records.map((rec, idx) => {
                          const isDeleting = deletingRecordId === rec.id
                          const isEven = idx % 2 === 1
                          const mobileActions = [
                            ...(onDuplicateRecord
                              ? [{
                                  label: 'Duplicate',
                                  icon: Copy,
                                  onClick: () => onDuplicateRecord(rec.data, getRecordDateKey(rec, fields)),
                                }]
                              : []),
                            {
                              label: 'Edit Entry',
                              icon: Pencil,
                              onClick: () => onEditEntry(rec),
                            },
                            {
                              label: isDeleting ? 'Deleting...' : 'Delete',
                              icon: isDeleting ? Loader2 : Trash2,
                              danger: true,
                              dividerBefore: true,
                              disabled: isDeleting,
                              onClick: () => onDeleteRecord(rec),
                            },
                          ]

                          return (
                            <tr
                              key={rec.id}
                              className={`group border-b border-[var(--border-subtle)] last:border-b-0 transition-colors ${
                                isEven ? 'bg-[#F6F4EF]/50' : 'bg-[var(--bg-card)]'
                              } hover:bg-[#FEF6E9]/55`}
                            >
                              {!groupByDate && (
                                <td
                                  className={`sticky left-0 z-10 px-3 py-2 text-center border-r border-[var(--border-subtle)] text-xs font-bold tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                                    isEven ? 'bg-[#F6F4EF]' : 'bg-[var(--bg-card)]'
                                  } group-hover:bg-[#FEF6E9]`}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </td>
                              )}

                              {visibleFields.map((f) => (
                                <td
                                  key={f.id}
                                  className={`p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle ${getColumnWidthClass(f.fieldType)}`}
                                >
                                  <EditableCell
                                    field={f}
                                    value={getEffectiveCellValue(f, rec.data, fields)}
                                    onSave={(nextVal) => handleCellChange(rec, f.id, nextVal)}
                                    onEditFormulaColumn={(fid) => onCustomizeFields(fid)}
                                  />
                                </td>
                              ))}

                              {/* Quiet row actions: hover-only on desktop, single ⋮ on mobile */}
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                <div className="hidden sm:inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  {onDuplicateRecord && (
                                    <button
                                      type="button"
                                      onClick={() => onDuplicateRecord(rec.data, getRecordDateKey(rec, fields))}
                                      className="p-1.5 rounded text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors"
                                      title="Duplicate Row"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onEditEntry(rec)}
                                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-[var(--bg-input)] transition-colors"
                                    title="Edit Entry"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => onDeleteRecord(rec)}
                                    className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Entry"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                <div className="sm:hidden inline-flex">
                                  <ActionMenu items={mobileActions} label="Row actions" />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right-edge scroll hint gradient when grid overflows horizontally */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FCFBF8]/95 via-[#FCFBF8]/60 to-transparent z-20"
                />
              )}
            </div>
          )}
        </>
      )}

      <SortModal
        open={sortModalOpen}
        onClose={() => setSortModalOpen(false)}
        fields={fields}
        displayLabels={displayLabels}
        sortLevels={
          sortSeedFieldId && !sortLevels.length
            ? [{ key: String(sortSeedFieldId), kind: 'auto', direction: 'asc', blanks: 'last' }]
            : sortLevels
        }
        onApply={setSortLevels}
      />

      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        fields={fields}
        displayLabels={displayLabels}
        filters={columnFilters}
        initialFieldId={filterSeedFieldId}
        onApply={setColumnFilters}
      />

      <TotalsModal
        open={totalsModalOpen}
        onClose={() => setTotalsModalOpen(false)}
        sectionName={section?.name || ''}
        records={processedRecords}
        totalRecordsCount={records.length}
        fields={fields}
        displayLabels={displayLabels}
      />
    </div>
  )
}
