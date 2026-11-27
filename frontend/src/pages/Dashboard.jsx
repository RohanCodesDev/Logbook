import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  HardHat, AlertTriangle, FileSpreadsheet,
  Clock, Sun, Sunrise, Moon, FolderOpen,
  RefreshCw, MapPin, ArrowRight, CalendarDays,
  BarChart3, Plus, IndianRupee, TrendingUp
} from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { useTopBar } from '../components/layout/AppLayout'
import { getDashboard } from '../services/api'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good Morning', Icon: Sunrise }
  if (h < 17) return { text: 'Good Afternoon', Icon: Sun }
  return { text: 'Good Evening', Icon: Moon }
}

function formatInr(val) {
  const num = Number(val || 0)
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function StatCard({ label, value, sub, icon: Icon, iconColor, bgColor, loading }) {
  return (
    <Card className="flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bgColor}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-16 rounded-md bg-slate-200 animate-pulse mb-1" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-none tabular-nums truncate">
            {value}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1 font-medium truncate">{label}</p>
        {sub && !loading && (
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums truncate">{sub}</p>
        )}
      </div>
    </Card>
  )
}

function RecentRow({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-amber-50/40 -mx-6 px-6 transition-colors group"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-amber-600 transition-colors">
          {project.name}
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{project.location || 'No location set'}</span>
          </span>
          <span>·</span>
          <span className="tabular-nums">{project.sectionCount ?? 0} sheets · {project.recordCount ?? 0} rows</span>
        </span>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {project.totalSpend > 0 && (
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] tabular-nums">
            {formatInr(project.totalSpend)}
          </span>
        )}
        <Badge status={project.status} />
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { setTopBar, clearTopBar } = useTopBar()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const greeting = getGreeting()

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

  useEffect(() => {
    setTopBar({
      title: greeting.text,
      actions: (
        <>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link to="/projects">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4" />
              Projects
            </Button>
          </Link>
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, greeting.text, load, loading])

  const s = data?.stats ?? {}
  const recent = data?.recentProjects ?? []

  const statCards = [
    {
      label: "Today's Spend",
      value: formatInr(s.todaySpend),
      sub: `${formatInr(s.monthSpend)} last 30d`,
      icon: IndianRupee,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      label: 'Total Logged Spend',
      value: formatInr(s.totalSpend),
      sub: `Across ${s.total ?? 0} projects`,
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      label: 'Active Sites',
      value: s.active ?? 0,
      sub: `${s.total ?? 0} total projects`,
      icon: HardHat,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      label: 'Logged Entries',
      value: s.totalRecords ?? 0,
      sub: `${s.totalSections ?? 0} sheets`,
      icon: FileSpreadsheet,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Could not load dashboard</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
            <button onClick={load} className="text-xs underline mt-1 hover:no-underline">Retry</button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <StatCard key={c.label} {...c} loading={loading} />
        ))}
      </div>

      {/* Recent Projects & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card noPad className="lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900">Recent Projects</h3>
            </div>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="px-6 py-1">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-2">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-48 rounded bg-slate-200 animate-pulse" />
                      <div className="h-2.5 w-32 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-12 text-center">
                <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No projects created yet.</p>
                <Link to="/projects">
                  <Button variant="primary" size="sm" className="mt-3">
                    <Plus className="w-3.5 h-3.5" /> Create First Project
                  </Button>
                </Link>
              </div>
            ) : (
              recent.map((p) => <RecentRow key={p.id} project={p} />)
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900">Project Status Breakdown</h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                  <div className="flex-1 h-2 rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-3 w-4 rounded bg-slate-200 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {[
                { label: 'Active',    key: 'active',    bar: 'bg-emerald-400' },
                { label: 'Planning',  key: 'planning',  bar: 'bg-purple-400' },
                { label: 'Paused',    key: 'paused',    bar: 'bg-amber-400' },
                { label: 'Completed', key: 'completed', bar: 'bg-blue-400' },
                { label: 'Archived',  key: 'archived',  bar: 'bg-slate-300' },
              ].map(({ label, key, bar }) => {
                const count = s[key] ?? 0
                const pct = s.total ? Math.round((count / s.total) * 100) : 0
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">{label}</span>
                      <span className="text-slate-400 tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${bar} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  <strong className="text-slate-900 tabular-nums">{s.newThisMonth ?? 0}</strong> added last 30 days
                </span>
                <span className="tabular-nums text-slate-400">{s.totalFields ?? 0} custom fields</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
