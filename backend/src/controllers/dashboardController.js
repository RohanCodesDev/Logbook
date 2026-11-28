import pool from '../db/index.js';
import { evalFieldNumeric, pickSpendField, pickEntryLabel } from '../utils/spendCalculator.js';

function buildLastNDaysKeys(todayStr, days = 14) {
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(base.getTime() - i * 86400000);
    keys.push(dt.toISOString().slice(0, 10));
  }
  return keys;
}

export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      { rows: statRows },
      { rows: workspaceRows },
      { rows: projectRows },
      { rows: sectionRows },
      { rows: fieldRows },
      { rows: recordRows },
      { rows: crewStatRows },
      { rows: agreementStatRows },
      { rows: recent },
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE status = 'active')                         AS active,
          COUNT(*) FILTER (WHERE status = 'planning')                       AS planning,
          COUNT(*) FILTER (WHERE status = 'paused')                         AS paused,
          COUNT(*) FILTER (WHERE status = 'completed')                      AS completed,
          COUNT(*) FILTER (WHERE status = 'archived')                       AS archived,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')  AS new_this_month
        FROM projects
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM project_sections)                  AS total_sections,
          (SELECT COUNT(*) FROM section_fields)                    AS total_fields,
          (SELECT COUNT(*) FROM section_records)                   AS total_records,
          TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')                      AS today_str,
          TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD') AS month_start_str
      `),
      pool.query('SELECT id, name, status FROM projects ORDER BY name ASC'),
      pool.query('SELECT id, project_id, name FROM project_sections'),
      pool.query('SELECT id, section_id, name, field_type, formula FROM section_fields ORDER BY sort_order ASC, id ASC'),
      pool.query(`
        SELECT
          id,
          section_id,
          data,
          created_at,
          TO_CHAR(COALESCE(entry_date, created_at::date), 'YYYY-MM-DD') AS effective_date
        FROM section_records
        ORDER BY COALESCE(entry_date, created_at::date) DESC, created_at DESC, id DESC
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                     AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int    AS active,
          COUNT(*) FILTER (WHERE status = 'on_leave')::int  AS on_leave,
          COUNT(*) FILTER (WHERE status = 'inactive')::int  AS inactive,
          COUNT(*) FILTER (WHERE role = 'driver')::int      AS drivers,
          COUNT(*) FILTER (WHERE role = 'operator')::int    AS operators,
          COUNT(*) FILTER (WHERE role = 'helper')::int      AS helpers,
          COUNT(*) FILTER (WHERE role = 'other')::int       AS other
        FROM crew_members
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                                                       AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int                                      AS active,
          COUNT(*) FILTER (WHERE status = 'pending')::int                                     AS pending,
          COUNT(*) FILTER (WHERE status = 'completed')::int                                   AS completed,
          COUNT(*) FILTER (WHERE status IN ('expired', 'terminated'))::int                    AS closed,
          COALESCE(SUM(contract_value), 0)::numeric                                           AS total_value,
          COALESCE(SUM(contract_value) FILTER (WHERE status = 'active'), 0)::numeric          AS active_value,
          COUNT(*) FILTER (
            WHERE status = 'active' AND end_date IS NOT NULL AND end_date <= CURRENT_DATE + INTERVAL '15 days'
          )::int                                                                              AS expiring_soon
        FROM agreements
      `),
      pool.query(`
        SELECT
          p.id, p.name, p.location, p.client, p.status, p.start_date, p.created_at, p.updated_at,
          COUNT(DISTINCT ps.id) AS section_count,
          COUNT(DISTINCT sr.id) AS record_count,
          COALESCE((
            SELECT SUM(a.contract_value)
            FROM agreements a
            WHERE a.project_id = p.id AND a.status NOT IN ('terminated', 'expired')
          ), 0)::numeric AS budget
        FROM projects p
        LEFT JOIN project_sections ps ON ps.project_id = p.id
        LEFT JOIN section_records sr  ON sr.section_id = ps.id
        GROUP BY p.id
        ORDER BY p.updated_at DESC
        LIMIT 5
      `),
    ]);

    const fieldsBySection = new Map();
    const fieldById = new Map();
    for (const f of fieldRows) {
      fieldById.set(f.id, f);
      if (!fieldsBySection.has(f.section_id)) fieldsBySection.set(f.section_id, []);
      fieldsBySection.get(f.section_id).push(f);
    }

    const projectById = new Map(projectRows.map((p) => [p.id, p]));
    const sectionById = new Map(sectionRows.map((sec) => [sec.id, sec]));

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
    const dayKeys = buildLastNDaysKeys(todayStr, 14);
    const dailyMap = new Map(dayKeys.map((k) => [k, { date: k, spend: 0, entries: 0 }]));

    let totalSpend = 0;
    let todaySpend = 0;
    let monthSpend = 0;
    const spendByProject = new Map();
    const recentEntries = [];

    for (const rec of recordRows) {
      if (rec.effective_date && dailyMap.has(rec.effective_date)) {
        dailyMap.get(rec.effective_date).entries += 1;
      }

      const spendField = spendFieldBySection.get(rec.section_id);
      const val = spendField ? evalFieldNumeric(spendField, rec.data, fieldById) : null;

      if (recentEntries.length < 5) {
        const sec = sectionById.get(rec.section_id);
        const proj = sec ? projectById.get(sec.project_id) : null;
        const secFields = fieldsBySection.get(rec.section_id) || [];
        const entryLabel = pickEntryLabel(secFields, rec.data, spendField);
        if (proj && sec) {
          recentEntries.push({
            id:             rec.id,
            date:           rec.effective_date,
            projectId:      proj.id,
            projectName:    proj.name,
            sectionId:      sec.id,
            sectionName:    sec.name,
            label:          entryLabel,
            spendFieldName: spendField?.name || '',
            amount:         val !== null ? Math.round(val * 100) / 100 : null,
          });
        }
      }

      if (val === null) continue;

      totalSpend += val;
      if (rec.effective_date === todayStr) todaySpend += val;
      if (rec.effective_date >= monthStartStr) monthSpend += val;
      if (rec.effective_date && dailyMap.has(rec.effective_date)) {
        dailyMap.get(rec.effective_date).spend += val;
      }

      const projId = projectBySection.get(rec.section_id);
      if (projId) {
        spendByProject.set(projId, (spendByProject.get(projId) || 0) + val);
      }
    }

    const spendByProjectList = projectRows
      .map((p) => ({
        id:     p.id,
        name:   p.name,
        status: p.status,
        spend:  Math.round((spendByProject.get(p.id) || 0) * 100) / 100,
      }))
      .filter((p) => p.spend > 0)
      .sort((a, b) => b.spend - a.spend);

    const dailySpend = dayKeys.map((k) => {
      const item = dailyMap.get(k);
      return {
        date:    k,
        spend:   Math.round(item.spend * 100) / 100,
        entries: item.entries,
      };
    });

    const s = statRows[0];
    const crew = crewStatRows[0] || {};
    const agr = agreementStatRows[0] || {};

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
        crew: {
          total:     crew.total ?? 0,
          active:    crew.active ?? 0,
          onLeave:   crew.on_leave ?? 0,
          inactive:  crew.inactive ?? 0,
          drivers:   crew.drivers ?? 0,
          operators: crew.operators ?? 0,
          helpers:   crew.helpers ?? 0,
          other:     crew.other ?? 0,
        },
        agreements: {
          total:        agr.total ?? 0,
          active:       agr.active ?? 0,
          pending:      agr.pending ?? 0,
          completed:    agr.completed ?? 0,
          closed:       agr.closed ?? 0,
          totalValue:   Math.round(Number(agr.total_value || 0) * 100) / 100,
          activeValue:  Math.round(Number(agr.active_value || 0) * 100) / 100,
          expiringSoon: agr.expiring_soon ?? 0,
        },
        charts: {
          dailySpend,
          spendByProject: spendByProjectList,
        },
        recentEntries,
        recentProjects: recent.map((r) => ({
          id:           r.id,
          name:         r.name,
          location:     r.location,
          client:       r.client,
          status:       r.status,
          startDate:    r.start_date ? r.start_date.toISOString().split('T')[0] : null,
          sectionCount: parseInt(r.section_count, 10),
          recordCount:  parseInt(r.record_count, 10),
          budget:       Math.round(Number(r.budget || 0) * 100) / 100,
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
