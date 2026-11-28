import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, AlertTriangle, IndianRupee, FolderPlus } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InputField, { inputClass } from '../ui/InputField'
import AnimatedDropdown from '../ui/animated-dropdown'
import { useToast } from '../ui/Toast'
import { getProjects, getSections, createSection, createRecord } from '../../services/api'
import { CURRENCY_NAME_RE, getTodayYmd } from '../../utils/sheetUtils'
import { invalidateQueryCache } from '../../utils/queryCache'

const PRIMARY_AMOUNT_RE = /\b(amount|total|rate|cost|spend|expense|bill|wage|fee|price)\b/i

function pickQuickLogFields(fields = []) {
  const editable = fields.filter((f) => f.fieldType !== 'formula')
  const amountField =
    editable.find((f) => f.fieldType === 'currency') ||
    editable.find((f) => (f.fieldType === 'number' || f.fieldType === 'text') && PRIMARY_AMOUNT_RE.test(f.name || '')) ||
    editable.find((f) => f.fieldType === 'number') ||
    null

  const multiplierField = editable.find(
    (f) =>
      f.id !== amountField?.id &&
      f.fieldType === 'number' &&
      /\b(hour|hrs|trip|qty|quantity|count|day|shift|unit)\b/i.test(f.name || '')
  ) || null

  const labelField =
    editable.find(
      (f) =>
        f.id !== amountField?.id &&
        f.fieldType === 'text' &&
        !CURRENCY_NAME_RE.test(f.name || '')
    ) ||
    editable.find((f) => f.id !== amountField?.id && f.fieldType === 'select') ||
    null

  return { amountField, multiplierField, labelField }
}

/**
 * GlobalQuickLogModal — Fast 4-field modal (Project → Sheet → Amount/Rate → Date)
 * accessible from any page via the top-right + Log Spend CTA.
 */
export default function GlobalQuickLogModal({ open, onClose }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const amountInputRef = useRef(null)

  const [projects, setProjects] = useState([])
  const [sections, setSections] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingSections, setLoadingSections] = useState(false)

  const [projectId, setProjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [amount, setAmount] = useState('')
  const [qty, setQty] = useState('1')
  const [itemLabel, setItemLabel] = useState('')
  const [entryDate, setEntryDate] = useState(() => getTodayYmd())

  const [submitting, setSubmitting] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setAmount('')
    setQty('1')
    setItemLabel('')
    setEntryDate(getTodayYmd())

    let active = true
    setLoadingProjects(true)
    getProjects()
      .then((res) => {
        if (!active) return
        const list = res.data || []
        setProjects(list)
        if (list.length > 0) {
          setProjectId((prev) =>
            list.some((p) => String(p.id) === String(prev)) ? prev : String(list[0].id)
          )
        } else {
          setProjectId('')
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoadingProjects(false)
      })

    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!open || !projectId) {
      setSections([])
      setSectionId('')
      return
    }
    let active = true
    setLoadingSections(true)
    getSections(projectId)
      .then((res) => {
        if (!active) return
        const list = res.data || []
        setSections(list)
        setSectionId(list[0] ? String(list[0].id) : '')
        setTimeout(() => amountInputRef.current?.focus(), 60)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoadingSections(false)
      })
    return () => { active = false }
  }, [open, projectId])

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(projectId)) || null,
    [projects, projectId]
  )

  const selectedSection = useMemo(
    () => sections.find((s) => String(s.id) === String(sectionId)) || null,
    [sections, sectionId]
  )

  const { amountField, multiplierField, labelField } = useMemo(
    () => pickQuickLogFields(selectedSection?.fields || []),
    [selectedSection]
  )

  const handleQuickCreateExpensesSheet = async () => {
    if (!projectId) return
    setCreatingSheet(true)
    setError(null)
    try {
      const res = await createSection(projectId, {
        name: 'Expenses',
        fields: [
          { name: 'Item', fieldType: 'text', isRequired: true },
          { name: 'Category', fieldType: 'select', options: ['Materials', 'Labour', 'Transport', 'Fuel', 'Other'] },
          { name: 'Amount', fieldType: 'currency' },
        ],
      })
      setSections([res.data])
      setSectionId(String(res.data.id))
      invalidateQueryCache()
      showToast('Created "Expenses" sheet')
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingSheet(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!projectId) {
      setError('Please select a project.')
      return
    }
    if (!sectionId || !selectedSection) {
      setError('Please select or create a sheet first.')
      return
    }
    const parsedAmount = Number(amount)
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    const data = {}
    if (amountField) {
      data[String(amountField.id)] = parsedAmount
    } else {
      setError(`Sheet "${selectedSection.name}" has no numeric/currency column for spend.`)
      return
    }

    if (multiplierField) {
      const qNum = Number(qty)
      data[String(multiplierField.id)] = Number.isFinite(qNum) && qNum > 0 ? qNum : 1
    }

    if (labelField) {
      const cleanLabel = itemLabel.trim()
      if (cleanLabel) {
        data[String(labelField.id)] = cleanLabel
      } else if (labelField.isRequired) {
        data[String(labelField.id)] =
          labelField.fieldType === 'select' && labelField.options?.length
            ? labelField.options[0]
            : `${selectedSection.name} entry`
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      await createRecord(selectedSection.id, data, entryDate)
      invalidateQueryCache()
      const finalDisplayAmt = multiplierField
        ? parsedAmount * (Number(qty) > 0 ? Number(qty) : 1)
        : parsedAmount
      showToast(
        `Logged ₹${finalDisplayAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} to ${selectedProject?.name} · ${selectedSection.name}`
      )
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick Log Spend">
      {loadingProjects ? (
        <div className="py-12 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <FolderPlus className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-zinc-900">Create a project first</p>
          <p className="text-xs text-zinc-500">You need at least one project to log expenses against.</p>
          <Button
            variant="obsidian"
            size="sm"
            onClick={() => {
              onClose()
              navigate('/projects')
            }}
          >
            Go to Projects
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label="1. Project" required>
              <AnimatedDropdown
                value={projectId}
                onChange={setProjectId}
                options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                buttonClassName="h-[42px] rounded-xl"
              />
            </InputField>

            <InputField label="2. Sheet" required>
              {loadingSections ? (
                <div className="h-[42px] px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)]/50 flex items-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading sheets...
                </div>
              ) : sections.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleQuickCreateExpensesSheet}
                  disabled={creatingSheet}
                  className="w-full h-[42px] justify-center"
                >
                  {creatingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-[#E08A1E]" />}
                  <span>Create Expenses Sheet</span>
                </Button>
              ) : (
                <AnimatedDropdown
                  value={sectionId}
                  onChange={setSectionId}
                  options={sections.map((s) => ({ value: String(s.id), label: s.name }))}
                  buttonClassName="h-[42px] rounded-xl"
                />
              )}
            </InputField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label={`3. ${amountField?.name || 'Amount / Rate'} (₹)`} required>
              <div className="relative flex items-center">
                <IndianRupee className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 pointer-events-none" />
                <input
                  ref={amountInputRef}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pl-9 tabular-nums font-semibold`}
                />
              </div>
            </InputField>

            <InputField label="4. Date" required>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </InputField>
          </div>

          {(multiplierField || labelField) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {labelField && (
                <InputField label={`${labelField.name} (Optional)`}>
                  <input
                    type="text"
                    value={itemLabel}
                    onChange={(e) => setItemLabel(e.target.value)}
                    placeholder={`e.g. Diesel, JCB 3DX, Cement...`}
                    className={inputClass}
                  />
                </InputField>
              )}
              {multiplierField && (
                <InputField label={`${multiplierField.name} (Default 1)`}>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="1"
                    className={`${inputClass} tabular-nums`}
                  />
                </InputField>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="obsidian" disabled={submitting || !selectedSection}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-amber-400" />}
              {submitting ? 'Logging...' : 'Log Spend'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
