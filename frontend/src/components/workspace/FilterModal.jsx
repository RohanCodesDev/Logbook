import { useState, useEffect } from 'react'
import { Filter, Plus, X, RotateCcw } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { inputClass } from '../ui/InputField'
import { isNumericColumn } from '../../utils/sheetUtils'

function getDefaultOp(field) {
  if (!field) return 'contains'
  if (isNumericColumn(field)) return 'gte'
  if (field.fieldType === 'date') return 'last7'
  if (field.fieldType === 'select') return 'in'
  if (field.fieldType === 'checkbox') return 'is_true'
  return 'contains'
}

function getOperatorsForField(field) {
  if (!field) return []
  if (isNumericColumn(field)) {
    return [
      { value: 'gte',       label: 'At least (>=)' },
      { value: 'lte',       label: 'At most (<=)' },
      { value: 'gt',        label: 'Greater than (>)' },
      { value: 'lt',        label: 'Less than (<)' },
      { value: 'eq',        label: 'Equals (=)' },
      { value: 'between',   label: 'Between range' },
      { value: 'empty',     label: 'Is empty / blank' },
      { value: 'not_empty', label: 'Has value' },
    ]
  }
  if (field.fieldType === 'date') {
    return [
      { value: 'today',      label: 'Today' },
      { value: 'last7',      label: 'Last 7 Days' },
      { value: 'this_month', label: 'This Month' },
      { value: 'after',      label: 'On or After' },
      { value: 'before',     label: 'On or Before' },
      { value: 'between',    label: 'Between Dates' },
      { value: 'empty',      label: 'Is empty' },
      { value: 'not_empty',  label: 'Has date' },
    ]
  }
  if (field.fieldType === 'select') {
    return [
      { value: 'in',        label: 'Matches Selected' },
      { value: 'empty',     label: 'Is empty' },
      { value: 'not_empty', label: 'Has choice' },
    ]
  }
  if (field.fieldType === 'checkbox') {
    return [
      { value: 'is_true',  label: 'Checked (Yes)' },
      { value: 'is_false', label: 'Unchecked (No)' },
    ]
  }
  return [
    { value: 'contains',    label: 'Contains text' },
    { value: 'equals',      label: 'Exact match' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'empty',       label: 'Is empty / blank' },
    { value: 'not_empty',   label: 'Has value' },
  ]
}

/**
 * FilterModal — Clean per-column filtering sheet tailored for mobile taps and desktop speed.
 */
export default function FilterModal({
  open,
  onClose,
  fields = [],
  displayLabels = {},
  filters = [],
  initialFieldId = null,
  onApply,
}) {
  const [rules, setRules] = useState([])

  useEffect(() => {
    if (!open) return
    if (filters.length > 0) {
      if (initialFieldId && !filters.some((r) => String(r.fieldId) === String(initialFieldId))) {
        const f = fields.find((fld) => String(fld.id) === String(initialFieldId))
        setRules([...filters, { fieldId: String(initialFieldId), op: getDefaultOp(f), value: '', value2: '', values: [] }])
      } else {
        setRules(filters.map((r) => ({ ...r })))
      }
    } else if (fields.length > 0) {
      const target = (initialFieldId && fields.find((f) => String(f.id) === String(initialFieldId))) || fields[0]
      setRules([{ fieldId: String(target.id), op: getDefaultOp(target), value: '', value2: '', values: [] }])
    } else {
      setRules([])
    }
  }, [open, filters, fields, initialFieldId])

  const addRule = () => {
    if (fields.length === 0) return
    const used = new Set(rules.map((r) => String(r.fieldId)))
    const nextField = fields.find((f) => !used.has(String(f.id))) || fields[0]
    setRules((prev) => [
      ...prev,
      { fieldId: String(nextField.id), op: getDefaultOp(nextField), value: '', value2: '', values: [] },
    ])
  }

  const updateRule = (idx, patch) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRule = (idx) => {
    setRules((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleOptionValue = (idx, opt) => {
    const cur = rules[idx]?.values || []
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]
    updateRule(idx, { values: next })
  }

  const handleApply = (e) => {
    e.preventDefault()
    onApply(rules.filter((r) => Boolean(r.fieldId)))
    onClose()
  }

  const handleClear = () => {
    onApply([])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Filter Entries">
      <form onSubmit={handleApply} className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No active filter rules.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule, idx) => {
              const field = fields.find((f) => String(f.id) === String(rule.fieldId)) || fields[0]
              const ops = getOperatorsForField(field)
              const needsNoInput = ['empty', 'not_empty', 'today', 'last7', 'this_month', 'is_true', 'is_false'].includes(rule.op)
              const isNum = isNumericColumn(field)
              const isDate = field?.fieldType === 'date'

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Rule {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Remove rule"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      className={inputClass}
                      value={rule.fieldId}
                      onChange={(e) => {
                        const nextField = fields.find((f) => String(f.id) === e.target.value)
                        updateRule(idx, {
                          fieldId: e.target.value,
                          op: getDefaultOp(nextField),
                          value: '',
                          value2: '',
                          values: [],
                        })
                      }}
                    >
                      {fields.map((f) => (
                        <option key={f.id} value={String(f.id)}>
                          {displayLabels[f.id] || f.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className={inputClass}
                      value={rule.op}
                      onChange={(e) => updateRule(idx, { op: e.target.value })}
                    >
                      {ops.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rule Value Inputs */}
                  {rule.op === 'in' && field?.fieldType === 'select' && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(field.options || []).map((opt) => {
                        const active = (rule.values || []).includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleOptionValue(idx, opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              active
                                ? 'bg-[#1E242B] text-white border-[#1E242B]'
                                : 'bg-[var(--bg-card)] text-slate-700 border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
                            }`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {!needsNoInput && rule.op !== 'in' && (
                    <div className={`grid gap-2 ${rule.op === 'between' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <input
                        type={isDate ? 'date' : isNum ? 'number' : 'text'}
                        step={isNum ? 'any' : undefined}
                        inputMode={isNum ? 'decimal' : undefined}
                        placeholder={rule.op === 'between' ? 'From...' : 'Enter value...'}
                        value={rule.value || ''}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        className={inputClass}
                      />
                      {rule.op === 'between' && (
                        <input
                          type={isDate ? 'date' : isNum ? 'number' : 'text'}
                          step={isNum ? 'any' : undefined}
                          inputMode={isNum ? 'decimal' : undefined}
                          placeholder="To..."
                          value={rule.value2 || ''}
                          onChange={(e) => updateRule(idx, { value2: e.target.value })}
                          className={inputClass}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {fields.length > 0 && (
          <button
            type="button"
            onClick={addRule}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#D6CFC2] text-xs font-semibold text-slate-600 hover:border-[#E08A1E] hover:text-[#C97814] hover:bg-[#FEF6E9]/50 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Column Filter</span>
          </button>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <div>
            {filters.length > 0 && (
              <Button type="button" variant="ghost" onClick={handleClear} className="w-full sm:w-auto">
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All Filters
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Filter className="w-4 h-4" />
              Apply Filters
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
