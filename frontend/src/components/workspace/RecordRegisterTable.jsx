import { useState } from 'react'
import {
  Pencil, Trash2, Search, Download, Plus,
  CheckCircle2, Minus, Loader2,
  Table as TableIcon, LayoutList, IndianRupee, Hash, Calendar, Type, List, CheckSquare
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
 * Formats a custom field value cleanly for display
 */
function formatCell(field, rawValue) {
  if (field.fieldType === 'checkbox') {
    return rawValue ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
        <CheckCircle2 className="w-3 h-3" /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-xs font-medium">
        <Minus className="w-3 h-3" /> No
      </span>
    )
  }

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return <span className="text-slate-300">—</span>
  }

  if (field.fieldType === 'currency') {
    const num = Number(rawValue)
    if (Number.isNaN(num)) return rawValue
    return (
      <span className="font-semibold text-slate-900 tabular-nums">
        ₹{num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (field.fieldType === 'number') {
    const num = Number(rawValue)
    if (Number.isNaN(num)) return rawValue
    return <span className="tabular-nums font-medium text-slate-800">{num.toLocaleString('en-IN')}</span>
  }

  if (field.fieldType === 'select') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200/60">
        {rawValue}
      </span>
    )
  }

  return <span className="text-slate-800">{String(rawValue)}</span>
}

/**
 * Common column quick-starter presets
 */
const COLUMN_PRESETS = [
  { name: 'Date',         fieldType: 'date',     isRequired: true },
  { name: 'Item / Scope', fieldType: 'text',     isRequired: true },
  { name: 'Amount',       fieldType: 'currency', isRequired: true },
  { name: 'Quantity',     fieldType: 'text',     isRequired: false },
  { name: 'Party / Vendor', fieldType: 'text',   isRequired: false },
  { name: 'Status',       fieldType: 'select',   isRequired: false, options: ['Paid', 'Pending', 'In Progress', 'Done'] },
]

/**
 * RecordRegisterTable — Excel-grade spreadsheet with phone-first interaction.
 * Features:
 * - Direct Excel grid with frozen sticky row index (#)
 * - Mobile view toggle: [ ▦ Sheet ] vs [ ☲ Cards ]
 * - Direct "+ Column" header cell to add columns in 1 click
 * - Excel status bar with SUM, COUNT, and AVERAGE
 * - Floating thumb "+ Add Row" FAB on mobile
 */
export default function RecordRegisterTable({
  section,
  records,
  loading,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  onCustomizeFields,
  onAddColumnPreset,
  deletingRecordId,
}) {
  const [search, setSearch] = useState('')
  const [mobileView, setMobileView] = useState('sheet') // 'sheet' | 'cards'
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
    const avg = numbers.length ? sum / numbers.length : 0
    statsByField[f.id] = { sum, avg, count: numbers.length }
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
    const a = document.createElement('a')
    a.href = url
    a.download = `${(section.name || 'register').toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // If section has 0 columns, show 1-tap column builder
  if (fields.length === 0) {
    return (
      <div className="p-6 sm:p-10 text-center space-y-6">
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Set Up Columns for {section.name}</h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Just like an Excel sheet, start by adding columns. Tap any quick preset below or create your own custom field:
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
          {COLUMN_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onAddColumnPreset?.(p)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-slate-700 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <div>
          <Button variant="primary" onClick={onCustomizeFields}>
            <Plus className="w-4 h-4" />
            Custom Column Builder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* ─── Excel Spreadsheet Header & Toolbar ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-white">
        {/* Search */}
        <div className="relative flex items-center w-full sm:max-w-xs">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${section.name}...`}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-100 text-sm text-slate-800 placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Mobile View Toggle: Sheet vs Cards */}
          <div className="sm:hidden flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setMobileView('sheet')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${
                mobileView === 'sheet'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Spreadsheet Grid View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView('cards')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${
                mobileView === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={onCustomizeFields} className="hidden sm:inline-flex">
            Columns ({fields.length})
          </Button>

          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}

          <Button variant="primary" size="sm" onClick={onAddRecord}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </Button>
        </div>
      </div>

      {/* ─── Body: Loading / Empty / Data ────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading spreadsheet...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title={records.length === 0 ? `No rows in ${section.name}` : 'No matching rows found'}
          description={
            records.length === 0
              ? 'Tap "Add Row" below to log your first record.'
              : 'Clear your search term to see all entries.'
          }
          action={
            records.length === 0 ? (
              <Button variant="primary" size="sm" onClick={onAddRecord}>
                <Plus className="w-3.5 h-3.5" />
                Add First Row
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* ─── View 1: Card View on Mobile (when Cards selected) ─────── */}
          {mobileView === 'cards' && (
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map((rec, idx) => {
                const isDeleting = deletingRecordId === rec.id
                return (
                  <div
                    key={rec.id}
                    onClick={() => onEditRecord(rec)}
                    className="p-4 space-y-3 active:bg-amber-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 tabular-nums">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onEditRecord(rec)}
                          className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => onDeleteRecord(rec)}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {fields.map((f) => (
                        <div key={f.id} className={f.fieldType === 'textarea' ? 'col-span-2' : ''}>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                            {f.name}
                          </span>
                          <span className="text-sm font-medium">
                            {formatCell(f, rec.data?.[String(f.id)])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ─── View 2: Excel Spreadsheet Grid (Desktop & Mobile Grid) ── */}
          <div className={`${mobileView === 'cards' ? 'hidden sm:block' : 'block'} overflow-x-auto`}>
            <table className="w-full text-left border-collapse border-b border-slate-200">
              <thead>
                <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 text-xs font-bold select-none">
                  {/* Sticky Row Number Index Column */}
                  <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 w-12 text-center border-r border-slate-200 text-slate-400 text-[11px] tabular-nums">
                    #
                  </th>

                  {/* Dynamic Column Headers */}
                  {fields.map((f) => (
                    <th
                      key={f.id}
                      className="px-4 py-2.5 border-r border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-700 whitespace-nowrap min-w-[130px]"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        {getFieldIcon(f.fieldType)}
                        <span>{f.name}</span>
                        {f.isRequired && <span className="text-red-500 text-xs">*</span>}
                      </div>
                    </th>
                  ))}

                  {/* Add Column Button cell right in the header row */}
                  <th className="px-3 py-2.5 w-28 text-center border-r border-slate-200 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={onCustomizeFields}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-800 hover:bg-amber-100/70 px-2 py-1 rounded transition-colors"
                      title="Add or Customize Columns"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Column</span>
                    </button>
                  </th>

                  {/* Actions Column */}
                  <th className="px-3 py-2.5 w-16 text-center text-[11px] uppercase tracking-wider text-slate-400">
                    Del
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
                      onClick={() => onEditRecord(rec)}
                      className={`group border-b border-slate-200/80 cursor-pointer transition-colors ${
                        isEven ? 'bg-slate-50/40' : 'bg-white'
                      } hover:bg-amber-50/50`}
                    >
                      {/* Sticky Row Number Cell */}
                      <td
                        className={`sticky left-0 z-10 px-3 py-3 text-center border-r border-slate-200 text-xs font-bold tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                          isEven ? 'bg-slate-50' : 'bg-white'
                        } group-hover:bg-amber-50`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* Data Cells */}
                      {fields.map((f) => (
                        <td
                          key={f.id}
                          className="px-4 py-3 text-sm text-slate-800 border-r border-slate-200/80 whitespace-nowrap max-w-xs truncate"
                        >
                          {formatCell(f, rec.data?.[String(f.id)])}
                        </td>
                      ))}

                      {/* Spacer matching + Column header */}
                      <td className="px-3 py-3 border-r border-slate-200/80 text-center">
                        <span className="text-slate-300 text-xs">·</span>
                      </td>

                      {/* Row Delete Button */}
                      <td
                        className="px-2 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => onDeleteRecord(rec)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete row"
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
              </tbody>
            </table>
          </div>

          {/* ─── Excel Bottom Status / Summary Bar ─────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-slate-900 text-slate-200 text-xs font-medium">
            <div className="flex items-center gap-4">
              <span className="tabular-nums">
                <strong>{filtered.length}</strong> {filtered.length === 1 ? 'row' : 'rows'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="tabular-nums">
                <strong>{fields.length}</strong> columns
              </span>
            </div>

            {/* Live sums for currency/number columns */}
            {numericFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {numericFields.map((f) => {
                  const s = statsByField[f.id]
                  if (!s) return null
                  return (
                    <div key={f.id} className="flex items-center gap-1.5 tabular-nums">
                      <span className="text-slate-400 text-[11px] uppercase">{f.name} SUM:</span>
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
        </>
      )}

      {/* ─── Mobile Floating Action Button (FAB) ────────────────────── */}
      <button
        type="button"
        onClick={onAddRecord}
        className="lg:hidden fixed bottom-20 right-4 z-40 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition-transform"
        aria-label="Add Row"
      >
        <Plus className="w-5 h-5" />
        <span className="text-sm font-semibold pr-1">Add Row</span>
      </button>
    </div>
  )
}
