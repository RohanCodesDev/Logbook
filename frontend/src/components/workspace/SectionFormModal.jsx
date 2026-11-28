import { useState, useEffect, useMemo } from 'react'
import { Plus, Save, AlertTriangle, Loader2, Copy, Sparkles } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'
import AnimatedDropdown from '../ui/animated-dropdown'

const SHEET_TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank Sheet',
    hint: 'Start empty',
    defaultName: '',
    fields: [],
  },
  {
    id: 'expense',
    label: 'Daily Expense',
    hint: 'Item · Category · ₹ Amount',
    defaultName: 'Expenses',
    fields: [
      { name: 'Item', fieldType: 'text', isRequired: true },
      { name: 'Category', fieldType: 'select', options: ['Materials', 'Labour', 'Transport', 'Fuel', 'Other'] },
      { name: 'Amount', fieldType: 'currency' },
      { name: 'Paid By', fieldType: 'text' },
      { name: 'Notes', fieldType: 'text' },
    ],
  },
  {
    id: 'material',
    label: 'Material Purchase',
    hint: 'Material · Qty × Rate = Total',
    defaultName: 'Materials',
    fields: [
      { name: 'Material', fieldType: 'text', isRequired: true },
      { name: 'Qty', fieldType: 'number' },
      { name: 'Unit', fieldType: 'select', options: ['Bags', 'Tons', 'Pcs', 'Brass', 'Kg', 'Liters'] },
      { name: 'Rate', fieldType: 'currency' },
      {
        name: 'Total',
        fieldType: 'formula',
        formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 3, format: 'currency' },
      },
      { name: 'Vendor', fieldType: 'text' },
    ],
  },
  {
    id: 'machine',
    label: 'Machine Hire',
    hint: 'Machine · Hours × Rate = Total',
    defaultName: 'Machines',
    fields: [
      { name: 'Machine', fieldType: 'text', isRequired: true },
      { name: 'Hours', fieldType: 'number' },
      { name: 'Rate', fieldType: 'currency' },
      {
        name: 'Total',
        fieldType: 'formula',
        formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' },
      },
      { name: 'Operator', fieldType: 'text' },
    ],
  },
  {
    id: 'hyva',
    label: 'Hyva / Tipper Log',
    hint: 'Hyva · Trips × Rate = Total',
    defaultName: 'Hyvas',
    fields: [
      { name: 'Hyva', fieldType: 'text', isRequired: true },
      { name: 'Trips', fieldType: 'number' },
      { name: 'Rate', fieldType: 'currency' },
      {
        name: 'Total',
        fieldType: 'formula',
        formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' },
      },
      { name: 'Driver', fieldType: 'text' },
    ],
  },
  {
    id: 'labour',
    label: 'Labour Log',
    hint: 'Team · Count × Wage = Total',
    defaultName: 'Labour',
    fields: [
      { name: 'Team / Worker', fieldType: 'text', isRequired: true },
      { name: 'Count', fieldType: 'number' },
      { name: 'Wage Rate', fieldType: 'currency' },
      {
        name: 'Total',
        fieldType: 'formula',
        formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' },
      },
      { name: 'Work Done', fieldType: 'text' },
    ],
  },
]

function mapSectionFieldsForClone(sourceFields = []) {
  const indexById = new Map(sourceFields.map((f, idx) => [f.id, idx]))
  return sourceFields.map((f) => {
    const item = {
      name: f.name,
      fieldType: f.fieldType,
      options: f.options || [],
      isRequired: Boolean(f.isRequired),
    }
    if (f.fieldType === 'formula' && f.formula) {
      const leftIndex = indexById.get(Number(f.formula.leftFieldId))
      const rightIndex = indexById.get(Number(f.formula.rightFieldId))
      if (leftIndex !== undefined && rightIndex !== undefined) {
        item.formulaRef = {
          leftIndex,
          operator: f.formula.operator || 'mul',
          rightIndex,
          format: f.formula.format || 'currency',
        }
      } else {
        item.fieldType = f.formula.format === 'currency' ? 'currency' : 'number'
      }
    }
    return item
  })
}

/**
 * SectionFormModal — Clean, fast modal to add (blank, from template, or cloned) or rename a sheet.
 */
export default function SectionFormModal({
  open,
  onClose,
  onSubmit,
  initialData = null,
  sections = [],
}) {
  const isEditing = Boolean(initialData)

  const [name, setName]             = useState('')
  const [templateId, setTemplateId] = useState('blank')
  const [cloneFromId, setCloneFromId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  const clonableSections = useMemo(
    () => sections.filter((s) => (s.fields || []).length > 0),
    [sections]
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(initialData?.name || '')
    setTemplateId('blank')
    setCloneFromId('')
  }, [open, initialData])

  const handleSelectTemplate = (tpl) => {
    setTemplateId(tpl.id)
    setCloneFromId('')
    const prevTplDefault = SHEET_TEMPLATES.some((t) => t.defaultName === name)
    if (!name.trim() || prevTplDefault) {
      setName(tpl.defaultName)
    }
  }

  const handleSelectClone = (secId) => {
    setCloneFromId(secId)
    if (secId) {
      setTemplateId('clone')
      const src = clonableSections.find((s) => String(s.id) === String(secId))
      if (src && (!name.trim() || SHEET_TEMPLATES.some((t) => t.defaultName === name))) {
        setName(`${src.name} Copy`)
      }
    } else {
      setTemplateId('blank')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Sheet name is required.')
      return
    }

    let fieldsPayload = []
    if (!isEditing) {
      if (cloneFromId) {
        const src = clonableSections.find((s) => String(s.id) === String(cloneFromId))
        fieldsPayload = src ? mapSectionFieldsForClone(src.fields) : []
      } else {
        const tpl = SHEET_TEMPLATES.find((t) => t.id === templateId)
        fieldsPayload = tpl ? tpl.fields : []
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        icon: 'folder',
        ...(isEditing ? {} : { fields: fieldsPayload }),
      })
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
      title={isEditing ? 'Rename Sheet' : 'Add New Sheet'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Sheet Name" required>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Steel & Cement, Labour, Electrical"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </InputField>

        {!isEditing && (
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E08A1E]" />
                <span>1-Click Starter Templates</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SHEET_TEMPLATES.map((tpl) => {
                  const active = templateId === tpl.id && !cloneFromId
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`text-left px-3 py-2 rounded-xl border transition-all ${
                        active
                          ? 'bg-[#FEF6E9] border-[#E08A1E] ring-1 ring-[#E08A1E]/40'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <p className="text-xs font-bold text-[var(--text-primary)]">{tpl.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{tpl.hint}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {clonableSections.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Or Copy Columns From Existing Sheet</span>
                </label>
                <AnimatedDropdown
                  value={cloneFromId}
                  onChange={handleSelectClone}
                  placeholder="Choose a sheet to copy columns from..."
                  options={[
                    { value: '', label: '— None (use template above) —' },
                    ...clonableSections.map((s) => ({
                      value: String(s.id),
                      label: `${s.name} (${(s.fields || []).length} cols)`,
                    })),
                  ]}
                />
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
                Save Name
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Sheet
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
