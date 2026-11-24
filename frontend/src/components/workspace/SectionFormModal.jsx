import { useState, useEffect, useRef } from 'react'
import { Plus, Save, AlertTriangle, Loader2, Package, Wallet, Users, ClipboardCheck } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

const SECTION_TEMPLATES = [
  {
    id: 'materials',
    name: 'Material Register',
    tag: 'Cement, steel, bills',
    icon: Package,
    fields: [
      { name: 'Date',           fieldType: 'date',     isRequired: true },
      { name: 'Material Name',  fieldType: 'text',     isRequired: true },
      { name: 'Supplier',       fieldType: 'text',     isRequired: false },
      { name: 'Quantity',       fieldType: 'text',     isRequired: true },
      { name: 'Total Cost',     fieldType: 'currency', isRequired: true },
      { name: 'Payment Status', fieldType: 'select',   isRequired: false, options: ['Paid', 'Pending', 'Partial'] },
    ],
  },
  {
    id: 'expenses',
    name: 'Expense Ledger',
    tag: 'Payments & payouts',
    icon: Wallet,
    fields: [
      { name: 'Date',         fieldType: 'date',     isRequired: true },
      { name: 'Particulars',  fieldType: 'text',     isRequired: true },
      { name: 'Paid To',      fieldType: 'text',     isRequired: true },
      { name: 'Payment Mode', fieldType: 'select',   isRequired: false, options: ['UPI', 'Bank Transfer', 'Cash', 'Cheque'] },
      { name: 'Amount',       fieldType: 'currency', isRequired: true },
      { name: 'Remarks',      fieldType: 'textarea', isRequired: false },
    ],
  },
  {
    id: 'labour',
    name: 'Daily Labour Log',
    tag: 'Headcount & wages',
    icon: Users,
    fields: [
      { name: 'Date',         fieldType: 'date',     isRequired: true },
      { name: 'Contractor',   fieldType: 'text',     isRequired: true },
      { name: 'Workers',      fieldType: 'number',   isRequired: true },
      { name: 'Work Summary', fieldType: 'text',     isRequired: true },
      { name: 'Wage Total',   fieldType: 'currency', isRequired: false },
    ],
  },
  {
    id: 'progress',
    name: 'Site Progress',
    tag: 'Milestones & checks',
    icon: ClipboardCheck,
    fields: [
      { name: 'Date',         fieldType: 'date',     isRequired: true },
      { name: 'Zone / Floor', fieldType: 'text',     isRequired: true },
      { name: 'Activity',     fieldType: 'text',     isRequired: true },
      { name: 'Status',       fieldType: 'select',   isRequired: true, options: ['In Progress', 'Completed', 'Hold'] },
      { name: 'Approved',     fieldType: 'checkbox', isRequired: false },
      { name: 'Notes',        fieldType: 'textarea', isRequired: false },
    ],
  },
]

/**
 * SectionFormModal — Tight, fast modal to add a section from a 2x2 template grid or blank, or rename an existing section.
 */
export default function SectionFormModal({ open, onClose, onSubmit, initialData = null }) {
  const isEditing = Boolean(initialData)
  const nameInputRef = useRef(null)

  const [selectedTemplate, setSelectedTemplate] = useState('materials')
  const [name, setName]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initialData) {
      setName(initialData.name || '')
    } else {
      setSelectedTemplate('materials')
      setName('Material Register')
    }
  }, [open, initialData])

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id)
    setName(tpl.name)
    setError(null)
  }

  const handleSelectBlank = () => {
    setSelectedTemplate('blank')
    setName('')
    setError(null)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Section name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const tpl = SECTION_TEMPLATES.find((t) => t.id === selectedTemplate)
      await onSubmit({
        name:   name.trim(),
        icon:   selectedTemplate,
        fields: isEditing ? undefined : (tpl?.fields || []),
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
      title={isEditing ? 'Rename Section' : 'Add Section'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Template
            </label>

            {/* 2x2 Template Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {SECTION_TEMPLATES.map((tpl) => {
                const Icon = tpl.icon
                const active = selectedTemplate === tpl.id
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                      active
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span
                      className={`p-1.5 rounded-lg flex-shrink-0 ${
                        active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{tpl.name}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{tpl.tag}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Slim Secondary Row for Blank Custom Section */}
            <button
              type="button"
              onClick={handleSelectBlank}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                selectedTemplate === 'blank'
                  ? 'border-amber-500 bg-amber-50/70 text-amber-800 ring-1 ring-amber-500'
                  : 'border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 bg-slate-50/50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Blank Custom Section
            </button>
          </div>
        )}

        <InputField label="Section Name" required>
          <input
            ref={nameInputRef}
            type="text"
            className={inputClass}
            placeholder="e.g. Steel & Cement"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={isEditing}
          />
        </InputField>

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
                Create Section
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
