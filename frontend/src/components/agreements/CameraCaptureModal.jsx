import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, SwitchCamera, RotateCcw, Check, X, Upload, AlertTriangle, Loader2 } from 'lucide-react'
import Button from '../ui/Button'
import { compressImageFile } from '../../utils/agreementUtils'

/**
 * CameraCaptureModal — Live camera capture with rear/front toggle, preview & caption,
 * plus seamless fallback to native device camera input when getUserMedia is unavailable.
 */
export default function CameraCaptureModal({ open, onClose, onCaptureSave }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fallbackInputRef = useRef(null)

  const [facingMode, setFacingMode] = useState('environment')
  const [starting, setStarting] = useState(false)
  const [camError, setCamError] = useState(null)
  const [captured, setCaptured] = useState(null) // { dataUrl, mimeType, fileName, fileSize }
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async (mode) => {
    stopStream()
    setCamError(null)
    setStarting(true)
    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false)
      setCamError('Live camera preview is not supported in this browser. Use device camera capture below.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      setCamError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow camera access or use the device camera picker below.'
          : 'Could not access webcam directly. Use the device camera picker below.'
      )
    } finally {
      setStarting(false)
    }
  }, [stopStream])

  useEffect(() => {
    if (!open) {
      stopStream()
      setCaptured(null)
      setCaption('')
      setCamError(null)
      return
    }
    if (!captured) {
      startCamera(facingMode)
    }
    return () => stopStream()
  }, [open, facingMode, captured, startCamera, stopStream])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open) return null

  const handleSnap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const maxDim = 1600
    let w = video.videoWidth
    let h = video.videoHeight
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84)
    const base64Len = dataUrl.split(',')[1]?.length || 0
    const fileSize = Math.round((base64Len * 3) / 4)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

    stopStream()
    setCaptured({
      dataUrl,
      mimeType: 'image/jpeg',
      fileName: `camera-${stamp}.jpg`,
      fileSize,
    })
  }

  const handleNativeCameraFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const compressed = await compressImageFile(file)
      stopStream()
      setCaptured(compressed)
      setCamError(null)
    } catch (err) {
      setCamError(err.message)
    }
  }

  const handleConfirmSave = async () => {
    if (!captured) return
    setSaving(true)
    try {
      await onCaptureSave({
        ...captured,
        caption: caption.trim() || null,
        source: 'camera',
      })
      onClose()
    } catch (err) {
      setCamError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/75 backdrop-blur-md">
      <div className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-[#09090B] text-zinc-100 border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Capture Agreement Photo</h3>
              <p className="text-[11px] text-zinc-400">Snap signed pages, stamp papers, or site documents</p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-colors"
            aria-label="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative bg-black flex items-center justify-center min-h-[280px] sm:min-h-[340px] max-h-[58vh] overflow-hidden">
          {captured ? (
            <img
              src={captured.dataUrl}
              alt="Captured agreement"
              className="max-h-[58vh] w-auto object-contain"
            />
          ) : camError ? (
            <div className="p-6 text-center max-w-sm space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{camError}</p>
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Open Device Camera / Photo
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-[58vh] object-contain"
              />
              {starting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2 text-xs text-zinc-300">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Starting camera...</span>
                </div>
              )}
              {!starting && (
                <button
                  type="button"
                  onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                  title="Switch camera"
                  className="absolute top-3 right-3 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-zinc-100 border border-white/15 backdrop-blur-md transition-colors cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Hidden native camera fallback input */}
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraFile}
          className="hidden"
        />

        {/* Controls Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#09090B] space-y-3">
          {captured ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Photo Caption / Label (Optional)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Page 1 — Signed Stamp Paper"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setCaptured(null)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake
                </button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Uploading...' : 'Save to Agreement'}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Device Camera
              </button>

              <button
                type="button"
                disabled={starting || Boolean(camError)}
                onClick={handleSnap}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Capture Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
