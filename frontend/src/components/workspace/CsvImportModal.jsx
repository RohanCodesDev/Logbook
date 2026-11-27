import { useState, useEffect, useMemo, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import AnimatedDropdown from '../ui/animated-dropdown'
import { CURRENCY_NAME_RE, getTodayYmd } from '../../utils/sheetUtils'

/**
 * Parses CSV or Tab-separated (Excel clipboard paste) text cleanly with quote handling.
 */
function parseDelimitedText(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return { headers: [], rows: [] }

  const firstLine = text.split('\n')[0] || ''
  const delimiter = (firstLine.match(/\t/g) || []).length >= (firstLine.match(/,/g) || []).length && firstLine.includes('\t')
    ? '\t'
    : ','

  const parsedRows = []
  let currentRow = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if (ch === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim())
      if (currentRow.some((c) => c !== '')) parsedRows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }
  currentRow.push(currentCell.trim())
  if (currentRow.some((c) => c !== '')) parsedRows.push(currentRow)

  if (!parsedRows.length) return { headers: [], rows: [] }
  const headers = parsedRows[0].map((h, i) => h || `Column ${i + 1}`)
  const rows = parsedRows.slice(1)
  return { headers, rows }
}

function inferColumnType(headerName, sampleValues = []) {
  const nonEmpty = sampleValues.map((v) => String(v || '').trim()).filter(Boolean)
  if (CURRENCY_NAME_RE.test(headerName)) return 'currency'
  if (nonEmpty.length > 0 && nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date'
  if (nonEmpty.length > 0 && nonEmpty.every((v) => /^₹?\s*-?[\d,]+(\.\d+)?$/.test(v))) {
    return nonEmpty.some((v) => v.includes('₹')) ? 'currency' : 'number'
  }
  return 'text'
}

function normalizeDateCandidate(raw) {
  const s = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const parsed = Date.parse(s)
  if (Number.isFinite(parsed)) {
    const dt = new Date(parsed)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

/**
 * CsvImportModal — Upload CSV or paste directly from Excel/Sheets into the current sheet.
 */
export default function CsvImportModal({
  open,
  onClose,
  section,
  onImport,
}) {
  const [rawText, setRawText]       = useState('')
  const [mappings, setMappings]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)
  const fileInputRef                = useRef(null)

  const fields = section?.fields || []

  const parsed = useMemo(() => parseDelimitedText(rawText), [rawText])

  useEffect(() => {
    if (!open) return
    setRawText('')
    setMappings({})
    setError(null)
  }, [open, section?.id])

  // Auto-map parsed headers to existing columns, Entry Date, or Create New Column
  useEffect(() => {
    if (!parsed.headers.length) {
      setMappings({})
      return
    }
    const next = {}
    parsed.headers.forEach((hdr, idx) => {
      const lower = hdr.trim().toLowerCase()
      if (/^(entry\s*date|date)$/i.test(lower)) {
        const dateField = fields.find((f) => f.fieldType === 'date' && /^date$/i.test(f.name.trim()))
        next[idx] = dateField ? String(dateField.id) : '__entryDate'
        return
      }
      const exact = fields.find((f) => f.fieldType !== 'formula' && f.name.trim().toLowerCase() === lower)
      next[idx] = exact ? String(exact.id) : '__create'
    })
    setMappings(next)
  }, [parsed.headers, fields])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawText(String(ev.target?.result || ''))
      setError(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmImport = async () => {
    if (!parsed.rows.length) {
      setError('Paste rows or upload a CSV file with at least one data row.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const columnsToCreate = []
      parsed.headers.forEach((hdr, idx) => {
        if (mappings[idx] === '__create') {
          const samples = parsed.rows.slice(0, 10).map((r) => r[idx])
          columnsToCreate.push({
            colIdx: idx,
            name: hdr,
            fieldType: inferColumnType(hdr, samples),
          })
        }
      })

      await onImport({
        headers: parsed.headers,
        rows: parsed.rows,
        mappings,
        columnsToCreate,
        defaultDate: getTodayYmd(),
        normalizeDateCandidate,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const mappingOptions = [
    { value: '__create', label: '+ Create New Column' },
    { value: '__entryDate', label: 'Map to Entry Date' },
    { value: '__skip', label: '— Skip Column —' },
    ...fields
      .filter((f) => f.fieldType !== 'formula')
      .map((f) => ({ value: String(f.id), label: `Column: ${f.name}` })),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Import CSV / Paste Excel Rows (${section?.name || ''})`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Upload a <code className="px-1 py-0.5 rounded bg-[var(--bg-input)]">.csv</code> file or paste cells copied directly from Excel / Google Sheets (first row = headers).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            Choose CSV File
          </Button>
        </div>

        <textarea
          rows={5}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={'Example:\nMachine,Hours,Rate\nExcavator,6,1800\nCrane,4,2500'}
          className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2.5 text-xs text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:bg-[var(--bg-card)]"
        />

        {parsed.headers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Detected {parsed.headers.length} columns · {parsed.rows.length} {parsed.rows.length === 1 ? 'row' : 'rows'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {parsed.headers.map((hdr, idx) => (
                <div
                  key={`${hdr}-${idx}`}
                  className="p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-1.5"
                >
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate" title={hdr}>
                    {hdr}
                  </p>
                  <AnimatedDropdown
                    value={mappings[idx] || '__create'}
                    onChange={(val) => setMappings((prev) => ({ ...prev, [idx]: val }))}
                    options={mappingOptions}
                    buttonClassName="py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>

            {parsed.rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-input)] text-slate-600 border-b border-[var(--border-subtle)]">
                      {parsed.headers.map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 4).map((r, rIdx) => (
                      <tr key={rIdx} className="border-b border-[var(--border-subtle)] last:border-b-0 bg-[var(--bg-card)]">
                        {parsed.headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap truncate max-w-[140px]">
                            {r[cIdx] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={submitting || !parsed.rows.length}
            onClick={handleConfirmImport}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Import {parsed.rows.length || ''} {parsed.rows.length === 1 ? 'Row' : 'Rows'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
