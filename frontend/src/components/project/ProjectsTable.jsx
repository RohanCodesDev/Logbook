import ProjectRow, { ProjectCard } from './ProjectRow'
import EmptyState from '../ui/EmptyState'
import { FolderOpen } from 'lucide-react'

const columns = [
  { label: 'Project Name',   className: 'pl-6 pr-4' },
  { label: 'Location',       className: 'px-4' },
  { label: 'Spend / Budget', className: 'px-4 hidden lg:table-cell' },
  { label: 'Status',         className: 'px-4' },
  { label: 'Records',        className: 'px-4 hidden xl:table-cell' },
  { label: 'Last Updated',   className: 'px-4 hidden lg:table-cell' },
  { label: '',               className: 'pl-4 pr-6 w-14 text-right' },
]

/**
 * ProjectsTable — Renders desktop spreadsheet table and mobile stacked cards cleanly.
 */
export default function ProjectsTable({
  projects,
  onView,
  onEdit,
  onShare,
  onDelete,
  deletingId,
  emptyAction,
}) {
  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No matching projects"
        description="Create a new project or adjust your search and filter selection."
        action={emptyAction}
      />
    )
  }

  return (
    <>
      {/* Mobile Card List (< md) */}
      <div className="md:hidden">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onView={onView}
            onEdit={onEdit}
            onShare={onShare}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)]/70">
              {columns.map((col, idx) => (
                <th
                  key={col.label || idx}
                  className={`py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${col.className}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onView={onView}
                onEdit={onEdit}
                onShare={onShare}
                onDelete={onDelete}
                deletingId={deletingId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
