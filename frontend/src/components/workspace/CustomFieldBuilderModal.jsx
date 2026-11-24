import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Pencil, Check, X, Loader2, AlertTriangle,
  Type, Hash, IndianRupee, Calendar, List, AlignLeft, CheckSquare
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

export const FIELD_TYPES = [
  { value: 'text',     label: 'Short Text',     icon: Type },
  { value: 'number',   label: 'Number',         icon: Hash },
  { value: 'currency', label: 'Amount (INR)',   icon: IndianRupee },
  { value: 'date',     label: 'Date',           icon: Calendar },
  { value: 'select',   label: 'Dropdown List',  icon: List },
  { value: 'textarea', label: 'Long Notes',     icon: AlignLeft },
  { value: 'checkbox', label: 'Yes / No Check', icon: CheckSquare },
]

const EMPTY_FIELD = {
  name: '',
  fieldType: 'text',
  optionsText: '',
  isRequired: false,
}

/**
 * CustomFieldBuilderModal — Manage custom columns/fields inside a workspace section.
 */
export default function CustomFieldBuilderModal({
  open,
  onClose,
  section,
  onAddField,
  onUpdateField,
  onDeleteField,
}) {
  const [form, setForm]             = useState(EMPTY_FIELD)
  const [editingId, setEditingId]   = useState(null)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError]           = useState(null)

  const fields = section?.fields || []

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FIELD)
    setEditingId(null)
    setError(null)
  }, [open, section?.id])

  const startEdit = (field) => {
    setEditingId(field.id)
    setForm({
      name:        field.name,
      fieldType:   field.fieldType,
      optionsText: (field.options || []).join(', '),
      isRequired:  field.isRequired,
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
      setError('Field label is required.')
      return
    }
    const options = form.fieldType === 'select'
      ? form.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    if (form.fieldType === 'select' && options.length === 0) {
      setError('Provide at least one comma-separated option for Dropdown List.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:       form.name.trim(),
        fieldType:  form.fieldType,
        options,
        isRequired: form.isRequired,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Customize Fields — ${section?.name || ''}`}
    >
      <div className="space-y-6">
        {/* Existing fields list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Columns ({fields.length})
            </p>
          </div>

          {fields.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No custom fields yet. Add your first field below.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
              {fields.map((f) => {
                const typeMeta = FIELD_TYPES.find((t) => t.value === f.fieldType) || FIELD_TYPES[0]
                const Icon = typeMeta.icon
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white ${
                      editingId === f.id ? 'ring-1 ring-inset ring-amber-400 bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-500 flex-shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {f.name}
                          {f.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {typeMeta.label}
                          {f.fieldType === 'select' && f.options?.length > 0
                            ? ` (${f.options.join(', ')})`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit Field"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        disabled={deletingId === f.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove Field"
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
        <form onSubmit={handleSave} className="space-y-3.5 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {editingId ? 'Edit Field' : 'Add New Field'}
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
            <InputField label="Field Label" required>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Vendor Name, Bags, Cost"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </InputField>

            <InputField label="Field Type">
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

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            Required field when logging a record
          </label>

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
                  Update Field
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Field
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
