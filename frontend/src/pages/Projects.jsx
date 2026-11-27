import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import ProjectsTable from '../components/project/ProjectsTable'
import ProjectFormModal from '../components/project/ProjectFormModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Magnetic } from '../components/ui/Magnetic'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import { getProjects, createProject, updateProject, deleteProject } from '../services/api'

export default function Projects() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Create / Edit modal state
  const [formModalOpen, setFormModalOpen]   = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProjects()
      setProjects(res.data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreateModal = useCallback(() => {
    setEditingProject(null)
    setFormModalOpen(true)
  }, [])

  // Mount minimal TopBar actions (+ New Project & Refresh)
  useEffect(() => {
    setTopBar({
      title: 'Your Projects',
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
              New Project
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, openCreateModal])

  const filtered = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    if (!matchesStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.client?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    )
  })

  const openEditModal = (project) => {
    setEditingProject(project)
    setFormModalOpen(true)
  }

  const handleSaveProject = async (payload) => {
    if (editingProject) {
      const res = await updateProject(editingProject.id, payload)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? { ...res.data, sectionCount: p.sectionCount, recordCount: p.recordCount }
            : p
        )
      )
      showToast(`Updated "${res.data.name}"`)
    } else {
      const res = await createProject(payload)
      setProjects((prev) => [res.data, ...prev])
      showToast(`Created project "${res.data.name}"`)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await deleteProject(deleteTarget.id)
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      showToast(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleView = (project) => {
    navigate(`/projects/${project.id}`)
  }

  const handleShare = (project) => {
    const url = `${window.location.origin}/projects/${project.id}`
    navigator.clipboard?.writeText(url)
    showToast(`Copied link for "${project.name}"`, 'info')
  }

  // Clickable unified KPI instrument strip — monochrome zeros, color reserved for active/non-zero states
  const kpiFilters = [
    {
      value: 'all',
      label: 'All Projects',
      count: projects.length,
      nonZeroAccent: 'text-zinc-900',
    },
    {
      value: 'active',
      label: 'Active',
      count: projects.filter((p) => p.status === 'active').length,
      nonZeroAccent: 'text-emerald-600',
    },
    {
      value: 'planning',
      label: 'Planning',
      count: projects.filter((p) => p.status === 'planning').length,
      nonZeroAccent: 'text-amber-600',
    },
    {
      value: 'paused',
      label: 'Paused',
      count: projects.filter((p) => p.status === 'paused').length,
      nonZeroAccent: 'text-amber-600',
    },
    {
      value: 'completed',
      label: 'Completed',
      count: projects.filter((p) => p.status === 'completed').length,
      nonZeroAccent: 'text-zinc-900',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Unified KPI Instrument Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-2xl border border-zinc-200/80 bg-[var(--bg-card)] divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80 overflow-hidden shadow-xs">
        {kpiFilters.map((k) => {
          const isSelected = statusFilter === k.value
          const isZero = !loading && k.count === 0
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setStatusFilter(k.value)}
              className={`relative text-left px-5 py-4 transition-all duration-150 ${
                isSelected
                  ? 'liquid-glass-dark text-zinc-100 border-0'
                  : 'hover:bg-zinc-950/[0.025] text-zinc-700'
              }`}
            >
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-amber-500"
                />
              )}
              <span
                className={`block text-[11px] font-semibold uppercase tracking-wider ${
                  isSelected ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {k.label}
              </span>
              <p
                className={`text-2xl font-bold tabular-nums mt-1.5 ${
                  isSelected
                    ? isZero
                      ? 'text-zinc-500'
                      : 'text-zinc-100'
                    : isZero
                      ? 'text-zinc-400'
                      : k.nonZeroAccent
                }`}
              >
                {loading ? '—' : k.count}
              </p>
            </button>
          )
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Could not load projects</p>
            <p className="text-xs mt-0.5 text-red-600">{error}</p>
            <button onClick={load} className="text-xs font-semibold underline mt-1.5 hover:no-underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Projects Table Card */}
      <Card noPad>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="relative flex items-center w-full max-w-sm">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, location, or client..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-input)] text-base sm:text-sm text-[var(--text-primary)] placeholder-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:bg-[var(--bg-card)] transition-all"
            />
          </div>

          {!loading && (
            <p className="text-xs text-zinc-500 tabular-nums hidden sm:block">
              Showing {filtered.length} of {projects.length}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading projects...
          </div>
        ) : (
          <ProjectsTable
            projects={filtered}
            onView={handleView}
            onEdit={openEditModal}
            onShare={handleShare}
            onDelete={(p) => setDeleteTarget(p)}
            deletingId={deletingId}
            emptyAction={
              projects.length === 0 ? (
                <Button variant="primary" size="sm" onClick={openCreateModal}>
                  <Plus className="w-4 h-4" />
                  Create First Project
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all')
                    setSearch('')
                  }}
                >
                  Clear Filters
                </Button>
              )
            }
          />
        )}
      </Card>

      {/* Reusable Create / Edit Project Modal */}
      <ProjectFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleSaveProject}
        initialData={editingProject}
      />

      {/* Reusable Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All sections, custom fields, and records inside this project will also be permanently deleted.`}
        loading={Boolean(deletingId)}
      />
    </div>
  )
}
