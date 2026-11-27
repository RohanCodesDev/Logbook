import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  HardHat, AlertTriangle, Clock, FolderOpen,
  RefreshCw, MapPin, ArrowRight, Plus,
  IndianRupee, Users, ScrollText, TrendingUp, ReceiptText,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import { useTopBar } from '../components/layout/AppLayout'
import { getDashboard } from '../services/api'

function formatInr(val) {
  const num = Number(val || 0)
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatCompactInr(val) {
  const num = Number(val || 0)
  if (num === 0) return '₹0'
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))
  if (num >= 10000000) return `₹${fmt(num / 10000000)}Cr`
  if (num >= 100000) return `₹${fmt(num / 100000)}L`
  if (num >= 1000) return `₹${fmt(num / 1000)}k`
  return `₹${Math.round(num)}`
}

const NICE_CEILINGS = [
  500, 1000, 2000, 5000, 10000, 20000, 50000,
  100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 50000000,
]

function getNiceYCeiling(maxVal) {
  if (!maxVal || maxVal <= 0) return 10000
  const target = maxVal / 0.9
  for (const step of NICE_CEILINGS) {
    if (step >= target) return step
  }
  const mag = Math.pow(10, Math.floor(Math.log10(target)))
  return Math.ceil(target / mag) * mag
}

function formatShortDay(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return ymd
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatCrewSummary(crew) {
  const parts = []
  if (crew.drivers > 0) parts.push(`${crew.drivers} ${crew.drivers === 1 ? 'Driver' : 'Drivers'}`)
  if (crew.operators > 0) parts.push(`${crew.operators} ${crew.operators === 1 ? 'Operator' : 'Operators'}`)
  if (crew.helpers > 0) parts.push(`${crew.helpers} ${crew.helpers === 1 ? 'Helper' : 'Helpers'}`)
  if (parts.length === 0 && crew.total > 0) {
    parts.push(`${crew.total} Staff`)
  }
  return parts.join(' · ') || 'No crew added'
}

function formatProjectSubtitle(s) {
  if (!s.total) return 'No projects yet'
  const sheetsText = `${s.totalSections ?? 0} ${s.totalSections === 1 ? 'sheet' : 'sheets'}`
  if ((s.active ?? 0) > 0) return `${s.active} active · ${sheetsText}`
  if ((s.planning ?? 0) > 0) return `${s.planning} planning · ${sheetsText}`
  if ((s.paused ?? 0) > 0) return `${s.paused} paused · ${sheetsText}`
  if ((s.completed ?? 0) > 0) return `${s.completed} completed · ${sheetsText}`
  if ((s.archived ?? 0) > 0) return `${s.archived} archived · ${sheetsText}`
  return `0 active · ${sheetsText}`
}

function formatEntryTitle(entry) {
  if (entry.label) return entry.label
  if (entry.spendFieldName) {
    const clean = entry.spendFieldName.trim()
    return `${clean.charAt(0).toUpperCase()}${clean.slice(1)} entry`
  }
  return null
}

/**
 * Clean 14-Day Daily Spend Bar Chart (single header row, bars only, rounded Y-axis intervals).
 */
function SpendBarCard({ series = [], totalEntries = 0, loading = false }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const maxSpend = useMemo(
    () => Math.max(...series.map((d) => Number(d.spend || 0)), 0),
    [series]
  )
  const periodTotal = useMemo(
    () => series.reduce((sum, d) => sum + Number(d.spend || 0), 0),
    [series]
  )

  const width = 560
  const height = 210
  const padLeft = 52
  const padRight = 14
  const padTop = 14
  const padBottom = 28
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const yCeiling = maxSpend > 0 ? getNiceYCeiling(maxSpend) : 0
  const stepX = series.length > 0 ? plotW / series.length : plotW
  const barW = Math.min(20, stepX * 0.52)

  const points = series.map((d, i) => {
    const val = Number(d.spend || 0)
    const cx = padLeft + i * stepX + stepX / 2
    const barH = yCeiling > 0 ? (val / yCeiling) * plotH : 0
    const cy = padTop + plotH - barH
    return { ...d, cx, cy, barH }
  })

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null

  return (
    <div className="lg:col-span-2 rounded-2xl liquid-glass-surface p-5 sm:p-6 min-w-0 flex flex-col justify-between">
      {/* Unified Header: Title + single quiet subtitle on left, total ₹ alone on right */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-zinc-900 truncate">14-Day Spend</h3>
          </div>
          <div className="mt-1 min-h-[22px] flex items-center">
            {activePoint ? (
              <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md liquid-glass-dark text-[11px] text-zinc-100 tabular-nums">
                <span>{formatShortDay(activePoint.date)}</span>
                <span className="text-amber-400 font-semibold">{formatInr(activePoint.spend)}</span>
                <span className="text-zinc-400">
                  {activePoint.entries} {activePoint.entries === 1 ? 'entry' : 'entries'}
                </span>
              </span>
            ) : (
              <p className="text-xs text-zinc-500 tabular-nums">
                Last 14 days · {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
              </p>
            )}
          </div>
        </div>

        <span className="font-heading text-lg sm:text-xl font-bold text-zinc-900 tabular-nums flex-shrink-0">
          {loading ? '—' : formatInr(periodTotal)}
        </span>
      </div>

      {loading ? (
        <div className="h-52 rounded-xl bg-zinc-200/50 animate-pulse" />
      ) : !series.length ? (
        <div className="h-52 flex items-center justify-center text-xs text-zinc-400">
          No daily spend logged yet.
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-56 block select-none">
            {[0, 0.5, 1].map((frac) => {
              const y = padTop + plotH * (1 - frac)
              const tickVal = yCeiling > 0 ? yCeiling * frac : 0
              return (
                <g key={frac}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="rgba(24, 24, 27, 0.08)"
                    strokeDasharray={frac === 0 ? undefined : '3 3'}
                  />
                  {(maxSpend > 0 || frac === 0) && (
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-zinc-400 text-[10px]"
                    >
                      {formatCompactInr(tickVal)}
                    </text>
                  )}
                </g>
              )
            })}

            {points.map((p, i) => {
              const isHovered = hoveredIdx === i
              const hasSpend = p.spend > 0
              const isStaticTick = i === 0 || i === 4 || i === 9 || i === points.length - 1
              const collidesWithHover = hoveredIdx !== null && !isHovered && Math.abs(i - hoveredIdx) <= 1
              const showLabel = isHovered || (isStaticTick && !collidesWithHover)

              return (
                <g
                  key={p.date}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={padLeft + i * stepX}
                    y={padTop}
                    width={stepX}
                    height={plotH + padBottom}
                    fill="transparent"
                  />
                  <rect
                    x={p.cx - barW / 2}
                    y={hasSpend ? p.cy : padTop + plotH - 2}
                    width={barW}
                    height={hasSpend ? Math.max(p.barH, 3) : 2}
                    rx="4"
                    fill={isHovered ? '#18181B' : hasSpend ? '#E08A1E' : 'rgba(24, 24, 27, 0.1)'}
                    opacity={hoveredIdx !== null && !isHovered ? 0.5 : 1}
                    className="transition-all duration-150"
                  />
                  {showLabel && (
                    <text
                      x={p.cx}
                      y={height - 8}
                      textAnchor="middle"
                      className={`text-[10px] ${isHovered ? 'fill-zinc-900 font-bold' : 'fill-zinc-400'}`}
                    >
                      {formatShortDay(p.date)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

function RecentProjectRow({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center justify-between gap-3 py-3 border-b border-zinc-900/[0.06] last:border-0 hover:bg-zinc-950/[0.03] -mx-5 px-5 transition-colors group min-w-0"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-zinc-900 truncate group-hover:text-amber-600 transition-colors">
            {project.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className="tabular-nums">
            {project.sectionCount ?? 0} {project.sectionCount === 1 ? 'sheet' : 'sheets'}
          </span>
          {project.location && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                <MapPin className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                <span className="truncate capitalize">{project.location}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs sm:text-sm font-bold tabular-nums ${project.totalSpend > 0 ? 'text-zinc-900' : 'text-zinc-400 font-medium'}`}>
          {project.totalSpend > 0 ? formatInr(project.totalSpend) : '₹0'}
        </span>
        <Badge status={project.status} />
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { setTopBar, clearTopBar } = useTopBar()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDashboard()
      setData(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const s = data?.stats ?? {}
  const crew = data?.crew ?? {}
  const agr = data?.agreements ?? {}
  const charts = data?.charts ?? {}
  const recent = data?.recentProjects ?? []
  const recentEntries = data?.recentEntries ?? []

  const primaryCtaTarget = recent.length > 0 ? `/projects/${recent[0].id}` : '/projects'
  const primaryCtaLabel = recent.length > 0 ? 'Log Spend' : 'New Project'

  useEffect(() => {
    setTopBar({
      title: 'Dashboard',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          <Magnetic strength={0.18}>
            <Link to={primaryCtaTarget}>
              <Button variant="obsidian" size="sm">
                <Plus className="w-4 h-4" />
                {primaryCtaLabel}
              </Button>
            </Link>
          </Magnetic>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, primaryCtaTarget, primaryCtaLabel])

  const kpiSegments = [
    {
      to: '/projects',
      label: 'Projects',
      value: s.total ?? 0,
      isZero: (s.total ?? 0) === 0,
      sub: formatProjectSubtitle(s),
      icon: HardHat,
    },
    {
      to: '/crew',
      label: 'Workforce',
      value: crew.total ?? 0,
      isZero: (crew.total ?? 0) === 0,
      sub: formatCrewSummary(crew),
      icon: Users,
    },
    {
      to: '/agreements',
      label: 'Agreements',
      value: agr.total ?? 0,
      isZero: (agr.total ?? 0) === 0,
      sub: (agr.total ?? 0) === 0
        ? 'No agreements yet'
        : agr.expiringSoon > 0
          ? `${agr.active ?? 0} active · ${agr.expiringSoon} due ≤15d`
          : `${agr.active ?? 0} active · ${formatCompactInr(agr.activeValue)}`,
      icon: ScrollText,
    },
    {
      to: '/projects',
      label: 'Logged Spend',
      value: formatInr(s.totalSpend),
      isZero: Number(s.totalSpend || 0) === 0,
      sub: Number(s.totalSpend || 0) === 0
        ? 'No spend logged'
        : `Today ${formatInr(s.todaySpend)} · 30d ${formatCompactInr(s.monthSpend)}`,
      icon: IndianRupee,
    },
  ]

  return (
    <div className="relative overflow-x-clip">
      {/* Subtle ambient washes refracted behind liquid-glass panels */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 lg:left-64 overflow-hidden -z-0">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6 max-w-7xl mx-auto">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl liquid-glass-surface border-red-200/80 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Could not load dashboard</p>
              <p className="text-xs mt-0.5 text-red-500 break-words">{error}</p>
              <button onClick={load} className="text-xs underline mt-1 hover:no-underline">Retry</button>
            </div>
          </div>
        )}

        {/* Row 1: Unified KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl liquid-glass-surface overflow-hidden">
          {kpiSegments.map((c, idx) => {
            const isZero = !loading && c.isZero
            return (
              <Link
                key={c.label}
                to={c.to}
                className={`group px-5 py-4 flex items-start justify-between gap-3 hover:bg-white/45 transition-colors min-w-0 border-zinc-900/[0.06] ${
                  idx < 3 ? 'border-b sm:border-b-0' : ''
                } ${idx < 2 ? 'sm:border-b lg:border-b-0' : ''} ${
                  idx % 2 === 0 ? 'sm:border-r' : ''
                } ${idx < 3 ? 'lg:border-r' : 'lg:border-r-0'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-800 transition-colors truncate">
                    {c.label}
                  </p>
                  {loading ? (
                    <div className="h-7 w-20 rounded-md bg-zinc-200/70 animate-pulse mt-2" />
                  ) : (
                    <p
                      className={`font-heading text-xl sm:text-2xl font-bold tabular-nums mt-1.5 leading-none truncate ${
                        isZero ? 'text-zinc-400' : 'text-zinc-900'
                      }`}
                    >
                      {c.value}
                    </p>
                  )}
                  {!loading && (
                    <p className="text-[11px] text-zinc-500 tabular-nums mt-1.5 truncate">
                      {c.sub}
                    </p>
                  )}
                </div>
                <c.icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400" />
              </Link>
            )
          })}
        </div>

        {/* Row 2: Main Operational Split (2:1 — 14-Day Spend + Recent Projects) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <SpendBarCard
            series={charts.dailySpend || []}
            totalEntries={s.totalRecords ?? 0}
            loading={loading}
          />

          <div className="rounded-2xl liquid-glass-surface overflow-hidden flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-zinc-900/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 truncate">Recent Projects</h3>
              </div>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold flex-shrink-0"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="px-5 py-1 flex-1 flex flex-col">
              {loading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-36 rounded bg-zinc-200/70 animate-pulse" />
                        <div className="h-2.5 w-24 rounded bg-zinc-100 animate-pulse" />
                      </div>
                      <div className="h-5 w-14 rounded-full bg-zinc-100 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="py-10 text-center my-auto">
                  <FolderOpen className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No projects created yet.</p>
                  <Link to="/projects">
                    <Button variant="obsidian" size="sm" className="mt-3">
                      <Plus className="w-3.5 h-3.5" /> New Project
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    {recent.map((p) => <RecentProjectRow key={p.id} project={p} />)}
                  </div>
                  {recent.length < 3 && (
                    <div className="mt-auto pt-3 pb-3 border-t border-zinc-900/[0.06]">
                      <Link
                        to="/projects"
                        className="w-full py-2 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-950/[0.04] border border-dashed border-zinc-900/[0.12] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Project</span>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Actionable Operations (2:1 — Recent Entries Ledger + Combined Operations Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Left: Recent Entries Ledger */}
          <div className="lg:col-span-2 rounded-2xl liquid-glass-surface overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2 px-5 sm:px-6 py-4 border-b border-zinc-900/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <ReceiptText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 truncate">Recent Entries</h3>
              </div>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold flex-shrink-0"
              >
                Open Sheets <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : recentEntries.length === 0 ? (
              <div className="py-10 px-6 text-center text-xs text-zinc-500">
                No entries logged across project sheets yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="pl-5 sm:pl-6 pr-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Entry</th>
                      <th className="px-3 py-2.5">Project / Sheet</th>
                      <th className="pl-3 pr-5 sm:pr-6 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map((entry) => {
                      const entryTitle = formatEntryTitle(entry)
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-zinc-900/[0.05] last:border-b-0 hover:bg-zinc-950/[0.025] transition-colors"
                        >
                          <td className="pl-5 sm:pl-6 pr-3 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                            {formatShortDay(entry.date)}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium max-w-[220px] truncate">
                            {entryTitle ? (
                              <Link
                                to={`/projects/${entry.projectId}`}
                                className={`transition-colors ${
                                  entry.label
                                    ? 'text-zinc-900 hover:text-amber-600'
                                    : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                              >
                                {entryTitle}
                              </Link>
                            ) : (
                              <span className="text-zinc-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-zinc-500 max-w-[200px] truncate">
                            <Link
                              to={`/projects/${entry.projectId}`}
                              className="hover:text-zinc-800 transition-colors"
                            >
                              {entry.projectName} · <span className="text-zinc-400">{entry.sectionName}</span>
                            </Link>
                          </td>
                          <td className="pl-3 pr-5 sm:pr-6 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                            {entry.amount !== null ? (
                              <span className="text-zinc-900">{formatInr(entry.amount)}</span>
                            ) : (
                              <span className="text-zinc-300 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Combined Workforce & Agreements Text-First Operations Card */}
          <div className="rounded-2xl liquid-glass-surface p-5 sm:p-6 flex flex-col justify-between min-w-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-900 truncate">Crew & Contracts</h3>
                <span className="text-[11px] tabular-nums text-zinc-400">Operations</span>
              </div>

              {/* Workforce row */}
              <div className="pt-3 border-t border-zinc-900/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Users className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Workforce
                    </p>
                    {(crew.total ?? 0) === 0 ? (
                      <p className="text-sm text-zinc-500 mt-0.5">No crew added</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5 tabular-nums truncate">
                          {formatCrewSummary(crew)}
                        </p>
                        <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                          {crew.active ?? 0} active{crew.onLeave > 0 ? ` · ${crew.onLeave} on leave` : ''}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Link to="/crew" className="flex-shrink-0">
                  {(crew.total ?? 0) === 0 ? (
                    <Button variant="outline" size="sm">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </Link>
              </div>

              {/* Agreements row */}
              <div className="pt-4 border-t border-zinc-900/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ScrollText className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Agreements
                    </p>
                    {(agr.total ?? 0) === 0 ? (
                      <p className="text-sm text-zinc-500 mt-0.5">No agreements yet</p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5 tabular-nums truncate">
                          {agr.active ?? 0} active · {formatInr(agr.activeValue)}
                        </p>
                        <p className={`text-xs tabular-nums mt-0.5 ${agr.expiringSoon > 0 ? 'text-red-600 font-semibold' : 'text-zinc-500'}`}>
                          {agr.expiringSoon > 0
                            ? `${agr.expiringSoon} due within 15 days`
                            : `${agr.total} total contracts`}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Link to="/agreements" className="flex-shrink-0">
                  {(agr.total ?? 0) === 0 ? (
                    <Button variant="outline" size="sm">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {!loading && (
              <div className="mt-5 pt-3 border-t border-zinc-900/[0.06] flex items-center justify-between text-xs text-zinc-500 tabular-nums">
                <span>{s.totalSections ?? 0} active sheets</span>
                <span>{s.totalFields ?? 0} columns configured</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
