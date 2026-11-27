import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ScrollText, Plus, Search, RefreshCw, AlertTriangle, Loader2,
  Phone, Calendar, MapPin, Pencil, Trash2, Download, IndianRupee,
  CheckCircle2, Clock, FileText,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import InputField, { inputClass } from '../components/ui/InputField'
import AnimatedDropdown from '../components/ui/animated-dropdown'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import {
  getAgreements,
  createAgreement,
  updateAgreement,
  deleteAgreement,
  getProjects,
} from '../services/api'
import { formatHumanDate, getTodayYmd } from '../utils/sheetUtils'

const TYPE_OPTIONS = [
  { value: 'subcontract',     label: 'Subcontract' },
  { value: 'machine_hire',    label: 'Machine Hire' },
  { value: 'labour',          label: 'Labour Contract' },
  { value: 'material_supply', label: 'Material Supply' },
  { value: 'client',          label: 'Client Contract' },
  { value: 'lease',           label: 'Site / Yard Lease' },
  { value: 'other',           label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'pending',    label: 'Pending' },
  { value: 'completed',  label: 'Completed' },
  { value: 'expired',    label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

const STATUS_STYLES = {
  active:     { cls: 'bg-[#DCFCE7] text-[#166534] ring-1 ring-[#BBF7D0]', dot: 'bg-[#16A34A]', label: 'Active' },
  pending:    { cls: 'bg-[#FEF3C7] text-[#92400E] ring-1 ring-[#FDE68A]', dot: 'bg-[#D97706]', label: 'Pending' },
  completed:  { cls: 'bg-[#DBEAFE] text-[#1E40AF] ring-1 ring-[#BFDBFE]', dot: 'bg-[#2563EB]', label: 'Completed' },
  expired:    { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200',       dot: 'bg-red-500',   label: 'Expired' },
  terminated: { cls: 'bg-[#EFECE4] text-[#57534E] ring-1 ring-[#E6E1D6]', dot: 'bg-[#78716C]', label: 'Terminated' },
}

function getTypeLabel(type) {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label || 'Agreement'
}

function daysUntil(ymd) {
  if (!ymd) return null
  const today = getTodayYmd()
  const a = new Date(`${today}T00:00:00`)
  const b = new Date(`${ymd.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function AgreementFormModal({ open, onClose, initialData, projects, onSave }) {
  const isEditing = Boolean(initialData)
  const [form, setForm] = useState({
    title: '',
    agreementType: 'subcontract',
    partyName: '',
    partyPhone: '',
    projectId: '',
    startDate: '',
    endDate: '',
    contractValue: '',
    paymentTerms: '',
    referenceNo: '',
    status: 'active',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initialData) {
      setForm({
        title: initialData.title || '',
        agreementType: initialData.agreementType || 'subcontract',
        partyName: initialData.partyName || '',
        partyPhone: initialData.partyPhone || '',
        projectId: initialData.projectId ? String(initialData.projectId) : '',
        startDate: initialData.startDate || '',
        endDate: initialData.endDate || '',
        contractValue:
          initialData.contractValue !== null && initialData.contractValue !== undefined
            ? String(initialData.contractValue)
            : '',
        paymentTerms: initialData.paymentTerms || '',
        referenceNo: initialData.referenceNo || '',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
      })
    } else {
      setForm({
        title: '',
        agreementType: 'subcontract',
        partyName: '',
        partyPhone: '',
        projectId: '',
        startDate: getTodayYmd(),
        endDate: '',
        contractValue: '',
        paymentTerms: '',
        referenceNo: '',
        status: 'active',
        notes: '',
      })
    }
  }, [open, initialData])

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'All Projects / Company-wide' },
      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [projects]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Agreement title is required.')
      return
    }
    if (!form.partyName.trim()) {
      setError('Party / contractor name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        ...form,
        projectId: form.projectId ? Number(form.projectId) : null,
        contractValue: form.contractValue === '' ? null : Number(form.contractValue),
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
      title={isEditing ? `Edit — ${initialData.title}` : 'New Agreement'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Agreement Title / Work Scope" required>
          <input
            type="text"
            required
            autoFocus
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Excavator Monthly Hire / Compound Wall Subcontract"
          />
        </InputField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Agreement Type">
            <AnimatedDropdown
              value={form.agreementType}
              onChange={(val) => setForm({ ...form, agreementType: val })}
              options={TYPE_OPTIONS}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>

          <InputField label="Status">
            <AnimatedDropdown
              value={form.status}
              onChange={(val) => setForm({ ...form, status: val })}
              options={STATUS_OPTIONS}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Party / Contractor / Vendor" required>
            <input
              type="text"
              required
              className={inputClass}
              value={form.partyName}
              onChange={(e) => setForm({ ...form, partyName: e.target.value })}
              placeholder="e.g. Sri Sai Earthmovers"
            />
          </InputField>

          <InputField label="Party Phone">
            <input
              type="tel"
              className={inputClass}
              value={form.partyPhone}
              onChange={(e) => setForm({ ...form, partyPhone: e.target.value })}
              placeholder="e.g. 9845012345"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Project / Site">
            <AnimatedDropdown
              value={form.projectId}
              onChange={(val) => setForm({ ...form, projectId: val })}
              options={projectOptions}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>

          <InputField label="Reference / Document No">
            <input
              type="text"
              className={inputClass}
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              placeholder="e.g. AGR-2026-04"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Start Date">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </InputField>

          <InputField label="End / Renewal Date">
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Contract Value / Rate (₹)">
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClass}
              value={form.contractValue}
              onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
              placeholder="e.g. 150000"
            />
          </InputField>

          <InputField label="Payment Terms">
            <input
              type="text"
              className={inputClass}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              placeholder="e.g. Monthly / 50% Advance / Per Sqft"
            />
          </InputField>
        </div>

        <InputField label="Key Terms & Notes">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Scope exclusions, diesel responsibility, retention %, notice period..."
          />
        </InputField>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update Agreement' : 'Save Agreement'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Agreements() {
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const [agreements, setAgreements] = useState([])
  const [projects, setProjects]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')

  const [modalOpen, setModalOpen]           = useState(false)
  const [editingAgreement, setEditingAgreement] = useState(null)
  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [deleting, setDeleting]             = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agrRes, projRes] = await Promise.all([
        getAgreements(),
        getProjects(),
      ])
      setAgreements(agrRes.data || [])
      setProjects(projRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreateModal = useCallback(() => {
    setEditingAgreement(null)
    setModalOpen(true)
  }, [])

  useEffect(() => {
    setTopBar({
      title: 'Agreements',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          <Magnetic strength={0.18}>
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              New Agreement
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, openCreateModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agreements.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (typeFilter !== 'all' && a.agreementType !== typeFilter) return false
      if (!q) return true
      return (
        a.title?.toLowerCase().includes(q) ||
        a.partyName?.toLowerCase().includes(q) ||
        a.partyPhone?.toLowerCase().includes(q) ||
        a.referenceNo?.toLowerCase().includes(q) ||
        a.projectName?.toLowerCase().includes(q)
      )
    })
  }, [agreements, statusFilter, typeFilter, search])

  const stats = useMemo(() => {
    const active = agreements.filter((a) => a.status === 'active')
    const activeValue = active.reduce((acc, a) => acc + (Number(a.contractValue) || 0), 0)
    const expiringSoon = active.filter((a) => {
      const d = daysUntil(a.endDate)
      return d !== null && d <= 15
    }).length
    return {
      total: agreements.length,
      activeCount: active.length,
      activeValue,
      expiringSoon,
    }
  }, [agreements])

  const handleSave = async (payload) => {
    if (editingAgreement) {
      const res = await updateAgreement(editingAgreement.id, payload)
      setAgreements((prev) => prev.map((a) => (a.id === editingAgreement.id ? res.data : a)))
      showToast(`Updated "${res.data.title}"`)
    } else {
      const res = await createAgreement(payload)
      setAgreements((prev) => [res.data, ...prev])
      showToast(`Saved "${res.data.title}"`)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAgreement(deleteTarget.id)
      setAgreements((prev) => prev.filter((a) => a.id !== deleteTarget.id))
      showToast(`Deleted "${deleteTarget.title}"`)
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCsv = () => {
    if (!filtered.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Title', 'Type', 'Party', 'Phone', 'Site', 'Ref No', 'Start Date', 'End Date', 'Value (INR)', 'Payment Terms', 'Status'].join(',')
    const rows = filtered.map((a) =>
      [
        esc(a.title),
        esc(getTypeLabel(a.agreementType)),
        esc(a.partyName),
        esc(a.partyPhone),
        esc(a.projectName || 'Company-wide'),
        esc(a.referenceNo),
        esc(a.startDate ? formatHumanDate(a.startDate) : ''),
        esc(a.endDate ? formatHumanDate(a.endDate) : ''),
        a.contractValue ?? '',
        esc(a.paymentTerms),
        esc(STATUS_STYLES[a.status]?.label || a.status),
      ].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'agreements.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Could not load agreements</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Unified KPI Instrument Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-zinc-200/80 bg-[var(--bg-card)] divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 overflow-hidden shadow-xs">
        {[
          { label: 'Total Agreements', val: stats.total, rawZero: stats.total === 0, icon: ScrollText, accent: 'text-zinc-900', iconActive: 'text-amber-500' },
          { label: 'Active Contracts', val: stats.activeCount, rawZero: stats.activeCount === 0, icon: CheckCircle2, accent: 'text-emerald-600', iconActive: 'text-emerald-500' },
          { label: 'Active Value', val: `₹${stats.activeValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, rawZero: stats.activeValue === 0, icon: IndianRupee, accent: 'text-zinc-900', iconActive: 'text-zinc-700' },
          { label: 'Due Within 15d', val: stats.expiringSoon, rawZero: stats.expiringSoon === 0, icon: Clock, accent: 'text-amber-600', iconActive: 'text-amber-500' },
        ].map((k) => {
          const isZero = !loading && k.rawZero
          return (
            <div key={k.label} className="px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{k.label}</p>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums mt-1.5 leading-none truncate ${isZero ? 'text-zinc-400' : k.accent}`}>
                  {loading ? '—' : k.val}
                </p>
              </div>
              <k.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isZero ? 'text-zinc-300' : k.iconActive}`} />
            </div>
          )
        })}
      </div>

      {/* Agreements Table Card */}
      <Card noPad className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, party, ref no, site..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-slate-400 focus:outline-none focus:border-[#E08A1E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'pending', label: 'Pending' },
                { key: 'completed', label: 'Done' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-slate-500 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-40">
              <AnimatedDropdown
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'All Types' },
                  ...TYPE_OPTIONS,
                ]}
                buttonClassName="h-9 rounded-xl text-xs"
              />
            </div>

            {filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading agreements...
          </div>
        ) : agreements.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No agreements recorded yet"
            description="Track machine hire contracts, subcontracts, labour rates, vendor supply agreements, and renewal dates in one place."
            action={
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="w-4 h-4" />
                Add First Agreement
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching agreements"
            description="Adjust your search query, status tab, or agreement type filter."
          />
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="sm:hidden p-3.5 space-y-2.5 bg-[var(--bg-canvas)]/70">
              {filtered.map((a) => {
                const st = STATUS_STYLES[a.status] || STATUS_STYLES.active
                const remaining = a.status === 'active' ? daysUntil(a.endDate) : null
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setEditingAgreement(a)
                      setModalOpen(true)
                    }}
                    className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-3.5 shadow-xs space-y-2.5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{a.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{a.partyName}</p>
                      </div>
                      {a.contractValue !== null && (
                        <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums flex-shrink-0">
                          ₹{a.contractValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#FEF6E9] text-[#92400E] text-[11px] font-semibold border border-[#FDE68A]">
                        {getTypeLabel(a.agreementType)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      {remaining !== null && remaining <= 15 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                          {remaining < 0 ? `Overdue ${Math.abs(remaining)}d` : `Ends in ${remaining}d`}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{a.projectName || 'Company-wide'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {a.endDate ? `Ends ${formatHumanDate(a.endDate)}` : (a.startDate ? formatHumanDate(a.startDate) : '—')}
                        </span>
                      </div>
                      {a.partyPhone && (
                        <a
                          href={`tel:${a.partyPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[#C97814] font-semibold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{a.partyPhone}</span>
                        </a>
                      )}
                      {a.referenceNo && (
                        <div className="flex items-center gap-1.5 truncate text-slate-500">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{a.referenceNo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Grid Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-input)] text-slate-800 border-b border-[var(--border-grid)] text-xs sm:text-[13px] font-bold uppercase tracking-wide select-none">
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Agreement</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Type</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Party</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Site / Project</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Period</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Value</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Status</th>
                    <th className="px-2 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, idx) => {
                    const st = STATUS_STYLES[a.status] || STATUS_STYLES.active
                    const remaining = a.status === 'active' ? daysUntil(a.endDate) : null
                    return (
                      <tr
                        key={a.id}
                        className={`group border-b border-[var(--border-grid)] last:border-b-0 transition-colors ${
                          idx % 2 === 1 ? 'bg-[#F6F4EF]/50' : 'bg-[var(--bg-card)]'
                        } hover:bg-zinc-950/[0.025]`}
                      >
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)]">
                          <div>{a.title}</div>
                          {(a.referenceNo || a.paymentTerms) && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              {[a.referenceNo, a.paymentTerms].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEF6E9] text-[#92400E] text-xs font-medium border border-[#FDE68A]">
                            {getTypeLabel(a.agreementType)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)]">
                          <div>{a.partyName}</div>
                          {a.partyPhone && (
                            <a href={`tel:${a.partyPhone}`} className="text-[11px] text-[#C97814] hover:underline tabular-nums">
                              {a.partyPhone}
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-slate-600">
                          {a.projectName || <span className="text-slate-400 text-xs">Company-wide</span>}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-xs font-medium text-[var(--text-primary)] tabular-nums">
                          {a.startDate || a.endDate ? (
                            <div className="space-y-0.5">
                              <div>
                                {a.startDate ? formatHumanDate(a.startDate) : '—'}
                                {a.endDate ? ` → ${formatHumanDate(a.endDate)}` : ''}
                              </div>
                              {remaining !== null && remaining <= 15 && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold">
                                  {remaining < 0 ? `Overdue ${Math.abs(remaining)}d` : `${remaining}d left`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)] tabular-nums">
                          {a.contractValue !== null ? (
                            `₹${a.contractValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-slate-300 text-xs font-normal">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)]">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAgreement(a)
                                setModalOpen(true)
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-[var(--bg-input)] transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(a)}
                              className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <AgreementFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingAgreement}
        projects={projects}
        onSave={handleSave}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Agreement"
        message={`Delete agreement "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  )
}
