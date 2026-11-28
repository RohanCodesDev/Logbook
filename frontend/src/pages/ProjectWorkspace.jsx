import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Layers,
  AlertTriangle, Loader2, ArrowLeft, ScrollText, Building2
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import EmptyState from '../components/ui/EmptyState'
import ConfirmModal from '../components/ui/ConfirmModal'
import ProjectFormModal from '../components/project/ProjectFormModal'
import SectionTabs from '../components/workspace/SectionTabs'
import ModelSelectorDropdown from '../components/workspace/ModelSelectorDropdown'
import SectionFormModal from '../components/workspace/SectionFormModal'
import CustomFieldBuilderModal from '../components/workspace/CustomFieldBuilderModal'
import RecordFormModal from '../components/workspace/RecordFormModal'
import RecordRegisterTable from '../components/workspace/RecordRegisterTable'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import {
  getProject, updateProject,
  getSections, createSection, updateSection, deleteSection,
  createField, reorderFields, updateField, deleteField,
  getRecords, createRecord, updateRecord, deleteRecord,
} from '../services/api'
import { invalidateQueryCache } from '../utils/queryCache'

const FLEET_SHEET_RE = /\b(machines?|machinery|equipments?|hyvas?|tippers?|dumpers?|vehicles?|trucks?|excavators?|loaders?|cranes?|rollers?|jcb|fleet)\b/i
const HYVA_SHEET_RE = /\b(hyvas?|tippers?|dumpers?|trucks?)\b/i
const MODEL_FIELD_RE = /\b(model|machine|hyva|vehicle|equipment|tipper|dumper|truck)\b/i

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
  const [editingFieldId, setEditingFieldId]     = useState(null)

  const [recordModalOpen, setRecordModalOpen]       = useState(false)
  const [editingRecord, setEditingRecord]           = useState(null)
  const [defaultEntryDate, setDefaultEntryDate]     = useState(null)
  const [deletingRecordId, setDeletingRecordId]     = useState(null)
  const [selectedModel, setSelectedModel]           = useState('')

  const activeSection = sections.find((s) => s.id === activeId) || null

  const isHyvaSheet = HYVA_SHEET_RE.test(activeSection?.name || '')

  const modelField = useMemo(() => {
    const flds = activeSection?.fields || []
    return (
      flds.find(
        (f) => (f.fieldType === 'text' || f.fieldType === 'select') && MODEL_FIELD_RE.test(f.name || '')
      ) || null
    )
  }, [activeSection])

  const isFleetSheet = useMemo(() => {
    if (!activeSection) return false
    return (
      FLEET_SHEET_RE.test(activeSection.name || '') ||
      (activeSection.models?.length || 0) > 0 ||
      Boolean(modelField)
    )
  }, [activeSection, modelField])

  const getRecordModelValue = useCallback((rec) => {
    if (!rec?.data) return ''
    if (modelField) {
      const v = rec.data[String(modelField.id)]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        return String(v).trim()
      }
    }
    const fallback = rec.data.__model
    return fallback ? String(fallback).trim() : ''
  }, [modelField])

  const { modelOptions, countsByModel } = useMemo(() => {
    const counts = {}
    const ordered = []
    const seen = new Set()

    const pushModel = (raw) => {
      const clean = String(raw || '').trim()
      if (!clean) return
      if (!seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase())
        ordered.push(clean)
      }
    }

    ;(activeSection?.models || []).forEach(pushModel)
    ;(modelField?.options || []).forEach(pushModel)
    records.forEach((rec) => {
      const val = getRecordModelValue(rec)
      if (val) {
        pushModel(val)
        const canonical = ordered.find((m) => m.toLowerCase() === val.toLowerCase()) || val
        counts[canonical] = (counts[canonical] || 0) + 1
      }
    })

    return { modelOptions: ordered, countsByModel: counts }
  }, [activeSection?.models, modelField?.options, records, getRecordModelValue])

  const filteredRecordsByModel = useMemo(() => {
    if (!selectedModel || !isFleetSheet) return records
    const targetLower = selectedModel.toLowerCase()
    return records.filter((rec) => getRecordModelValue(rec).toLowerCase() === targetLower)
  }, [records, selectedModel, isFleetSheet, getRecordModelValue])

  const attachSelectedModel = useCallback((rawData = {}) => {
    if (!selectedModel || !isFleetSheet) return rawData
    const next = { ...rawData }
    if (modelField) {
      const key = String(modelField.id)
      if (!next[key] || String(next[key]).trim() === '') {
        next[key] = selectedModel
      }
    } else if (!next.__model) {
      next.__model = selectedModel
    }
    return next
  }, [selectedModel, isFleetSheet, modelField])

  useEffect(() => {
    setSelectedModel('')
  }, [activeId])

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

  // Sync TopBar breadcrumb with live project name, Agreement & Project Centre buttons, and inline click-to-rename
  useEffect(() => {
    if (!project) return
    setTopBar({
      title: project.name,
      actions: (
        <>
          {project.agreementId && (
            <Magnetic strength={0.18}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/agreements/${project.agreementId}`)}
              >
                <ScrollText className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Agreement</span>
              </Button>
            </Magnetic>
          )}
          <Magnetic strength={0.18}>
            <Button
              variant="obsidian"
              size="sm"
              onClick={() => setEditProjectOpen(true)}
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Project Centre</span>
            </Button>
          </Magnetic>
        </>
      ),
      onRenameTitle: async (nextName) => {
        try {
          const res = await updateProject(project.id, {
            name: nextName,
            location: project.location,
            client: project.client,
            status: project.status,
            startDate: project.startDate,
            description: project.description,
          })
          setProject((prev) => ({ ...prev, ...res.data }))
          showToast(`Renamed project to "${res.data.name}"`)
        } catch (err) {
          showToast(err.message, 'error')
          throw err
        }
      },
    })
    return () => clearTopBar()
  }, [project, setTopBar, clearTopBar, showToast, navigate])

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
    invalidateQueryCache()
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
    try {
      await deleteField(fieldId)
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id
            ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
            : s
        )
      )
      showToast('Column removed')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleReorderFields = async (fieldIds) => {
    if (!activeSection) return
    const previousFields = activeSection.fields || []
    const mapById = new Map(previousFields.map((f) => [f.id, f]))
    const optimisticFields = fieldIds.map((fid, idx) => ({
      ...mapById.get(fid),
      sortOrder: idx,
    })).filter(Boolean)

    setSections((prev) =>
      prev.map((s) => (s.id === activeSection.id ? { ...s, fields: optimisticFields } : s))
    )
    try {
      const res = await reorderFields(activeSection.id, fieldIds)
      setSections((prev) =>
        prev.map((s) => (s.id === activeSection.id ? { ...s, fields: res.data } : s))
      )
      showToast('Column order updated')
    } catch (err) {
      setSections((prev) =>
        prev.map((s) => (s.id === activeSection.id ? { ...s, fields: previousFields } : s))
      )
      showToast(err.message, 'error')
      throw err
    }
  }

  const handleSaveRecord = async (data, entryDate) => {
    const taggedData = attachSelectedModel(data)
    if (editingRecord) {
      const res = await updateRecord(editingRecord.id, data, entryDate)
      setRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? res.data : r)))
      invalidateQueryCache()
      showToast('Entry updated')
    } else {
      const res = await createRecord(activeSection.id, taggedData, entryDate)
      setRecords((prev) => [...prev, res.data])
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id ? { ...s, recordCount: (s.recordCount || 0) + 1 } : s
        )
      )
      invalidateQueryCache()
      showToast('Entry saved')
    }
  }

  const handleDuplicateRecord = async (data, entryDate) => {
    try {
      const res = await createRecord(activeSection.id, attachSelectedModel(data), entryDate)
      setRecords((prev) => [...prev, res.data])
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id ? { ...s, recordCount: (s.recordCount || 0) + 1 } : s
        )
      )
      invalidateQueryCache()
      showToast('Entry duplicated')
    } catch (err) {
      showToast(err.message, 'error')
      throw err
    }
  }

  const handleQuickCreateRecord = async (data = {}, entryDate = null) => {
    try {
      const res = await createRecord(activeSection.id, attachSelectedModel(data), entryDate)
      setRecords((prev) => [...prev, res.data])
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id ? { ...s, recordCount: (s.recordCount || 0) + 1 } : s
        )
      )
      invalidateQueryCache()
      showToast('Row added')
      return res.data
    } catch (err) {
      showToast(err.message, 'error')
      throw err
    }
  }

  const handleAddSectionModel = async (newModelName) => {
    if (!activeSection) return
    const clean = newModelName.trim()
    if (!clean) return
    const existingModels = activeSection.models || []
    const already = modelOptions.find((m) => m.toLowerCase() === clean.toLowerCase())
    if (already) {
      setSelectedModel(already)
      return
    }
    const nextModels = [...existingModels, clean]
    try {
      const res = await updateSection(activeSection.id, { models: nextModels })
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id
            ? { ...s, models: res.data.models || nextModels }
            : s
        )
      )
      setSelectedModel(clean)
      showToast(`Added "${clean}"`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleRemoveSectionModel = async (modelToRemove) => {
    if (!activeSection) return
    const nextModels = (activeSection.models || []).filter(
      (m) => m.toLowerCase() !== modelToRemove.toLowerCase()
    )
    try {
      const res = await updateSection(activeSection.id, { models: nextModels })
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeSection.id
            ? { ...s, models: res.data.models || nextModels }
            : s
        )
      )
      if (selectedModel.toLowerCase() === modelToRemove.toLowerCase()) {
        setSelectedModel('')
      }
      showToast(`Removed "${modelToRemove}"`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleInlineUpdateRecord = async (recordId, data) => {
    try {
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, data } : r))
      )
      const res = await updateRecord(recordId, data)
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? res.data : r))
      )
    } catch (err) {
      showToast(err.message, 'error')
      if (activeSection?.id) loadRecords(activeSection.id)
    }
  }

  const handleDeleteRecordWithUndo = async (rec) => {
    if (!rec || !activeSection) return
    const sectionId = activeSection.id
    const snapshotData = rec.data || {}
    const snapshotDate = rec.entryDate || null

    setDeletingRecordId(rec.id)
    try {
      await deleteRecord(rec.id)
      setRecords((prev) => prev.filter((r) => r.id !== rec.id))
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, recordCount: Math.max(0, (s.recordCount || 1) - 1) } : s
        )
      )
      showToast('Row deleted', {
        type: 'info',
        duration: 5500,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            const restored = await createRecord(sectionId, snapshotData, snapshotDate)
            setRecords((prev) => [...prev, restored.data])
            setSections((prev) =>
              prev.map((s) =>
                s.id === sectionId ? { ...s, recordCount: (s.recordCount || 0) + 1 } : s
              )
            )
            showToast('Row restored')
          } catch (restoreErr) {
            showToast(restoreErr.message, 'error')
          }
        },
      })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingRecordId(null)
    }
  }

  const handleBulkDeleteRecords = async (recordsToDelete) => {
    if (!recordsToDelete?.length || !activeSection) return
    const sectionId = activeSection.id
    const snapshots = recordsToDelete.map((r) => ({
      id: r.id,
      data: r.data || {},
      entryDate: r.entryDate || null,
    }))

    try {
      await Promise.all(snapshots.map((s) => deleteRecord(s.id)))
      const deletedSet = new Set(snapshots.map((s) => s.id))
      setRecords((prev) => prev.filter((r) => !deletedSet.has(r.id)))
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, recordCount: Math.max(0, (s.recordCount || snapshots.length) - snapshots.length) }
            : s
        )
      )
      showToast(`Deleted ${snapshots.length} ${snapshots.length === 1 ? 'row' : 'rows'}`, {
        type: 'info',
        duration: 6000,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            const restored = await Promise.all(
              snapshots.map((s) => createRecord(sectionId, s.data, s.entryDate))
            )
            setRecords((prev) => [...prev, ...restored.map((r) => r.data)])
            setSections((prev) =>
              prev.map((s) =>
                s.id === sectionId ? { ...s, recordCount: (s.recordCount || 0) + snapshots.length } : s
              )
            )
            showToast(`Restored ${snapshots.length} rows`)
          } catch (restoreErr) {
            showToast(restoreErr.message, 'error')
          }
        },
      })
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleBulkUpdateEntryDate = async (recordsToUpdate, nextEntryDate) => {
    if (!recordsToUpdate?.length || !nextEntryDate) return
    try {
      const updated = await Promise.all(
        recordsToUpdate.map((r) => updateRecord(r.id, r.data || {}, nextEntryDate))
      )
      const byId = new Map(updated.map((res) => [res.data.id, res.data]))
      setRecords((prev) => prev.map((r) => byId.get(r.id) || r))
      showToast(`Moved ${recordsToUpdate.length} ${recordsToUpdate.length === 1 ? 'row' : 'rows'} to ${nextEntryDate}`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleImportCsv = async ({ rows, mappings, columnsToCreate, defaultDate, normalizeDateCandidate }) => {
    if (!activeSection) return
    const sectionId = activeSection.id
    const currentFields = [...(activeSection.fields || [])]
    const createdColIdByIdx = {}

    for (const col of columnsToCreate) {
      const res = await createField(sectionId, {
        name: col.name,
        fieldType: col.fieldType,
        options: [],
        formula: null,
        isRequired: false,
      })
      createdColIdByIdx[col.colIdx] = res.data.id
      currentFields.push(res.data)
    }

    if (columnsToCreate.length > 0) {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, fields: currentFields } : s))
      )
    }

    const fieldById = new Map(currentFields.map((f) => [String(f.id), f]))
    const payloads = rows.map((row) => {
      const data = {}
      let entryDate = defaultDate

      Object.entries(mappings).forEach(([idxStr, target]) => {
        const idx = Number(idxStr)
        const rawCell = row[idx] ?? ''
        if (target === '__skip' || rawCell === '') return
        if (target === '__entryDate') {
          const norm = normalizeDateCandidate(rawCell)
          if (norm) entryDate = norm
          return
        }
        const fieldId = target === '__create' ? String(createdColIdByIdx[idx]) : String(target)
        const f = fieldById.get(fieldId)
        if (!f) return
        if (f.fieldType === 'number' || f.fieldType === 'currency') {
          const cleaned = String(rawCell).replace(/[₹,\s]/g, '')
          const n = Number(cleaned)
          data[fieldId] = Number.isNaN(n) ? rawCell : n
        } else if (f.fieldType === 'date') {
          data[fieldId] = normalizeDateCandidate(rawCell) || rawCell
        } else if (f.fieldType === 'checkbox') {
          data[fieldId] = /^(true|yes|1|y)$/i.test(String(rawCell).trim())
        } else {
          data[fieldId] = rawCell
        }
      })

      return { data, entryDate }
    })

    const createdRecords = await Promise.all(
      payloads.map((p) => createRecord(sectionId, p.data, p.entryDate))
    )
    const inserted = createdRecords.map((r) => r.data)
    setRecords((prev) => [...prev, ...inserted])
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, recordCount: (s.recordCount || 0) + inserted.length } : s
      )
    )
    showToast(`Imported ${inserted.length} ${inserted.length === 1 ? 'row' : 'rows'}`)
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Sections & Registers */}
      {sections.length === 0 ? (
        <Card noPad>
          <EmptyState
            icon={Layers}
            title="No sheets created yet"
            description="Add spreadsheet registers like Materials, Expenses, or Labour to start logging rows."
            action={
              <Button
                variant="primary"
                onClick={() => { setEditingSection(null); setSectionModalOpen(true) }}
              >
                <Plus className="w-4 h-4" />
                Add First Sheet
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="no-print">
            <SectionTabs
              sections={sections}
              activeSectionId={activeId}
              activeFleetModelCount={isFleetSheet ? modelOptions.length : null}
              onSelect={(secId) => setActiveId(secId)}
              onAddSection={() => { setEditingSection(null); setSectionModalOpen(true) }}
              rightSlot={
                isFleetSheet ? (
                  <ModelSelectorDropdown
                    isHyva={isHyvaSheet}
                    selectedModel={selectedModel}
                    models={modelOptions}
                    countsByModel={countsByModel}
                    onSelectModel={setSelectedModel}
                    onAddModel={handleAddSectionModel}
                    onRemoveModel={handleRemoveSectionModel}
                  />
                ) : null
              }
            />
          </div>

          {activeSection && (
            <Card noPad>
              {activeSection.description && (
                <div className="px-6 py-3 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] text-xs text-slate-500">
                  {activeSection.description}
                </div>
              )}
              <RecordRegisterTable
                projectName={project?.name || ''}
                section={activeSection}
                records={filteredRecordsByModel}
                loading={loadingRecords}
                modelPrefill={
                  isFleetSheet && selectedModel
                    ? { fieldId: modelField?.id || null, value: selectedModel }
                    : null
                }
                onAddEntry={(dateKey = null) => {
                  setEditingRecord(null)
                  setDefaultEntryDate(typeof dateKey === 'string' ? dateKey : null)
                  setRecordModalOpen(true)
                }}
                onEditEntry={(rec) => {
                  setEditingRecord(rec)
                  setDefaultEntryDate(null)
                  setRecordModalOpen(true)
                }}
                onDuplicateRecord={handleDuplicateRecord}
                onQuickCreateRecord={handleQuickCreateRecord}
                onInlineUpdateRecord={handleInlineUpdateRecord}
                onDeleteRecord={handleDeleteRecordWithUndo}
                onBulkDeleteRecords={handleBulkDeleteRecords}
                onBulkUpdateEntryDate={handleBulkUpdateEntryDate}
                onImportCsv={handleImportCsv}
                onAddColumn={handleAddField}
                onDeleteField={handleDeleteField}
                onReorderFields={handleReorderFields}
                onCustomizeFields={(fieldId = null) => {
                  setEditingFieldId(fieldId)
                  setFieldBuilderOpen(true)
                }}
                onEditSection={(sec) => { setEditingSection(sec); setSectionModalOpen(true) }}
                onDeleteSection={(sec) => setDeleteSectionTarget(sec)}
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
        sections={sections}
      />

      <CustomFieldBuilderModal
        open={fieldBuilderOpen}
        onClose={() => {
          setFieldBuilderOpen(false)
          setEditingFieldId(null)
        }}
        section={activeSection}
        initialEditFieldId={editingFieldId}
        onAddField={handleAddField}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
        onReorderFields={handleReorderFields}
      />

      <RecordFormModal
        open={recordModalOpen}
        onClose={() => {
          setRecordModalOpen(false)
          setDefaultEntryDate(null)
        }}
        section={activeSection}
        initialRecord={editingRecord}
        defaultEntryDate={defaultEntryDate}
        modelFieldId={modelField?.id || null}
        defaultModelValue={isFleetSheet ? selectedModel : ''}
        onSubmit={handleSaveRecord}
        onDuplicate={(data, entryDate) => handleDuplicateRecord(data, entryDate)}
        onDelete={(rec) => {
          setRecordModalOpen(false)
          handleDeleteRecordWithUndo(rec)
        }}
      />

      <ConfirmModal
        open={Boolean(deleteSectionTarget)}
        onClose={() => setDeleteSectionTarget(null)}
        onConfirm={handleConfirmDeleteSection}
        title="Delete Section"
        message={`Delete "${deleteSectionTarget?.name}" and all ${deleteSectionTarget?.recordCount || 0} logged records inside it?`}
        loading={deletingSection}
      />
    </div>
  )
}
