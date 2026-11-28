import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, Camera, Upload, Phone,
  ExternalLink, AlertTriangle, Loader2, Check, X,
  Download, ChevronLeft, ChevronRight, Pencil, FolderOpen,
} from 'lucide-react'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'
import InputField, { inputClass } from '../components/ui/InputField'
import { Magnetic } from '../components/ui/Magnetic'
import CameraCaptureModal from '../components/agreements/CameraCaptureModal'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import {
  getAgreement,
  updateAgreement,
  deleteAgreement,
  addAgreementAttachments,
  updateAgreementAttachment,
  deleteAgreementAttachment,
} from '../services/api'
import { formatBytes, compressImageFile } from '../utils/agreementUtils'
import { invalidateQueryCache } from '../utils/queryCache'

function formFromAgreement(agr) {
  return {
    title: agr.title || '',
    partyName: agr.partyName || '',
    partyPhone: agr.partyPhone || '',
    contractValue:
      agr.contractValue !== null && agr.contractValue !== undefined
        ? String(agr.contractValue)
        : '',
    notes: agr.notes || '',
  }
}

function AttachmentLightbox({
  attachments,
  activeIndex,
  onClose,
  onIndexChange,
  onUpdateCaption,
  onDeleteAttachment,
}) {
  const current = activeIndex !== null ? attachments[activeIndex] : null
  const [captionDraft, setCaptionDraft] = useState('')
  const [savingCap, setSavingCap] = useState(false)

  useEffect(() => {
    if (current) setCaptionDraft(current.caption || '')
  }, [current])

  useEffect(() => {
    if (!current) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && activeIndex < attachments.length - 1) {
        onIndexChange(activeIndex + 1)
      }
      if (e.key === 'ArrowLeft' && activeIndex > 0) {
        onIndexChange(activeIndex - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, activeIndex, attachments.length, onClose, onIndexChange])

  if (!current) return null

  const saveCap = async () => {
    const trimmed = captionDraft.trim()
    if (trimmed === (current.caption || '')) return
    setSavingCap(true)
    try {
      await onUpdateCaption(current.id, trimmed)
    } finally {
      setSavingCap(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/[0.08] text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {current.caption || current.fileName}
          </p>
          <p className="text-[11px] text-zinc-400 tabular-nums">
            {activeIndex + 1} of {attachments.length} · {current.source === 'camera' ? 'Camera' : 'File'} · {formatBytes(current.fileSize)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={current.dataUrl}
            download={current.fileName || 'agreement-photo.jpg'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            type="button"
            onClick={() => onDeleteAttachment(current)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs font-medium text-red-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 min-h-0">
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange(activeIndex - 1)
            }}
            className="absolute left-3 sm:left-6 p-2.5 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 text-white transition-colors cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <img
          src={current.dataUrl}
          alt={current.caption || current.fileName}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
        />

        {activeIndex < attachments.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange(activeIndex + 1)
            }}
            className="absolute right-3 sm:right-6 p-2.5 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 text-white transition-colors cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div
        className="px-4 sm:px-6 py-3 border-t border-white/[0.08] bg-black/50 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-lg flex items-center gap-2">
          <input
            type="text"
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={saveCap}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCap()
            }}
            placeholder="Add photo label (e.g. Stamp Paper Page 1)..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.07] border border-white/[0.12] text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={saveCap}
            disabled={savingCap}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {savingCap ? 'Saving...' : 'Save Label'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgreementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const fileInputRef = useRef(null)

  const [agreement, setAgreement] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [form, setForm] = useState(null)
  const [savedSnapshot, setSavedSnapshot] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [editingCaptionId, setEditingCaptionId] = useState(null)
  const [captionText, setCaptionText] = useState('')

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletePhotoTarget, setDeletePhotoTarget] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const agrRes = await getAgreement(id)
      const data = agrRes.data
      setAgreement(data)
      setAttachments(data.attachments || [])
      const initialForm = formFromAgreement(data)
      setForm(initialForm)
      setSavedSnapshot(JSON.stringify(initialForm))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isDirty = useMemo(() => {
    if (!form || !savedSnapshot) return false
    return JSON.stringify(form) !== savedSnapshot
  }, [form, savedSnapshot])

  const handleSave = useCallback(async () => {
    if (!form || !agreement) return
    setSaving(true)
    try {
      const res = await updateAgreement(agreement.id, {
        title: form.title.trim() || agreement.title,
        partyName: form.partyName,
        partyPhone: form.partyPhone,
        contractValue: form.contractValue === '' ? null : Number(form.contractValue),
        notes: form.notes,
      })
      setAgreement((prev) => ({ ...prev, ...res.data }))
      const nextForm = formFromAgreement(res.data)
      setForm(nextForm)
      setSavedSnapshot(JSON.stringify(nextForm))
      invalidateQueryCache()
      showToast('Agreement saved')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }, [form, agreement, showToast])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty && !saving) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDirty, saving, handleSave])

  useEffect(() => {
    if (!agreement) return
    const displayTitle = agreement.projectName || form?.title || agreement.title
    setTopBar({
      title: displayTitle,
      onRenameTitle: async (nextTitle) => {
        const res = await updateAgreement(agreement.id, { title: nextTitle })
        setAgreement((prev) => ({ ...prev, ...res.data }))
        setForm((prev) => {
          const updated = { ...prev, title: res.data.title }
          setSavedSnapshot((snap) => {
            try {
              return JSON.stringify({ ...JSON.parse(snap), title: res.data.title })
            } catch {
              return JSON.stringify(updated)
            }
          })
          return updated
        })
        showToast(`Renamed to "${res.data.title}"`)
      },
      actions: (
        <>
          {agreement.projectId && (
            <Magnetic strength={0.18}>
              <Link to={`/projects/${agreement.projectId}`}>
                <Button variant="outline" size="sm">
                  <FolderOpen className="w-3.5 h-3.5 text-[#D97706]" />
                  <span className="hidden sm:inline">Project</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </Button>
              </Link>
            </Magnetic>
          )}
          <Magnetic strength={0.18}>
            <Button
              variant={isDirty ? 'primary' : 'obsidian'}
              size="sm"
              onClick={handleSave}
              disabled={saving || (!isDirty && Boolean(savedSnapshot))}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : isDirty ? 'Save' : 'Saved'}</span>
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [agreement, form?.title, isDirty, saving, savedSnapshot, handleSave, setTopBar, clearTopBar, showToast])

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) {
      showToast('Please select image files', 'error')
      return
    }
    setUploadingPhotos(true)
    try {
      const prepared = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressImageFile(file)
          return { ...compressed, source: 'upload', caption: '' }
        })
      )
      const res = await addAgreementAttachments(agreement.id, prepared)
      setAttachments((prev) => [...(res.data || []), ...prev])
      invalidateQueryCache('agreements')
      showToast(`Uploaded ${res.data.length} ${res.data.length === 1 ? 'photo' : 'photos'}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleCameraSave = async (attachmentPayload) => {
    const res = await addAgreementAttachments(agreement.id, [attachmentPayload])
    setAttachments((prev) => [...(res.data || []), ...prev])
    invalidateQueryCache('agreements')
    showToast('Camera photo saved')
  }

  const handleUpdateCaption = async (attachmentId, caption) => {
    const res = await updateAgreementAttachment(agreement.id, attachmentId, { caption })
    setAttachments((prev) => prev.map((a) => (a.id === attachmentId ? res.data : a)))
    setEditingCaptionId(null)
    showToast('Photo label updated')
  }

  const handleConfirmDeletePhoto = async () => {
    if (!deletePhotoTarget) return
    setDeletingPhoto(true)
    try {
      await deleteAgreementAttachment(agreement.id, deletePhotoTarget.id)
      setAttachments((prev) => {
        const next = prev.filter((a) => a.id !== deletePhotoTarget.id)
        if (lightboxIdx !== null) {
          if (next.length === 0) setLightboxIdx(null)
          else if (lightboxIdx >= next.length) setLightboxIdx(next.length - 1)
        }
        return next
      })
      setDeletePhotoTarget(null)
      invalidateQueryCache('agreements')
      showToast('Photo removed')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingPhoto(false)
    }
  }

  const handleConfirmDeleteAgreement = async () => {
    if (!agreement) return
    setDeleting(true)
    try {
      await deleteAgreement(agreement.id)
      invalidateQueryCache()
      showToast(`Deleted "${agreement.title}"`)
      navigate('/agreements')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading agreement...
      </div>
    )
  }

  if (error || !agreement || !form) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Agreement unavailable</h2>
        <p className="text-sm text-zinc-500">{error || 'This agreement could not be found.'}</p>
        <Button variant="outline" onClick={() => navigate('/agreements')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Agreements
        </Button>
      </div>
    )
  }

  const isUploaded = attachments.length > 0
  const displayName = agreement.projectName || form.title || agreement.title

  return (
    <div className="relative overflow-x-clip">
      {/* Subtle ambient washes refracted behind liquid-glass panels */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 lg:left-64 overflow-hidden -z-0">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      {/* Viewport-fitted 50/50 split: Details on Left, Pictures on Right */}
      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-[calc(100vh-7.5rem)] lg:min-h-[460px]">
        {/* Left Half — Simple Details (Company Name, Party Number, Notes) */}
        <div className="rounded-2xl liquid-glass-surface p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-900/[0.06]">
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-bold text-zinc-900 truncate capitalize">
                  {displayName}
                </h2>
                <div className="mt-1">
                  {isUploaded ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 tabular-nums">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Agreement Uploaded ({attachments.length})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 ring-1 ring-amber-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Not Uploaded
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
                title="Delete agreement"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <InputField label="Company / Party Name">
              <input
                type="text"
                className={inputClass}
                value={form.partyName}
                onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                placeholder="e.g. Sri Sai Earthmovers"
              />
            </InputField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <InputField label="Party Number">
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    className={`${inputClass} tabular-nums`}
                    value={form.partyPhone}
                    onChange={(e) => setForm({ ...form, partyPhone: e.target.value })}
                    placeholder="e.g. 9845012345"
                  />
                  {form.partyPhone?.trim() && (
                    <a
                      href={`tel:${form.partyPhone.trim()}`}
                      className="h-[42px] px-3 rounded-xl border border-[var(--border-subtle)] bg-white/75 hover:bg-[#FEF6E9] text-[#D97706] inline-flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 transition-colors"
                      title="Call party"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </InputField>

              <InputField label="Contract Value / Budget (₹)">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  className={`${inputClass} tabular-nums font-semibold`}
                  value={form.contractValue}
                  onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                  placeholder="e.g. 500000"
                />
              </InputField>
            </div>

            <InputField label="Agreement Text & Notes">
              <textarea
                rows={5}
                className={`${inputClass} resize-none leading-relaxed`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Key terms, rates, payment schedule, or remarks..."
              />
            </InputField>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-900/[0.06]">
            <span className="text-xs text-zinc-500">
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button
              variant={isDirty ? 'primary' : 'obsidian'}
              size="sm"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Right Half — Pictures Added + Compact Upload (Files & Camera) */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFilesSelected(e.dataTransfer.files)
          }}
          className={`rounded-2xl liquid-glass-surface p-5 sm:p-6 flex flex-col gap-4 lg:overflow-hidden transition-all ${
            isDragging ? 'ring-2 ring-[#E08A1E] bg-[#FEF6E9]/60' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              handleFilesSelected(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />

          {/* Compact Header + Upload Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-zinc-900/[0.06] flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Agreement Pictures</h3>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {attachments.length} {attachments.length === 1 ? 'picture' : 'pictures'} added
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="obsidian"
                size="sm"
                disabled={uploadingPhotos}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhotos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Files</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={uploadingPhotos}
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera</span>
              </Button>
            </div>
          </div>

          {/* Pictures Grid (fits cleanly in remaining viewport height) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            {attachments.length === 0 ? (
              <div className="h-full min-h-[240px] rounded-2xl border-2 border-dashed border-zinc-300/80 bg-white/35 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-11 h-11 rounded-2xl bg-[#18181B] text-amber-400 flex items-center justify-center mb-3">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-zinc-900">No pictures uploaded yet</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  Drop agreement photos here, or use Files / Camera above to upload.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {attachments.map((att, idx) => {
                  const isEditingCap = editingCaptionId === att.id
                  return (
                    <div
                      key={att.id}
                      className="group rounded-xl overflow-hidden border border-zinc-900/[0.08] bg-white/80 shadow-xs hover:shadow-md transition-all flex flex-col"
                    >
                      <div
                        onClick={() => setLightboxIdx(idx)}
                        className="relative aspect-[4/3] bg-zinc-100 overflow-hidden cursor-pointer"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.caption || att.fileName}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                          <a
                            href={att.dataUrl}
                            download={att.fileName || 'agreement-photo.jpg'}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-zinc-950/75 hover:bg-zinc-950 text-white backdrop-blur-sm transition-colors"
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletePhotoTarget(att)
                            }}
                            className="p-1.5 rounded-lg bg-zinc-950/75 hover:bg-red-600 text-white backdrop-blur-sm transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="px-2.5 py-2">
                        {isEditingCap ? (
                          <input
                            type="text"
                            autoFocus
                            value={captionText}
                            onChange={(e) => setCaptionText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCaption(att.id, captionText)
                              if (e.key === 'Escape') setEditingCaptionId(null)
                            }}
                            onBlur={() => handleUpdateCaption(att.id, captionText)}
                            placeholder="Label..."
                            className="w-full px-2 py-1 text-xs rounded-lg bg-[var(--bg-input)] border border-[#E08A1E] focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCaptionId(att.id)
                              setCaptionText(att.caption || '')
                            }}
                            className="w-full flex items-center justify-between gap-1.5 text-left group/cap cursor-pointer"
                            title="Click to edit label"
                          >
                            <span className={`text-xs font-medium truncate ${att.caption ? 'text-zinc-900' : 'text-zinc-400 italic'}`}>
                              {att.caption || 'Add label...'}
                            </span>
                            <Pencil className="w-3 h-3 text-zinc-400 opacity-0 group-hover/cap:opacity-100 flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptureSave={handleCameraSave}
      />

      <AttachmentLightbox
        attachments={attachments}
        activeIndex={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onIndexChange={setLightboxIdx}
        onUpdateCaption={handleUpdateCaption}
        onDeleteAttachment={(att) => setDeletePhotoTarget(att)}
      />

      <ConfirmModal
        open={Boolean(deletePhotoTarget)}
        onClose={() => setDeletePhotoTarget(null)}
        onConfirm={handleConfirmDeletePhoto}
        loading={deletingPhoto}
        title="Delete Photo"
        message={`Remove "${deletePhotoTarget?.caption || deletePhotoTarget?.fileName}"?`}
        confirmText="Delete"
      />

      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteAgreement}
        loading={deleting}
        title="Delete Agreement"
        message={`Delete agreement "${displayName}" and all its uploaded photos?`}
        confirmText="Delete"
      />
    </div>
  )
}
