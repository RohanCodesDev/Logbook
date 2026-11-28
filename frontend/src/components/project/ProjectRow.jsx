import { ExternalLink, Pencil, Share2, Trash2, MapPin, Layers, Clock, Loader2, IndianRupee } from 'lucide-react'
import Badge from '../ui/Badge'
import ActionMenu from '../ui/ActionMenu'

function formatInrCompact(val) {
  const num = Number(val || 0)
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatUpdatedDate(isoDate, fallbackDate) {
  const raw = isoDate || fallbackDate
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function buildProjectMenuItems({ project, isDeleting, onView, onEdit, onShare, onDelete }) {
  return [
    {
      label: 'Open Workspace',
      icon: ExternalLink,
      onClick: () => onView?.(project),
    },
    {
      label: 'Edit Details',
      icon: Pencil,
      onClick: () => onEdit?.(project),
    },
    {
      label: 'Copy Link',
      icon: Share2,
      onClick: () => onShare?.(project),
    },
    {
      label: isDeleting ? 'Deleting...' : 'Delete Project',
      icon: isDeleting ? Loader2 : Trash2,
      danger: true,
      dividerBefore: true,
      disabled: isDeleting,
      onClick: () => onDelete?.(project),
    },
  ]
}

/**
 * ProjectCard — Mobile-friendly tappable project card (< md).
 */
export function ProjectCard({ project, onView, onEdit, onShare, onDelete, deletingId }) {
  const isDeleting = deletingId === project.id
  const menuItems = buildProjectMenuItems({ project, isDeleting, onView, onEdit, onShare, onDelete })

  return (
    <div
      onClick={() => onView?.(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView?.(project)
        }
      }}
      className="p-4 border-b border-[var(--border-subtle)] last:border-b-0 active:bg-[#FEF6E9] hover:bg-[#FEF6E9]/60 transition-colors cursor-pointer space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-slate-900 leading-snug">{project.name}</h3>
          <Badge status={project.status} />
        </div>
        <ActionMenu items={menuItems} label={`Actions for ${project.name}`} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500 pt-1">
        <span className="inline-flex items-center gap-1.5 truncate">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate capitalize">{project.location || 'No location'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <IndianRupee className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate font-semibold text-zinc-800">
            {formatInrCompact(project.loggedSpend)}
            {project.budget > 0 ? ` / ${formatInrCompact(project.budget)}` : ''}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {project.sectionCount ?? 0} sec · {project.recordCount ?? 0} rec
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {formatUpdatedDate(project.updatedAt, project.startDate)}
        </span>
      </div>
    </div>
  )
}

/**
 * ProjectRow — Full-row clickable table row for desktop/tablet viewports.
 */
export default function ProjectRow({
  project,
  onView,
  onEdit,
  onShare,
  onDelete,
  deletingId,
}) {
  const isDeleting = deletingId === project.id
  const menuItems = buildProjectMenuItems({ project, isDeleting, onView, onEdit, onShare, onDelete })

  return (
    <tr
      onClick={() => onView?.(project)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView?.(project)
        }
      }}
      tabIndex={0}
      className="group border-b border-[var(--border-subtle)] last:border-b-0 cursor-pointer hover:bg-zinc-950/[0.025] focus:outline-none focus:bg-zinc-950/[0.035] transition-colors duration-150"
    >
      {/* Project Name */}
      <td className="pl-6 pr-4 py-4">
        <span className="font-semibold text-slate-900 text-sm leading-tight group-hover:text-amber-600 transition-colors block">
          {project.name}
        </span>
      </td>

      {/* Location */}
      <td className="px-4 py-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate max-w-[180px] capitalize">{project.location || '—'}</span>
        </span>
      </td>

      {/* Logged Spend vs Budget */}
      <td className="px-4 py-4 hidden lg:table-cell">
        <div className="tabular-nums">
          <span className={`text-sm font-semibold ${project.loggedSpend > 0 ? 'text-zinc-900' : 'text-zinc-400 font-normal'}`}>
            {formatInrCompact(project.loggedSpend)}
          </span>
          {project.budget > 0 && (
            <span className="text-xs text-zinc-400 ml-1">
              / {formatInrCompact(project.budget)}
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <Badge status={project.status} />
      </td>

      {/* Sections & Records */}
      <td className="px-4 py-4 hidden xl:table-cell">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-medium tabular-nums">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          {project.sectionCount ?? 0} sec · {project.recordCount ?? 0} rec
        </span>
      </td>

      {/* Last Updated */}
      <td className="px-4 py-4 hidden lg:table-cell">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 tabular-nums">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          {formatUpdatedDate(project.updatedAt, project.startDate)}
        </span>
      </td>

      {/* Kebab Actions Menu */}
      <td className="pl-4 pr-6 py-3 text-right">
        <div className="inline-flex opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          <ActionMenu items={menuItems} label={`Actions for ${project.name}`} />
        </div>
      </td>
    </tr>
  )
}
