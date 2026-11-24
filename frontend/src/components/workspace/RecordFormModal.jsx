import { useState, useEffect, useRef } from 'react'
import { Plus, Save, AlertTriangle, Loader2, CheckCircle2, Calendar, IndianRupee } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

/**
 * RecordFormModal — High-speed mobile-first data entry modal.
 * Features:
 * - Direct numeric keypad opening via inputMode="decimal"
 * - 1-tap "Today" / "Yesterday" date buttons
 * - 1-tap selection chips for categories/status
 * - "Save & Add Next" for lightning-fast consecutive entry on site
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
  const firstInputRef = useRef(null)

  const [values, setValues]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [addNextSuccess, setAddNextSuccess] = useState(false)
  const [error, setError]           = useState(null)

  const getInitialValues = () => {
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
    return init
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setAddNextSuccess(false)
    setValues(getInitialValues())
  }, [open, initialRecord, section?.id])

  const handleChange = (fieldId, val) => {
    setValues((prev) => ({ ...prev, [String(fieldId)]: val }))
  }

  const setRelativeDate = (fieldId, offsetDays = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    handleChange(fieldId, d.toISOString().split('T')[0])
  }

  const validateAndPrepare = () => {
    for (const f of fields) {
      if (!f.isRequired) continue
      const val = values[String(f.id)]
      if (f.fieldType !== 'checkbox' && (val === undefined || val === null || String(val).trim() === '')) {
        setError(`"${f.name}" is required.`)
        return null
      }
    }

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
    return cleanData
  }

  const handleSubmit = async (e, addNext = false) => {
    if (e?.preventDefault) e.preventDefault()
    const cleanData = validateAndPrepare()
    if (!cleanData) return

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(cleanData)
      if (addNext) {
        // Keep Date & Reset other inputs for rapid logging
        setValues((prev) => {
          const reset = {}
          for (const f of fields) {
            const key = String(f.id)
            if (f.fieldType === 'date') {
              reset[key] = prev[key] || new Date().toISOString().split('T')[0]
            } else if (f.fieldType === 'checkbox') {
              reset[key] = false
            } else {
              reset[key] = ''
            }
          }
          return reset
        })
        setAddNextSuccess(true)
        setTimeout(() => setAddNextSuccess(false), 2500)
        setTimeout(() => firstInputRef.current?.focus(), 50)
      } else {
        onClose()
      }
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
      title={isEditing ? `Edit Entry — ${section?.name}` : `Add Entry — ${section?.name}`}
    >
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        {addNextSuccess && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Entry saved! Ready for next entry.</span>
          </div>
        )}

        <div className="space-y-3.5">
          {fields.map((f, idx) => {
            const key = String(f.id)
            const val = values[key] ?? ''
            const isFirst = idx === 0

            if (f.fieldType === 'checkbox') {
              return (
                <label
                  key={f.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => handleChange(f.id, e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-semibold text-slate-800">{f.name}</span>
                </label>
              )
            }

            return (
              <InputField key={f.id} label={f.name} required={f.isRequired}>
                {f.fieldType === 'textarea' ? (
                  <textarea
                    ref={isFirst ? firstInputRef : null}
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder={`Enter ${f.name.toLowerCase()}...`}
                    value={val}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                  />
                ) : f.fieldType === 'select' ? (
                  <div className="space-y-2">
                    {/* Fast chips if <= 6 options (great for mobile thumbs) */}
                    {f.options?.length > 0 && f.options.length <= 6 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {f.options.map((opt) => {
                          const isSel = val === opt
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleChange(f.id, opt)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isSel
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <select
                        ref={isFirst ? firstInputRef : null}
                        className={inputClass}
                        value={val}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                      >
                        <option value="">Select {f.name}...</option>
                        {(f.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : f.fieldType === 'currency' ? (
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 font-bold text-sm pointer-events-none">
                      ₹
                    </span>
                    <input
                      ref={isFirst ? firstInputRef : null}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      className={`${inputClass} pl-8 text-base font-semibold`}
                      placeholder="0.00"
                      value={val}
                      onChange={(e) => handleChange(f.id, e.target.value)}
                    />
                  </div>
                ) : f.fieldType === 'number' ? (
                  <input
                    ref={isFirst ? firstInputRef : null}
                    type="number"
                    step="any"
                    inputMode="numeric"
                    className={`${inputClass} text-base`}
                    placeholder="0"
                    value={val}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                  />
                ) : f.fieldType === 'date' ? (
                  <div className="space-y-1.5">
                    <div className="relative flex items-center">
                      <input
                        ref={isFirst ? firstInputRef : null}
                        type="date"
                        className={inputClass}
                        value={val}
                        onChange={(e) => handleChange(f.id, e.target.value)}
                      />
                    </div>
                    {/* Quick date pills */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setRelativeDate(f.id, 0)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setRelativeDate(f.id, -1)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    ref={isFirst ? firstInputRef : null}
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
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleSubmit(null, true)}
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              <Plus className="w-4 h-4" />
              Save & Add Next
            </Button>
          )}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              <>
                <Save className="w-4 h-4" />
                Update Entry
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Entry
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
