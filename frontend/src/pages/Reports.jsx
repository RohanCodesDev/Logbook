import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileBarChart2, Download, RefreshCw, ArrowRight, Loader2, AlertTriangle, Layers } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import EmptyState from '../components/ui/EmptyState'
import { useTopBar } from '../components/layout/AppLayout'
import { getReports } from '../services/api'

export default function Reports() {
  const { setTopBar, clearTopBar } = useTopBar()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getReports()
      setReport(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const projects = report?.projects || []
  const sections = report?.sections || []

  const exportOverviewCsv = useCallback(() => {
    if (!projects.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Project Name', 'Client', 'Location', 'Status', 'Sections', 'Custom Fields', 'Records', 'Start Date'].join(',')
    const lines = projects.map((p) =>
      [esc(p.name), esc(p.client), esc(p.location), esc(p.status), p.sectionCount, p.fieldCount, p.recordCount, esc(p.startDate)].join(',')
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'business-projects-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [projects])

  useEffect(() => {
    setTopBar({
      title: 'Reports',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          {projects.length > 0 && (
            <Magnetic strength={0.18}>
              <Button variant="primary" size="sm" onClick={exportOverviewCsv}>
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
            </Magnetic>
          )}
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, projects.length, exportOverviewCsv])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Could not load reports</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Project Summary Table */}
      <Card noPad>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Projects Overview</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Generating report...
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FileBarChart2}
            title="No project data yet"
            description="Once you add projects and record entries, live reports will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)]/70">
                  <th className="pl-6 pr-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Project</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Sections</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Fields</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Records</th>
                  <th className="pl-4 pr-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-zinc-950/[0.025] transition-colors">
                    <td className="pl-6 pr-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.client || p.location || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5"><Badge status={p.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-right font-medium text-slate-700 tabular-nums">{p.sectionCount}</td>
                    <td className="px-4 py-3.5 text-sm text-right font-medium text-slate-700 tabular-nums">{p.fieldCount}</td>
                    <td className="px-4 py-3.5 text-sm text-right font-bold text-slate-900 tabular-nums">{p.recordCount}</td>
                    <td className="pl-4 pr-6 py-3.5 text-right">
                      <Link
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
                      >
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Active Sections Breakdown */}
      {!loading && sections.length > 0 && (
        <Card noPad>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900">All Custom Section Registers ({sections.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)]/70">
                  <th className="pl-6 pr-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Section Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Project</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Fields</th>
                  <th className="pl-4 pr-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Records</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-zinc-950/[0.025] transition-colors">
                    <td className="pl-6 pr-4 py-3.5 text-sm font-semibold text-slate-900">{s.sectionName}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      <Link to={`/projects/${s.projectId}`} className="hover:text-amber-600 transition-colors">
                        {s.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right text-slate-600 tabular-nums">{s.fieldCount}</td>
                    <td className="pl-4 pr-6 py-3.5 text-sm text-right font-bold text-slate-900 tabular-nums">{s.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
