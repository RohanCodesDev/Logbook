import { useState, useEffect } from 'react'
import { Plus, Save, AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

const STATUS_OPTIONS = [
  { value: 'planning',  label: 'Planning' },
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
]

const EMPTY_FORM = {
  name: '',
  location: '',
  client: '',
  status: 'planning',
  startDate: '',
  description: '',
}

/**
 * ProjectFormModal — Reusable modal for both creating and editing a project.
 */
export default function ProjectFormModal({
  open,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const isEditing = Boolean(initialData)
  const [form, setForm]             = useState(EMPTY_FORM)
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
        description: initialData.description || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, initialData])

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
      title={isEditing ? 'Edit Project Details' : 'Create New Project'}
    >
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
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Brief description of the project scope..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
