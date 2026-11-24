import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Trash2, Search, Download, Plus, Pencil,
  CheckCircle2, Minus, Loader2, SlidersHorizontal,
  Table as TableIcon, IndianRupee, Hash, Calendar, Type, List, CheckSquare,
  X, MoreVertical, AlertTriangle, FileSpreadsheet
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

/**
 * Returns icon corresponding to column data type
 */
function getFieldIcon(type) {
  switch (type) {
    case 'currency': return <IndianRupee className="w-3 h-3 text-emerald-600" />
    case 'number':   return <Hash className="w-3 h-3 text-blue-600" />
    case 'date':     return <Calendar className="w-3 h-3 text-amber-600" />
    case 'select':   return <List className="w-3 h-3 text-purple-600" />
    case 'checkbox': return <CheckSquare className="w-3 h-3 text-teal-600" />
    default:         return <Type className="w-3 h-3 text-slate-400" />
  }
}

const CURRENCY_NAME_RE = /\b(rate|amount|price|cost|bill|wage|salary|fee|total|budget)\b/i

/**
 * Formats ISO/YYYY-MM-DD date string cleanly as "24 Nov 2026" without timezone shift
 */
function formatHumanDate(raw) {
  const str = String(raw).trim()
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number)
    const dt = new Date(y, m - 1, d)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }
  const dt = new Date(str)
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return str
}

/**
 * Formats a field value cleanly for mobile cards & display
 */
function formatDisplayValue(field, value) {
  if (field.fieldType === 'checkbox') {
    const isChecked = Boolean(value)
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          isChecked
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-slate-100 text-slate-400'
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
      <span className="text-slate-800 font-medium tabular-nums">
        {formatHumanDate(value)}
      </span>
    )
  }

  if (field.fieldType === 'currency') {
    const num = Number(value)
    if (Number.isNaN(num)) return <span className="text-sm text-slate-800">{String(value)}</span>
    return (
      <span className="font-semibold text-slate-900 tabular-nums">
        ₹{num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'number') {
    const num = Number(value)
    if (Number.isNaN(num)) return <span className="text-sm text-slate-800">{String(value)}</span>
    return (
      <span className="font-medium text-slate-800 tabular-nums">
        {num.toLocaleString('en-IN')}
      </span>
    )
  }

  // Format plain numeric strings in currency-named text columns (e.g., RATE = 67890 -> ₹67,890)
  if (
    field.fieldType === 'text' &&
    CURRENCY_NAME_RE.test(field.name) &&
    /^-?\d+(\.\d{1,2})?$/.test(String(value).trim())
  ) {
    const num = Number(String(value).trim())
    return (
      <span className="font-semibold text-slate-900 tabular-nums">
        ₹{num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'select') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200/60">
        {value}
      </span>
    )
  }

  return <span className="text-slate-800 break-words">{String(value)}</span>
}

/**
 * Builds distinct display labels so duplicate column names (e.g., two "DATE" columns)
 * remain clearly distinguishable across headers and mobile cards.
 */
function buildDisplayLabels(fields) {
  const counts = {}
  for (const f of fields) {
    const key = f.name.trim().toLowerCase()
    counts[key] = (counts[key] || 0) + 1
  }

  const seen = {}
  const labels = {}
  for (const f of fields) {
    const key = f.name.trim().toLowerCase()
    if (counts[key] > 1) {
      seen[key] = (seen[key] || 0) + 1
      labels[f.id] = `${f.name} (${seen[key]})`
    } else {
      labels[f.id] = f.name
    }
  }
  return labels
}

/**
 * Fast inline cell editor / viewer for desktop & tablet table cells
 */
function EditableCell({ field, value, onSave }) {
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
          className="w-full h-10 px-2 py-1 bg-amber-50 text-slate-900 text-sm font-medium border border-amber-400 rounded focus:outline-none"
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
            className="w-full h-10 pl-6 pr-2 bg-amber-50 text-slate-900 text-sm font-semibold border border-amber-400 rounded focus:outline-none"
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
          inputMode="numeric"
          value={tempVal}
          onChange={(e) => setTempVal(e.target.value)}
          onBlur={() => commitChange()}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="w-full h-10 px-2 bg-amber-50 text-slate-900 text-sm font-medium border border-amber-400 rounded focus:outline-none"
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
          className="w-full h-10 px-2 bg-amber-50 text-slate-900 text-sm font-medium border border-amber-400 rounded focus:outline-none"
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
        className="w-full h-10 px-2 bg-amber-50 text-slate-900 text-sm font-medium border border-amber-400 rounded focus:outline-none"
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
      className="w-full min-h-[42px] px-3 py-2 flex items-center cursor-pointer transition-colors select-none text-sm rounded hover:bg-amber-50/70 text-slate-800"
    >
      {formatDisplayValue(field, value)}
    </div>
  )
}

/**
 * Quick bottom-sheet / popover to add a column with duplicate-name safeguard
 */
function QuickAddColumnModal({ open, onClose, onAddColumn, existingFields = [] }) {
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [typeTouched, setTypeTouched] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setName('')
      setFieldType('text')
      setTypeTouched(false)
      setOptionsText('')
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
    setSubmitting(true)
    try {
      const options = fieldType === 'select'
        ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
        : []
      await onAddColumn({
        name: name.trim(),
        fieldType,
        options,
        isRequired: false,
      })
      onClose()
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
        className="w-full sm:max-w-sm bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-[var(--border-subtle)] space-y-4"
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
              placeholder="e.g. Rate, Start Date, Vendor, Hours"
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
            </select>

            {fieldType === 'date' && hasDateAlready && !name.trim() && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400">Suggestions:</span>
                {['Start Date', 'End Date', 'Bill Date'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setName(preset)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-[11px] font-medium transition-colors"
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
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
 * Column Header with Options (Delete Column)
 */
function ColumnHeaderCell({ field, displayLabel, onDeleteField }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <th
      ref={menuRef}
      className="relative px-3.5 py-2.5 border-r border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-700 whitespace-nowrap min-w-[140px] group select-none"
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          {getFieldIcon(field.fieldType)}
          <span className="truncate">{displayLabel}</span>
          {field.isRequired && <span className="text-red-500 text-xs">*</span>}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          title="Column Options"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      {menuOpen && (
        <div
          className="absolute left-2 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 font-normal normal-case tracking-normal text-left"
          onClick={() => setMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete column "${field.name}"? Data in this column will be removed.`)) {
                onDeleteField(field.id)
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Column</span>
          </button>
        </div>
      )}
    </th>
  )
}

/**
 * Mobile Stacked Entry Card (< 640px) — clean zero-scroll overview of every column.
 * Tapping the card opens the Bottom Sheet form for editing (with Delete safely inside).
 */
function MobileEntryCard({
  record,
  index,
  fields,
  displayLabels,
  onEdit,
}) {
  // Choose a natural headline: first text/select/date field if available
  const headlineField =
    fields.find((f) => f.fieldType === 'text' && !CURRENCY_NAME_RE.test(f.name)) ||
    fields.find((f) => f.fieldType === 'select') ||
    fields[0]

  // Choose a prominent highlight currency/rate field on the card header right
  const amountField =
    fields.find((f) => f.id !== headlineField?.id && f.fieldType === 'currency') ||
    fields.find((f) => f.id !== headlineField?.id && CURRENCY_NAME_RE.test(f.name)) ||
    fields.find((f) => f.id !== headlineField?.id && f.fieldType === 'number')

  const remainingFields = fields.filter(
    (f) => f.id !== headlineField?.id && f.id !== amountField?.id
  )

  const headlineVal = headlineField ? record.data?.[String(headlineField.id)] : ''
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
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-slate-600 text-[10px] font-bold tabular-nums">
              #{String(index + 1).padStart(2, '0')}
            </span>
            {headlineField && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                {displayLabels[headlineField.id]}
              </span>
            )}
          </div>
          {headlineField && (
            <div className="text-sm font-bold text-slate-900 truncate pt-0.5">
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
            <div className="text-sm font-bold text-slate-900">
              {formatDisplayValue(amountField, record.data?.[String(amountField.id)])}
            </div>
          </div>
        )}
      </div>

      {/* Remaining Fields Grid (All visible without horizontal scrolling) */}
      {remainingFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-slate-100">
          {remainingFields.map((f) => (
            <div key={f.id} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                {displayLabels[f.id]}
              </p>
              <div className="text-xs font-medium text-slate-800 mt-0.5 truncate">
                {formatDisplayValue(f, record.data?.[String(f.id)])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * RecordRegisterTable — Mobile-first register + desktop spreadsheet:
 * - Primary CTA: "+ Add Entry" (plus sticky mobile FAB above bottom nav)
 * - Sheet actions (Add Column, Manage Columns, Export CSV, Rename Sheet, Delete Sheet) live safely in ⋮ menu
 * - On < 640px phones: clean stacked entry cards + slide-up Bottom Sheet form
 * - On >= 640px desktop/tablet: Excel-style grid with inline cell edits & right-edge scroll fade indicator
 * - When 0 entries exist: clean centered EmptyState instead of collapsed empty table box
 */
export default function RecordRegisterTable({
  section,
  records,
  loading,
  onAddEntry,
  onEditEntry,
  onInlineUpdateRecord,
  onDeleteRecord,
  onAddColumn,
  onDeleteField,
  onCustomizeFields,
  onEditSection,
  onDeleteSection,
  deletingRecordId,
}) {
  const [search, setSearch] = useState('')
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [sheetMenuOpen, setSheetMenuOpen] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sheetMenuRef = useRef(null)
  const tableScrollRef = useRef(null)
  const fields = section?.fields || []

  const displayLabels = useMemo(() => buildDisplayLabels(fields), [fields])

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

  // Reset search when switching sheets
  useEffect(() => {
    setSearch('')
  }, [section?.id])

  // Check horizontal overflow to toggle subtle right-edge fade hint on desktop/tablet table
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
  }, [checkTableScroll, fields.length, records.length, search])

  // Filter across any custom field
  const filtered = records.filter((rec) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return fields.some((f) => {
      const val = rec.data?.[String(f.id)]
      return val !== undefined && val !== null && String(val).toLowerCase().includes(q)
    })
  })

  // Numeric / currency column sums for status bar
  const numericFields = fields.filter(
    (f) => f.fieldType === 'currency' || f.fieldType === 'number' || CURRENCY_NAME_RE.test(f.name)
  )
  const statsByField = {}
  for (const f of numericFields) {
    const numbers = filtered
      .map((r) => Number(r.data?.[String(f.id)]))
      .filter((n) => !Number.isNaN(n) && n !== 0)
    if (numbers.length > 0 || f.fieldType === 'currency' || f.fieldType === 'number') {
      const sum = numbers.reduce((acc, n) => acc + n, 0)
      statsByField[f.id] = {
        sum,
        count: numbers.length,
        isCurrency: f.fieldType === 'currency' || CURRENCY_NAME_RE.test(f.name),
      }
    }
  }

  const handleCellChange = (record, fieldId, nextVal) => {
    const updatedData = {
      ...(record.data || {}),
      [String(fieldId)]: nextVal,
    }
    onInlineUpdateRecord(record.id, updatedData)
  }

  const handleExportCsv = () => {
    if (!fields.length || !filtered.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['#', ...fields.map((f) => esc(displayLabels[f.id]))].join(',')
    const rows = filtered.map((rec, idx) =>
      [idx + 1, ...fields.map((f) => esc(rec.data?.[String(f.id)] ?? ''))].join(',')
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

  return (
    <div className="relative">
      {/* ─── Sheet Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        {/* Left: Search (when entries exist) or Sheet Title */}
        {fields.length > 0 && records.length > 0 ? (
          <div className="relative flex items-center flex-1 sm:max-w-xs min-w-0">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${section.name}...`}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:bg-[var(--bg-card)] transition-all"
            />
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

        {/* Right: Desktop "+ Add Entry" CTA + "⋮" Sheet Menu (mobile uses sticky FAB) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {fields.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddEntry}
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
                className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] rounded-xl shadow-xl border border-[var(--border-subtle)] py-1.5 z-40"
                onClick={() => setSheetMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setAddColumnOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Add Column</span>
                </button>

                <button
                  type="button"
                  onClick={onCustomizeFields}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manage Columns</span>
                </button>

                {filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => onEditSection(section)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

      {/* ─── Content Body ───────────────────────────────────────────── */}
      {fields.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title={`No columns in ${section.name} yet`}
          description="Add your first column (such as Item, Date, or Rate) to start logging entries."
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
            <Button variant="primary" onClick={onAddEntry}>
              <Plus className="w-4 h-4" />
              Add First Entry
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching entries"
          description={`No entries in ${section.name} match "${search}".`}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          }
        />
      ) : (
        <>
          {/* ─── Mobile Stacked Cards (< 640px) ────────────────────── */}
          <div className="sm:hidden p-3.5 space-y-3 bg-[var(--bg-canvas)]/70">
            {filtered.map((rec, idx) => (
              <MobileEntryCard
                key={rec.id}
                record={rec}
                index={idx}
                fields={fields}
                displayLabels={displayLabels}
                onEdit={onEditEntry}
              />
            ))}

            {/* Subtle muted summary footer on mobile */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-[11px] text-slate-400 font-medium">
              <span className="tabular-nums">
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} • {fields.length} {fields.length === 1 ? 'column' : 'columns'}
              </span>
              {Object.keys(statsByField).length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {numericFields.map((f) => {
                    const s = statsByField[f.id]
                    if (!s) return null
                    return (
                      <span key={f.id} className="tabular-nums">
                        {displayLabels[f.id]}:{' '}
                        <strong className="text-slate-600 font-semibold">
                          {s.isCurrency
                            ? `₹${s.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                            : s.sum.toLocaleString('en-IN')}
                        </strong>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Desktop / Tablet Spreadsheet Grid (>= 640px) ──────── */}
          <div className="hidden sm:block relative">
            <div
              ref={tableScrollRef}
              onScroll={checkTableScroll}
              className="overflow-x-auto"
            >
              <table className="w-full text-left border-collapse border-b border-[var(--border-subtle)]">
                <thead>
                  <tr className="bg-[var(--bg-input)]/80 text-slate-600 border-b border-[var(--border-subtle)] text-xs font-bold select-none">
                    <th className="sticky left-0 z-20 bg-[var(--bg-input)] px-3 py-2.5 w-12 text-center border-r border-[var(--border-subtle)] text-slate-500 text-[11px] tabular-nums">
                      #
                    </th>

                    {fields.map((f) => (
                      <ColumnHeaderCell
                        key={f.id}
                        field={f}
                        displayLabel={displayLabels[f.id]}
                        onDeleteField={onDeleteField}
                      />
                    ))}

                    <th className="px-3 py-2.5 w-28 text-center border-r border-[var(--border-subtle)] whitespace-nowrap bg-[var(--bg-input)]/60">
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

                    <th className="px-3 py-2.5 w-20 text-center text-[11px] uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((rec, idx) => {
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
                            className="p-0 border-r border-[var(--border-subtle)] whitespace-nowrap align-middle"
                          >
                            <EditableCell
                              field={f}
                              value={rec.data?.[String(f.id)]}
                              onSave={(nextVal) => handleCellChange(rec, f.id, nextVal)}
                            />
                          </td>
                        ))}

                        <td className="px-3 py-2 border-r border-slate-200/80 text-center text-slate-200">
                          ·
                        </td>

                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => onEditEntry(rec)}
                              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
                </tbody>
              </table>
            </div>

            {/* Right-edge scroll hint gradient when table overflows horizontally */}
            {canScrollRight && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FCFBF8]/95 via-[#FCFBF8]/60 to-transparent z-20"
              />
            )}
          </div>

          {/* ─── Desktop Status Bar (Sums & Counts) ─────────────────── */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-[#1E242B] text-slate-200 text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="tabular-nums font-semibold">
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="tabular-nums font-semibold text-[#F2A649]">
                {fields.length} {fields.length === 1 ? 'column' : 'columns'}
              </span>
            </div>

            {numericFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                {numericFields.map((f) => {
                  const s = statsByField[f.id]
                  if (!s) return null
                  return (
                    <div key={f.id} className="flex items-center gap-1.5 tabular-nums">
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider">
                        {displayLabels[f.id]} SUM:
                      </span>
                      <strong className="text-[#F2A649] font-bold">
                        {s.isCurrency
                          ? `₹${s.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                          : s.sum.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Sticky Mobile FAB above bottom nav (when entries exist) ── */}
      {fields.length > 0 && records.length > 0 && (
        <button
          type="button"
          onClick={onAddEntry}
          className="sm:hidden fixed bottom-20 right-4 z-30 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:scale-95 text-white font-bold px-4 py-3 rounded-full shadow-lg shadow-amber-700/25 flex items-center gap-2 transition-transform"
          aria-label="Add Entry"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm">Add Entry</span>
        </button>
      )}

      {/* Quick Add Column Modal */}
      <QuickAddColumnModal
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        onAddColumn={onAddColumn}
        existingFields={fields}
      />
    </div>
  )
}
