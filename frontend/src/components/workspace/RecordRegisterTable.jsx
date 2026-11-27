import { Fragment, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Trash2, Search, Download, Plus, Pencil, Copy, Check, Maximize2,
  CheckCircle2, Minus, Loader2, SlidersHorizontal,
  Table as TableIcon, LayoutList, IndianRupee, Hash, Calendar, Type, List, CheckSquare,
  Calculator, Sigma, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Filter, X, MoreVertical, FileSpreadsheet, Eye, ChevronDown, ChevronRight, Upload, Printer
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import ActionMenu from '../ui/ActionMenu'
import AnimatedDropdown, { AnimatedPortalMenu, AnimatedMenuItem } from '../ui/animated-dropdown'
import { Dock, DockIcon, DockItem, DockLabel } from '../ui/dock'
import SortModal from './SortModal'
import FilterModal from './FilterModal'
import TotalsModal from './TotalsModal'
import CsvImportModal from './CsvImportModal'
import {
  CURRENCY_NAME_RE,
  evaluateFormulaValue,
  formatDateGroupMeta,
  formatHumanDate,
  formatPlainValue,
  getEffectiveCellValue,
  getRecordDateKey,
  getTodayYmd,
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
 * Fast inline cell editor / viewer for Excel Grid view (with Tab / Shift+Tab navigation)
 */
function EditableCell({
  field,
  value,
  onSave,
  onEditFormulaColumn,
  forceEdit = false,
  onStartEdit,
  onStopEdit,
  onTabNavigate,
}) {
  const [localEditing, setLocalEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value ?? '')
  const inputRef = useRef(null)
  const tabbingRef = useRef(false)

  const isEditing = forceEdit || localEditing

  useEffect(() => {
    setTempVal(value ?? '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      tabbingRef.current = false
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

  const startEditing = () => {
    setLocalEditing(true)
    onStartEdit?.()
  }

  const stopEditing = () => {
    setLocalEditing(false)
    onStopEdit?.()
  }

  const commitChange = (nextVal, keepNavigating = false) => {
    if (!keepNavigating) {
      stopEditing()
    } else {
      setLocalEditing(false)
    }
    const valToSave = nextVal !== undefined ? nextVal : tempVal
    if (valToSave !== value) {
      onSave(valToSave)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitChange()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTempVal(value ?? '')
      stopEditing()
    } else if (e.key === 'Tab' && onTabNavigate) {
      e.preventDefault()
      tabbingRef.current = true
      commitChange(undefined, true)
      onTabNavigate(e.shiftKey ? -1 : 1)
    }
  }

  const handleBlur = () => {
    if (tabbingRef.current) {
      tabbingRef.current = false
      return
    }
    commitChange()
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
          onCloseComplete={stopEditing}
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
            onBlur={handleBlur}
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
          onBlur={handleBlur}
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
          onBlur={handleBlur}
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
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Type here..."
        className="w-full h-10 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
      />
    )
  }

  return (
    <div
      onClick={startEditing}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startEditing()
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

const QUICK_COLUMN_TYPES = [
  { value: 'text',     label: 'Short Text',   icon: Type,        color: 'text-slate-500' },
  { value: 'number',   label: 'Number',       icon: Hash,        color: 'text-blue-600' },
  { value: 'currency', label: 'Amount (INR)', icon: IndianRupee, color: 'text-emerald-600' },
  { value: 'date',     label: 'Date',         icon: Calendar,    color: 'text-[#E08A1E]' },
]

/**
 * Blank trailing column header — click anywhere in the blank column to add a new column inline.
 */
function BlankColumnHeader({
  isOpen,
  existingCount,
  onOpen,
  onCancel,
  onCreateColumn,
  onOpenFullBuilder,
}) {
  const [name, setName]             = useState('')
  const [fieldType, setFieldType]   = useState('text')
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [saving, setSaving]         = useState(false)

  const headerRef      = useRef(null)
  const inputRef       = useRef(null)
  const typeTriggerRef = useRef(null)
  const savingRef      = useRef(false)
  const nameRef        = useRef('')
  const typeRef        = useRef('text')
  const typeMenuRef    = useRef(false)

  nameRef.current = name
  typeRef.current = fieldType
  typeMenuRef.current = typeMenuOpen

  useEffect(() => {
    if (!isOpen) {
      setName('')
      setFieldType('text')
      setTypeMenuOpen(false)
      savingRef.current = false
      return
    }
    requestAnimationFrame(() => {
      headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      inputRef.current?.focus()
    })
  }, [isOpen])

  const submitColumn = async (allowDefaultName = false) => {
    if (savingRef.current) return
    const trimmed = nameRef.current.trim()
    const finalName = trimmed || (allowDefaultName ? `Column ${existingCount + 1}` : '')
    if (!finalName) {
      onCancel()
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await onCreateColumn({
        name: finalName,
        fieldType: typeRef.current,
        options: [],
        formula: null,
        isRequired: false,
      })
      setName('')
      onCancel()
    } catch {
      // keep open so user can adjust name on error
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (typeMenuRef.current) return
      if (headerRef.current?.contains(document.activeElement)) return
      if (nameRef.current.trim()) {
        submitColumn(false)
      } else {
        onCancel()
      }
    }, 90)
  }

  const activeTypeMeta = QUICK_COLUMN_TYPES.find((t) => t.value === fieldType) || QUICK_COLUMN_TYPES[0]
  const ActiveTypeIcon = activeTypeMeta.icon

  return (
    <th
      ref={headerRef}
      className={`no-print px-2 py-2 border-r border-dashed border-[var(--border-subtle)] whitespace-nowrap select-none transition-all ${
        isOpen ? 'min-w-[225px] bg-[#FEF6E9]/60' : 'min-w-[132px]'
      }`}
    >
      {isOpen ? (
        <div className="flex items-center gap-1">
          <button
            ref={typeTriggerRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTypeMenuOpen((prev) => !prev)}
            title={`Column type: ${activeTypeMeta.label}`}
            className="h-7 px-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[#E08A1E] inline-flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <ActiveTypeIcon className={`w-3.5 h-3.5 ${activeTypeMeta.color}`} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitColumn(true)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setTypeMenuOpen(false)
                onCancel()
              }
            }}
            placeholder={`Column ${existingCount + 1}...`}
            className="w-full min-w-[110px] h-7 px-2 rounded bg-[var(--bg-card)] text-[var(--text-primary)] text-xs font-semibold border border-[#E08A1E] focus:outline-none normal-case tracking-normal"
          />

          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => submitColumn(true)}
            title="Save column"
            className="h-7 w-7 rounded bg-[#E08A1E] hover:bg-[#C97814] text-white inline-flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>

          <AnimatedPortalMenu
            open={typeMenuOpen}
            onClose={() => setTypeMenuOpen(false)}
            anchorRef={typeTriggerRef}
            align="left"
            widthPx={196}
            className="font-normal normal-case tracking-normal text-left"
          >
            {QUICK_COLUMN_TYPES.map((t) => {
              const Icon = t.icon
              const isSelected = fieldType === t.value
              return (
                <AnimatedMenuItem
                  key={t.value}
                  onClick={() => {
                    setFieldType(t.value)
                    setTypeMenuOpen(false)
                    inputRef.current?.focus()
                  }}
                  className={isSelected ? 'bg-[#FEF6E9] text-[#C97814] font-semibold' : 'text-slate-700 hover:bg-[var(--bg-input)]'}
                >
                  <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                  <span>{t.label}</span>
                </AnimatedMenuItem>
              )
            })}
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <AnimatedMenuItem
              onClick={() => {
                setTypeMenuOpen(false)
                onCancel()
                onOpenFullBuilder()
              }}
              className="text-slate-700 hover:bg-[var(--bg-input)]"
            >
              <Calculator className="w-3.5 h-3.5 text-[#E08A1E]" />
              <span>Dropdown / Formula...</span>
            </AnimatedMenuItem>
          </AnimatedPortalMenu>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9]/70 transition-colors text-left"
          title="Click to add a new column"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New column</span>
        </button>
      )}
    </th>
  )
}

/**
 * Blank ghost row at the bottom of a date group (or table) — click any cell to type and add a row inline.
 */
function BlankEntryRow({
  fields,
  allFields,
  entryDate,
  showSerial,
  onCreateRow,
  onOpenBlankColumn,
  onOpenFullModal,
}) {
  const [draftData, setDraftData]         = useState({})
  const [activeFieldId, setActiveFieldId] = useState(null)
  const [saving, setSaving]               = useState(false)

  const rowRef       = useRef(null)
  const inputRef     = useRef(null)
  const draftRef     = useRef({})
  const savingRef    = useRef(false)
  const switchingRef = useRef(false)

  draftRef.current = draftData

  const editableFields = useMemo(
    () => fields.filter((f) => f.fieldType !== 'formula'),
    [fields]
  )
  const firstEditableFieldId = editableFields[0]?.id ?? null

  useEffect(() => {
    if (!activeFieldId) return
    switchingRef.current = false
    if (inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [activeFieldId])

  const hasAnyValue = (data) =>
    Object.values(data || {}).some((v) => {
      if (typeof v === 'boolean') return v
      return v !== undefined && v !== null && String(v).trim() !== ''
    })

  const prepareData = (raw) => {
    const clean = {}
    for (const f of fields) {
      if (f.fieldType === 'formula') continue
      const key = String(f.id)
      const val = raw[key]
      if (val === undefined || val === null || val === '') continue
      if (f.fieldType === 'number' || f.fieldType === 'currency') {
        const n = Number(val)
        clean[key] = Number.isNaN(n) ? val : n
      } else {
        clean[key] = val
      }
    }
    return clean
  }

  const commitRow = async (rawOverride = null, forceCreate = false) => {
    if (savingRef.current) return
    const merged = rawOverride ?? draftRef.current
    if (!forceCreate && !hasAnyValue(merged)) {
      setActiveFieldId(null)
      setDraftData({})
      draftRef.current = {}
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      await onCreateRow(prepareData(merged), entryDate)
      setDraftData({})
      draftRef.current = {}
      setActiveFieldId(null)
    } catch {
      // Toast shown by parent; keep draft intact
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const cancelDraft = () => {
    setDraftData({})
    draftRef.current = {}
    setActiveFieldId(null)
  }

  const updateDraftValue = (fieldId, val) => {
    const next = { ...draftRef.current, [String(fieldId)]: val }
    draftRef.current = next
    setDraftData(next)
    return next
  }

  const moveFocusBy = (fieldId, delta) => {
    const idx = editableFields.findIndex((f) => f.id === fieldId)
    const nextField = editableFields[idx + delta]
    if (!nextField) {
      if (delta > 0) {
        commitRow(draftRef.current, hasAnyValue(draftRef.current))
      }
      return
    }
    switchingRef.current = true
    setActiveFieldId(nextField.id)
  }

  const handleCellBlur = () => {
    setTimeout(() => {
      if (switchingRef.current || savingRef.current) return
      if (rowRef.current?.contains(document.activeElement)) return
      commitRow(draftRef.current, false)
    }, 80)
  }

  const handleKeyDown = (field, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRow(draftRef.current, true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelDraft()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      moveFocusBy(field.id, e.shiftKey ? -1 : 1)
    }
  }

  const isRowActive = activeFieldId !== null || hasAnyValue(draftData)

  return (
    <tr
      ref={rowRef}
      className={`no-print group/blank border-b border-[var(--border-subtle)]/75 last:border-b-0 transition-colors ${
        isRowActive ? 'bg-[#FEF6E9]/45' : 'bg-[var(--bg-card)]/60 hover:bg-[#FEF6E9]/40'
      }`}
    >
      <td className="sticky left-0 z-10 px-2 py-1.5 text-center border-r border-[var(--border-subtle)] bg-[var(--bg-card)] group-hover/blank:bg-[#FEF6E9]">
        <button
          type="button"
          disabled={saving}
          onClick={() => commitRow(draftRef.current, true)}
          title="Click to add a new blank row"
          className={`w-6 h-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-all disabled:opacity-50 ${
            showSerial ? 'opacity-100' : 'opacity-40 group-hover/blank:opacity-100'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E08A1E]" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </td>

      {fields.map((f) => {
        const key = String(f.id)
        const val = draftData[key] ?? ''
        const isEditingCell = activeFieldId === f.id

        if (f.fieldType === 'formula') {
          const previewVal = hasAnyValue(draftData)
            ? evaluateFormulaValue(f, draftData, allFields)
            : null
          return (
            <td
              key={f.id}
              onClick={() => firstEditableFieldId && setActiveFieldId(firstEditableFieldId)}
              className={`p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle cursor-pointer ${getColumnWidthClass(f.fieldType)}`}
            >
              <div className="w-full min-h-[38px] px-3 py-1.5 flex items-center text-sm">
                {previewVal !== null && previewVal !== undefined ? (
                  formatDisplayValue(f, previewVal)
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </div>
            </td>
          )
        }

        if (f.fieldType === 'checkbox') {
          return (
            <td
              key={f.id}
              onClick={() => {
                const next = updateDraftValue(f.id, !Boolean(draftRef.current[key]))
                commitRow(next, true)
              }}
              className={`p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle cursor-pointer ${getColumnWidthClass(f.fieldType)}`}
            >
              <div className="w-full min-h-[38px] flex items-center justify-center text-slate-300 hover:text-[#C97814]">
                <Plus className="w-3 h-3 opacity-0 group-hover/blank:opacity-70 transition-opacity" />
              </div>
            </td>
          )
        }

        return (
          <td
            key={f.id}
            className={`p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle ${getColumnWidthClass(f.fieldType)}`}
          >
            {isEditingCell ? (
              f.fieldType === 'select' ? (
                <AnimatedDropdown
                  defaultOpen={true}
                  placeholder="Select..."
                  value={val}
                  onChange={(nextVal) => {
                    const next = updateDraftValue(f.id, nextVal)
                    if (nextVal) {
                      commitRow(next, true)
                    } else {
                      setActiveFieldId(null)
                    }
                  }}
                  onCloseComplete={() => {
                    if (!savingRef.current && !hasAnyValue(draftRef.current)) {
                      setActiveFieldId(null)
                    }
                  }}
                  options={[
                    { value: '', label: '— Clear —' },
                    ...(f.options || []).map((opt) => ({ value: opt, label: opt })),
                  ]}
                  buttonClassName="h-9 px-2 py-1 rounded bg-[#FEF6E9] border-[#E08A1E] text-sm"
                />
              ) : f.fieldType === 'currency' || (f.fieldType === 'text' && CURRENCY_NAME_RE.test(f.name)) ? (
                <div className="relative flex items-center w-full">
                  <span className="absolute left-2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                  <input
                    ref={inputRef}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={val}
                    onChange={(e) => updateDraftValue(f.id, e.target.value)}
                    onBlur={handleCellBlur}
                    onKeyDown={(e) => handleKeyDown(f, e)}
                    placeholder="0.00"
                    className="w-full h-9 pl-6 pr-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-semibold border border-[#E08A1E] rounded focus:outline-none"
                  />
                </div>
              ) : f.fieldType === 'number' ? (
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => updateDraftValue(f.id, e.target.value)}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(f, e)}
                  placeholder="0"
                  className="w-full h-9 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
                />
              ) : f.fieldType === 'date' ? (
                <input
                  ref={inputRef}
                  type="date"
                  value={val || entryDate || getTodayYmd()}
                  onChange={(e) => updateDraftValue(f.id, e.target.value)}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(f, e)}
                  className="w-full h-9 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={val}
                  onChange={(e) => updateDraftValue(f.id, e.target.value)}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(f, e)}
                  placeholder={`Enter ${f.name}...`}
                  className="w-full h-9 px-2 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
                />
              )
            ) : (
              <div
                onClick={() => setActiveFieldId(f.id)}
                className="w-full min-h-[38px] px-3 py-1.5 flex items-center cursor-pointer transition-colors select-none text-sm hover:bg-[#FEF6E9]/70"
              >
                {val !== '' && val !== undefined ? (
                  formatDisplayValue(f, val)
                ) : f.id === firstEditableFieldId ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400/85 group-hover/blank:text-[#C97814] transition-colors">
                    <Plus className="w-3 h-3" />
                    <span>New row...</span>
                  </span>
                ) : (
                  <span className="text-transparent group-hover/blank:text-slate-300 text-xs select-none">+</span>
                )}
              </div>
            )}
          </td>
        )
      })}

      {/* Clicking blank trailing column cell also opens New Column */}
      <td
        onClick={onOpenBlankColumn}
        title="Click to add a new column"
        className="p-0 border-r border-dashed border-[var(--border-subtle)]/80 hover:bg-[#FEF6E9]/45 cursor-pointer"
      >
        <div className="min-h-[38px]" />
      </td>

      {/* Quiet quick-create / full-modal controls */}
      <td className="px-2 py-1 text-right whitespace-nowrap">
        <div
          className={`inline-flex items-center gap-0.5 transition-opacity ${
            isRowActive ? 'opacity-100' : 'sm:opacity-0 sm:group-hover/blank:opacity-100 focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commitRow(draftRef.current, true)}
            className="p-1.5 rounded text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors"
            title={isRowActive ? 'Save row' : 'Add blank row'}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E08A1E]" />
            ) : isRowActive ? (
              <Check className="w-3.5 h-3.5 text-[#E08A1E]" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
          {onOpenFullModal && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenFullModal}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-[var(--bg-input)] transition-colors"
              title="Open full entry form"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Slim center-aligned Date Group Banner (collapsible):
 * Center: clickable "27 Nov 2026 · Fri" + TODAY tag + collapse chevron
 * Right: bold day subtotal ("₹78,542") + subtle "+" icon
 */
function DateGroupBanner({ group, isCollapsed = false, onToggleCollapse, onAddForDate }) {
  const { title, relativeTag, weekday, dateKey, stats } = group
  const primaryField = stats.summaryFields[0]
  const primarySummary = primaryField ? stats.byField[primaryField.id] : null
  const shortDay = weekday ? weekday.slice(0, 3) : ''

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 sm:px-5 py-2 select-none">
      <div />

      {/* Plain centered clickable Date heading (no pill/box container) */}
      <button
        type="button"
        onClick={() => onToggleCollapse?.(dateKey)}
        title={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
        className="group/date inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:text-[#C97814] transition-colors cursor-pointer"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover/date:text-[#C97814]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover/date:opacity-100 transition-opacity" />
        )}
        <span className="font-heading text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover/date:text-[#C97814] tracking-tight transition-colors">
          {title}{shortDay ? ` · ${shortDay}` : ''}
        </span>
        {relativeTag && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C97814]">
            · {relativeTag}
          </span>
        )}
        {isCollapsed && (
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            ({group.records.length})
          </span>
        )}
      </button>

      {/* Right: Bold day total + subtle "+" icon */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        {primarySummary && group.records.length > 0 && (
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
            className="no-print p-1 rounded-lg text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors flex-shrink-0"
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
 * Mobile Stacked Entry Card — tap amount to inline-edit, tap checkbox to toggle, tap card for full form.
 */
function MobileEntryCard({
  record,
  index,
  showSerial,
  fields,
  displayLabels,
  onEdit,
  onInlineUpdate,
}) {
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountDraft, setAmountDraft]     = useState('')
  const amountInputRef = useRef(null)

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
  const amountVal = amountField ? getEffectiveCellValue(amountField, record.data, fields) : null
  const canInlineEditAmount = Boolean(amountField && amountField.fieldType !== 'formula' && onInlineUpdate)

  useEffect(() => {
    if (editingAmount && amountInputRef.current) {
      amountInputRef.current.focus()
      amountInputRef.current.select()
    }
  }, [editingAmount])

  const commitAmount = () => {
    setEditingAmount(false)
    if (!amountField || !onInlineUpdate) return
    const nextRaw = amountDraft.trim()
    const nextVal = nextRaw === '' ? '' : Number(nextRaw)
    if (Number.isNaN(nextVal)) return
    if (nextVal !== record.data?.[String(amountField.id)]) {
      onInlineUpdate(record.id, {
        ...(record.data || {}),
        [String(amountField.id)]: nextVal,
      })
    }
  }

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
          <div
            className="text-right flex-shrink-0"
            onClick={(e) => {
              if (!canInlineEditAmount) return
              e.stopPropagation()
              setAmountDraft(amountVal ?? '')
              setEditingAmount(true)
            }}
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {displayLabels[amountField.id]}
            </p>
            {editingAmount ? (
              <input
                ref={amountInputRef}
                type="number"
                step="any"
                inputMode="decimal"
                value={amountDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setAmountDraft(e.target.value)}
                onBlur={commitAmount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitAmount()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditingAmount(false)
                  }
                }}
                className="mt-0.5 w-24 h-7 px-2 text-right text-sm font-bold bg-[#FEF6E9] border border-[#E08A1E] rounded-lg focus:outline-none tabular-nums"
              />
            ) : (
              <div
                title={canInlineEditAmount ? 'Tap to quick-edit value' : undefined}
                className={`text-sm font-bold text-[var(--text-primary)] ${
                  canInlineEditAmount ? 'px-1.5 py-0.5 -mr-1.5 rounded-md hover:bg-[#FEF6E9] transition-colors' : ''
                }`}
              >
                {formatDisplayValue(amountField, amountVal)}
              </div>
            )}
          </div>
        )}
      </div>

      {remainingFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-[var(--border-subtle)]">
          {remainingFields.map((f) => {
            const val = getEffectiveCellValue(f, record.data, fields)
            const isCheckbox = f.fieldType === 'checkbox' && Boolean(onInlineUpdate)
            return (
              <div
                key={f.id}
                className="min-w-0"
                onClick={(e) => {
                  if (!isCheckbox) return
                  e.stopPropagation()
                  onInlineUpdate(record.id, {
                    ...(record.data || {}),
                    [String(f.id)]: !Boolean(val),
                  })
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                  {displayLabels[f.id]}
                </p>
                <div className="text-xs font-medium text-[var(--text-primary)] mt-0.5 truncate">
                  {formatDisplayValue(f, val)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * RecordRegisterTable — Single-row Dock toolbar + quiet Excel Grid / Mobile Cards.
 */
export default function RecordRegisterTable({
  projectName = '',
  section,
  records,
  loading,
  onAddEntry,
  onEditEntry,
  onDuplicateRecord,
  onQuickCreateRecord,
  onInlineUpdateRecord,
  onDeleteRecord,
  onBulkDeleteRecords,
  onBulkUpdateEntryDate,
  onImportCsv,
  onAddColumn,
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
  const [csvImportOpen, setCsvImportOpen]       = useState(false)

  // Floating Dock dropdowns, inline blank column, Tab grid nav, collapsed date groups, bulk selection & footer modes
  const [viewMenuOpen, setViewMenuOpen]     = useState(false)
  const [sheetMenuOpen, setSheetMenuOpen]   = useState(false)
  const [addingColumn, setAddingColumn]     = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [collapsedDates, setCollapsedDates] = useState({})
  const [activeGridCell, setActiveGridCell] = useState(null)
  const [selectedIds, setSelectedIds]       = useState(() => new Set())
  const [bulkDateOpen, setBulkDateOpen]     = useState(false)
  const [bulkDateVal, setBulkDateVal]       = useState(() => getTodayYmd())
  const [bulkBusy, setBulkBusy]             = useState(false)
  const [footerAggMode, setFooterAggMode]   = useState({})

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
    setAddingColumn(false)
    setCollapsedDates({})
    setActiveGridCell(null)
    setSelectedIds(new Set())
    setBulkDateOpen(false)
  }, [section?.id])

  // Keep selectedIds synced with existing records after deletions
  useEffect(() => {
    const validIds = new Set(records.map((r) => r.id))
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set()
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [records])

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

  const openQuickAddColumn = useCallback(() => {
    if (onAddColumn) {
      setAddingColumn(true)
    } else {
      onCustomizeFields(null)
    }
  }, [onAddColumn, onCustomizeFields])

  const quickCreateHandler = onQuickCreateRecord || (async (_data, entryDate) => {
    onAddEntry(entryDate)
  })

  const hasActiveControls = sortLevels.length > 0 || columnFilters.length > 0 || Boolean(search.trim())
  const totalGridCols = visibleFields.length + 3 // left gutter/SL + visibleFields + blank column + Actions
  const gridGroups = groupByDate
    ? (dateGroups.length > 0
        ? dateGroups
        : [{ ...formatDateGroupMeta(getTodayYmd()), records: [], stats: computeSheetStats([], fields) }])
    : [{ dateKey: getTodayYmd(), records: processedRecords }]

  const flatExpandedRecords = useMemo(() => {
    if (!groupByDate) return processedRecords
    const out = []
    gridGroups.forEach((g) => {
      if (!collapsedDates[g.dateKey]) out.push(...g.records)
    })
    return out
  }, [groupByDate, gridGroups, processedRecords, collapsedDates])

  const editableTabFields = useMemo(
    () => visibleFields.filter((f) => f.fieldType !== 'formula' && f.fieldType !== 'checkbox'),
    [visibleFields]
  )

  const handleSavedCellTab = useCallback((recordId, fieldId, delta) => {
    const rowIdx = flatExpandedRecords.findIndex((r) => r.id === recordId)
    const colIdx = editableTabFields.findIndex((f) => f.id === fieldId)
    if (rowIdx === -1 || colIdx === -1) {
      setActiveGridCell(null)
      return
    }
    let nextCol = colIdx + delta
    let nextRow = rowIdx
    if (nextCol >= editableTabFields.length) {
      nextCol = 0
      nextRow += 1
    } else if (nextCol < 0) {
      nextCol = editableTabFields.length - 1
      nextRow -= 1
    }
    if (nextRow < 0 || nextRow >= flatExpandedRecords.length) {
      setActiveGridCell(null)
      return
    }
    setActiveGridCell({
      recordId: flatExpandedRecords[nextRow].id,
      fieldId: editableTabFields[nextCol].id,
    })
  }, [flatExpandedRecords, editableTabFields])

  const toggleDateCollapsed = useCallback((dateKey) => {
    setCollapsedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }))
  }, [])

  const toggleSelectRow = useCallback((recordId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return next
    })
  }, [])

  const allProcessedSelected =
    processedRecords.length > 0 && processedRecords.every((r) => selectedIds.has(r.id))

  const toggleSelectAll = useCallback(() => {
    if (allProcessedSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processedRecords.map((r) => r.id)))
    }
  }, [allProcessedSelected, processedRecords])

  const selectedRecords = useMemo(
    () => records.filter((r) => selectedIds.has(r.id)),
    [records, selectedIds]
  )

  const selectedPrimaryStats = useMemo(() => {
    if (!selectedRecords.length) return null
    const stats = computeSheetStats(selectedRecords, fields)
    const primary = stats.summaryFields[0]
    if (!primary) return null
    return {
      label: displayLabels[primary.id] || primary.name,
      ...stats.byField[primary.id],
    }
  }, [selectedRecords, fields, displayLabels])

  const handleBulkDeleteClick = async () => {
    if (!selectedRecords.length || !onBulkDeleteRecords) return
    setBulkBusy(true)
    try {
      await onBulkDeleteRecords(selectedRecords)
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDateApply = async () => {
    if (!selectedRecords.length || !bulkDateVal || !onBulkUpdateEntryDate) return
    setBulkBusy(true)
    try {
      await onBulkUpdateEntryDate(selectedRecords, bulkDateVal)
      setBulkDateOpen(false)
      setSelectedIds(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const cycleFooterMode = useCallback((field) => {
    const isNum = isNumericColumn(field)
    if (!isNum) return
    setFooterAggMode((prev) => {
      const cur = prev[field.id] || 'sum'
      const next = cur === 'sum' ? 'avg' : cur === 'avg' ? 'count' : 'sum'
      return { ...prev, [field.id]: next }
    })
  }, [])

  const handlePrintSheet = () => {
    if (effectiveView === 'cards') {
      setViewModeOverride('grid')
      setTimeout(() => window.print(), 120)
    } else {
      window.print()
    }
  }

  return (
    <div className="relative">
      {/* Clean Print / PDF Header (hidden on screen, shown on print) */}
      <div className="print-only px-2 pb-4 mb-3 border-b border-slate-300">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {projectName || 'BuildLogic'}
            </p>
            <h2 className="text-xl font-bold text-slate-900">{section?.name}</h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Printed: {formatHumanDate(getTodayYmd())}</p>
            <p>{processedRecords.length} {processedRecords.length === 1 ? 'entry' : 'entries'}</p>
          </div>
        </div>
      </div>

      {/* ─── Single Clean Toolbar Row (Search Left + Dock Toolbar Right) ─── */}
      <div className="no-print flex items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
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
        widthPx={204}
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

        {onImportCsv && (
          <AnimatedMenuItem
            onClick={() => setCsvImportOpen(true)}
            className="text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Import CSV / Paste</span>
          </AnimatedMenuItem>
        )}

        {processedRecords.length > 0 && (
          <>
            <AnimatedMenuItem
              onClick={handleExportCsv}
              className="text-slate-700 hover:bg-[var(--bg-input)]"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV</span>
            </AnimatedMenuItem>

            <AnimatedMenuItem
              onClick={handlePrintSheet}
              className="text-slate-700 hover:bg-[var(--bg-input)]"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print / Save PDF</span>
            </AnimatedMenuItem>
          </>
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

      {/* ─── Multi-Row Selection Action Bar ─────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-2 bg-[#1E242B] text-white text-xs border-b border-[#2C333C]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#F5BD6E] tabular-nums">
              {selectedIds.size} {selectedIds.size === 1 ? 'row' : 'rows'} selected
            </span>
            {selectedPrimaryStats && selectedPrimaryStats.count > 0 && (
              <span className="text-slate-300 tabular-nums">
                {selectedPrimaryStats.label} Sum:{' '}
                <strong className="text-white">
                  {selectedPrimaryStats.isCurrency
                    ? `₹${selectedPrimaryStats.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                    : selectedPrimaryStats.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBulkUpdateEntryDate && (
              bulkDateOpen ? (
                <div className="inline-flex items-center gap-1.5 bg-[#2B333C] px-2 py-1 rounded-lg">
                  <input
                    type="date"
                    value={bulkDateVal}
                    onChange={(e) => setBulkDateVal(e.target.value)}
                    className="bg-transparent text-white text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={handleBulkDateApply}
                    className="px-2 py-0.5 rounded bg-[#E08A1E] hover:bg-[#C97814] text-white font-semibold"
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDateOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setBulkDateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2B333C] hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#F5BD6E]" />
                  <span>Change Date</span>
                </button>
              )
            )}

            {onBulkDeleteRecords && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkDeleteClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set())
                setBulkDateOpen(false)
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Active Sort & Filter Summary Pills ─────────────────────── */}
      {hasActiveControls && records.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-1.5 px-4 sm:px-6 py-2 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] text-xs">
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
      ) : records.length === 0 && effectiveView === 'cards' ? (
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
      ) : records.length > 0 && processedRecords.length === 0 ? (
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
                dateGroups.map((group) => {
                  const isCollapsed = Boolean(collapsedDates[group.dateKey])
                  return (
                    <section key={group.dateKey} className="space-y-2">
                      <DateGroupBanner
                        group={group}
                        isCollapsed={isCollapsed}
                        onToggleCollapse={toggleDateCollapsed}
                        onAddForDate={onAddEntry}
                      />

                      {!isCollapsed && (
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
                              onInlineUpdate={onInlineUpdateRecord}
                            />
                          ))}

                          <button
                            type="button"
                            onClick={() => onAddEntry(group.dateKey)}
                            className="no-print flex items-center justify-center gap-2 min-h-[72px] rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/60 hover:bg-[#FEF6E9]/60 hover:border-[#E08A1E]/60 text-xs font-semibold text-slate-400 hover:text-[#C97814] transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add row</span>
                          </button>
                        </div>
                      )}
                    </section>
                  )
                })
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
                      onInlineUpdate={onInlineUpdateRecord}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => onAddEntry()}
                    className="no-print flex items-center justify-center gap-2 min-h-[72px] rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/60 hover:bg-[#FEF6E9]/60 hover:border-[#E08A1E]/60 text-xs font-semibold text-slate-400 hover:text-[#C97814] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add row</span>
                  </button>
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
                      <th className="group/sel sticky left-0 z-20 bg-[var(--bg-input)] px-2 py-2.5 w-11 text-center border-r border-[var(--border-subtle)] text-slate-500 text-[11px] uppercase tracking-wider tabular-nums">
                        {processedRecords.length > 0 ? (
                          <div className="flex items-center justify-center">
                            {!groupByDate && selectedIds.size === 0 && (
                              <span className="group-hover/sel:hidden">SL</span>
                            )}
                            <input
                              type="checkbox"
                              checked={allProcessedSelected}
                              onChange={toggleSelectAll}
                              title="Select all visible rows"
                              className={`no-print w-3.5 h-3.5 rounded border-slate-300 text-[#E08A1E] accent-[#E08A1E] cursor-pointer ${
                                selectedIds.size > 0
                                  ? 'block'
                                  : groupByDate
                                    ? 'opacity-30 group-hover/sel:opacity-100 transition-opacity'
                                    : 'hidden group-hover/sel:block'
                              }`}
                            />
                          </div>
                        ) : (
                          !groupByDate ? 'SL' : ''
                        )}
                      </th>

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

                      <BlankColumnHeader
                        isOpen={addingColumn}
                        existingCount={fields.length}
                        onOpen={openQuickAddColumn}
                        onCancel={() => setAddingColumn(false)}
                        onCreateColumn={(payload) => onAddColumn?.(payload)}
                        onOpenFullBuilder={() => onCustomizeFields(null)}
                      />

                      <th className="no-print px-2 py-2.5 w-16 sm:w-20 text-right text-[11px] uppercase tracking-wider text-slate-400" />
                    </tr>
                  </thead>

                  <tbody>
                    {gridGroups.map((group) => {
                      const isCollapsed = Boolean(collapsedDates[group.dateKey])
                      return (
                        <Fragment key={group.dateKey}>
                          {groupByDate && (
                            <tr className="bg-[var(--bg-canvas)] border-y border-[var(--border-subtle)]">
                              <td colSpan={totalGridCols} className="p-0">
                                <div className="sticky left-0 max-w-[calc(100vw-2.25rem)] sm:max-w-full">
                                  <DateGroupBanner
                                    group={group}
                                    isCollapsed={isCollapsed}
                                    onToggleCollapse={toggleDateCollapsed}
                                    onAddForDate={onAddEntry}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && group.records.map((rec, idx) => {
                            const isDeleting = deletingRecordId === rec.id
                            const isSelected = selectedIds.has(rec.id)
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
                                  isSelected
                                    ? 'bg-[#FEF6E9]/85'
                                    : isEven
                                      ? 'bg-[#F6F4EF]/50'
                                      : 'bg-[var(--bg-card)]'
                                } hover:bg-[#FEF6E9]/55`}
                              >
                                <td
                                  className={`sticky left-0 z-10 px-2 py-2 text-center border-r border-[var(--border-subtle)] text-xs font-bold tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                                    isSelected
                                      ? 'bg-[#FEF6E9]'
                                      : isEven
                                        ? 'bg-[#F6F4EF]'
                                        : 'bg-[var(--bg-card)]'
                                  } group-hover:bg-[#FEF6E9]`}
                                >
                                  <div className="flex items-center justify-center">
                                    {!groupByDate && !isSelected && (
                                      <span className={selectedIds.size > 0 ? 'hidden' : 'group-hover:hidden'}>
                                        {String(idx + 1).padStart(2, '0')}
                                      </span>
                                    )}
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectRow(rec.id)}
                                      title="Select row"
                                      className={`no-print w-3.5 h-3.5 rounded border-slate-300 text-[#E08A1E] accent-[#E08A1E] cursor-pointer ${
                                        isSelected || selectedIds.size > 0
                                          ? 'block'
                                          : groupByDate
                                            ? 'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
                                            : 'hidden group-hover:block'
                                      }`}
                                    />
                                  </div>
                                </td>

                                {visibleFields.map((f) => {
                                  const isCellFocused =
                                    activeGridCell?.recordId === rec.id &&
                                    activeGridCell?.fieldId === f.id
                                  return (
                                    <td
                                      key={f.id}
                                      className={`p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle ${getColumnWidthClass(f.fieldType)}`}
                                    >
                                      <EditableCell
                                        field={f}
                                        value={getEffectiveCellValue(f, rec.data, fields)}
                                        forceEdit={isCellFocused}
                                        onStartEdit={() => setActiveGridCell({ recordId: rec.id, fieldId: f.id })}
                                        onStopEdit={() =>
                                          setActiveGridCell((prev) =>
                                            prev?.recordId === rec.id && prev?.fieldId === f.id ? null : prev
                                          )
                                        }
                                        onTabNavigate={(delta) => handleSavedCellTab(rec.id, f.id, delta)}
                                        onSave={(nextVal) => handleCellChange(rec, f.id, nextVal)}
                                        onEditFormulaColumn={(fid) => onCustomizeFields(fid)}
                                      />
                                    </td>
                                  )
                                })}

                                {/* Clicking blank trailing column cell opens New Column inline */}
                                <td
                                  onClick={openQuickAddColumn}
                                  title="Click to add a new column"
                                  className="no-print p-0 border-r border-dashed border-[var(--border-subtle)]/80 hover:bg-[#FEF6E9]/45 cursor-pointer"
                                >
                                  <div className="min-h-[42px]" />
                                </td>

                                {/* Quiet row actions: hover-only on desktop, single ⋮ on mobile */}
                                <td className="no-print px-2 py-1.5 text-right whitespace-nowrap">
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

                          {!isCollapsed && (
                            <BlankEntryRow
                              fields={visibleFields}
                              allFields={fields}
                              entryDate={group.dateKey}
                              showSerial={!groupByDate}
                              onCreateRow={quickCreateHandler}
                              onOpenBlankColumn={openQuickAddColumn}
                              onOpenFullModal={() => onAddEntry(group.dateKey)}
                            />
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>

                  {/* Sticky Grand Totals Footer */}
                  {processedRecords.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-[var(--bg-input)] border-t-2 border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]">
                      <tr>
                        <td className="sticky left-0 z-20 bg-[var(--bg-input)] px-2 py-2.5 text-center border-r border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-slate-500">
                          Σ
                        </td>
                        {visibleFields.map((f) => {
                          const stat = statsByField[f.id]
                          if (stat) {
                            const mode = footerAggMode[f.id] || 'sum'
                            const modeLabel = mode === 'sum' ? 'Sum' : mode === 'avg' ? 'Avg' : 'Count'
                            const valNum = mode === 'sum' ? stat.sum : mode === 'avg' ? stat.avg : stat.count
                            const formatted =
                              mode === 'count'
                                ? `${stat.count} vals`
                                : stat.isCurrency
                                  ? `₹${valNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                                  : valNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                            return (
                              <td
                                key={f.id}
                                className="px-3 py-2 border-r border-[var(--border-subtle)] whitespace-nowrap tabular-nums"
                              >
                                <button
                                  type="button"
                                  onClick={() => cycleFooterMode(f)}
                                  title="Click to switch between Sum / Avg / Count"
                                  className="w-full flex items-center justify-between gap-2 text-left hover:text-[#C97814] transition-colors"
                                >
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                    {modeLabel}
                                  </span>
                                  <span>{formatted}</span>
                                </button>
                              </td>
                            )
                          }
                          const filledCount = processedRecords.filter((rec) => {
                            const v = getEffectiveCellValue(f, rec.data, fields)
                            if (f.fieldType === 'checkbox') return Boolean(v)
                            return v !== undefined && v !== null && String(v).trim() !== ''
                          }).length
                          return (
                            <td
                              key={f.id}
                              className="px-3 py-2 border-r border-[var(--border-subtle)] whitespace-nowrap text-[11px] font-medium text-slate-400 tabular-nums"
                            >
                              {filledCount > 0 ? `${filledCount} filled` : '—'}
                            </td>
                          )
                        })}
                        <td className="no-print border-r border-dashed border-[var(--border-subtle)]" />
                        <td className="no-print px-2 py-2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Right-edge scroll hint gradient when grid overflows horizontally */}
              {canScrollRight && (
                <div
                  aria-hidden="true"
                  className="no-print pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FCFBF8]/95 via-[#FCFBF8]/60 to-transparent z-20"
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

      {onImportCsv && (
        <CsvImportModal
          open={csvImportOpen}
          onClose={() => setCsvImportOpen(false)}
          section={section}
          onImport={onImportCsv}
        />
      )}
    </div>
  )
}
