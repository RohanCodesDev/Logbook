import { Fragment, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Trash2, Search, Download, Plus, Pencil, Copy,
  CheckCircle2, Minus, Loader2, SlidersHorizontal,
  Table as TableIcon, LayoutList, IndianRupee, Hash, Calendar, Type, List, CheckSquare,
  Calculator, Sigma, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Filter, X, MoreVertical, AlertTriangle, FileSpreadsheet
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import SortModal from './SortModal'
import FilterModal from './FilterModal'
import TotalsModal from './TotalsModal'
import {
  CURRENCY_NAME_RE,
  FORMULA_OPERATORS,
  formatHumanDate,
  formatPlainValue,
  getEffectiveCellValue,
  getRecordDateKey,
  groupRecordsByDate,
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
 * Returns icon corresponding to column data type
 */
function getFieldIcon(type) {
  switch (type) {
    case 'currency': return <IndianRupee className="w-3 h-3 text-emerald-600" />
    case 'number':   return <Hash className="w-3 h-3 text-blue-600" />
    case 'date':     return <Calendar className="w-3 h-3 text-[#E08A1E]" />
    case 'select':   return <List className="w-3 h-3 text-purple-600" />
    case 'checkbox': return <CheckSquare className="w-3 h-3 text-teal-600" />
    case 'formula':  return <Calculator className="w-3 h-3 text-[#C97814]" />
    default:         return <Type className="w-3 h-3 text-slate-400" />
  }
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
        title="Auto-calculated formula column (click to configure formula)"
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
        <select
          ref={inputRef}
          value={tempVal}
          onChange={(e) => {
            setTempVal(e.target.value)
            commitChange(e.target.value)
          }}
          onBlur={() => commitChange()}
          className="w-full h-10 px-2 py-1 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium border border-[#E08A1E] rounded focus:outline-none"
        >
          <option value="">Select...</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    if (field.fieldType === 'currency') {
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
 * Quick bottom-sheet / popover to add a column (including Auto Formula & smart type inference)
 */
function QuickAddColumnModal({ open, onClose, onAddColumn, existingFields = [] }) {
  const [name, setName]               = useState('')
  const [fieldType, setFieldType]     = useState('text')
  const [typeTouched, setTypeTouched] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [leftFieldId, setLeftFieldId]   = useState('')
  const [operator, setOperator]         = useState('mul')
  const [rightFieldId, setRightFieldId] = useState('')
  const [formulaFormat, setFormulaFormat] = useState('currency')
  const [error, setError]               = useState(null)
  const [submitting, setSubmitting]     = useState(false)
  const inputRef = useRef(null)

  const formulaSources = existingFields.filter(isNumericColumn)

  useEffect(() => {
    if (open) {
      setName('')
      setFieldType('text')
      setTypeTouched(false)
      setOptionsText('')
      setLeftFieldId(formulaSources[0] ? String(formulaSources[0].id) : '')
      setRightFieldId(formulaSources[1] ? String(formulaSources[1].id) : '')
      setOperator('mul')
      setFormulaFormat('currency')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const handleNameChange = (val) => {
    setName(val)
    if (typeTouched) return
    if (CURRENCY_NAME_RE.test(val)) {
      setFieldType('currency')
    } else if (/\bdate\b/i.test(val)) {
      setFieldType('date')
    } else if (/\b(qty|quantity|hours|hrs|days|count|bags|units)\b/i.test(val)) {
      setFieldType('number')
    }
  }

  if (!open) return null

  const normalized = name.trim().toLowerCase()
  const isDuplicate = Boolean(
    normalized &&
    existingFields.some((f) => f.name.trim().toLowerCase() === normalized)
  )
  const hasDateAlready = existingFields.some((f) => f.fieldType === 'date')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)

    const options = fieldType === 'select'
      ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    if (fieldType === 'select' && options.length === 0) {
      setError('Add at least one comma-separated option for Dropdown Choices.')
      return
    }

    let formula = null
    if (fieldType === 'formula') {
      if (!leftFieldId || !rightFieldId) {
        setError('Pick two numeric/currency columns for the formula.')
        return
      }
      formula = {
        leftFieldId: Number(leftFieldId),
        operator,
        rightFieldId: Number(rightFieldId),
        format: formulaFormat,
      }
    }

    setSubmitting(true)
    try {
      await onAddColumn({
        name: name.trim(),
        fieldType,
        options,
        formula,
        isRequired: false,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-[var(--border-subtle)] space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center -mt-2">
          <div className="w-10 h-1 rounded-full bg-[#D8D1C4]" />
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Add New Column</h4>
          <button type="button" onClick={onClose} className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Column Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              placeholder="e.g. Rate, Start Date, Total, Vendor"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E08A1E]"
            />

            {isDuplicate && (
              <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  A column named <strong>"{name.trim()}"</strong> already exists. Try a clearer name like <em>Start Date</em> or <em>End Date</em>.
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Column Data Type
            </label>
            <select
              value={fieldType}
              onChange={(e) => {
                setTypeTouched(true)
                setFieldType(e.target.value)
              }}
              className="w-full px-3 py-2.5 text-sm border border-[var(--border-subtle)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E08A1E] bg-[var(--bg-card)]"
            >
              <option value="text">Text (Description, Machine, Name)</option>
              <option value="currency">Currency / Rate (₹)</option>
              <option value="number">Number / Quantity</option>
              <option value="date">Date</option>
              <option value="select">Dropdown Choices</option>
              <option value="checkbox">Yes / No Checkbox</option>
              <option value="textarea">Long Notes</option>
              <option value="formula">Auto Formula (e.g. Qty × Rate)</option>
            </select>

            {fieldType === 'date' && hasDateAlready && !name.trim() && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400">Suggestions:</span>
                {['Start Date', 'End Date', 'Bill Date'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setName(preset)}
                    className="px-2 py-0.5 rounded-md bg-[var(--bg-input)] hover:bg-[#FEF6E9] text-slate-700 hover:text-[#C97814] text-[11px] font-medium transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {fieldType === 'select' && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Dropdown Options (comma separated)
              </label>
              <input
                type="text"
                placeholder="Paid, Pending, Partial"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E08A1E]"
              />
            </div>
          )}

          {fieldType === 'formula' && (
            <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2.5">
              {formulaSources.length < 2 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  Add at least 2 numeric or currency columns first (e.g. Qty and Rate).
                </p>
              ) : (
                <>
                  <select
                    value={leftFieldId}
                    onChange={(e) => setLeftFieldId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-lg"
                  >
                    <option value="">First column...</option>
                    {formulaSources.map((sf) => (
                      <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
                    ))}
                  </select>

                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-lg"
                  >
                    {FORMULA_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  <select
                    value={rightFieldId}
                    onChange={(e) => setRightFieldId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-lg"
                  >
                    <option value="">Second column...</option>
                    {formulaSources.map((sf) => (
                      <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 font-medium">Format:</span>
                    <div className="inline-flex rounded-lg bg-[var(--bg-input)] p-0.5">
                      <button
                        type="button"
                        onClick={() => setFormulaFormat('currency')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          formulaFormat === 'currency' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        Amount (₹)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormulaFormat('number')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          formulaFormat === 'number' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        Number
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting || !name.trim()}>
              {submitting ? 'Adding...' : 'Add Column'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Column Header with direct click-to-sort + Excel-style Column Menu
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  const openMenu = () => {
    if (menuOpen) {
      setMenuOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = 192
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
      const top = Math.min(rect.bottom + 6, window.innerHeight - 280)
      setMenuPos({ top: Math.max(8, top), left })
    }
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return
      }
      setMenuOpen(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const handleScroll = () => setMenuOpen(false)

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [menuOpen])

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
      className={`relative px-2.5 py-2.5 border-r border-[var(--border-subtle)] uppercase tracking-wider text-[11px] font-bold text-slate-700 whitespace-nowrap group select-none ${getColumnWidthClass(field.fieldType)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onQuickSort(field)}
          className="inline-flex items-center gap-1.5 min-w-0 hover:text-[#C97814] transition-colors text-left"
          title="Click to sort by this column"
        >
          {getFieldIcon(field.fieldType)}
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
          onClick={openMenu}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-[#E6E1D6]/70 transition-colors flex-shrink-0"
          title="Column Options"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed w-48 bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border-subtle)] py-1.5 z-[9999] font-normal normal-case tracking-normal text-left"
          onClick={() => setMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => onQuickSort(field, 'asc')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
            <span>{ascLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickSort(field, 'desc')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{descLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSortModal(field.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#E08A1E]" />
            <span>More Sort Kinds...</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFilterForColumn(field.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter Column</span>
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <button
            type="button"
            onClick={() => onEditField(field.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
            <span>Edit Column</span>
          </button>

          {index > 0 && (
            <button
              type="button"
              onClick={() => onMoveField(index, -1)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Move Left</span>
            </button>
          )}

          {index < totalCount - 1 && (
            <button
              type="button"
              onClick={() => onMoveField(index, 1)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Move Right</span>
            </button>
          )}

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete column "${field.name}"? Data in this column will be removed.`)) {
                onDeleteField(field.id)
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Column</span>
          </button>
        </div>,
        document.body
      )}
    </th>
  )
}

/**
 * Mobile Stacked Entry Card — clean overview of every column + computed formula values.
 * Tapping anywhere opens the Bottom Sheet form with Edit, Duplicate, and Delete.
 */
function MobileEntryCard({
  record,
  index,
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
    fields.find((f) => f.id !== headlineField?.id && f.fieldType === 'currency') ||
    fields.find((f) => f.id !== headlineField?.id && CURRENCY_NAME_RE.test(f.name)) ||
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
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-4 shadow-xs active:scale-[0.99] transition-all cursor-pointer space-y-3"
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-slate-600 text-[10px] font-bold tabular-nums uppercase">
              SL {String(index + 1).padStart(2, '0')}
            </span>
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

      {/* Remaining Fields Grid */}
      {remainingFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
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
 * Center-aligned Date Header & Subheader for each day's entries.
 */
function DateGroupBanner({ group, onAddForDate }) {
  const { title, relativeTag, weekday, dateKey, records, stats } = group
  const primaryField = stats.summaryFields[0]
  const primarySummary = primaryField ? stats.byField[primaryField.id] : null

  return (
    <div className="flex flex-col items-center justify-center text-center py-2.5 px-4 select-none">
      {/* Centered Date Header */}
      <div className="inline-flex items-center justify-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-[#E08A1E]" />
        <h4 className="font-heading text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight">
          {title}
        </h4>
        {relativeTag && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF6E9] text-[#C97814] border border-[#FDE68A]">
            {relativeTag}
          </span>
        )}
      </div>

      {/* Centered Date Subheader */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] font-medium text-slate-500">
        {weekday && <span>{weekday}</span>}
        {weekday && <span className="text-slate-300">•</span>}
        <span className="tabular-nums">
          {records.length} {records.length === 1 ? 'entry' : 'entries'}
        </span>
        {primarySummary && (
          <>
            <span className="text-slate-300">•</span>
            <span className="tabular-nums font-semibold text-[var(--text-primary)]">
              {primaryField.name}:{' '}
              {primarySummary.isCurrency
                ? `₹${primarySummary.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                : primarySummary.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </>
        )}
        {onAddForDate && (
          <>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => onAddForDate(dateKey)}
              className="inline-flex items-center gap-0.5 font-semibold text-[#C97814] hover:text-[#E08A1E] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Fingertip Action Pill Button inside the quick command strip
 */
function QuickActionPill({ icon: Icon, label, active = false, badge = null, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
        active
          ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-xs'
          : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#F2A649]' : 'text-[#C97814]'}`} />
      <span>{label}</span>
      {badge !== null && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none tabular-nums ${
            active ? 'bg-[#E08A1E] text-white' : 'bg-[var(--bg-input)] text-slate-600'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

/**
 * RecordRegisterTable — Simplified Excel Workspace for Mobile & Desktop:
 * - Fingertip Action Strip: + Column, Columns (Reorder/Edit/Formulas), Sort, Filter, Totals, Cards/Grid, Export
 * - Multi-kind & multi-level column sorting + per-column filtering
 * - Mobile Cards default on < 640px (toggleable to Grid anytime), Excel Grid default on >= 640px
 * - Live Auto Formula calculations, inline cell editing, 1-tap Duplicate & CSV Export
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
  const [viewModeOverride, setViewModeOverride] = useState(null) // null -> auto ('cards' < 640px, 'grid' >= 640px)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  )

  const [addColumnOpen, setAddColumnOpen]   = useState(false)
  const [sortModalOpen, setSortModalOpen]   = useState(false)
  const [sortSeedFieldId, setSortSeedFieldId] = useState(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filterSeedFieldId, setFilterSeedFieldId] = useState(null)
  const [totalsModalOpen, setTotalsModalOpen] = useState(false)
  const [sheetMenuOpen, setSheetMenuOpen]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sheetMenuRef = useRef(null)
  const tableScrollRef = useRef(null)
  const fields = section?.fields || []

  const effectiveView = viewModeOverride || (isMobileViewport ? 'cards' : 'grid')
  const displayLabels = useMemo(() => buildDisplayLabels(fields), [fields])

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close sheet menu on outside click
  useEffect(() => {
    if (!sheetMenuOpen) return
    const close = (e) => {
      if (sheetMenuRef.current && !sheetMenuRef.current.contains(e.target)) {
        setSheetMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [sheetMenuOpen])

  // Reset per-sheet local view controls when switching sheets
  useEffect(() => {
    setSearch('')
    setSortLevels([])
    setColumnFilters([])
  }, [section?.id])

  // Apply Filter -> Sort pipeline
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

  // Check horizontal overflow to toggle subtle right-edge fade hint on grid table
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
  }, [checkTableScroll, fields.length, processedRecords.length, effectiveView])

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

  const handleMoveField = async (index, delta) => {
    if (!onReorderFields) return
    const targetIdx = index + delta
    if (targetIdx < 0 || targetIdx >= fields.length) return
    const ordered = [...fields]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(targetIdx, 0, moved)
    await onReorderFields(ordered.map((f) => f.id))
  }

  const handleExportCsv = () => {
    if (!fields.length || !processedRecords.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Entry Date', 'SL', ...fields.map((f) => esc(displayLabels[f.id]))].join(',')
    const rows = processedRecords.map((rec, idx) =>
      [
        esc(formatHumanDate(getRecordDateKey(rec, fields))),
        idx + 1,
        ...fields.map((f) => esc(formatPlainValue(f, getEffectiveCellValue(f, rec.data, fields)))),
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

  const getSortSummaryLabel = () => {
    if (!sortLevels.length) return 'Sort'
    const first = sortLevels[0]
    const f = fields.find((x) => String(x.id) === String(first.key))
    const name = f
      ? (displayLabels[f.id] || f.name)
      : first.key === '__entryDate'
        ? 'Entry Date'
        : first.key === '__updatedAt'
          ? 'Updated'
          : 'Created'
    return `${name} ${first.direction === 'desc' ? '↓' : '↑'}`
  }

  const hasActiveControls = sortLevels.length > 0 || columnFilters.length > 0 || Boolean(search.trim())

  return (
    <div className="relative">
      {/* ─── Sheet Top Bar (Search + Primary CTA + Sheet Options ⋮) ──── */}
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
            <span className="text-xs text-slate-400 font-medium flex-shrink-0">
              {fields.length} {fields.length === 1 ? 'col' : 'cols'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {fields.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-input)]/80 border border-[var(--border-subtle)] text-[11px] font-semibold text-slate-600 tabular-nums">
              <span>
                {processedRecords.length}
                {processedRecords.length !== records.length ? `/${records.length}` : ''}{' '}
                {processedRecords.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="hidden sm:inline text-[#C97814]">
                {fields.length} {fields.length === 1 ? 'col' : 'cols'}
              </span>
            </span>
          )}

          {fields.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddEntry()}
              className="hidden sm:inline-flex"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setAddColumnOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Add Column</span>
            </Button>
          )}

          {/* Sheet Actions Menu (⋮) */}
          <div ref={sheetMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSheetMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-slate-600 hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Sheet options"
              title="Sheet options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {sheetMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] rounded-xl shadow-xl border border-[var(--border-subtle)] py-1.5 z-50"
                onClick={() => setSheetMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setAddColumnOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E08A1E]" />
                  <span>Add Column</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCustomizeFields(null)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manage Columns</span>
                </button>

                {processedRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                )}

                <div className="my-1 border-t border-[var(--border-subtle)]" />

                <button
                  type="button"
                  onClick={() => onEditSection(section)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-[var(--bg-input)]"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rename Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteSection(section)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Sheet</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Fingertip Quick Action Strip (Scrollable on Phones) ────── */}
      {fields.length > 0 && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-x-auto no-scrollbar">
          <QuickActionPill
            icon={Plus}
            label="Column"
            onClick={() => setAddColumnOpen(true)}
          />
          <QuickActionPill
            icon={SlidersHorizontal}
            label="Manage Columns"
            badge={fields.length}
            onClick={() => onCustomizeFields(null)}
          />
          <QuickActionPill
            icon={ArrowUpDown}
            label={getSortSummaryLabel()}
            active={sortLevels.length > 0}
            onClick={() => {
              setSortSeedFieldId(null)
              setSortModalOpen(true)
            }}
          />
          <QuickActionPill
            icon={Filter}
            label="Filter"
            active={columnFilters.length > 0}
            badge={columnFilters.length > 0 ? columnFilters.length : null}
            onClick={() => {
              setFilterSeedFieldId(null)
              setFilterModalOpen(true)
            }}
          />
          <QuickActionPill
            icon={Sigma}
            label="Totals"
            onClick={() => setTotalsModalOpen(true)}
          />
          <QuickActionPill
            icon={Calendar}
            label="By Date"
            active={groupByDate}
            onClick={() => setGroupByDate((prev) => !prev)}
          />
          <QuickActionPill
            icon={effectiveView === 'cards' ? TableIcon : LayoutList}
            label={effectiveView === 'cards' ? 'Grid View' : 'Card View'}
            onClick={() => setViewModeOverride(effectiveView === 'cards' ? 'grid' : 'cards')}
          />
          {processedRecords.length > 0 && (
            <QuickActionPill
              icon={Download}
              label="Export CSV"
              onClick={handleExportCsv}
            />
          )}
        </div>
      )}

      {/* ─── Active Sort & Filter Summary Strip ─────────────────────── */}
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
          description="Add your first column (such as Item, Date, Qty, Rate, or Total) to start logging entries."
          action={
            <Button variant="primary" onClick={() => setAddColumnOpen(true)}>
              <Plus className="w-4 h-4" />
              Add First Column
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
            <div className="p-3.5 sm:p-5 space-y-5 bg-[var(--bg-canvas)]/70">
              {groupByDate ? (
                dateGroups.map((group) => (
                  <section key={group.dateKey} className="space-y-3">
                    {/* Centered Date Header & Subheader */}
                    <div className="border-b border-[var(--border-subtle)] pb-1">
                      <DateGroupBanner group={group} onAddForDate={onAddEntry} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.records.map((rec, idx) => (
                        <MobileEntryCard
                          key={rec.id}
                          record={rec}
                          index={idx}
                          fields={fields}
                          displayLabels={displayLabels}
                          onEdit={onEditEntry}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {processedRecords.map((rec, idx) => (
                    <MobileEntryCard
                      key={rec.id}
                      record={rec}
                      index={idx}
                      fields={fields}
                      displayLabels={displayLabels}
                      onEdit={onEditEntry}
                    />
                  ))}
                </div>
              )}

              {/* Quick Totals bar in Card View when numeric columns exist */}
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
                        {displayLabels[f.id]}:{' '}
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
            /* ─── Excel Spreadsheet Grid View ────────────────────────── */
            <div className="relative">
              <div
                ref={tableScrollRef}
                onScroll={checkTableScroll}
                className="overflow-x-auto"
              >
                  <table className="w-full text-left border-collapse border-b border-[var(--border-subtle)]">
                    <thead>
                      <tr className="bg-[var(--bg-input)]/80 text-slate-600 border-b border-[var(--border-subtle)] text-xs font-bold select-none">
                        <th className="sticky left-0 z-20 bg-[var(--bg-input)] px-3 py-2.5 w-12 text-center border-r border-[var(--border-subtle)] text-slate-500 text-[11px] uppercase tracking-wider tabular-nums">
                          SL
                        </th>

                        {fields.map((f, idx) => {
                          const activeSort = sortLevels[0] && String(sortLevels[0].key) === String(f.id)
                            ? sortLevels[0]
                            : null
                          const hasFilter = columnFilters.some((r) => String(r.fieldId) === String(f.id))
                          return (
                            <ColumnHeaderCell
                              key={f.id}
                              field={f}
                              index={idx}
                              totalCount={fields.length}
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

                        <th className="px-3 py-2.5 text-left border-r border-[var(--border-subtle)] whitespace-nowrap bg-[var(--bg-input)]/60">
                          <button
                            type="button"
                            onClick={() => setAddColumnOpen(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#C97814] hover:bg-[#FEF6E9] px-2 py-1 rounded transition-colors"
                            title="Add another column"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Column</span>
                          </button>
                        </th>

                        <th className="px-3 py-2.5 w-24 text-center text-[11px] uppercase tracking-wider text-slate-500">
                          Actions
                        </th>
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
                              <td colSpan={fields.length + 3} className="p-0">
                                <div className="sticky left-0 max-w-[calc(100vw-2.25rem)] sm:max-w-full">
                                  <DateGroupBanner group={group} onAddForDate={onAddEntry} />
                                </div>
                              </td>
                            </tr>
                          )}
                          {group.records.map((rec, idx) => {
                            const isDeleting = deletingRecordId === rec.id
                            const isEven = idx % 2 === 1
                            return (
                              <tr
                                key={rec.id}
                                className={`group border-b border-[var(--border-subtle)] transition-colors ${
                                  isEven ? 'bg-[#F6F4EF]/55' : 'bg-[var(--bg-card)]'
                                } hover:bg-[#FEF6E9]/60`}
                              >
                                <td
                                  className={`sticky left-0 z-10 px-3 py-2 text-center border-r border-[var(--border-subtle)] text-xs font-bold tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                                    isEven ? 'bg-[#F6F4EF]' : 'bg-[var(--bg-card)]'
                                  } group-hover:bg-[#FEF6E9]`}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </td>

                                {fields.map((f) => (
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

                                <td className="px-3 py-2 border-r border-[var(--border-subtle)] text-center text-slate-300">
                                  ·
                                </td>

                                <td className="px-2 py-2 text-center whitespace-nowrap">
                                  <div className="inline-flex items-center gap-0.5">
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

      {/* ─── Sticky Mobile FAB above bottom nav (when entries exist) ── */}
      {fields.length > 0 && records.length > 0 && (
        <button
          type="button"
          onClick={() => onAddEntry()}
          className="sm:hidden fixed bottom-20 right-4 z-30 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:scale-95 text-white font-bold px-4 py-3 rounded-full shadow-lg shadow-amber-700/25 flex items-center gap-2 transition-transform"
          aria-label="Add Entry"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm">Add Entry</span>
        </button>
      )}

      {/* Modals & Bottom Sheets */}
      <QuickAddColumnModal
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        onAddColumn={onAddColumn}
        existingFields={fields}
      />

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
