import { useState, useEffect } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, X, RotateCcw } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'
import { SORT_KINDS, resolveSortKind } from '../../utils/sheetUtils'

function getDirectionLabels(field, kind) {
  const effective = resolveSortKind(field, kind)
  switch (effective) {
    case 'numeric':  return { asc: 'Low → High',      desc: 'High → Low' }
    case 'date':     return { asc: 'Oldest → Newest', desc: 'Newest → Oldest' }
    case 'checkbox': return { asc: 'Yes First',       desc: 'No First' }
    case 'option':   return { asc: 'List Order ↑',    desc: 'List Order ↓' }
    case 'length':   return { asc: 'Shortest First',  desc: 'Longest First' }
    case 'alpha':
    default:         return { asc: 'A → Z',           desc: 'Z → A' }
  }
}

const DEFAULT_LEVEL = {
  key: '',
  kind: 'auto',
  direction: 'asc',
  blanks: 'last',
}

/**
 * SortModal — Simplified Excel-style multi-kind & multi-level column sort sheet.
 */
export default function SortModal({
  open,
  onClose,
  fields = [],
  displayLabels = {},
  sortLevels = [],
  onApply,
}) {
  const [levels, setLevels] = useState([DEFAULT_LEVEL])

  useEffect(() => {
    if (!open) return
    if (sortLevels.length > 0) {
      setLevels(sortLevels.map((l) => ({ ...DEFAULT_LEVEL, ...l })))
    } else if (fields.length > 0) {
      setLevels([{ ...DEFAULT_LEVEL, key: String(fields[0].id) }])
    } else {
      setLevels([{ ...DEFAULT_LEVEL, key: '__createdAt' }])
    }
  }, [open, sortLevels, fields])

  const updateLevel = (idx, patch) => {
    setLevels((prev) => prev.map((lvl, i) => (i === idx ? { ...lvl, ...patch } : lvl)))
  }

  const addSecondaryLevel = () => {
    if (levels.length >= 2) return
    const usedKeys = new Set(levels.map((l) => String(l.key)))
    const nextField = fields.find((f) => !usedKeys.has(String(f.id))) || fields[0]
    setLevels((prev) => [
      ...prev,
      { ...DEFAULT_LEVEL, key: nextField ? String(nextField.id) : '__createdAt' },
    ])
  }

  const removeLevel = (idx) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleApply = (e) => {
    e.preventDefault()
    const valid = levels.filter((l) => Boolean(l.key))
    onApply(valid)
    onClose()
  }

  const handleClear = () => {
    onApply([])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Sort Entries">
      <form onSubmit={handleApply} className="space-y-4">
        <div className="space-y-3">
          {levels.map((lvl, idx) => {
            const selectedField = fields.find((f) => String(f.id) === String(lvl.key))
            const dirLabels = getDirectionLabels(selectedField, lvl.kind)

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {idx === 0 ? 'Sort By Column' : 'Then Sort By'}
                  </span>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Remove sort level"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Column Picker */}
                <InputField label="Column">
                  <select
                    className={inputClass}
                    value={lvl.key}
                    onChange={(e) => updateLevel(idx, { key: e.target.value, kind: 'auto' })}
                  >
                    <option value="__entryDate">Entry Date (Header Group)</option>
                    {fields.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {displayLabels[f.id] || f.name}
                      </option>
                    ))}
                    <option value="__createdAt">Created Time (Entry Order)</option>
                    <option value="__updatedAt">Last Updated Time</option>
                  </select>
                </InputField>

                {/* Sort Kind Picker */}
                {lvl.key !== '__entryDate' && lvl.key !== '__createdAt' && lvl.key !== '__updatedAt' && (
                  <InputField label="Sort Method (Kind)">
                    <select
                      className={inputClass}
                      value={lvl.kind}
                      onChange={(e) => updateLevel(idx, { kind: e.target.value })}
                    >
                      {SORT_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </InputField>
                )}

                {/* Direction Toggle Pills */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateLevel(idx, { direction: 'asc' })}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      lvl.direction === 'asc'
                        ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-xs'
                        : 'bg-[var(--bg-card)] text-slate-700 border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>{dirLabels.asc}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateLevel(idx, { direction: 'desc' })}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      lvl.direction === 'desc'
                        ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-xs'
                        : 'bg-[var(--bg-card)] text-slate-700 border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>{dirLabels.desc}</span>
                  </button>
                </div>

                {/* Blank cells placement */}
                {lvl.key !== '__entryDate' && lvl.key !== '__createdAt' && lvl.key !== '__updatedAt' && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500 font-medium">Empty cells:</span>
                    <div className="inline-flex rounded-lg bg-[var(--bg-input)] p-0.5 border border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => updateLevel(idx, { blanks: 'last' })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          lvl.blanks === 'last'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Bottom
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLevel(idx, { blanks: 'first' })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          lvl.blanks === 'first'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Top
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {levels.length < 2 && fields.length > 1 && (
          <button
            type="button"
            onClick={addSecondaryLevel}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#D6CFC2] text-xs font-semibold text-slate-600 hover:border-[#E08A1E] hover:text-[#C97814] hover:bg-[#FEF6E9]/50 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Secondary Sort ("Then By")</span>
          </button>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <div>
            {sortLevels.length > 0 && (
              <Button type="button" variant="ghost" onClick={handleClear} className="w-full sm:w-auto">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Default Order
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <ArrowUpDown className="w-4 h-4" />
              Apply Sort
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
