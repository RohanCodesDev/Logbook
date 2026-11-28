import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FileBarChart2, Download, RefreshCw, ArrowRight, Loader2,
  AlertTriangle, Layers, Printer, IndianRupee, ReceiptText,
  TrendingUp, Wallet,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Magnetic } from '../components/ui/Magnetic'
import EmptyState from '../components/ui/EmptyState'
import { useTopBar } from '../components/layout/AppLayout'
import { getReports } from '../services/api'
import { useCachedQuery } from '../utils/queryCache'
import { formatHumanDate, getTodayYmd } from '../utils/sheetUtils'

function formatInr(val) {
  const num = Number(val || 0)
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function Reports() {
  const { setTopBar, clearTopBar } = useTopBar()

  const [preset, setPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(() => getTodayYmd())

  const queryParams = useMemo(() => {
    if (preset === 'custom') {
      return { range: 'custom', from: customFrom, to: customTo }
    }
    return { range: preset }
  }, [preset, customFrom, customTo])

  const cacheKey = `reports:${queryParams.range}:${queryParams.from || ''}:${queryParams.to || ''}`

  const { data: report, loading, refreshing, error, reload } = useCachedQuery(
    cacheKey,
    () => getReports(queryParams)
  )

  const load = useCallback(() => reload(), [reload])

  const summary = report?.summary || {}
  const range = report?.range || {}
  const projects = report?.projects || []
  const sections = report?.sections || []
  const entries = report?.entries || []

  const exportStatementCsv = useCallback(() => {
    if (!projects.length && !entries.length) return
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const section1 = [
      ['PROJECT FINANCIAL SUMMARY', `Period: ${range.from || 'All'} to ${range.to || 'Present'}`].join(','),
      ['Project Name', 'Client', 'Location', 'Status', 'Period Spend (INR)', 'All-Time Spend (INR)', 'Agreement Budget (INR)', 'Period Entries'].join(','),
      ...projects.map((p) =>
        [
          esc(p.name),
          esc(p.client),
          esc(p.location),
          esc(p.status),
          p.periodSpend ?? 0,
          p.allTimeSpend ?? 0,
          p.budget ?? 0,
          p.periodRecords ?? 0,
        ].join(',')
      ),
    ]

    const section2 = entries.length
      ? [
          '',
          'ITEMIZED SPEND STATEMENT',
          ['Date', 'Project', 'Sheet', 'Entry / Description', 'Amount (INR)'].join(','),
          ...entries.map((e) =>
            [esc(e.date), esc(e.projectName), esc(e.sectionName), esc(e.label), e.amount ?? ''].join(',')
          ),
        ]
      : []

    const csv = [...section1, ...section2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-statement-${range.preset || '30d'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [projects, entries, range.from, range.to, range.preset])

  const handlePrintPdf = useCallback(() => {
    window.print()
  }, [])

  useEffect(() => {
    setTopBar({
      title: 'Reports',
      actions: (
        <>
          <Magnetic strength={0.18}>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </Magnetic>
          {projects.length > 0 && (
            <>
              <Magnetic strength={0.18}>
                <Button variant="outline" size="sm" onClick={exportStatementCsv}>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
              </Magnetic>
              <Magnetic strength={0.18}>
                <Button variant="outline" size="sm" onClick={handlePrintPdf}>
                  <Printer className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>PDF Statement</span>
                </Button>
              </Magnetic>
            </>
          )}
        </>
      ),
    })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar, load, loading, refreshing, projects.length, exportStatementCsv, handlePrintPdf])

  const totalPeriodSpend = Number(summary.totalSpend || 0)

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden="true" className="no-print pointer-events-none fixed inset-0 lg:left-64 overflow-hidden -z-0">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange-200/15 blur-3xl" />
      </div>

      {/* Print-Only Formal Statement Header */}
      <div className="print-only pb-4 mb-5 border-b-2 border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">BuildLogic · Financial Statement</p>
            <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">Project Spend &amp; Budget Summary</h1>
          </div>
          <div className="text-right text-xs text-zinc-600 tabular-nums">
            <p className="font-semibold">
              Period: {range.from ? formatHumanDate(range.from) : 'Inception'} – {range.to ? formatHumanDate(range.to) : formatHumanDate(getTodayYmd())}
            </p>
            <p>Generated: {formatHumanDate(getTodayYmd())}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-5 max-w-7xl mx-auto">
        {error && (
          <div className="no-print flex items-start gap-3 p-4 rounded-2xl liquid-glass-surface border-red-200/80 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Could not load reports</p>
              <p className="text-xs mt-0.5 text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Date Range Filter Toolbar */}
        <div className="no-print rounded-2xl liquid-glass-surface px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
            {[
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: 'all', label: 'All Time' },
              { key: 'custom', label: 'Custom' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPreset(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  preset === tab.key
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                    : 'text-slate-500 hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {preset === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 px-3 rounded-xl bg-white/80 border border-zinc-900/[0.08] text-xs tabular-nums focus:outline-none focus:border-[#E08A1E]"
              />
              <span className="text-zinc-500 font-medium">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 px-3 rounded-xl bg-white/80 border border-zinc-900/[0.08] text-xs tabular-nums focus:outline-none focus:border-[#E08A1E]"
              />
            </div>
          ) : (
            <p className="text-xs text-zinc-500 tabular-nums">
              {range.from
                ? `${formatHumanDate(range.from)} — ${formatHumanDate(range.to)}`
                : 'All recorded entries'}
            </p>
          )}
        </div>

        {/* Financial Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl liquid-glass-surface overflow-hidden">
          {[
            {
              label: 'Period Spend',
              val: formatInr(summary.totalSpend),
              rawZero: totalPeriodSpend === 0,
              icon: IndianRupee,
            },
            {
              label: 'Agreement Budget',
              val: Number(summary.totalBudget || 0) > 0 ? formatInr(summary.totalBudget) : 'No budget',
              rawZero: Number(summary.totalBudget || 0) === 0,
              icon: Wallet,
            },
            {
              label: 'Entries in Range',
              val: summary.totalEntries ?? 0,
              rawZero: (summary.totalEntries ?? 0) === 0,
              icon: ReceiptText,
            },
            {
              label: 'Daily Average',
              val: formatInr(summary.avgDailySpend),
              rawZero: Number(summary.avgDailySpend || 0) === 0,
              icon: TrendingUp,
            },
          ].map((k, idx) => {
            const isZero = !loading && k.rawZero
            return (
              <div
                key={k.label}
                className={`px-5 py-4 flex items-start justify-between gap-3 border-zinc-900/[0.06] ${
                  idx < 2 ? 'border-b lg:border-b-0' : ''
                } ${idx % 2 === 0 ? 'border-r' : ''} ${idx < 3 ? 'lg:border-r' : 'lg:border-r-0'}`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 truncate">{k.label}</p>
                  <p className={`font-heading text-xl sm:text-2xl font-bold tabular-nums mt-1.5 leading-none truncate ${
                    isZero ? 'text-zinc-400' : 'text-zinc-900'
                  }`}>
                    {loading ? '—' : k.val}
                  </p>
                </div>
                <k.icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400" />
              </div>
            )
          })}
        </div>

        {/* Spend by Project Breakdown */}
        <div className="rounded-2xl liquid-glass-surface overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-zinc-900/[0.06] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Spend by Project</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Period expenditure compared against linked agreement budgets
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Generating financial summary...
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FileBarChart2}
              title="No project data yet"
              description="Once you add projects and log spend entries, financial summaries will appear here."
            />
          ) : (
            <div className="overflow-x-auto bg-[var(--bg-card)]/70">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)]/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="pl-5 sm:pl-6 pr-4 py-3">Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Period Spend</th>
                    <th className="px-4 py-3 text-right">All-Time / Budget</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                    <th className="no-print pl-4 pr-5 sm:pr-6 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const pct = p.budget > 0 ? Math.min(100, Math.round((p.allTimeSpend / p.budget) * 100)) : null
                    return (
                      <tr key={p.id} className="border-b border-zinc-900/[0.05] last:border-0 hover:bg-zinc-950/[0.025] transition-colors">
                        <td className="pl-5 sm:pl-6 pr-4 py-3.5">
                          <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                          <p className="text-xs text-zinc-400 capitalize">{p.client || p.location || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5"><Badge status={p.status} /></td>
                        <td className="px-4 py-3.5 text-sm text-right font-bold text-zinc-900 tabular-nums">
                          {formatInr(p.periodSpend)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div className="text-xs font-semibold text-zinc-800">
                            {formatInr(p.allTimeSpend)}
                            {p.budget > 0 && (
                              <span className="text-zinc-400 font-normal"> / {formatInr(p.budget)}</span>
                            )}
                          </div>
                          {pct !== null && (
                            <div className="mt-1 ml-auto w-24 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 95 ? 'bg-red-500' : 'bg-[#E08A1E]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-right font-medium text-zinc-600 tabular-nums">
                          {p.periodRecords}
                        </td>
                        <td className="no-print pl-4 pr-5 sm:pr-6 py-3.5 text-right">
                          <Link
                            to={`/projects/${p.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
                          >
                            Open <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Spend by Sheet Breakdown */}
        {!loading && sections.length > 0 && (
          <div className="rounded-2xl liquid-glass-surface overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-zinc-900/[0.06] flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900">Spend by Sheet ({sections.length})</h3>
            </div>
            <div className="overflow-x-auto bg-[var(--bg-card)]/70">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)]/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="pl-5 sm:pl-6 pr-4 py-3">Sheet Name</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3 text-right">Period Entries</th>
                    <th className="px-4 py-3 text-right">Period Spend</th>
                    <th className="pl-4 pr-5 sm:pr-6 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => {
                    const sharePct = totalPeriodSpend > 0
                      ? Math.round((s.periodSpend / totalPeriodSpend) * 100)
                      : 0
                    return (
                      <tr key={s.id} className="border-b border-zinc-900/[0.05] last:border-0 hover:bg-zinc-950/[0.025] transition-colors">
                        <td className="pl-5 sm:pl-6 pr-4 py-3 text-sm font-semibold text-zinc-900">{s.sectionName}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          <Link to={`/projects/${s.projectId}`} className="hover:text-amber-600 transition-colors">
                            {s.projectName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-600 tabular-nums">{s.periodRecords}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-zinc-900 tabular-nums">
                          {formatInr(s.periodSpend)}
                        </td>
                        <td className="pl-4 pr-5 sm:pr-6 py-3 text-right text-xs font-medium text-zinc-500 tabular-nums">
                          {sharePct}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Print-only Itemized Ledger Statement for Client/Partner PDF Sharing */}
        {!loading && entries.length > 0 && (
          <div className="print-only pt-4">
            <h3 className="text-sm font-bold text-zinc-900 mb-2">Itemized Spend Statement ({entries.length} entries)</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-400 text-[10px] uppercase text-zinc-600">
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 px-2">Project</th>
                  <th className="py-1.5 px-2">Sheet</th>
                  <th className="py-1.5 px-2">Entry</th>
                  <th className="py-1.5 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-200">
                    <td className="py-1.5 pr-2 tabular-nums">{formatHumanDate(e.date)}</td>
                    <td className="py-1.5 px-2">{e.projectName}</td>
                    <td className="py-1.5 px-2">{e.sectionName}</td>
                    <td className="py-1.5 px-2">{e.label}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums font-semibold">
                      {e.amount !== null ? formatInr(e.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
