import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Pencil, Check, X, Loader2, AlertTriangle,
  ArrowUp, ArrowDown, Calculator,
  Type, Hash, IndianRupee, Calendar, List, AlignLeft, CheckSquare
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'
import { FORMULA_OPERATORS, isNumericColumn } from '../../utils/sheetUtils'

export const FIELD_TYPES = [
  { value: 'text',     label: 'Short Text',     icon: Type },
  { value: 'number',   label: 'Number',         icon: Hash },
  { value: 'currency', label: 'Amount (INR)',   icon: IndianRupee },
  { value: 'date',     label: 'Date',           icon: Calendar },
  { value: 'select',   label: 'Dropdown List',  icon: List },
  { value: 'textarea', label: 'Long Notes',     icon: AlignLeft },
  { value: 'checkbox', label: 'Yes / No Check', icon: CheckSquare },
  { value: 'formula',  label: 'Auto Formula',   icon: Calculator },
]

const EMPTY_FIELD = {
  name: '',
  fieldType: 'text',
  optionsText: '',
  isRequired: false,
  leftFieldId: '',
  operator: 'mul',
  rightFieldId: '',
  formulaFormat: 'currency',
}

/**
 * CustomFieldBuilderModal — Create, edit, reorder, and delete custom columns per sheet.
 */
export default function CustomFieldBuilderModal({
  open,
  onClose,
  section,
  initialEditFieldId = null,
  onAddField,
  onUpdateField,
  onDeleteField,
  onReorderFields,
}) {
  const [form, setForm]             = useState(EMPTY_FIELD)
  const [editingId, setEditingId]   = useState(null)
  const [saving, setSaving]         = useState(false)
  const [reordering, setReordering] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError]           = useState(null)

  const fields = section?.fields || []
  const formulaSourceFields = fields.filter((f) => f.id !== editingId && isNumericColumn(f))

  const normalizedName = form.name.trim().toLowerCase()
  const isDuplicateName = Boolean(
    normalizedName &&
    fields.some((f) => f.id !== editingId && f.name.trim().toLowerCase() === normalizedName)
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initialEditFieldId) {
      const target = fields.find((f) => f.id === initialEditFieldId)
      if (target) {
        startEdit(target)
        return
      }
    }
    setForm(EMPTY_FIELD)
    setEditingId(null)
  }, [open, section?.id, initialEditFieldId])

  const startEdit = (field) => {
    setEditingId(field.id)
    setForm({
      name:          field.name,
      fieldType:     field.fieldType,
      optionsText:   (field.options || []).join(', '),
      isRequired:    field.isRequired,
      leftFieldId:   field.formula?.leftFieldId ? String(field.formula.leftFieldId) : '',
      operator:      field.formula?.operator || 'mul',
      rightFieldId:  field.formula?.rightFieldId ? String(field.formula.rightFieldId) : '',
      formulaFormat: field.formula?.format || 'currency',
    })
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FIELD)
    setError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Column name is required.')
      return
    }
    const options = form.fieldType === 'select'
      ? form.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    if (form.fieldType === 'select' && options.length === 0) {
      setError('Provide at least one comma-separated option for Dropdown List.')
      return
    }

    let formula = null
    if (form.fieldType === 'formula') {
      if (!form.leftFieldId || !form.rightFieldId) {
        setError('Pick two numeric/currency columns for the formula.')
        return
      }
      formula = {
        leftFieldId:  Number(form.leftFieldId),
        operator:     form.operator,
        rightFieldId: Number(form.rightFieldId),
        format:       form.formulaFormat,
      }
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:       form.name.trim(),
        fieldType:  form.fieldType,
        options,
        formula,
        isRequired: form.fieldType === 'formula' ? false : form.isRequired,
      }
      if (editingId) {
        await onUpdateField(editingId, payload)
        setEditingId(null)
      } else {
        await onAddField(payload)
      }
      setForm(EMPTY_FIELD)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (fieldId) => {
    setDeletingId(fieldId)
    try {
      await onDeleteField(fieldId)
      if (editingId === fieldId) cancelEdit()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const moveField = async (index, delta) => {
    if (!onReorderFields || reordering) return
    const targetIdx = index + delta
    if (targetIdx < 0 || targetIdx >= fields.length) return
    const ordered = [...fields]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(targetIdx, 0, moved)

    setReordering(true)
    setError(null)
    try {
      await onReorderFields(ordered.map((f) => f.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setReordering(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage Columns — ${section?.name || ''}`}
    >
      <div className="space-y-6">
        {/* Existing fields list with instant Up/Down reorder + Edit + Delete */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Columns Order ({fields.length})
            </p>
            {fields.length > 1 && (
              <span className="text-[11px] text-slate-400">Use ↑ ↓ to reorder</span>
            )}
          </div>

          {fields.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-slate-400">
              No custom columns yet. Add your first column below.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-canvas)]">
              {fields.map((f, idx) => {
                const typeMeta = FIELD_TYPES.find((t) => t.value === f.fieldType) || FIELD_TYPES[0]
                const Icon = typeMeta.icon
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--bg-card)] ${
                      editingId === f.id ? 'ring-1 ring-inset ring-[#E08A1E] bg-[#FEF6E9]/60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="p-1.5 rounded-lg bg-[var(--bg-input)] text-slate-500 flex-shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {f.name}
                          {f.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {typeMeta.label}
                          {f.fieldType === 'select' && f.options?.length > 0
                            ? ` (${f.options.join(', ')})`
                            : ''}
                          {f.fieldType === 'formula' && f.formula
                            ? (() => {
                                const l = fields.find((x) => x.id === Number(f.formula.leftFieldId))?.name || '?'
                                const r = fields.find((x) => x.id === Number(f.formula.rightFieldId))?.name || '?'
                                const sym = FORMULA_OPERATORS.find((o) => o.value === f.formula.operator)?.symbol || '×'
                                return ` (${l} ${sym} ${r})`
                              })()
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {onReorderFields && (
                        <>
                          <button
                            type="button"
                            onClick={() => moveField(idx, -1)}
                            disabled={idx === 0 || reordering}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] disabled:opacity-25 transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(idx, 1)}
                            disabled={idx === fields.length - 1 || reordering}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] disabled:opacity-25 transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors"
                        title="Edit Column"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        disabled={deletingId === f.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove Column"
                      >
                        {deletingId === f.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add / Edit field form */}
        <form onSubmit={handleSave} className="space-y-3.5 pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {editingId ? 'Edit Column' : 'Add New Column'}
            </p>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
              >
                <X className="w-3 h-3" /> Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Column Label" required>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Vendor Name, Qty, Total"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </InputField>

            <InputField label="Column Type">
              <select
                className={inputClass}
                value={form.fieldType}
                onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </InputField>
          </div>

          {form.fieldType === 'select' && (
            <InputField
              label="Dropdown Options"
              required
              hint="Separate options with commas (e.g. Paid, Pending, Partial)"
            >
              <input
                type="text"
                className={inputClass}
                placeholder="Paid, Pending, Partial"
                value={form.optionsText}
                onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
              />
            </InputField>
          )}

          {form.fieldType === 'formula' && (
            <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Auto-Calculate From Columns
              </p>
              {formulaSourceFields.length < 2 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Add at least 2 numeric or currency columns first (e.g. Quantity and Rate), then create a formula column.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      className={inputClass}
                      value={form.leftFieldId}
                      onChange={(e) => setForm({ ...form, leftFieldId: e.target.value })}
                    >
                      <option value="">First column...</option>
                      {formulaSourceFields.map((sf) => (
                        <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
                      ))}
                    </select>

                    <select
                      className={inputClass}
                      value={form.operator}
                      onChange={(e) => setForm({ ...form, operator: e.target.value })}
                    >
                      {FORMULA_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    <select
                      className={inputClass}
                      value={form.rightFieldId}
                      onChange={(e) => setForm({ ...form, rightFieldId: e.target.value })}
                    >
                      <option value="">Second column...</option>
                      {formulaSourceFields.map((sf) => (
                        <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Result Format:</span>
                    <div className="inline-flex rounded-lg bg-[var(--bg-input)] p-0.5 border border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, formulaFormat: 'currency' })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          form.formulaFormat === 'currency'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Amount (₹)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, formulaFormat: 'number' })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          form.formulaFormat === 'number'
                            ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                            : 'text-slate-500'
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

          {form.fieldType !== 'formula' && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-[#E08A1E] focus:ring-[#E08A1E]"
              />
              Required column when logging an entry
            </label>
          )}

          {isDuplicateName && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>
                A column named <strong>"{form.name.trim()}"</strong> already exists. Consider a distinct label (e.g. <em>Start Date</em> / <em>End Date</em>) to avoid confusion.
              </span>
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                <>
                  <Check className="w-4 h-4" />
                  Update Column
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Column
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
