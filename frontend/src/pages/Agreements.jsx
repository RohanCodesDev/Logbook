import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScrollText, Plus, Search, RefreshCw, AlertTriangle, Loader2,
  Trash2, CheckCircle2, Clock, Camera, ArrowUpRight,
} from 'lucide-react'
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
  deleteAgreement,
  getProjects,
} from '../services/api'
import { useCachedQuery, invalidateQueryCache } from '../utils/queryCache'

function AgreementCreateModal({ open, onClose, projects, onSave }) {
  const [form, setForm] = useState({
    title: '',
    partyName: '',
    partyPhone: '',
    contractValue: '',
    projectId: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm({
      title: '',
      partyName: '',
      partyPhone: '',
      contractValue: '',
      projectId: '',
      notes: '',
    })
  }, [open])

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Company-wide / Unlinked' },
      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [projects]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Agreement name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        title: form.title.trim(),
        agreementType: 'client',
        partyName: form.partyName.trim(),
        partyPhone: form.partyPhone.trim(),
        contractValue: form.contractValue === '' ? null : Number(form.contractValue),
        projectId: form.projectId ? Number(form.projectId) : null,
        notes: form.notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Agreement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Agreement / Project Name" required>
          <input
            type="text"
            required
            autoFocus
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Sunrise Residential Villa"
          />
        </InputField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Company / Party Name">
            <input
              type="text"
              className={inputClass}
              value={form.partyName}
              onChange={(e) => setForm({ ...form, partyName: e.target.value })}
              placeholder="e.g. Sri Sai Builders"
            />
          </InputField>

          <InputField label="Party Number">
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
          <InputField label="Contract Value / Budget (₹)">
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={`${inputClass} tabular-nums`}
              value={form.contractValue}
              onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
              placeholder="e.g. 500000"
            />
          </InputField>

          <InputField label="Linked Project">
            <AnimatedDropdown
              value={form.projectId}
              onChange={(val) => setForm({ ...form, projectId: val })}
              options={projectOptions}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>
        </div>

        <InputField label="Notes">
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any short remarks or terms..."
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
          <Button type="submit" variant="obsidian" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create & Open
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Agreements() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const {
    data: bundle,
    setData: setBundle,
    loading,
    refreshing,
    error,
    reload,
  } = useCachedQuery('agreements', async () => {
    const [agrRes, projRes] = await Promise.all([getAgreements(), getProjects()])
    return { agreements: agrRes.data || [], projects: projRes.data || [] }
  })

  const agreements = bundle?.agreements || []
  const projects = bundle?.projects || []

  const [search, setSearch]             = useState('')
  const [uploadFilter, setUploadFilter] = useState('all')

  const [modalOpen, setModalOpen]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(() => reload(), [reload])

  const openCreateModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  useEffect(() => {
    setTopBar({
      title: 'Agreements',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          <Magnetic strength={0.18}>
            <Button variant="obsidian" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              New Agreement
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, refreshing, openCreateModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agreements.filter((a) => {
      const hasPhotos = (a.attachmentCount ?? 0) > 0
      if (uploadFilter === 'uploaded' && !hasPhotos) return false
      if (uploadFilter === 'pending' && hasPhotos) return false
      if (!q) return true
      return (
        a.title?.toLowerCase().includes(q) ||
        a.projectName?.toLowerCase().includes(q) ||
        a.partyName?.toLowerCase().includes(q)
      )
    })
  }, [agreements, uploadFilter, search])

  const stats = useMemo(() => {
    const uploaded = agreements.filter((a) => (a.attachmentCount ?? 0) > 0).length
    const pending = agreements.length - uploaded
    return {
      total: agreements.length,
      uploaded,
      pending,
    }
  }, [agreements])

  const handleCreate = async (payload) => {
    const res = await createAgreement(payload)
    invalidateQueryCache()
    showToast(`Created "${res.data.title}"`)
    navigate(`/agreements/${res.data.id}`)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAgreement(deleteTarget.id)
      setBundle((prev) => ({
        ...(prev || {}),
        agreements: (prev?.agreements || []).filter((a) => a.id !== deleteTarget.id),
      }))
      invalidateQueryCache()
      showToast(`Deleted "${deleteTarget.title}"`)
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative overflow-x-clip">
      {/* Subtle ambient washes refracted behind liquid-glass panels */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 lg:left-64 overflow-hidden -z-0">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      <div className="relative z-10 space-y-5 max-w-7xl mx-auto">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl liquid-glass-surface border-red-200/80 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Could not load agreements</p>
              <p className="text-xs mt-0.5 text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Unified 3-Stat KPI Strip */}
        <div className="grid grid-cols-3 rounded-2xl liquid-glass-surface overflow-hidden">
          {[
            { label: 'Total Projects', val: stats.total, rawZero: stats.total === 0, icon: ScrollText, accent: 'text-zinc-900' },
            { label: 'Uploaded', val: stats.uploaded, rawZero: stats.uploaded === 0, icon: CheckCircle2, accent: 'text-emerald-600' },
            { label: 'Not Uploaded', val: stats.pending, rawZero: stats.pending === 0, icon: Clock, accent: 'text-amber-600' },
          ].map((k, idx) => {
            const isZero = !loading && k.rawZero
            return (
              <div
                key={k.label}
                className={`px-4 sm:px-5 py-3.5 sm:py-4 flex items-start justify-between gap-3 border-zinc-900/[0.06] ${
                  idx < 2 ? 'border-r' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{k.label}</p>
                  <p className={`font-heading text-xl sm:text-2xl font-bold tabular-nums mt-1.5 leading-none truncate ${isZero ? 'text-zinc-400' : k.accent}`}>
                    {loading ? '—' : k.val}
                  </p>
                </div>
                <k.icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400 hidden sm:block" />
              </div>
            )
          })}
        </div>

        {/* Search & Upload Status Filter */}
        <div className="rounded-2xl liquid-glass-surface px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project name..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/70 border border-zinc-900/[0.08] text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#E08A1E]"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
            {[
              { key: 'all', label: 'All' },
              { key: 'uploaded', label: 'Uploaded' },
              { key: 'pending', label: 'Not Uploaded' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setUploadFilter(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  uploadFilter === tab.key
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                    : 'text-slate-500 hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Agreement Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading agreements...
          </div>
        ) : agreements.length === 0 ? (
          <div className="rounded-2xl liquid-glass-surface">
            <EmptyState
              icon={ScrollText}
              title="No agreements yet"
              description="Creating a project automatically adds its agreement card here."
              action={
                <Button variant="obsidian" onClick={openCreateModal}>
                  <Plus className="w-4 h-4" />
                  New Agreement
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl liquid-glass-surface">
            <EmptyState
              icon={Search}
              title="No matching agreements"
              description="Try clearing your search or switching the upload filter."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const photoCount = a.attachmentCount ?? 0
              const isUploaded = photoCount > 0
              const displayName = a.projectName || a.title

              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/agreements/${a.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/agreements/${a.id}`)
                    }
                  }}
                  className="group rounded-2xl liquid-glass-surface p-5 flex flex-col justify-between gap-5 text-left cursor-pointer hover:border-amber-500/45 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-lg font-bold text-zinc-900 group-hover:text-[#D97706] transition-colors truncate capitalize">
                      {displayName}
                    </h3>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(a)
                        }}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-all cursor-pointer"
                        title="Delete agreement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-[#D97706] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-900/[0.06]">
                    {isUploaded ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Agreement Uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 ring-1 ring-amber-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Not Uploaded
                      </span>
                    )}

                    <span className="inline-flex items-center gap-2 text-xs text-zinc-500 tabular-nums">
                      {a.contractValue > 0 && (
                        <span className="font-semibold text-zinc-700">
                          ₹{Number(a.contractValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ·
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Camera className={`w-3.5 h-3.5 ${isUploaded ? 'text-emerald-600' : 'text-zinc-400'}`} />
                        {photoCount}
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AgreementCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projects={projects}
        onSave={handleCreate}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Agreement"
        message={`Delete agreement "${deleteTarget?.projectName || deleteTarget?.title}" and all its uploaded photos?`}
        confirmText="Delete"
      />
    </div>
  )
}
