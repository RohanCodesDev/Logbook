import { useState, useEffect } from 'react'
import { Plus, Save, AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'

/**
 * SectionFormModal — Clean, fast modal to add or rename a workspace section.
 */
export default function SectionFormModal({ open, onClose, onSubmit, initialData = null }) {
  const isEditing = Boolean(initialData)

  const [name, setName]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(initialData?.name || '')
  }, [open, initialData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Section name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        icon: 'folder',
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
        <InputField label="Section Name" required>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Steel & Cement, Labour, Electrical"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
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
