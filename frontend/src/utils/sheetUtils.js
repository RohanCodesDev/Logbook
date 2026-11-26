/**
 * Sheet Utilities — Pure functions for Excel-like formulas, multi-kind sorting,
 * per-column filtering, human formatting, and AutoCalculate statistics.
 */

export const CURRENCY_NAME_RE = /\b(rate|amount|price|cost|bill|wage|salary|fee|total|budget)\b/i

export const FORMULA_OPERATORS = [
  { value: 'mul', symbol: '×', label: 'Multiply (×)' },
  { value: 'add', symbol: '+', label: 'Add (+)' },
  { value: 'sub', symbol: '−', label: 'Subtract (−)' },
  { value: 'div', symbol: '÷', label: 'Divide (÷)' },
]

export const SORT_KINDS = [
  { value: 'auto',     label: 'Smart Auto (Default)' },
  { value: 'alpha',    label: 'Alphabetical (A–Z)' },
  { value: 'numeric',  label: 'Numeric Value (0–9)' },
  { value: 'date',     label: 'Date / Chronological' },
  { value: 'option',   label: 'Dropdown Option Order' },
  { value: 'checkbox', label: 'Checked / Unchecked' },
  { value: 'length',   label: 'Text Length' },
]

/**
 * Formats YYYY-MM-DD or ISO date string cleanly as "24 Nov 2026" without timezone drift.
 */
export function formatHumanDate(raw) {
  const str = String(raw).trim()
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number)
    const dt = new Date(y, m - 1, d)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }
  const dt = new Date(str)
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return str
}

/**
 * Parses a numeric value even if stored with commas or currency symbol.
 */
export function parseNumericValue(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Parses YYYY-MM-DD or ISO timestamp into epoch ms for reliable sorting & comparisons.
 */
export function parseDateMs(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const str = String(raw).trim()
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    const [, y, m, d] = ymd.map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  const ts = Date.parse(str)
  return Number.isFinite(ts) ? ts : null
}

/**
 * Evaluates a Formula field against a row's data, guarding against circular references.
 */
export function evaluateFormulaValue(field, rowData, allFields, visited = new Set()) {
  if (!field?.formula || !rowData) return null
  if (visited.has(field.id)) return null

  const { leftFieldId, operator = 'mul', rightFieldId } = field.formula
  const leftField = allFields.find((f) => f.id === Number(leftFieldId))
  const rightField = allFields.find((f) => f.id === Number(rightFieldId))
  if (!leftField || !rightField) return null

  const nextVisited = new Set(visited)
  nextVisited.add(field.id)

  const leftRaw = leftField.fieldType === 'formula'
    ? evaluateFormulaValue(leftField, rowData, allFields, nextVisited)
    : rowData[String(leftField.id)]

  const rightRaw = rightField.fieldType === 'formula'
    ? evaluateFormulaValue(rightField, rowData, allFields, nextVisited)
    : rowData[String(rightField.id)]

  const a = parseNumericValue(leftRaw)
  const b = parseNumericValue(rightRaw)
  if (a === null || b === null) return null

  switch (operator) {
    case 'add': return a + b
    case 'sub': return a - b
    case 'div': return b === 0 ? null : a / b
    case 'mul':
    default:    return a * b
  }
}

/**
 * Resolves the effective cell value (computing formulas on the fly).
 */
export function getEffectiveCellValue(field, rowData, allFields) {
  if (!field) return ''
  if (field.fieldType === 'formula') {
    return evaluateFormulaValue(field, rowData, allFields)
  }
  return rowData?.[String(field.id)]
}

/**
 * Plain string representation for CSV export & sorting/filtering checks.
 */
export function formatPlainValue(field, value) {
  if (field.fieldType === 'checkbox') {
    return value ? 'Yes' : 'No'
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return ''
  }
  if (field.fieldType === 'date') {
    return formatHumanDate(value)
  }
  if (field.fieldType === 'formula') {
    const n = parseNumericValue(value)
    if (n === null) return ''
    return Number(n.toFixed(2))
  }
  return String(value)
}

/**
 * Checks whether a column represents currency amounts.
 */
export function isCurrencyField(field) {
  if (!field) return false
  if (field.fieldType === 'currency') return true
  if (field.fieldType === 'formula' && field.formula?.format === 'currency') return true
  if (field.fieldType === 'text' && CURRENCY_NAME_RE.test(field.name)) return true
  return false
}

/**
 * Checks whether a column supports numeric summary stats (SUM, AVG, MIN, MAX).
 */
export function isNumericColumn(field) {
  if (!field) return false
  return (
    field.fieldType === 'currency' ||
    field.fieldType === 'number' ||
    field.fieldType === 'formula' ||
    (field.fieldType === 'text' && CURRENCY_NAME_RE.test(field.name))
  )
}

/**
 * Builds distinct display labels when duplicate column names exist in the same sheet.
 */
export function buildDisplayLabels(fields) {
  const counts = {}
  for (const f of fields) {
    const key = f.name.trim().toLowerCase()
    counts[key] = (counts[key] || 0) + 1
  }

  const seen = {}
  const labels = {}
  for (const f of fields) {
    const key = f.name.trim().toLowerCase()
    if (counts[key] > 1) {
      seen[key] = (seen[key] || 0) + 1
      labels[f.id] = `${f.name} (${seen[key]})`
    } else {
      labels[f.id] = f.name
    }
  }
  return labels
}

/**
 * Resolves the effective sort kind when set to 'auto'.
 */
export function resolveSortKind(field, requestedKind = 'auto') {
  if (requestedKind && requestedKind !== 'auto') return requestedKind
  if (!field) return 'date'
  if (field.fieldType === 'currency' || field.fieldType === 'number' || field.fieldType === 'formula') {
    return 'numeric'
  }
  if (field.fieldType === 'date') return 'date'
  if (field.fieldType === 'checkbox') return 'checkbox'
  if (field.fieldType === 'text' && CURRENCY_NAME_RE.test(field.name)) return 'numeric'
  return 'alpha'
}

/**
 * Compares two records using a specific sort level.
 */
function compareByLevel(recA, recB, level, fields) {
  const { key, kind = 'auto', direction = 'asc', blanks = 'last' } = level
  const dir = direction === 'desc' ? -1 : 1

  // Built-in record metadata sort keys
  if (key === '__createdAt' || key === '__updatedAt') {
    const rawA = key === '__updatedAt' ? recA.updatedAt : recA.createdAt
    const rawB = key === '__updatedAt' ? recB.updatedAt : recB.createdAt
    const tsA = parseDateMs(rawA) ?? 0
    const tsB = parseDateMs(rawB) ?? 0
    return (tsA - tsB) * dir
  }

  const field = fields.find((f) => String(f.id) === String(key))
  if (!field) return 0

  const valA = getEffectiveCellValue(field, recA.data, fields)
  const valB = getEffectiveCellValue(field, recB.data, fields)

  const emptyA = field.fieldType !== 'checkbox' && (valA === undefined || valA === null || String(valA).trim() === '')
  const emptyB = field.fieldType !== 'checkbox' && (valB === undefined || valB === null || String(valB).trim() === '')

  if (emptyA && emptyB) return 0
  if (emptyA) return blanks === 'first' ? -1 : 1
  if (emptyB) return blanks === 'first' ? 1 : -1

  const effectiveKind = resolveSortKind(field, kind)

  switch (effectiveKind) {
    case 'numeric': {
      const nA = parseNumericValue(valA)
      const nB = parseNumericValue(valB)
      if (nA === null && nB === null) {
        return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir
      }
      if (nA === null) return 1
      if (nB === null) return -1
      return (nA - nB) * dir
    }

    case 'date': {
      const dA = parseDateMs(valA)
      const dB = parseDateMs(valB)
      if (dA === null && dB === null) return String(valA).localeCompare(String(valB)) * dir
      if (dA === null) return 1
      if (dB === null) return -1
      return (dA - dB) * dir
    }

    case 'checkbox': {
      const bA = Boolean(valA) ? 1 : 0
      const bB = Boolean(valB) ? 1 : 0
      return (bB - bA) * dir // asc puts Checked ('Yes') first
    }

    case 'option': {
      const opts = (field.options || []).map((o) => o.toLowerCase())
      const idxA = opts.indexOf(String(valA).trim().toLowerCase())
      const idxB = opts.indexOf(String(valB).trim().toLowerCase())
      const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA
      const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB
      if (rankA !== rankB) return (rankA - rankB) * dir
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir
    }

    case 'length': {
      const diff = String(valA).trim().length - String(valB).trim().length
      if (diff !== 0) return diff * dir
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir
    }

    case 'alpha':
    default: {
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir
    }
  }
}

/**
 * Sorts records cleanly without mutating the input array.
 * Supports primary + optional secondary sort levels.
 */
export function sortRecords(records, sortLevels = [], fields = []) {
  if (!sortLevels || sortLevels.length === 0) return records
  return [...records].sort((a, b) => {
    for (const level of sortLevels) {
      if (!level?.key) continue
      const diff = compareByLevel(a, b, level, fields)
      if (diff !== 0) return diff
    }
    return 0
  })
}

/**
 * Checks if a single row satisfies a single column filter rule.
 */
function matchesFilterRule(record, rule, fields) {
  const field = fields.find((f) => String(f.id) === String(rule.fieldId))
  if (!field) return true

  const raw = getEffectiveCellValue(field, record.data, fields)
  const isEmpty = field.fieldType !== 'checkbox' && (raw === undefined || raw === null || String(raw).trim() === '')

  if (rule.op === 'empty') return isEmpty
  if (rule.op === 'not_empty') return !isEmpty

  if (field.fieldType === 'checkbox') {
    if (rule.op === 'is_true') return Boolean(raw) === true
    if (rule.op === 'is_false') return Boolean(raw) === false
    return true
  }

  if (isEmpty) return false

  // Multi-select dropdown match
  if (rule.op === 'in') {
    const selected = Array.isArray(rule.values) ? rule.values : []
    if (selected.length === 0) return true
    return selected.includes(String(raw))
  }

  // Numeric / currency / formula filters
  if (isNumericColumn(field)) {
    const num = parseNumericValue(raw)
    if (num === null) return false
    const v1 = parseNumericValue(rule.value)
    const v2 = parseNumericValue(rule.value2)
    switch (rule.op) {
      case 'gt':      return v1 === null ? true : num > v1
      case 'gte':     return v1 === null ? true : num >= v1
      case 'lt':      return v1 === null ? true : num < v1
      case 'lte':     return v1 === null ? true : num <= v1
      case 'eq':      return v1 === null ? true : num === v1
      case 'between': return (v1 === null || num >= v1) && (v2 === null || num <= v2)
      default:        return true
    }
  }

  // Date filters
  if (field.fieldType === 'date') {
    const ts = parseDateMs(raw)
    if (ts === null) return false
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    switch (rule.op) {
      case 'today':
        return ts === todayStart
      case 'last7': {
        const weekAgo = todayStart - 6 * 86400000
        return ts >= weekAgo && ts <= todayStart
      }
      case 'this_month': {
        const d = new Date(ts)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      case 'after': {
        const afterMs = parseDateMs(rule.value)
        return afterMs === null ? true : ts >= afterMs
      }
      case 'before': {
        const beforeMs = parseDateMs(rule.value)
        return beforeMs === null ? true : ts <= beforeMs
      }
      case 'between': {
        const startMs = parseDateMs(rule.value)
        const endMs = parseDateMs(rule.value2)
        return (startMs === null || ts >= startMs) && (endMs === null || ts <= endMs)
      }
      default:
        return true
    }
  }

  // Text / fallback filters
  const text = String(raw).toLowerCase()
  const target = String(rule.value || '').trim().toLowerCase()
  if (!target) return true
  switch (rule.op) {
    case 'equals':      return text === target
    case 'starts_with': return text.startsWith(target)
    case 'contains':
    default:            return text.includes(target)
  }
}

/**
 * Filters records by global search string + active column filter rules.
 */
export function filterRecords(records, search = '', columnFilters = [], fields = []) {
  const q = search.trim().toLowerCase()
  return records.filter((rec) => {
    if (q) {
      const hitsSearch = fields.some((f) => {
        const val = getEffectiveCellValue(f, rec.data, fields)
        if (val === undefined || val === null || val === '') return false
        const str = f.fieldType === 'date' ? `${val} ${formatHumanDate(val)}` : String(val)
        return str.toLowerCase().includes(q)
      })
      if (!hitsSearch) return false
    }

    for (const rule of columnFilters) {
      if (!matchesFilterRule(rec, rule, fields)) return false
    }
    return true
  })
}

/**
 * Computes SUM, AVG, MIN, MAX, and filled counts for Excel-style AutoCalculate stats.
 */
export function computeSheetStats(records, fields) {
  const byField = {}
  const summaryFields = fields.filter(isNumericColumn)

  for (const f of summaryFields) {
    const nums = []
    for (const rec of records) {
      const raw = getEffectiveCellValue(f, rec.data, fields)
      const n = parseNumericValue(raw)
      if (n !== null) nums.push(n)
    }
    const sum = nums.reduce((acc, n) => acc + n, 0)
    const count = nums.length
    const avg = count > 0 ? sum / count : 0
    const min = count > 0 ? Math.min(...nums) : 0
    const max = count > 0 ? Math.max(...nums) : 0
    byField[f.id] = {
      field: f,
      sum,
      avg,
      min,
      max,
      count,
      emptyCount: records.length - count,
      isCurrency: isCurrencyField(f),
    }
  }

  return { summaryFields, byField }
}
