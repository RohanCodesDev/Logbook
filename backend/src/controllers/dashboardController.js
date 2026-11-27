import pool from '../db/index.js';

const CURRENCY_NAME_RE = /\b(rate|amount|price|cost|bill|wage|salary|fee|total|budget|spend|expense|payable)\b/i;
const PRIMARY_TOTAL_NAME_RE = /\b(amount|total|cost|spend|expense|bill|payable|net)\b/i;

function parseNumeric(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function evalFieldNumeric(field, rowData, fieldById, visited = new Set()) {
  if (!field || !rowData) return null;
  if (field.field_type !== 'formula') {
    return parseNumeric(rowData[String(field.id)]);
  }
  if (!field.formula || visited.has(field.id)) return null;
  const { leftFieldId, operator = 'mul', rightFieldId } = field.formula;
  const leftField = fieldById.get(Number(leftFieldId));
  const rightField = fieldById.get(Number(rightFieldId));
  if (!leftField || !rightField) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(field.id);

  const l = evalFieldNumeric(leftField, rowData, fieldById, nextVisited);
  const r = evalFieldNumeric(rightField, rowData, fieldById, nextVisited);
  if (l === null || r === null) return null;

  switch (operator) {
    case 'add': return l + r;
    case 'sub': return l - r;
    case 'div': return r === 0 ? null : l / r;
    case 'mul':
    default:    return l * r;
  }
}

function pickSpendField(fields = []) {
  const formulaCurrency = fields.filter(
    (f) => f.field_type === 'formula' && f.formula?.format === 'currency'
  );
  if (formulaCurrency.length) {
    return formulaCurrency.find((f) => PRIMARY_TOTAL_NAME_RE.test(f.name)) || formulaCurrency[0];
  }

  const totalNamed = fields.find(
    (f) =>
      PRIMARY_TOTAL_NAME_RE.test(f.name) &&
      (f.field_type === 'currency' || f.field_type === 'number' || f.field_type === 'formula' || f.field_type === 'text')
  );
  if (totalNamed) return totalNamed;

  const anyCurrency = fields.find((f) => f.field_type === 'currency');
  if (anyCurrency) return anyCurrency;

  return fields.find(
    (f) =>
      CURRENCY_NAME_RE.test(f.name) &&
      (f.field_type === 'number' || f.field_type === 'text' || f.field_type === 'formula')
  ) || null;
}

export const getDashboardStats = async (req, res, next) => {
  try {
    // Aggregate project stats
    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'active')                         AS active,
        COUNT(*) FILTER (WHERE status = 'planning')                       AS planning,
        COUNT(*) FILTER (WHERE status = 'paused')                         AS paused,
        COUNT(*) FILTER (WHERE status = 'completed')                      AS completed,
        COUNT(*) FILTER (WHERE status = 'archived')                       AS archived,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')  AS new_this_month
      FROM projects
    `);

    // Aggregate workspace totals (sections & records) + date bounds
    const { rows: workspaceRows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM project_sections)                 AS total_sections,
        (SELECT COUNT(*) FROM section_fields)                   AS total_fields,
        (SELECT COUNT(*) FROM section_records)                  AS total_records,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')                     AS today_str,
        TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD') AS month_start_str
    `);

    // Fetch sections, fields & records for spend/cost rollups
    const [{ rows: sectionRows }, { rows: fieldRows }, { rows: recordRows }] = await Promise.all([
      pool.query('SELECT id, project_id FROM project_sections'),
      pool.query('SELECT id, section_id, name, field_type, formula FROM section_fields ORDER BY sort_order ASC, id ASC'),
      pool.query(`
        SELECT
          section_id,
          data,
          TO_CHAR(COALESCE(entry_date, created_at::date), 'YYYY-MM-DD') AS effective_date
        FROM section_records
      `),
    ]);

    const fieldsBySection = new Map();
    const fieldById = new Map();
    for (const f of fieldRows) {
      fieldById.set(f.id, f);
      if (!fieldsBySection.has(f.section_id)) fieldsBySection.set(f.section_id, []);
      fieldsBySection.get(f.section_id).push(f);
    }

    const projectBySection = new Map();
    const spendFieldBySection = new Map();
    for (const sec of sectionRows) {
      projectBySection.set(sec.id, sec.project_id);
      const secFields = fieldsBySection.get(sec.id) || [];
      spendFieldBySection.set(sec.id, pickSpendField(secFields));
    }

    const w = workspaceRows[0];
    const todayStr = w.today_str;
    const monthStartStr = w.month_start_str;

    let totalSpend = 0;
    let todaySpend = 0;
    let monthSpend = 0;
    const spendByProject = new Map();

    for (const rec of recordRows) {
      const spendField = spendFieldBySection.get(rec.section_id);
      if (!spendField) continue;
      const val = evalFieldNumeric(spendField, rec.data, fieldById);
      if (val === null) continue;

      totalSpend += val;
      if (rec.effective_date === todayStr) todaySpend += val;
      if (rec.effective_date >= monthStartStr) monthSpend += val;

      const projId = projectBySection.get(rec.section_id);
      if (projId) {
        spendByProject.set(projId, (spendByProject.get(projId) || 0) + val);
      }
    }

    // Recent 5 updated projects with their section & record counts
    const { rows: recent } = await pool.query(`
      SELECT
        p.id, p.name, p.location, p.client, p.status, p.start_date, p.created_at, p.updated_at,
        COUNT(DISTINCT ps.id) AS section_count,
        COUNT(DISTINCT sr.id) AS record_count
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 5
    `);

    const s = statRows[0];

    res.json({
      success: true,
      data: {
        stats: {
          total:         parseInt(s.total, 10),
          active:        parseInt(s.active, 10),
          planning:      parseInt(s.planning, 10),
          paused:        parseInt(s.paused, 10),
          completed:     parseInt(s.completed, 10),
          archived:      parseInt(s.archived, 10),
          newThisMonth:  parseInt(s.new_this_month, 10),
          totalSections: parseInt(w.total_sections, 10),
          totalFields:   parseInt(w.total_fields, 10),
          totalRecords:  parseInt(w.total_records, 10),
          totalSpend:    Math.round(totalSpend * 100) / 100,
          todaySpend:    Math.round(todaySpend * 100) / 100,
          monthSpend:    Math.round(monthSpend * 100) / 100,
        },
        recentProjects: recent.map((r) => ({
          id:           r.id,
          name:         r.name,
          location:     r.location,
          client:       r.client,
          status:       r.status,
          startDate:    r.start_date ? r.start_date.toISOString().split('T')[0] : null,
          sectionCount: parseInt(r.section_count, 10),
          recordCount:  parseInt(r.record_count, 10),
          totalSpend:   Math.round((spendByProject.get(r.id) || 0) * 100) / 100,
          createdAt:    r.created_at,
          updatedAt:    r.updated_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
