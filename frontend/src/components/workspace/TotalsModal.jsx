import { Calculator, Sigma } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { computeSheetStats } from '../../utils/sheetUtils'

function fmtVal(num, isCurrency) {
  if (isCurrency) {
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/**
 * TotalsModal — Mobile-friendly Excel AutoCalculate sheet (SUM, AVG, MIN, MAX, Filled Count).
 */
export default function TotalsModal({
  open,
  onClose,
  sectionName,
  records = [],
  totalRecordsCount = 0,
  fields = [],
  displayLabels = {},
}) {
  const { summaryFields, byField } = computeSheetStats(records, fields)
  const isFiltered = records.length !== totalRecordsCount

  return (
    <Modal open={open} onClose={onClose} title={`Summary & Totals — ${sectionName}`}>
      <div className="space-y-4">
        {/* Top Row Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {isFiltered ? 'Matching Rows' : 'Total Entries'}
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1">
              {records.length}
              {isFiltered && (
                <span className="text-xs font-medium text-slate-400 ml-1.5">
                  / {totalRecordsCount}
                </span>
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Columns
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1">
              {fields.length}
            </p>
          </div>
        </div>

        {/* Numeric / Currency / Formula Breakdown */}
        {summaryFields.length === 0 ? (
          <div className="p-6 rounded-xl bg-[var(--bg-canvas)] border border-dashed border-[var(--border-subtle)] text-center space-y-2">
            <Calculator className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No numeric columns to total yet</p>
            <p className="text-xs text-slate-500">
              Add an Amount (₹), Number, or Auto Formula column to view instant Sums, Averages, Min, and Max.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {summaryFields.map((f) => {
              const s = byField[f.id]
              if (!s) return null
              return (
                <div
                  key={f.id}
                  className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1.5 rounded-lg bg-[#FEF6E9] text-[#C97814]">
                        <Sigma className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {displayLabels[f.id] || f.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      {s.count} filled
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sum</p>
                      <p className="text-sm font-bold text-[#C97814] tabular-nums mt-0.5">
                        {fmtVal(s.sum, s.isCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Average</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                        {fmtVal(s.avg, s.isCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Min</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                        {fmtVal(s.min, s.isCurrency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Max</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
                        {fmtVal(s.max, s.isCurrency)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
