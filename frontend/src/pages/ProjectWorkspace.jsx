import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MapPin, User, Calendar, Pencil, Plus, Layers,
  AlertTriangle, Loader2, ArrowLeft
} from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ConfirmModal from '../components/ui/ConfirmModal'
import ProjectFormModal from '../components/project/ProjectFormModal'
import SectionTabs from '../components/workspace/SectionTabs'
import SectionFormModal from '../components/workspace/SectionFormModal'
import CustomFieldBuilderModal from '../components/workspace/CustomFieldBuilderModal'
import RecordFormModal from '../components/workspace/RecordFormModal'
import RecordRegisterTable from '../components/workspace/RecordRegisterTable'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import {
  getProject, updateProject,
  getSections, createSection, updateSection, deleteSection,
  createField, updateField, deleteField,
  getRecords, createRecord, updateRecord, deleteRecord,
} from '../services/api'

/**
 * ProjectWorkspace — Independent workspace for a single project.
 */
export default function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const [project, setProject]     = useState(null)
  const [sections, setSections]   = useState([])
  const [activeId, setActiveId]   = useState(null)
  const [records, setRecords]     = useState([])

  const [loadingPage, setLoadingPage]       = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [error, setError]                   = useState(null)

  // Modals
  const [editProjectOpen, setEditProjectOpen]         = useState(false)
  const [sectionModalOpen, setSectionModalOpen]       = useState(false)
  const [editingSection, setEditingSection]           = useState(null)
  const [deleteSectionTarget, setDeleteSectionTarget] = useState(null)
  const [deletingSection, setDeletingSection]         = useState(false)

  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)

  const [recordModalOpen, setRecordModalOpen]       = useState(false)
  const [editingRecord, setEditingRecord]           = useState(null)
  const [deleteRecordTarget, setDeleteRecordTarget] = useState(null)
  const [deletingRecordId, setDeletingRecordId]     = useState(null)

  const activeSection = sections.find((s) => s.id === activeId) || null

  const loadWorkspace = useCallback(async () => {
    setLoadingPage(true)
    setError(null)
    try {
      const [projRes, secRes] = await Promise.all([
        getProject(id),
        getSections(id),
      ])
      setProject(projRes.data)
      const list = secRes.data || []
      setSections(list)
      setActiveId((prev) => (list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPage(false)
    }
  }, [id])

  useEffect(() => { loadWorkspace() }, [loadWorkspace])

  // Sync TopBar breadcrumb with live project name & Edit action
  useEffect(() => {
    if (!project) return
    setTopBar({
      title: project.name,
      actions: (
        <Button variant="outline" size="sm" onClick={() => setEditProjectOpen(true)}>
          <Pencil className="w-3.5 h-3.5" />
          Edit Project
        </Button>
      ),
    })
    return () => clearTopBar()
  }, [project, setTopBar, clearTopBar])

  const loadRecords = useCallback(async (sectionId) => {
    if (!sectionId) {
      setRecords([])
      return
    }
    setLoadingRecords(true)
    try {
      const res = await getRecords(sectionId)
      setRecords(res.data || [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoadingRecords(false)
    }
  }, [showToast])

  useEffect(() => {
    loadRecords(activeId)
  }, [activeId, loadRecords])

  const handleUpdateProject = async (payload) => {
    const res = await updateProject(project.id, payload)
    setProject((prev) => ({ ...prev, ...res.data }))
    showToast('Project details updated')
  }

  const handleSaveSection = async (payload) => {
    if (editingSection) {
      const res = await updateSection(editingSection.id, payload)
      setSections((prev) =>
        prev.map((s) =>
          s.id === editingSection.id
            ? { ...s, ...res.data, fields: s.fields, recordCount: s.recordCount }
            : s
        )
      )
      showToast(`Renamed section to "${res.data.name}"`)
    } else {
      const res = await createSection(id, payload)
      setSections((prev) => [...prev, res.data])
      setActiveId(res.data.id)
      showToast(`Added section "${res.data.name}"`)
    }
  }

  const handleConfirmDeleteSection = async () => {
    if (!deleteSectionTarget) return
    setDeletingSection(true)
    try {
      await deleteSection(deleteSectionTarget.id)
      const remaining = sections.filter((s) => s.id !== deleteSectionTarget.id)
      setSections(remaining)
      if (activeId === deleteSectionTarget.id) {
        setActiveId(remaining[0]?.id ?? null)
      }
      showToast(`Deleted section "${deleteSectionTarget.name}"`)
      setDeleteSectionTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingSection(false)
    }
  }

  const handleAddField = async (payload) => {
    const res = await createField(activeSection.id, payload)
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection.id ? { ...s, fields: [...(s.fields || []), res.data] } : s
      )
    )
    showToast(`Added field "${res.data.name}"`)
  }

  const handleUpdateField = async (fieldId, payload) => {
    const res = await updateField(fieldId, payload)
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection.id
          ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? res.data : f)) }
          : s
      )
    )
    showToast(`Updated field "${res.data.name}"`)
  }

  const handleDeleteField = async (fieldId) => {
    await deleteField(fieldId)
    setSections((prev) =>
      prev.map((s) =>
        s.id === activeSection.id
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s
      )
    )
    showToast('Field removed')
  }

  const handleSaveRecord = async (data) => {
    if (editingRecord) {
      const res = await updateRecord(editingRecord.id, data)
      setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? res.data : r)))
      showToast('Record updated')
    } else {
      const res = await createRecord(activeSection.id, data)
      setRecords((prev) => [res.data, ...prev])
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id ? { ...s, recordCount: (s.recordCount || 0) + 1 } : s
        )
      )
      showToast('Record saved')
    }
  }

  const handleConfirmDeleteRecord = async () => {
    if (!deleteRecordTarget) return
    setDeletingRecordId(deleteRecordTarget.id)
    try {
      await deleteRecord(deleteRecordTarget.id)
      setRecords((prev) => prev.filter((r) => r.id !== deleteRecordTarget.id))
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection?.id ? { ...s, recordCount: Math.max(0, (s.recordCount || 1) - 1) } : s
        )
      )
      showToast('Record deleted')
      setDeleteRecordTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingRecordId(null)
    }
  }

  if (loadingPage) {
    return (
      <div className="flex items-center justify-center py-28 gap-3 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading project workspace...
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Project unavailable</h2>
        <p className="text-sm text-slate-500">{error || 'This project could not be found.'}</p>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Your Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Compact Project Metadata Strip */}
      <Card className="py-4 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <Badge status={project.status} />
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Client: <strong className="text-slate-700 font-medium">{project.client || '—'}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {project.location || 'Location not set'}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Started: {project.startDate || '—'}
            </span>
          </div>
          {project.description && (
            <p className="text-xs text-slate-500 truncate max-w-md" title={project.description}>
              {project.description}
            </p>
          )}
        </div>
      </Card>

      {/* Sections & Registers */}
      {sections.length === 0 ? (
        <Card noPad>
          <EmptyState
            icon={Layers}
            title="Set up your project workspace"
            description="Create customizable sections like Material Register, Payment Ledger, or Daily Labour Log — or start from scratch with your own fields."
            action={
              <Button
                variant="primary"
                onClick={() => { setEditingSection(null); setSectionModalOpen(true) }}
              >
                <Plus className="w-4 h-4" />
                Add First Section
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <SectionTabs
            sections={sections}
            activeSectionId={activeId}
            onSelect={(secId) => setActiveId(secId)}
            onAddSection={() => { setEditingSection(null); setSectionModalOpen(true) }}
            onEditSection={(sec) => { setEditingSection(sec); setSectionModalOpen(true) }}
            onDeleteSection={(sec) => setDeleteSectionTarget(sec)}
          />

          {activeSection && (
            <Card noPad>
              {activeSection.description && (
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 text-xs text-slate-500">
                  {activeSection.description}
                </div>
              )}
              <RecordRegisterTable
                section={activeSection}
                records={records}
                loading={loadingRecords}
                onAddRecord={() => { setEditingRecord(null); setRecordModalOpen(true) }}
                onEditRecord={(rec) => { setEditingRecord(rec); setRecordModalOpen(true) }}
                onDeleteRecord={(rec) => setDeleteRecordTarget(rec)}
                onCustomizeFields={() => setFieldBuilderOpen(true)}
                deletingRecordId={deletingRecordId}
              />
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <ProjectFormModal
        open={editProjectOpen}
        onClose={() => setEditProjectOpen(false)}
        onSubmit={handleUpdateProject}
        initialData={project}
      />

      <SectionFormModal
        open={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        onSubmit={handleSaveSection}
        initialData={editingSection}
      />

      <CustomFieldBuilderModal
        open={fieldBuilderOpen}
        onClose={() => setFieldBuilderOpen(false)}
        section={activeSection}
        onAddField={handleAddField}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
      />

      <RecordFormModal
        open={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        section={activeSection}
        initialRecord={editingRecord}
        onSubmit={handleSaveRecord}
      />

      <ConfirmModal
        open={Boolean(deleteSectionTarget)}
        onClose={() => setDeleteSectionTarget(null)}
        onConfirm={handleConfirmDeleteSection}
        title="Delete Section"
        message={`Delete "${deleteSectionTarget?.name}" and all ${deleteSectionTarget?.recordCount || 0} logged records inside it?`}
        loading={deletingSection}
      />

      <ConfirmModal
        open={Boolean(deleteRecordTarget)}
        onClose={() => setDeleteRecordTarget(null)}
        onConfirm={handleConfirmDeleteRecord}
        title="Delete Record"
        message="Are you sure you want to remove this record from the register?"
        loading={Boolean(deletingRecordId)}
      />
    </div>
  )
}
