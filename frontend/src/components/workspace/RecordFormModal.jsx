import { useState, useEffect } from 'react'
import { Plus, Save, AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

/**
 * RecordFormModal — Dynamically generates form inputs from a section's custom fields.
 */
export default function RecordFormModal({
  open,
  onClose,
  section,
  initialRecord = null,
  onSubmit,
}) {
  const isEditing = Boolean(initialRecord)
  const fields = section?.fields || []

  const [values, setValues]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const init = {}
    for (const f of fields) {
      const key = String(f.id)
      const existing = initialRecord?.data?.[key]
      if (existing !== undefined) {
        init[key] = existing
      } else if (f.fieldType === 'checkbox') {
        init[key] = false
      } else if (f.fieldType === 'date') {
        init[key] = new Date().toISOString().split('T')[0]
      } else {
        init[key] = ''
      }
    }
    setValues(init)
  }, [open, initialRecord, fields])

  const handleChange = (fieldId, val) => {
    setValues((prev) => ({ ...prev, [String(fieldId)]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields
    for (const f of fields) {
      if (!f.isRequired) continue
      const val = values[String(f.id)]
      if (f.fieldType !== 'checkbox' && (val === undefined || val === null || String(val).trim() === '')) {
        setError(`"${f.name}" is required.`)
        return
      }
    }

    // Normalize numeric types cleanly
    const cleanData = {}
    for (const f of fields) {
      const key = String(f.id)
      const raw = values[key]
      if (f.fieldType === 'number' || f.fieldType === 'currency') {
        cleanData[key] = raw === '' || raw === null || raw === undefined ? '' : Number(raw)
      } else {
        cleanData[key] = raw
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(cleanData)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Edit Entry — ${section?.name}` : `New Entry — ${section?.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((f) => {
          const key = String(f.id)
          const val = values[key] ?? ''

          if (f.fieldType === 'checkbox') {
            return (
              <label
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => handleChange(f.id, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm font-medium text-slate-800">{f.name}</span>
              </label>
            )
          }

          return (
            <InputField key={f.id} label={f.name} required={f.isRequired}>
              {f.fieldType === 'textarea' ? (
                <textarea
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder={`Enter ${f.name.toLowerCase()}...`}
                  value={val}
                  onChange={(e) => handleChange(f.id, e.target.value)}
                />
              ) : f.fieldType === 'select' ? (
                <select
                  className={inputClass}
                  value={val}
                  onChange={(e) => handleChange(f.id, e.target.value)}
                >
                  <option value="">Select {f.name}...</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.fieldType === 'currency' || f.fieldType === 'number' ? (
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder={f.fieldType === 'currency' ? '0.00' : '0'}
                  value={val}
                  onChange={(e) => handleChange(f.id, e.target.value)}
                />
              ) : f.fieldType === 'date' ? (
                <input
                  type="date"
                  className={inputClass}
                  value={val}
                  onChange={(e) => handleChange(f.id, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className={inputClass}
                  placeholder={`Enter ${f.name.toLowerCase()}...`}
                  value={val}
                  onChange={(e) => handleChange(f.id, e.target.value)}
                />
              )}
            </InputField>
          )
        })}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              <>
                <Save className="w-4 h-4" />
                Update Record
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Record
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
