import { getTodayYmd } from './sheetUtils'

export const AGREEMENT_TYPE_OPTIONS = [
  { value: 'client',          label: 'Client Contract' },
  { value: 'subcontract',     label: 'Subcontract' },
  { value: 'machine_hire',    label: 'Machine Hire' },
  { value: 'labour',          label: 'Labour Contract' },
  { value: 'material_supply', label: 'Material Supply' },
  { value: 'lease',           label: 'Site / Yard Lease' },
  { value: 'other',           label: 'Other' },
]

export const AGREEMENT_STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'pending',    label: 'Pending' },
  { value: 'completed',  label: 'Completed' },
  { value: 'expired',    label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

export const AGREEMENT_STATUS_STYLES = {
  active:     { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80', dot: 'bg-emerald-500', label: 'Active' },
  pending:    { cls: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',       dot: 'bg-amber-500',   label: 'Pending' },
  completed:  { cls: 'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200',            dot: 'bg-zinc-600',    label: 'Completed' },
  expired:    { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200/80',             dot: 'bg-red-500',     label: 'Expired' },
  terminated: { cls: 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200',            dot: 'bg-zinc-400',    label: 'Terminated' },
}

export function getAgreementTypeLabel(type) {
  return AGREEMENT_TYPE_OPTIONS.find((t) => t.value === type)?.label || 'Agreement'
}

export function daysUntil(ymd) {
  if (!ymd) return null
  const today = getTodayYmd()
  const a = new Date(`${today}T00:00:00`)
  const b = new Date(`${ymd.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

export function formatInr(val) {
  if (val === null || val === undefined || val === '') return '—'
  const num = Number(val)
  if (!Number.isFinite(num)) return '—'
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function formatBytes(bytes) {
  const b = Number(bytes || 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Resize and compress a File/Blob image in-browser via Canvas so phone camera
 * shots stay sharp for reading documents while uploading fast to PostgreSQL.
 */
export function compressImageFile(file, { maxDim = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64Len = dataUrl.split(',')[1]?.length || 0
        const fileSize = Math.round((base64Len * 3) / 4)
        resolve({
          dataUrl,
          mimeType: 'image/jpeg',
          fileName: (file.name || 'agreement-photo.jpg').replace(/\.[^.]+$/, '.jpg'),
          fileSize,
        })
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Could not read image "${file.name || 'file'}"`))
    }
    img.src = objectUrl
  })
}
