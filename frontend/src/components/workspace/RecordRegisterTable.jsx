import { useState, useRef, useEffect } from 'react'
import {
  Trash2, Search, Download, Plus,
  CheckCircle2, Minus, Loader2,
  Table as TableIcon, IndianRupee, Hash, Calendar, Type, List, CheckSquare,
  X, Check, MoreVertical
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

/**
 * Fast inline cell editor / viewer
 */
function EditableCell({
  field,
  value,
  onSave,
  isDraft = false,
  placeholder = '',
}) {
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

  // Checkbox: 1-tap direct toggle
  if (field.fieldType === 'checkbox') {
    const isChecked = Boolean(value)
    return (
      <div
        className="w-full h-full flex items-center justify-center p-2 cursor-pointer select-none"
        onClick={() => onSave(!isChecked)}
      >
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            isChecked
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {isChecked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          <span>{isChecked ? 'Yes' : 'No'}</span>
        </span>
      </div>
    )
  }

  // Active editing state
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
        placeholder={placeholder || 'Type here...'}
        className="w-full h-10 px-2 bg-amber-50 text-slate-900 text-sm font-medium border border-amber-400 rounded focus:outline-none"
      />
    )
  }

  // Resting display state: click or tap to edit
  const hasValue = value !== undefined && value !== null && String(value).trim() !== ''

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
      className={`w-full min-h-[42px] px-3 py-2 flex items-center cursor-pointer transition-colors select-none text-sm rounded ${
        isDraft
          ? 'text-slate-400 italic hover:bg-amber-50/60 hover:text-slate-700'
          : 'hover:bg-amber-50/70 text-slate-800'
      }`}
    >
      {!hasValue ? (
        <span className="text-slate-300 text-xs italic">
          {placeholder || (isDraft ? '+ Add...' : '—')}
        </span>
      ) : field.fieldType === 'currency' ? (
        <span className="font-semibold text-slate-900 tabular-nums">
          ₹{Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      ) : field.fieldType === 'number' ? (
        <span className="font-medium text-slate-800 tabular-nums">
          {Number(value).toLocaleString('en-IN')}
        </span>
      ) : field.fieldType === 'select' ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200/60">
          {value}
        </span>
      ) : (
        <span className="truncate max-w-xs">{String(value)}</span>
      )}
    </div>
  )
}

/**
 * Quick inline popover to add as many columns as needed
 */
function QuickAddColumnModal({ open, onClose, onAddColumn }) {
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [optionsText, setOptionsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setName('')
      setFieldType('text')
      setOptionsText('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h4 className="text-sm font-bold text-slate-900">Add New Column</h4>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Column Header Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              placeholder="e.g. Rate, Vehicle No, Bags, Supplier"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Column Data Type
            </label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="text">Text (General Description, Name)</option>
              <option value="currency">Currency / Amount (₹)</option>
              <option value="number">Number / Quantity</option>
              <option value="date">Date</option>
              <option value="select">Dropdown Choices</option>
              <option value="checkbox">Yes / No Checkbox</option>
            </select>
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
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
 * Column Header with Options (Rename/Delete)
 */
function ColumnHeaderCell({ field, onDeleteField }) {
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
          <span className="truncate">{field.name}</span>
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
          className="absolute left-2 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 font-normal lowercase tracking-normal text-left"
          onClick={() => setMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete column "${field.name}"? Data in this column will be removed.`)) {
                onDeleteField(field.id)
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
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
 * RecordRegisterTable — Pure Excel Experience:
 * - Empty cells under each column ready to be edited
 * - Type in empty row at the bottom -> row is saved -> new blank row appears
 * - Click any existing cell to edit inline
 * - Permanent "+ Column" button to add as many columns as needed
 * - Pinned Excel status bar (Sums, Counts, Row totals)
 */
export default function RecordRegisterTable({
  section,
  records,
  loading,
  onInlineUpdateRecord,
  onInlineCreateRecord,
  onDeleteRecord,
  onAddColumn,
  onDeleteField,
  deletingRecordId,
}) {
  const [search, setSearch] = useState('')
  const [draftRow, setDraftRow] = useState({})
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const fields = section?.fields || []

  // Filter across any custom field
  const filtered = records.filter((rec) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return fields.some((f) => {
      const val = rec.data?.[String(f.id)]
      return val !== undefined && val !== null && String(val).toLowerCase().includes(q)
    })
  })

  // Numeric column calculations for Excel-like status bar
  const numericFields = fields.filter((f) => f.fieldType === 'currency' || f.fieldType === 'number')
  const statsByField = {}
  for (const f of numericFields) {
    const numbers = filtered
      .map((r) => Number(r.data?.[String(f.id)]))
      .filter((n) => !Number.isNaN(n) && n !== 0)
    const sum = numbers.reduce((acc, n) => acc + n, 0)
    statsByField[f.id] = { sum, count: numbers.length }
  }

  // Handle cell edit on an existing row
  const handleCellChange = (record, fieldId, nextVal) => {
    const updatedData = {
      ...(record.data || {}),
      [String(fieldId)]: nextVal,
    }
    onInlineUpdateRecord(record.id, updatedData)
  }

  // Handle editing the persistent bottom blank row
  const handleDraftCellChange = async (fieldId, nextVal) => {
    const updatedDraft = {
      ...draftRow,
      [String(fieldId)]: nextVal,
    }
    setDraftRow(updatedDraft)

    // Check if there is meaningful data to commit
    const hasAnyContent = Object.values(updatedDraft).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== '' && v !== false
    )

    if (hasAnyContent) {
      // Auto-commit new row and clear draft so a new empty row is instantly available!
      await onInlineCreateRecord(updatedDraft)
      setDraftRow({})
    }
  }

  const handleExportCsv = () => {
    if (!fields.length || !filtered.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['#', ...fields.map((f) => esc(f.name))].join(',')
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

  // If section has 0 columns, show 1-tap column builder
  if (fields.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center space-y-5">
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Add Columns to {section.name}</h3>
          <p className="text-sm text-slate-500">
            Just like Excel, add columns to structure your records. You can add as many columns as needed.
          </p>
        </div>

        <div>
          <Button variant="primary" onClick={() => setAddColumnOpen(true)}>
            <Plus className="w-4 h-4" />
            Add First Column
          </Button>
        </div>

        <QuickAddColumnModal
          open={addColumnOpen}
          onClose={() => setAddColumnOpen(false)}
          onAddColumn={onAddColumn}
        />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* ─── Excel Spreadsheet Header & Controls ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        {/* Search */}
        <div className="relative flex items-center w-full sm:max-w-xs">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${section.name}...`}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-100 text-sm text-slate-800 placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}

          <Button variant="primary" size="sm" onClick={() => setAddColumnOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Column</span>
          </Button>
        </div>
      </div>

      {/* ─── Excel Spreadsheet Grid ─────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading sheet...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border-b border-slate-200">
            <thead>
              <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 text-xs font-bold select-none">
                {/* Sticky Row Number Index Column */}
                <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 w-12 text-center border-r border-slate-200 text-slate-400 text-[11px] tabular-nums">
                  #
                </th>

                {/* Dynamic Column Headers */}
                {fields.map((f) => (
                  <ColumnHeaderCell
                    key={f.id}
                    field={f}
                    onDeleteField={onDeleteField}
                  />
                ))}

                {/* Permanent "+ Column" header cell (Excel / Airtable style) */}
                <th className="px-3 py-2.5 w-32 text-center border-r border-slate-200 whitespace-nowrap bg-slate-100/70">
                  <button
                    type="button"
                    onClick={() => setAddColumnOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/80 px-2.5 py-1 rounded transition-colors"
                    title="Add another column to this sheet"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Column</span>
                  </button>
                </th>

                {/* Row Delete Action Header */}
                <th className="px-3 py-2.5 w-14 text-center text-[11px] uppercase tracking-wider text-slate-400">
                  Del
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Existing Rows */}
              {filtered.map((rec, idx) => {
                const isDeleting = deletingRecordId === rec.id
                const isEven = idx % 2 === 1
                return (
                  <tr
                    key={rec.id}
                    className={`group border-b border-slate-200/80 transition-colors ${
                      isEven ? 'bg-slate-50/40' : 'bg-white'
                    } hover:bg-amber-50/30`}
                  >
                    {/* Sticky Row Index Cell */}
                    <td
                      className={`sticky left-0 z-10 px-3 py-2 text-center border-r border-slate-200 text-xs font-bold tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                        isEven ? 'bg-slate-50' : 'bg-white'
                      } group-hover:bg-amber-50/50`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </td>

                    {/* Inline Editable Cells */}
                    {fields.map((f) => (
                      <td
                        key={f.id}
                        className="p-0 border-r border-slate-200/80 whitespace-nowrap align-middle"
                      >
                        <EditableCell
                          field={f}
                          value={rec.data?.[String(f.id)]}
                          onSave={(nextVal) => handleCellChange(rec, f.id, nextVal)}
                        />
                      </td>
                    ))}

                    {/* Spacer cell under + Column */}
                    <td className="px-3 py-2 border-r border-slate-200/80 text-center text-slate-200">
                      ·
                    </td>

                    {/* Delete Row Button */}
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => onDeleteRecord(rec)}
                        className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Row"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* ─── Persistent Blank Row At Bottom (Click any cell to type) ─── */}
              <tr className="bg-amber-50/20 hover:bg-amber-50/40 border-b-2 border-dashed border-amber-300 transition-colors">
                {/* Plus icon indicating new row slot */}
                <td className="sticky left-0 z-10 px-3 py-2 text-center border-r border-slate-200 bg-amber-50/80 text-amber-600 font-bold text-xs shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  <Plus className="w-3.5 h-3.5 mx-auto" />
                </td>

                {/* Empty cells under each column ready to be typed in */}
                {fields.map((f) => (
                  <td
                    key={f.id}
                    className="p-0 border-r border-slate-200/80 whitespace-nowrap align-middle"
                  >
                    <EditableCell
                      field={f}
                      value={draftRow[String(f.id)]}
                      onSave={(nextVal) => handleDraftCellChange(f.id, nextVal)}
                      isDraft={true}
                      placeholder={`+ Type ${f.name.toLowerCase()}...`}
                    />
                  </td>
                ))}

                {/* Spacer */}
                <td className="px-3 py-2 border-r border-slate-200/80 text-center text-slate-300 text-xs">
                  ·
                </td>

                {/* Spacer */}
                <td className="px-2 py-2 text-center text-slate-300 text-xs">
                  ·
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Excel Bottom Status Bar (Calculations & Totals) ─────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-slate-900 text-slate-200 text-xs font-medium">
        <div className="flex items-center gap-3">
          <span className="tabular-nums font-semibold">
            {filtered.length} {filtered.length === 1 ? 'row' : 'rows'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="tabular-nums font-semibold text-amber-400">
            {fields.length} {fields.length === 1 ? 'column' : 'columns'}
          </span>
        </div>

        {/* Live Sums for Currency / Number columns */}
        {numericFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {numericFields.map((f) => {
              const s = statsByField[f.id]
              if (!s) return null
              return (
                <div key={f.id} className="flex items-center gap-1.5 tabular-nums">
                  <span className="text-slate-400 text-[11px] uppercase tracking-wider">{f.name} SUM:</span>
                  <strong className="text-amber-400 font-bold">
                    {f.fieldType === 'currency'
                      ? `₹${s.sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                      : s.sum.toLocaleString('en-IN')}
                  </strong>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Add Column Modal */}
      <QuickAddColumnModal
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        onAddColumn={onAddColumn}
      />
    </div>
  )
}
