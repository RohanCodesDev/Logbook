import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Plus, Search, RefreshCw, AlertTriangle, Loader2,
  Phone, Truck, MapPin, Pencil, Trash2, Download, IndianRupee,
  BadgeCheck, UserCheck, HardHat,
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
  getCrewMembers,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
  getProjects,
} from '../services/api'
import { formatHumanDate } from '../utils/sheetUtils'

const ROLE_OPTIONS = [
  { value: 'driver',   label: 'Driver' },
  { value: 'operator', label: 'Operator' },
  { value: 'helper',   label: 'Helper' },
  { value: 'other',    label: 'Other Staff' },
]

const WAGE_BASIS_OPTIONS = [
  { value: 'daily',   label: 'Per Day' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'trip',    label: 'Per Trip' },
]

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
]

const ROLE_STYLES = {
  driver:   'bg-[#FEF6E9] text-[#92400E] ring-1 ring-[#FDE68A]',
  operator: 'bg-[#DBEAFE] text-[#1E40AF] ring-1 ring-[#BFDBFE]',
  helper:   'bg-[#DCFCE7] text-[#166534] ring-1 ring-[#BBF7D0]',
  other:    'bg-[#EFECE4] text-[#57534E] ring-1 ring-[#E6E1D6]',
}

const STATUS_STYLES = {
  active:   { cls: 'bg-[#DCFCE7] text-[#166534] ring-1 ring-[#BBF7D0]', dot: 'bg-[#16A34A]', label: 'Active' },
  on_leave: { cls: 'bg-[#FEF3C7] text-[#92400E] ring-1 ring-[#FDE68A]', dot: 'bg-[#D97706]', label: 'On Leave' },
  inactive: { cls: 'bg-[#EFECE4] text-[#57534E] ring-1 ring-[#E6E1D6]', dot: 'bg-[#78716C]', label: 'Inactive' },
}

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || 'Staff'
}

function getBasisSuffix(basis) {
  if (basis === 'monthly') return '/mo'
  if (basis === 'trip') return '/trip'
  return '/day'
}

function CrewFormModal({ open, onClose, initialData, projects, onSave }) {
  const isEditing = Boolean(initialData)
  const [form, setForm] = useState({
    name: '',
    role: 'driver',
    phone: '',
    vehicleMachine: '',
    projectId: '',
    wageRate: '',
    wageBasis: 'daily',
    licenseNo: '',
    joiningDate: '',
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
        name: initialData.name || '',
        role: initialData.role || 'driver',
        phone: initialData.phone || '',
        vehicleMachine: initialData.vehicleMachine || '',
        projectId: initialData.projectId ? String(initialData.projectId) : '',
        wageRate: initialData.wageRate !== null && initialData.wageRate !== undefined ? String(initialData.wageRate) : '',
        wageBasis: initialData.wageBasis || 'daily',
        licenseNo: initialData.licenseNo || '',
        joiningDate: initialData.joiningDate || '',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
      })
    } else {
      setForm({
        name: '',
        role: 'driver',
        phone: '',
        vehicleMachine: '',
        projectId: '',
        wageRate: '',
        wageBasis: 'daily',
        licenseNo: '',
        joiningDate: '',
        status: 'active',
        notes: '',
      })
    }
  }, [open, initialData])

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned / General Pool' },
      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [projects]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Full name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        ...form,
        projectId: form.projectId ? Number(form.projectId) : null,
        wageRate: form.wageRate === '' ? null : Number(form.wageRate),
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
      title={isEditing ? `Edit — ${initialData.name}` : 'Add Driver, Operator or Helper'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Full Name" required>
            <input
              type="text"
              required
              autoFocus
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
            />
          </InputField>

          <InputField label="Role" required>
            <AnimatedDropdown
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val })}
              options={ROLE_OPTIONS}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="Phone Number">
            <input
              type="tel"
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9876543210"
            />
          </InputField>

          <InputField label="Assigned Machine / Vehicle">
            <input
              type="text"
              className={inputClass}
              value={form.vehicleMachine}
              onChange={(e) => setForm({ ...form, vehicleMachine: e.target.value })}
              placeholder="e.g. JCB 3DX / Tipper TN-01"
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
          <InputField label="Wage / Salary (₹)">
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClass}
              value={form.wageRate}
              onChange={(e) => setForm({ ...form, wageRate: e.target.value })}
              placeholder="e.g. 900"
            />
          </InputField>

          <InputField label="Pay Basis">
            <AnimatedDropdown
              value={form.wageBasis}
              onChange={(val) => setForm({ ...form, wageBasis: val })}
              options={WAGE_BASIS_OPTIONS}
              buttonClassName="h-[42px] rounded-xl"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <InputField label="License / ID Number">
            <input
              type="text"
              className={inputClass}
              value={form.licenseNo}
              onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
              placeholder="Optional DL / Aadhaar ref"
            />
          </InputField>

          <InputField label="Joining Date">
            <input
              type="date"
              className={inputClass}
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
          </InputField>
        </div>

        <InputField label="Notes">
          <textarea
            rows={2}
            className={`${inputClass} resize-none`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Shift preferences, bank details, emergency contact..."
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
            {isEditing ? 'Update Person' : 'Add Person'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CrewDirectory() {
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const [crew, setCrew]         = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [modalOpen, setModalOpen]         = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [deleting, setDeleting]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [crewRes, projRes] = await Promise.all([
        getCrewMembers(),
        getProjects(),
      ])
      setCrew(crewRes.data || [])
      setProjects(projRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreateModal = useCallback(() => {
    setEditingMember(null)
    setModalOpen(true)
  }, [])

  useEffect(() => {
    setTopBar({
      title: 'Workforce',
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
              Add Person
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, openCreateModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return crew.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!q) return true
      return (
        m.name?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.vehicleMachine?.toLowerCase().includes(q) ||
        m.projectName?.toLowerCase().includes(q) ||
        m.licenseNo?.toLowerCase().includes(q)
      )
    })
  }, [crew, roleFilter, statusFilter, search])

  const counts = useMemo(() => ({
    total: crew.length,
    active: crew.filter((c) => c.status === 'active').length,
    drivers: crew.filter((c) => c.role === 'driver').length,
    operators: crew.filter((c) => c.role === 'operator').length,
    helpers: crew.filter((c) => c.role === 'helper').length,
  }), [crew])

  const handleSave = async (payload) => {
    if (editingMember) {
      const res = await updateCrewMember(editingMember.id, payload)
      setCrew((prev) => prev.map((c) => (c.id === editingMember.id ? res.data : c)))
      showToast(`Updated "${res.data.name}"`)
    } else {
      const res = await createCrewMember(payload)
      setCrew((prev) => [res.data, ...prev])
      showToast(`Added "${res.data.name}"`)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCrewMember(deleteTarget.id)
      setCrew((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      showToast(`Removed "${deleteTarget.name}"`)
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
    const header = ['Name', 'Role', 'Phone', 'Machine / Vehicle', 'Site', 'Wage Rate', 'Pay Basis', 'License / ID', 'Joined', 'Status'].join(',')
    const rows = filtered.map((m) =>
      [
        esc(m.name),
        esc(getRoleLabel(m.role)),
        esc(m.phone),
        esc(m.vehicleMachine),
        esc(m.projectName || 'General'),
        m.wageRate ?? '',
        esc(m.wageBasis),
        esc(m.licenseNo),
        esc(m.joiningDate ? formatHumanDate(m.joiningDate) : ''),
        esc(STATUS_STYLES[m.status]?.label || m.status),
      ].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'drivers-operators-helpers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Could not load directory</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Unified KPI Instrument Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-zinc-200/80 bg-[var(--bg-card)] divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 overflow-hidden shadow-xs">
        {[
          { label: 'Total Workforce', val: counts.total, icon: Users, accent: 'text-zinc-900', iconActive: 'text-amber-500' },
          { label: 'Active on Duty', val: counts.active, icon: UserCheck, accent: 'text-emerald-600', iconActive: 'text-emerald-500' },
          { label: 'Drivers / Operators', val: `${counts.drivers} / ${counts.operators}`, rawZero: counts.drivers + counts.operators === 0, icon: Truck, accent: 'text-zinc-900', iconActive: 'text-zinc-700' },
          { label: 'Helpers', val: counts.helpers, icon: HardHat, accent: 'text-amber-600', iconActive: 'text-amber-500' },
        ].map((k) => {
          const isZero = !loading && (k.rawZero !== undefined ? k.rawZero : k.val === 0)
          return (
            <div key={k.label} className="px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k.label}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1.5 leading-none ${isZero ? 'text-zinc-400' : k.accent}`}>
                  {loading ? '—' : k.val}
                </p>
              </div>
              <k.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isZero ? 'text-zinc-300' : k.iconActive}`} />
            </div>
          )
        })}
      </div>

      {/* Main Directory Card */}
      <Card noPad className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, machine, site..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-slate-400 focus:outline-none focus:border-[#E08A1E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Role chips */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
              {[
                { key: 'all', label: 'All' },
                { key: 'driver', label: 'Drivers' },
                { key: 'operator', label: 'Operators' },
                { key: 'helper', label: 'Helpers' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    roleFilter === tab.key
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-slate-500 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-32">
              <AnimatedDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Status' },
                  ...STATUS_OPTIONS,
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading staff directory...
          </div>
        ) : crew.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No drivers, operators, or helpers yet"
            description="Keep a central directory of your drivers, machine operators, and site helpers with their assigned vehicles, wages, and phone numbers."
            action={
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="w-4 h-4" />
                Add First Person
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching personnel"
            description="Try clearing your search or changing the role/status filter."
          />
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="sm:hidden p-3.5 space-y-2.5 bg-[var(--bg-canvas)]/70">
              {filtered.map((m) => {
                const st = STATUS_STYLES[m.status] || STATUS_STYLES.active
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setEditingMember(m)
                      setModalOpen(true)
                    }}
                    className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-3.5 shadow-xs space-y-2.5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{m.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_STYLES[m.role] || ROLE_STYLES.other}`}>
                            {getRoleLabel(m.role)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                      </div>

                      {m.wageRate !== null && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                            ₹{m.wageRate.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">{getBasisSuffix(m.wageBasis)}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{m.vehicleMachine || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{m.projectName || 'General Pool'}</span>
                      </div>
                      {m.phone && (
                        <a
                          href={`tel:${m.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[#C97814] font-semibold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{m.phone}</span>
                        </a>
                      )}
                      {m.licenseNo && (
                        <div className="flex items-center gap-1.5 truncate text-slate-500">
                          <BadgeCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{m.licenseNo}</span>
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
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Name</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Role</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Phone</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Machine / Vehicle</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Site / Project</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Wage / Rate</th>
                    <th className="px-3 py-2.5 border-r border-[var(--border-grid)]">Status</th>
                    <th className="px-2 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => {
                    const st = STATUS_STYLES[m.status] || STATUS_STYLES.active
                    return (
                      <tr
                        key={m.id}
                        className={`group border-b border-[var(--border-grid)] last:border-b-0 transition-colors ${
                          idx % 2 === 1 ? 'bg-[#F6F4EF]/50' : 'bg-[var(--bg-card)]'
                        } hover:bg-zinc-950/[0.025]`}
                      >
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)]">
                          <div>{m.name}</div>
                          {m.licenseNo && (
                            <div className="text-[11px] text-slate-400 font-normal">ID: {m.licenseNo}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)]">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLES[m.role] || ROLE_STYLES.other}`}>
                            {getRoleLabel(m.role)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium tabular-nums">
                          {m.phone ? (
                            <a href={`tel:${m.phone}`} className="text-[#C97814] hover:underline">
                              {m.phone}
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs font-normal">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)]">
                          {m.vehicleMachine || <span className="text-slate-300 text-xs font-normal">—</span>}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-slate-600">
                          {m.projectName || <span className="text-slate-400 text-xs">General Pool</span>}
                        </td>
                        <td className="px-3 py-2.5 border-r border-[var(--border-grid)] text-sm font-medium text-[var(--text-primary)] tabular-nums">
                          {m.wageRate !== null ? (
                            <span>
                              ₹{m.wageRate.toLocaleString('en-IN')}
                              <span className="text-[11px] text-slate-400 font-normal ml-0.5">
                                {getBasisSuffix(m.wageBasis)}
                              </span>
                            </span>
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
                                setEditingMember(m)
                                setModalOpen(true)
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-[var(--bg-input)] transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(m)}
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

      <CrewFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingMember}
        projects={projects}
        onSave={handleSave}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Remove Crew Member"
        message={`Remove "${deleteTarget?.name}" from Drivers, Operators & Helpers?`}
        confirmText="Remove"
      />
    </div>
  )
}
