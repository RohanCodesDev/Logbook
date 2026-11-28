import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Search, RefreshCw, AlertTriangle, Loader2,
  Phone, Trash2, Download, Copy, ArrowUp, ArrowDown,
  ArrowUpDown, X, Check, FolderOpen, IndianRupee,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import ConfirmModal from '../components/ui/ConfirmModal'
import AnimatedDropdown from '../components/ui/animated-dropdown'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import {
  getCrewMembers,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
  logCrewWages,
  getProjects,
} from '../services/api'
import { useCachedQuery, invalidateQueryCache } from '../utils/queryCache'

const COLUMNS = [
  { key: 'name',           label: 'Person Name',    widthClass: 'min-w-[175px]', placeholder: 'Enter name...' },
  { key: 'phone',          label: 'Ph No',          widthClass: 'min-w-[135px]', placeholder: 'Enter phone...' },
  { key: 'vehicleMachine', label: 'Vehicle',        widthClass: 'min-w-[165px]', placeholder: 'e.g. JCB 3DX, Tipper...' },
  { key: 'projectId',      label: 'Project',        widthClass: 'min-w-[175px]', placeholder: 'Assign project...' },
  { key: 'wageRate',       label: 'Daily Rate (₹)', widthClass: 'min-w-[125px]', placeholder: '0' },
]

const SORT_OPTIONS = [
  { value: '',                   label: 'Default Order' },
  { value: 'name:asc',           label: 'Person Name (A → Z)' },
  { value: 'name:desc',          label: 'Person Name (Z → A)' },
  { value: 'vehicleMachine:asc', label: 'Vehicle (A → Z)' },
  { value: 'projectName:asc',    label: 'Project (A → Z)' },
  { value: 'wageRate:desc',      label: 'Daily Rate (High → Low)' },
]

function EditableCrewCell({
  column,
  member,
  projectOptions,
  forceEdit,
  onStartEdit,
  onStopEdit,
  onTabNavigate,
  onSave,
  onValidationError,
}) {
  const isProject = column.key === 'projectId'
  const isRate = column.key === 'wageRate'
  const rawVal = isProject
    ? (member.projectId ? String(member.projectId) : '')
    : isRate
      ? (member.wageRate !== null && member.wageRate !== undefined ? String(member.wageRate) : '')
      : (member[column.key] || '')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawVal)
  const inputRef = useRef(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    setDraft(rawVal)
  }, [rawVal])

  useEffect(() => {
    if (forceEdit && !editing) {
      setDraft(rawVal)
      cancelledRef.current = false
      setEditing(true)
    }
  }, [forceEdit, editing, rawVal])

  useEffect(() => {
    if (editing && !isProject && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select?.()
    }
  }, [editing, isProject])

  const commit = (overrideVal = undefined) => {
    setEditing(false)
    onStopEdit?.()
    if (cancelledRef.current) {
      cancelledRef.current = false
      setDraft(rawVal)
      return
    }
    const nextVal = overrideVal !== undefined ? overrideVal : draft
    if (isProject) {
      const nextProj = nextVal ? Number(nextVal) : null
      if (nextProj !== (member.projectId ?? null)) {
        onSave(nextProj)
      }
      return
    }
    if (isRate) {
      const cleaned = String(nextVal || '').trim()
      const nextRate = cleaned === '' ? null : Number(cleaned)
      if (cleaned !== '' && (!Number.isFinite(nextRate) || nextRate < 0)) {
        onValidationError?.('Enter a valid daily rate')
        setDraft(rawVal)
        return
      }
      if (nextRate !== (member.wageRate ?? null)) {
        onSave(nextRate)
      }
      return
    }
    const trimmed = String(nextVal || '').trim()
    if (column.key === 'name' && !trimmed) {
      onValidationError?.('Person Name cannot be empty')
      setDraft(rawVal)
      return
    }
    if (trimmed !== String(rawVal || '').trim()) {
      onSave(trimmed)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelledRef.current = true
      setDraft(rawVal)
      setEditing(false)
      onStopEdit?.()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit()
      onTabNavigate?.(e.shiftKey ? -1 : 1)
    }
  }

  if (editing) {
    if (isProject) {
      return (
        <div className="p-0.5">
          <AnimatedDropdown
            defaultOpen={true}
            value={draft}
            options={projectOptions}
            onChange={(nextVal) => {
              setDraft(nextVal)
              commit(nextVal)
            }}
            onCloseComplete={() => {
              setEditing(false)
              onStopEdit?.()
            }}
            buttonClassName="h-9 px-2.5 py-1 rounded bg-[#FEF6E9] border-[#E08A1E] text-sm font-medium"
          />
        </div>
      )
    }

    return (
      <div className="p-0.5">
        <input
          ref={inputRef}
          type={column.key === 'phone' ? 'tel' : isRate ? 'number' : 'text'}
          step={isRate ? 'any' : undefined}
          inputMode={isRate ? 'decimal' : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={handleKeyDown}
          placeholder={column.placeholder}
          className={`w-full h-9 px-2.5 bg-[#FEF6E9] text-[var(--text-primary)] text-sm font-medium text-center border border-[#E08A1E] rounded focus:outline-none ${
            column.key === 'phone' || isRate ? 'tabular-nums' : ''
          }`}
        />
      </div>
    )
  }

  const displayValue = isProject
    ? member.projectName
    : isRate
      ? (member.wageRate !== null && member.wageRate !== undefined
          ? `₹${Number(member.wageRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
          : '')
      : member[column.key]
  const hasVal = Boolean(displayValue && String(displayValue).trim())

  return (
    <div
      onClick={() => {
        cancelledRef.current = false
        setDraft(rawVal)
        setEditing(true)
        onStartEdit?.()
      }}
      title="Click to edit"
      className={`group/cell w-full min-h-[40px] px-3 py-1.5 flex items-center justify-center gap-1.5 text-center cursor-pointer transition-colors hover:bg-[#FEF6E9]/75 text-sm ${
        column.key === 'phone' || isRate ? 'tabular-nums' : ''
      }`}
    >
      {hasVal ? (
        <>
          <span className={column.key === 'name' || isRate ? 'font-medium text-zinc-900' : 'text-zinc-700'}>
            {displayValue}
          </span>
          {column.key === 'phone' && (
            <a
              href={`tel:${displayValue}`}
              onClick={(e) => e.stopPropagation()}
              title={`Call ${displayValue}`}
              className="p-1 rounded text-zinc-400 hover:text-[#D97706] hover:bg-[#FEF6E9] opacity-0 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
            >
              <Phone className="w-3 h-3" />
            </a>
          )}
        </>
      ) : (
        <span className="text-slate-300 font-normal select-none">—</span>
      )}
    </div>
  )
}

function BlankCrewRow({ projectOptions, focusSignal, onCreateRow, onValidationError }) {
  const [draft, setDraft] = useState({ name: '', phone: '', vehicleMachine: '', projectId: '', wageRate: '' })
  const [activeKey, setActiveKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState(false)

  const rowRef = useRef(null)
  const inputRef = useRef(null)
  const draftRef = useRef(draft)
  const savingRef = useRef(false)
  const switchingRef = useRef(false)

  draftRef.current = draft

  useEffect(() => {
    if (focusSignal > 0) {
      setActiveKey('name')
    }
  }, [focusSignal])

  useEffect(() => {
    if (!activeKey || activeKey === 'projectId') return
    switchingRef.current = false
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select?.()
    }
  }, [activeKey])

  const hasAnyValue = (d) =>
    Boolean(d.name.trim() || d.phone.trim() || d.vehicleMachine.trim() || d.projectId || d.wageRate.trim())

  const updateVal = (key, val) => {
    if (key === 'name' && val.trim()) setNameError(false)
    const next = { ...draftRef.current, [key]: val }
    draftRef.current = next
    setDraft(next)
    return next
  }

  const resetRow = () => {
    const empty = { name: '', phone: '', vehicleMachine: '', projectId: '', wageRate: '' }
    draftRef.current = empty
    setDraft(empty)
    setActiveKey(null)
    setNameError(false)
  }

  const commitRow = async (override = null, explicitSubmit = false) => {
    if (savingRef.current) return
    const cur = override ?? draftRef.current
    if (!hasAnyValue(cur)) {
      if (explicitSubmit) {
        setNameError(true)
        setActiveKey('name')
        onValidationError?.('Enter a Person Name before adding a row')
      } else {
        resetRow()
      }
      return
    }

    if (!cur.name.trim()) {
      setNameError(true)
      setActiveKey('name')
      onValidationError?.('Person Name is required')
      return
    }

    const rateTrim = cur.wageRate.trim()
    const parsedRate = rateTrim === '' ? null : Number(rateTrim)
    if (rateTrim !== '' && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      onValidationError?.('Enter a valid daily rate')
      setActiveKey('wageRate')
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      await onCreateRow({
        name: cur.name.trim(),
        phone: cur.phone.trim() || null,
        vehicleMachine: cur.vehicleMachine.trim() || null,
        projectId: cur.projectId ? Number(cur.projectId) : null,
        wageRate: parsedRate,
      })
      resetRow()
    } catch {
      // keep draft intact so user can adjust
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const moveFocusBy = (curKey, delta) => {
    const idx = COLUMNS.findIndex((c) => c.key === curKey)
    const nextCol = COLUMNS[idx + delta]
    if (!nextCol) {
      if (delta > 0) commitRow(draftRef.current, true)
      return
    }
    switchingRef.current = true
    setActiveKey(nextCol.key)
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (switchingRef.current || savingRef.current) return
      if (rowRef.current?.contains(document.activeElement)) return
      if (!hasAnyValue(draftRef.current)) {
        resetRow()
        return
      }
      if (draftRef.current.name.trim()) {
        commitRow(draftRef.current, false)
      } else {
        setNameError(true)
      }
    }, 90)
  }

  const handleKeyDown = (colKey, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRow(draftRef.current, true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      resetRow()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      moveFocusBy(colKey, e.shiftKey ? -1 : 1)
    }
  }

  const isRowActive = activeKey !== null || hasAnyValue(draft)

  return (
    <tr
      ref={rowRef}
      className={`group/blank border-b border-[var(--border-grid)] last:border-b-0 transition-colors ${
        isRowActive ? 'bg-[#FEF6E9]/45' : 'bg-[var(--bg-card)]/60 hover:bg-[#FEF6E9]/40'
      }`}
    >
      <td className="sticky left-0 z-10 px-2 py-1.5 text-center border-r border-[var(--border-grid)] bg-[var(--bg-card)] group-hover/blank:bg-[#FEF6E9]">
        <button
          type="button"
          disabled={saving}
          onClick={() => commitRow(draftRef.current, true)}
          title="Add row (Person Name required)"
          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-all cursor-pointer"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E08A1E]" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </td>

      {COLUMNS.map((col, idx) => {
        const isEditing = activeKey === col.key
        const val = draft[col.key]
        const isNameErr = col.key === 'name' && nameError

        if (col.key === 'projectId') {
          const selectedLabel = projectOptions.find((o) => o.value === val)?.label || ''
          return (
            <td
              key={col.key}
              className={`p-0 border-r border-[var(--border-grid)] whitespace-nowrap align-middle ${col.widthClass}`}
            >
              {isEditing ? (
                <div className="p-0.5">
                  <AnimatedDropdown
                    defaultOpen={true}
                    value={val}
                    options={projectOptions}
                    onChange={(nextVal) => {
                      const next = updateVal('projectId', nextVal)
                      if (next.name.trim()) commitRow(next, false)
                      else setActiveKey('name')
                    }}
                    onCloseComplete={() => {
                      if (!savingRef.current && !hasAnyValue(draftRef.current)) {
                        setActiveKey(null)
                      }
                    }}
                    buttonClassName="h-9 px-2.5 py-1 rounded bg-[#FEF6E9] border-[#E08A1E] text-sm"
                  />
                </div>
              ) : (
                <div
                  onClick={() => setActiveKey('projectId')}
                  className="w-full min-h-[40px] px-3 py-1.5 flex items-center justify-center text-center cursor-pointer hover:bg-[#FEF6E9]/70 text-sm"
                >
                  {val ? (
                    <span className="text-zinc-700">{selectedLabel}</span>
                  ) : (
                    <span className="text-transparent group-hover/blank:text-slate-300 text-xs select-none">+</span>
                  )}
                </div>
              )}
            </td>
          )
        }

        const isRate = col.key === 'wageRate'
        return (
          <td
            key={col.key}
            className={`p-0 border-r border-[var(--border-grid)] whitespace-nowrap align-middle ${col.widthClass}`}
          >
            {isEditing ? (
              <div className="p-0.5">
                <input
                  ref={inputRef}
                  type={col.key === 'phone' ? 'tel' : isRate ? 'number' : 'text'}
                  step={isRate ? 'any' : undefined}
                  inputMode={isRate ? 'decimal' : undefined}
                  value={val}
                  onChange={(e) => updateVal(col.key, e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => handleKeyDown(col.key, e)}
                  placeholder={isNameErr ? 'Name required*' : col.placeholder}
                  className={`w-full h-9 px-2.5 text-[var(--text-primary)] text-sm font-medium text-center border rounded focus:outline-none ${
                    isNameErr
                      ? 'bg-red-50 border-red-400 placeholder:text-red-400'
                      : 'bg-[#FEF6E9] border-[#E08A1E]'
                  } ${col.key === 'phone' || isRate ? 'tabular-nums' : ''}`}
                />
              </div>
            ) : (
              <div
                onClick={() => setActiveKey(col.key)}
                className={`w-full min-h-[40px] px-3 py-1.5 flex items-center justify-center text-center cursor-pointer transition-colors text-sm ${
                  isNameErr ? 'bg-red-50/70 ring-1 ring-inset ring-red-300' : 'hover:bg-[#FEF6E9]/70'
                }`}
              >
                {val ? (
                  <span className={col.key === 'phone' || isRate ? 'tabular-nums text-zinc-700' : 'text-zinc-900 font-medium'}>
                    {isRate ? `₹${val}` : val}
                  </span>
                ) : idx === 0 ? (
                  <span className={`inline-flex items-center gap-1 text-xs transition-colors ${
                    isNameErr ? 'text-red-500 font-semibold' : 'text-slate-400/90 group-hover/blank:text-[#C97814]'
                  }`}>
                    <Plus className="w-3 h-3" />
                    <span>{isNameErr ? 'Name required...' : 'New row...'}</span>
                  </span>
                ) : (
                  <span className="text-transparent group-hover/blank:text-slate-300 text-xs select-none">+</span>
                )}
              </div>
            )}
          </td>
        )
      })}

      <td className="px-2 py-1 text-right whitespace-nowrap">
        {isRowActive && (
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commitRow(draftRef.current, true)}
            className="p-1.5 rounded text-[#E08A1E] hover:bg-[#FEF6E9] transition-colors cursor-pointer"
            title="Save row"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function CrewDirectory() {
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const {
    data: bundle,
    setData: setBundle,
    loading,
    refreshing,
    error,
    reload,
  } = useCachedQuery('crew', async () => {
    const [crewRes, projRes] = await Promise.all([getCrewMembers(), getProjects()])
    return { crew: crewRes.data || [], projects: projRes.data || [] }
  })

  const crew = bundle?.crew || []
  const projects = bundle?.projects || []

  const setCrew = useCallback((updater) => {
    setBundle((prev) => {
      const curCrew = prev?.crew || []
      const nextCrew = typeof updater === 'function' ? updater(curCrew) : updater
      return { ...(prev || { projects: [] }), crew: nextCrew }
    })
  }, [setBundle])

  const load = useCallback(() => reload(), [reload])

  // Search, Filter & Sort states
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('')

  // Inline grid interaction states
  const [activeCell, setActiveCell] = useState(null)
  const [focusNewRowSignal, setFocusNewRowSignal] = useState(0)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [postingWages, setPostingWages] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  useEffect(() => {
    const valid = new Set(crew.map((c) => c.id))
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set()
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [crew])

  const eligibleForWagePost = useMemo(
    () => crew.filter((m) => m.projectId && Number(m.wageRate) > 0),
    [crew]
  )

  const handleLogWages = useCallback(async (targetIds = []) => {
    setPostingWages(true)
    try {
      const res = await logCrewWages({ memberIds: targetIds })
      const { count, totalAmount } = res.data
      invalidateQueryCache()
      showToast(
        `Posted ₹${Number(totalAmount || 0).toLocaleString('en-IN')} (${count} ${count === 1 ? 'person' : 'people'}) to project spend`
      )
      if (targetIds.length > 0) setSelectedIds(new Set())
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setPostingWages(false)
    }
  }, [showToast])

  useEffect(() => {
    setTopBar({
      title: 'Workforce',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          {eligibleForWagePost.length > 0 && (
            <Magnetic strength={0.18}>
              <Button
                variant="outline"
                size="sm"
                disabled={postingWages}
                onClick={() => handleLogWages([])}
                title="Post today's daily rates for deployed crew straight into project spend"
              >
                {postingWages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5 text-[#D97706]" />}
                <span className="hidden sm:inline">Post Today&apos;s Wages</span>
              </Button>
            </Magnetic>
          )}
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={() => setFocusNewRowSignal((n) => n + 1)}>
              <Plus className="w-4 h-4 text-[#D97706]" />
              Add Row
            </Button>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, refreshing, eligibleForWagePost.length, postingWages, handleLogWages])

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [projects]
  )

  const projectFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Projects' },
      { value: '__none', label: 'Unassigned' },
      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [projects]
  )

  const vehicleFilterOptions = useMemo(() => {
    const distinct = Array.from(
      new Set(crew.map((m) => (m.vehicleMachine || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
    return [
      { value: 'all', label: 'All Vehicles' },
      { value: '__none', label: 'No Vehicle' },
      ...distinct.map((v) => ({ value: v, label: v })),
    ]
  }, [crew])

  const processedCrew = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = crew.filter((m) => {
      if (projectFilter === '__none' && m.projectId) return false
      if (projectFilter !== 'all' && projectFilter !== '__none' && String(m.projectId) !== projectFilter) {
        return false
      }
      if (vehicleFilter === '__none' && (m.vehicleMachine || '').trim()) return false
      if (vehicleFilter !== 'all' && vehicleFilter !== '__none' && (m.vehicleMachine || '').trim() !== vehicleFilter) {
        return false
      }
      if (!q) return true
      return (
        m.name?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.vehicleMachine?.toLowerCase().includes(q) ||
        m.projectName?.toLowerCase().includes(q)
      )
    })

    if (!sortBy) return filtered

    const [fieldKey, dir] = sortBy.split(':')
    const mult = dir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      if (fieldKey === 'wageRate') {
        const av = a.wageRate !== null && a.wageRate !== undefined ? Number(a.wageRate) : -Infinity
        const bv = b.wageRate !== null && b.wageRate !== undefined ? Number(b.wageRate) : -Infinity
        return (av - bv) * mult
      }
      const av = String((fieldKey === 'projectId' ? a.projectName : a[fieldKey]) || '').trim()
      const bv = String((fieldKey === 'projectId' ? b.projectName : b[fieldKey]) || '').trim()
      if (!av && !bv) return 0
      if (!av) return 1
      if (!bv) return -1
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * mult
    })
  }, [crew, search, projectFilter, vehicleFilter, sortBy])

  const hasActiveFilters = Boolean(search.trim()) || projectFilter !== 'all' || vehicleFilter !== 'all' || Boolean(sortBy)

  const toggleColumnSort = (colKey) => {
    const sortKey = colKey === 'projectId' ? 'projectName' : colKey
    setSortBy((prev) => {
      if (prev === `${sortKey}:asc`) return `${sortKey}:desc`
      if (prev === `${sortKey}:desc`) return ''
      return `${sortKey}:asc`
    })
  }

  const handleInlineCreate = async (payload) => {
    try {
      const res = await createCrewMember(payload)
      setCrew((prev) => [...prev, res.data])
      invalidateQueryCache('dashboard')
      showToast('Row added')
      return res.data
    } catch (err) {
      showToast(err.message, 'error')
      throw err
    }
  }

  const handleCellUpdate = async (member, fieldKey, nextVal) => {
    const prevSnapshot = member
    const optimisticProjectName =
      fieldKey === 'projectId'
        ? (projects.find((p) => p.id === nextVal)?.name || '')
        : member.projectName

    setCrew((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, [fieldKey]: nextVal, projectName: optimisticProjectName }
          : m
      )
    )

    try {
      const res = await updateCrewMember(member.id, { [fieldKey]: nextVal })
      setCrew((prev) => prev.map((m) => (m.id === member.id ? res.data : m)))
      invalidateQueryCache('dashboard')
    } catch (err) {
      setCrew((prev) => prev.map((m) => (m.id === member.id ? prevSnapshot : m)))
      showToast(err.message, 'error')
    }
  }

  const handleDuplicate = async (member) => {
    try {
      const res = await createCrewMember({
        name: member.name,
        phone: member.phone,
        vehicleMachine: member.vehicleMachine,
        projectId: member.projectId,
        wageRate: member.wageRate,
      })
      setCrew((prev) => [...prev, res.data])
      invalidateQueryCache('dashboard')
      showToast('Row duplicated')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDeleteWithUndo = async (member) => {
    const snapshot = { ...member }
    setCrew((prev) => prev.filter((m) => m.id !== member.id))
    try {
      await deleteCrewMember(member.id)
      invalidateQueryCache('dashboard')
      showToast(`Removed "${member.name}"`, {
        type: 'info',
        duration: 5500,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            const restored = await createCrewMember({
              name: snapshot.name,
              phone: snapshot.phone,
              vehicleMachine: snapshot.vehicleMachine,
              projectId: snapshot.projectId,
              wageRate: snapshot.wageRate,
            })
            setCrew((prev) => [...prev, restored.data])
            invalidateQueryCache('dashboard')
            showToast('Row restored')
          } catch (restoreErr) {
            showToast(restoreErr.message, 'error')
          }
        },
      })
    } catch (err) {
      setCrew((prev) => [...prev, snapshot])
      showToast(err.message, 'error')
    }
  }

  const handleTabNavigate = useCallback((rowIdx, colIdx, delta) => {
    let nextCol = colIdx + delta
    let nextRow = rowIdx
    if (nextCol >= COLUMNS.length) {
      nextCol = 0
      nextRow += 1
    } else if (nextCol < 0) {
      nextCol = COLUMNS.length - 1
      nextRow -= 1
    }
    if (nextRow < 0 || nextRow >= processedCrew.length) {
      setActiveCell(null)
      return
    }
    setActiveCell({
      id: processedCrew[nextRow].id,
      key: COLUMNS[nextCol].key,
    })
  }, [processedCrew])

  const allSelected =
    processedCrew.length > 0 && processedCrew.every((m) => selectedIds.has(m.id))

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(processedCrew.map((m) => m.id)))
  }

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkAssignProject = async (nextProjVal) => {
    if (!selectedIds.size) return
    const nextProjId = nextProjVal ? Number(nextProjVal) : null
    setBulkBusy(true)
    try {
      const targets = crew.filter((m) => selectedIds.has(m.id))
      const results = await Promise.all(
        targets.map((m) => updateCrewMember(m.id, { projectId: nextProjId }))
      )
      const byId = new Map(results.map((r) => [r.data.id, r.data]))
      setCrew((prev) => prev.map((m) => byId.get(m.id) || m))
      setSelectedIds(new Set())
      invalidateQueryCache('dashboard')
      showToast(`Updated project for ${targets.length} ${targets.length === 1 ? 'person' : 'people'}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    setBulkBusy(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map((id) => deleteCrewMember(id)))
      const deletedSet = new Set(ids)
      setCrew((prev) => prev.filter((m) => !deletedSet.has(m.id)))
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      invalidateQueryCache('dashboard')
      showToast(`Deleted ${ids.length} ${ids.length === 1 ? 'row' : 'rows'}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleExportCsv = () => {
    if (!processedCrew.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['SL', 'Person Name', 'Ph No', 'Vehicle', 'Project', 'Daily Rate (INR)'].join(',')
    const rows = processedCrew.map((m, idx) =>
      [idx + 1, esc(m.name), esc(m.phone), esc(m.vehicleMachine), esc(m.projectName), m.wageRate ?? ''].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'workforce.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 lg:left-64 overflow-hidden -z-0">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      <div className="relative z-10 space-y-4 max-w-7xl mx-auto">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl liquid-glass-surface border-red-200/80 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Could not load workforce</p>
              <p className="text-xs mt-0.5 text-red-500">{error}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl liquid-glass-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/90">
            <div className="relative flex items-center flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, vehicle, project..."
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-[var(--bg-input)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-slate-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-[#E08A1E] focus:bg-[var(--bg-card)] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <AnimatedDropdown
                  value={projectFilter}
                  onChange={setProjectFilter}
                  options={projectFilterOptions}
                  buttonClassName="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="w-36">
                <AnimatedDropdown
                  value={vehicleFilter}
                  onChange={setVehicleFilter}
                  options={vehicleFilterOptions}
                  buttonClassName="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="w-44">
                <AnimatedDropdown
                  value={sortBy}
                  onChange={setSortBy}
                  options={SORT_OPTIONS}
                  buttonClassName="h-9 rounded-xl text-xs"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setProjectFilter('all')
                    setVehicleFilter('all')
                    setSortBy('')
                  }}
                  className="px-2.5 h-9 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}

              {processedCrew.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="px-4 sm:px-5 py-2.5 bg-[#18181B] text-zinc-100 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-500 text-zinc-950 font-bold">
                  {selectedIds.size}
                </span>
                <span>selected</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <div className="w-44">
                    <AnimatedDropdown
                      value=""
                      placeholder="Deploy to Project..."
                      options={projectOptions}
                      onChange={handleBulkAssignProject}
                      buttonClassName="h-8 rounded-lg text-xs bg-white/10 border-white/15 text-zinc-100"
                    />
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={postingWages}
                  onClick={() => handleLogWages(Array.from(selectedIds))}
                >
                  {postingWages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5" />}
                  Post Wages
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => setBulkDeleteConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>

                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading workforce...
            </div>
          ) : (
            <div className="overflow-x-auto bg-[var(--bg-card)]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-input)] text-slate-800 border-b border-[var(--border-grid)] text-xs sm:text-[13px] font-bold select-none">
                    <th className="group/sel sticky left-0 z-20 bg-[var(--bg-input)] px-2 py-2.5 w-11 text-center border-r border-[var(--border-grid)] text-slate-700 text-xs font-bold uppercase tracking-wide tabular-nums">
                      {processedCrew.length > 0 ? (
                        <div className="flex items-center justify-center">
                          {selectedIds.size === 0 && (
                            <span className="group-hover/sel:hidden">SL</span>
                          )}
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            title="Select all visible rows"
                            className={`w-3.5 h-3.5 rounded border-slate-300 text-[#E08A1E] accent-[#E08A1E] cursor-pointer ${
                              selectedIds.size > 0 ? 'block' : 'hidden group-hover/sel:block'
                            }`}
                          />
                        </div>
                      ) : (
                        'SL'
                      )}
                    </th>

                    {COLUMNS.map((col) => {
                      const sortKey = col.key === 'projectId' ? 'projectName' : col.key
                      const isAsc = sortBy === `${sortKey}:asc`
                      const isDesc = sortBy === `${sortKey}:desc`
                      return (
                        <th
                          key={col.key}
                          className={`border-r border-[var(--border-grid)] px-3 py-2.5 whitespace-nowrap ${col.widthClass}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleColumnSort(col.key)}
                            title={`Click to sort by ${col.label}`}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-center font-bold text-slate-800 hover:text-[#C97814] transition-colors cursor-pointer"
                          >
                            <span>{col.label}</span>
                            {isAsc ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#E08A1E]" />
                            ) : isDesc ? (
                              <ArrowDown className="w-3.5 h-3.5 text-[#E08A1E]" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />
                            )}
                          </button>
                        </th>
                      )
                    })}

                    <th className="px-2 py-2 w-24 text-right" />
                  </tr>
                </thead>

                <tbody>
                  {processedCrew.length === 0 && hasActiveFilters && (
                    <tr className="border-b border-[var(--border-grid)]">
                      <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-xs text-slate-500">
                        No matching people found.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('')
                            setProjectFilter('all')
                            setVehicleFilter('all')
                            setSortBy('')
                          }}
                          className="text-[#C97814] font-semibold underline cursor-pointer"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  )}

                  {processedCrew.map((member, rowIdx) => {
                    const isSelected = selectedIds.has(member.id)
                    const isEven = rowIdx % 2 === 1
                    const canPostWage = Boolean(member.projectId && Number(member.wageRate) > 0)
                    return (
                      <tr
                        key={member.id}
                        className={`group border-b border-[var(--border-grid)] transition-colors ${
                          isSelected
                            ? 'bg-[#FEF6E9]/85'
                            : isEven
                              ? 'bg-[#F6F4EF]/50'
                              : 'bg-[var(--bg-card)]'
                        } hover:bg-[#FEF6E9]/55`}
                      >
                        <td
                          className={`sticky left-0 z-10 px-2 py-2 text-center border-r border-[var(--border-grid)] text-xs font-medium tabular-nums text-slate-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                            isSelected
                              ? 'bg-[#FEF6E9]'
                              : isEven
                                ? 'bg-[#F6F4EF]'
                                : 'bg-[var(--bg-card)]'
                          } group-hover:bg-[#FEF6E9]`}
                        >
                          <div className="flex items-center justify-center">
                            {!isSelected && (
                              <span className={selectedIds.size > 0 ? 'hidden' : 'group-hover:hidden'}>
                                {String(rowIdx + 1).padStart(2, '0')}
                              </span>
                            )}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(member.id)}
                              title="Select row"
                              className={`w-3.5 h-3.5 rounded border-slate-300 text-[#E08A1E] accent-[#E08A1E] cursor-pointer ${
                                isSelected || selectedIds.size > 0 ? 'block' : 'hidden group-hover:block'
                              }`}
                            />
                          </div>
                        </td>

                        {COLUMNS.map((col, colIdx) => {
                          const isFocused = activeCell?.id === member.id && activeCell?.key === col.key
                          return (
                            <td
                              key={col.key}
                              className={`p-0 border-r border-[var(--border-grid)] whitespace-nowrap align-middle ${col.widthClass}`}
                            >
                              <EditableCrewCell
                                column={col}
                                member={member}
                                projectOptions={projectOptions}
                                forceEdit={isFocused}
                                onStartEdit={() => setActiveCell({ id: member.id, key: col.key })}
                                onStopEdit={() =>
                                  setActiveCell((prev) =>
                                    prev?.id === member.id && prev?.key === col.key ? null : prev
                                  )
                                }
                                onTabNavigate={(delta) => handleTabNavigate(rowIdx, colIdx, delta)}
                                onSave={(nextVal) => handleCellUpdate(member, col.key, nextVal)}
                                onValidationError={(msg) => showToast(msg, 'error')}
                              />
                            </td>
                          )
                        })}

                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-within:opacity-100 transition-opacity">
                            {canPostWage && (
                              <button
                                type="button"
                                disabled={postingWages}
                                onClick={() => handleLogWages([member.id])}
                                className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title={`Post ₹${member.wageRate} to ${member.projectName}`}
                              >
                                <IndianRupee className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(member)}
                              className="p-1.5 rounded text-slate-400 hover:text-[#C97814] hover:bg-[#FEF6E9] transition-colors cursor-pointer"
                              title="Duplicate Row"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWithUndo(member)}
                              className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  <BlankCrewRow
                    projectOptions={projectOptions}
                    focusSignal={focusNewRowSignal}
                    onCreateRow={handleInlineCreate}
                    onValidationError={(msg) => showToast(msg, 'error')}
                  />
                </tbody>

                {processedCrew.length > 0 && (
                  <tfoot className="bg-[var(--bg-input)] border-t-2 border-[var(--border-grid)] text-[11px] font-semibold text-slate-500 tabular-nums">
                    <tr>
                      <td className="sticky left-0 z-20 bg-[var(--bg-input)] px-2 py-2 text-center border-r border-[var(--border-grid)] uppercase">
                        Σ
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--border-grid)]">
                        {processedCrew.length} {processedCrew.length === 1 ? 'person' : 'people'}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--border-grid)]">
                        {processedCrew.filter((m) => (m.phone || '').trim()).length} numbers
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--border-grid)]">
                        {processedCrew.filter((m) => (m.vehicleMachine || '').trim()).length} assigned
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--border-grid)]">
                        {processedCrew.filter((m) => m.projectId).length} deployed
                      </td>
                      <td className="px-3 py-2 text-center border-r border-[var(--border-grid)]">
                        ₹{processedCrew.reduce((s, m) => s + (Number(m.wageRate) || 0), 0).toLocaleString('en-IN')}/d
                      </td>
                      <td className="px-2 py-2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        loading={bulkBusy}
        title="Delete Selected Rows"
        message={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'person' : 'people'} from Workforce?`}
        confirmText="Delete"
      />
    </div>
  )
}
