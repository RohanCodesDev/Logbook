import { useState } from 'react'
import {
  Pencil, Trash2, Search, Download, Plus, SlidersHorizontal,
  CheckCircle2, Minus, FileSpreadsheet, Loader2
} from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

/**
 * Formats a custom field value cleanly for display across desktop tables and mobile cards.
 */
function formatCell(field, rawValue) {
  if (field.fieldType === 'checkbox') {
    return rawValue ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
        <CheckCircle2 className="w-3 h-3" /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
        {rawValue}
      </span>
    )
  }

  return <span className="text-slate-700">{String(rawValue)}</span>
}

function formatTotal(field, total) {
  if (field.fieldType === 'currency') {
    return `₹${(total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  }
  return (total || 0).toLocaleString('en-IN')
}

/**
 * RecordRegisterTable — Spreadsheet table on desktop + structured record cards on mobile.
 * Designed as a mobile-friendly alternative to Google Sheets.
 */
export default function RecordRegisterTable({
  section,
  records,
  loading,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  onCustomizeFields,
  deletingRecordId,
}) {
  const [search, setSearch] = useState('')
  const fields = section?.fields || []

  const filtered = records.filter((rec) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return fields.some((f) => {
      const val = rec.data?.[String(f.id)]
      return val !== undefined && val !== null && String(val).toLowerCase().includes(q)
    })
  })

  const numericFields = fields.filter((f) => f.fieldType === 'currency' || f.fieldType === 'number')
  const columnTotals = {}
  for (const f of numericFields) {
    columnTotals[f.id] = filtered.reduce((sum, rec) => {
      const num = Number(rec.data?.[String(f.id)])
      return Number.isNaN(num) ? sum : sum + num
    }, 0)
  }

  const handleExportCsv = () => {
    if (!fields.length || !filtered.length) return
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['#', ...fields.map((f) => escape(f.name))].join(',')
    const rows = filtered.map((rec, idx) =>
      [idx + 1, ...fields.map((f) => escape(rec.data?.[String(f.id)] ?? ''))].join(',')
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

  if (fields.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="Define custom fields for this section"
        description={`"${section.name}" doesn't have any columns yet. Add custom fields like Date, Material, Vendor, or Amount to begin recording entries.`}
        action={
          <Button variant="primary" onClick={onCustomizeFields}>
            <Plus className="w-4 h-4" />
            Add Custom Fields
          </Button>
        }
      />
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
        <div className="relative flex items-center w-full sm:max-w-xs">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search in ${section.name}...`}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 text-base sm:text-sm text-slate-700 placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCustomizeFields}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Fields ({fields.length})
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" />
              CSV
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onAddRecord} className="ml-auto sm:ml-0">
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading records...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={records.length === 0 ? 'No records logged yet' : 'No matching records'}
          description={
            records.length === 0
              ? `Tap "Add Record" to log your first entry into ${section.name}.`
              : 'Try adjusting your search query.'
          }
          action={
            records.length === 0 ? (
              <Button variant="primary" size="sm" onClick={onAddRecord}>
                <Plus className="w-3.5 h-3.5" />
                Add First Record
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Mobile Totals Summary Strip (< md) */}
          {numericFields.length > 0 && (
            <div className="md:hidden px-4 py-3 bg-amber-50/60 border-b border-amber-100 flex flex-wrap gap-x-5 gap-y-2">
              {numericFields.map((f) => (
                <div key={f.id}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
                    Total {f.name}
                  </p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatTotal(f, columnTotals[f.id])}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Mobile Stacked Record Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map((rec, idx) => {
              const isDeleting = deletingRecordId === rec.id
              return (
                <div key={rec.id} className="p-4 space-y-3 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100/80">
                    <span className="text-xs font-bold text-slate-400 tabular-nums">
                      Entry #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditRecord(rec)}
                        className="text-slate-600 hover:text-indigo-600 px-2.5 py-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => onDeleteRecord(rec)}
                        className="text-slate-500 hover:text-red-600 px-2 py-1"
                      >
                        {isDeleting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {fields.map((f) => (
                      <div
                        key={f.id}
                        className={f.fieldType === 'textarea' ? 'col-span-2' : ''}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                          {f.name}
                        </p>
                        <div className="text-sm break-words">
                          {formatCell(f, rec.data?.[String(f.id)])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Spreadsheet Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="pl-6 pr-3 py-3 w-12 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    #
                  </th>
                  {fields.map((f) => (
                    <th
                      key={f.id}
                      className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {f.name}
                    </th>
                  ))}
                  <th className="pl-4 pr-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, idx) => {
                  const isDeleting = deletingRecordId === rec.id
                  return (
                    <tr
                      key={rec.id}
                      className="group border-b border-slate-100 last:border-b-0 hover:bg-amber-50/35 transition-colors"
                    >
                      <td className="pl-6 pr-3 py-3.5 text-xs font-bold text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      {fields.map((f) => (
                        <td key={f.id} className="px-4 py-3.5 text-sm max-w-xs truncate">
                          {formatCell(f, rec.data?.[String(f.id)])}
                        </td>
                      ))}
                      <td className="pl-4 pr-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditRecord(rec)}
                            title="Edit Record"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting}
                            onClick={() => onDeleteRecord(rec)}
                            title="Delete Record"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            {isDeleting
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {numericFields.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="pl-6 pr-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Total
                    </td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-4 py-3 text-sm font-bold text-slate-900 tabular-nums">
                        {f.fieldType === 'currency' || f.fieldType === 'number'
                          ? formatTotal(f, columnTotals[f.id])
                          : ''}
                      </td>
                    ))}
                    <td className="pr-6 py-3 text-right text-xs text-slate-400 tabular-nums">
                      {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
