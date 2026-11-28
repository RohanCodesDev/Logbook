import { useState, useEffect } from 'react'
import { Plus, Save, AlertTriangle, Loader2, Check, Sparkles } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'
import AnimatedDropdown from '../ui/animated-dropdown'

const STATUS_OPTIONS = [
  { value: 'planning',  label: 'Planning' },
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
]

const PRESET_SHEETS = [
  { key: 'machines',  label: 'Machines / Excavators', hint: 'Machine · Hours × Rate' },
  { key: 'hyvas',     label: 'Hyva / Dumpers',        hint: 'Hyva · Trips × Rate' },
  { key: 'materials', label: 'Materials',             hint: 'Material · Qty × Rate' },
  { key: 'labour',    label: 'Daily Labor',           hint: 'Worker · Days × Wage' },
  { key: 'expenses',  label: 'Daily Expenses',        hint: 'Item · Category · ₹' },
]

const EMPTY_FORM = {
  name: '',
  location: '',
  client: '',
  status: 'planning',
  startDate: '',
  contractValue: '',
  description: '',
}

/**
 * ProjectFormModal — Reusable modal for creating (with 1-click preset sheets + budget) and editing a project.
 */
export default function ProjectFormModal({
  open,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const isEditing = Boolean(initialData)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [presetSheets, setPresetSheets] = useState(['machines', 'expenses'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initialData) {
      setForm({
        name:        initialData.name || '',
        location:    initialData.location || '',
        client:      initialData.client || '',
        status:      initialData.status || 'planning',
        startDate:   initialData.startDate || '',
        contractValue: initialData.budget ? String(initialData.budget) : '',
        description: initialData.description || '',
      })
    } else {
      setForm(EMPTY_FORM)
      setPresetSheets(['machines', 'expenses'])
    }
  }, [open, initialData])

  const togglePreset = (key) => {
    setPresetSheets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Project name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name:        form.name.trim(),
        location:    form.location.trim() || null,
        client:      form.client.trim() || null,
        status:      form.status,
        startDate:   form.startDate || null,
        description: form.description.trim() || null,
        ...(!isEditing ? {
          contractValue: form.contractValue === '' ? null : Number(form.contractValue),
          presetSheets,
        } : {}),
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
      title={isEditing ? 'Project Centre' : 'Create New Project'}
    >
      {isEditing && (
        <div className="mb-4 grid grid-cols-3 rounded-xl bg-[var(--bg-input)]/70 border border-[var(--border-subtle)] divide-x divide-[var(--border-subtle)] text-center">
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Sheets</p>
            <p className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">{initialData?.sectionCount ?? 0}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Entries</p>
            <p className="text-sm font-bold text-zinc-900 tabular-nums mt-0.5">{initialData?.recordCount ?? 0}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Created</p>
            <p className="text-xs font-semibold text-zinc-700 tabular-nums mt-1">
              {initialData?.createdAt ? String(initialData.createdAt).slice(0, 10) : '—'}
            </p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Project Name" required>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Sunrise Residential Villa"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </InputField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Client / Owner">
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Mr. Sharma"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
            />
          </InputField>

          <InputField label="Site Location">
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Whitefield, Bangalore"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Status">
            <AnimatedDropdown
              value={form.status}
              onChange={(val) => setForm({ ...form, status: val })}
              options={STATUS_OPTIONS}
            />
          </InputField>

          <InputField label="Start Date">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </InputField>
        </div>

        <InputField label="Scope / Notes">
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Brief description of the project scope..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </InputField>

        {!isEditing && (
          <>
            <InputField label="Agreement Budget / Contract Value (₹)">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                className={`${inputClass} tabular-nums`}
                placeholder="Optional — sets initial budget on linked agreement"
                value={form.contractValue}
                onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
              />
            </InputField>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E08A1E]" />
                <span>1-Click Preset Sheets</span>
                <span className="text-[11px] text-zinc-400 font-normal">(Pre-configured columns)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_SHEETS.map((tpl) => {
                  const active = presetSheets.includes(tpl.key)
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => togglePreset(tpl.key)}
                      className={`flex items-start justify-between gap-2 text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#FEF6E9] border-[#E08A1E] ring-1 ring-[#E08A1E]/30'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 truncate">{tpl.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{tpl.hint}</p>
                      </div>
                      <span
                        className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                          active
                            ? 'bg-[#E08A1E] border-[#E08A1E] text-white'
                            : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
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
                Save Changes
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Project
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
