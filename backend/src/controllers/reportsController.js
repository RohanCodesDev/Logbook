import pool from '../db/index.js';
import { evalFieldNumeric, pickSpendField, pickEntryLabel } from '../utils/spendCalculator.js';

function isValidYmd(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
}

// GET /api/reports?range=30d|7d|all&from=YYYY-MM-DD&to=YYYY-MM-DD
export const getBusinessReport = async (req, res, next) => {
  try {
    const rangeParam = String(req.query.range || '30d').toLowerCase();
    const customFrom = isValidYmd(req.query.from) ? req.query.from.trim() : null;
    const customTo = isValidYmd(req.query.to) ? req.query.to.trim() : null;

    const [{ rows: dateRows }, { rows: projects }, { rows: sections }, { rows: fields }, { rows: records }, { rows: budgets }] =
      await Promise.all([
        pool.query(`
          SELECT
            TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')                      AS today_str,
            TO_CHAR(CURRENT_DATE - INTERVAL '6 days', 'YYYY-MM-DD')  AS d7_str,
            TO_CHAR(CURRENT_DATE - INTERVAL '29 days', 'YYYY-MM-DD') AS d30_str
        `),
        pool.query(`
          SELECT id, name, client, location, status, start_date, created_at
          FROM projects
          ORDER BY created_at DESC
        `),
        pool.query(`
          SELECT id, project_id, name, created_at
          FROM project_sections
          ORDER BY sort_order ASC, created_at ASC
        `),
        pool.query(`
          SELECT id, section_id, name, field_type, formula
          FROM section_fields
          ORDER BY sort_order ASC, id ASC
        `),
        pool.query(`
          SELECT
            id,
            section_id,
            data,
            created_at,
            updated_at,
            TO_CHAR(COALESCE(entry_date, created_at::date), 'YYYY-MM-DD') AS effective_date
          FROM section_records
          ORDER BY COALESCE(entry_date, created_at::date) DESC, created_at DESC, id DESC
        `),
        pool.query(`
          SELECT
            project_id,
            COALESCE(SUM(contract_value), 0)::numeric AS budget
          FROM agreements
          WHERE project_id IS NOT NULL AND status NOT IN ('terminated', 'expired')
          GROUP BY project_id
        `),
      ]);

    const dt = dateRows[0];
    let fromDate = null;
    let toDate = dt.today_str;
    let activePreset = rangeParam;

    if (customFrom || customTo) {
      activePreset = 'custom';
      fromDate = customFrom;
      toDate = customTo || dt.today_str;
    } else if (rangeParam === '7d') {
      fromDate = dt.d7_str;
    } else if (rangeParam === 'all') {
      fromDate = null;
      toDate = null;
    } else {
      activePreset = '30d';
      fromDate = dt.d30_str;
    }

    const fieldsBySection = new Map();
    const fieldById = new Map();
    for (const f of fields) {
      fieldById.set(f.id, f);
      if (!fieldsBySection.has(f.section_id)) fieldsBySection.set(f.section_id, []);
      fieldsBySection.get(f.section_id).push(f);
    }

    const spendFieldBySection = new Map();
    for (const sec of sections) {
      spendFieldBySection.set(sec.id, pickSpendField(fieldsBySection.get(sec.id) || []));
    }

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const budgetByProject = new Map(budgets.map((b) => [b.project_id, Number(b.budget || 0)]));

    const periodSpendByProject = new Map();
    const allSpendByProject = new Map();
    const periodEntriesByProject = new Map();
    const allEntriesByProject = new Map();
    const lastRecordByProject = new Map();

    const periodSpendBySection = new Map();
    const allSpendBySection = new Map();
    const periodEntriesBySection = new Map();
    const allEntriesBySection = new Map();
    const lastUpdatedBySection = new Map();

    const statementEntries = [];
    const activeDatesSet = new Set();
    let totalPeriodSpend = 0;
    let totalPeriodEntries = 0;

    for (const rec of records) {
      const sec = sectionMap.get(rec.section_id);
      if (!sec) continue;
      const projId = sec.project_id;
      const proj = projectMap.get(projId);
      const spendField = spendFieldBySection.get(sec.id);
      const amount = spendField ? evalFieldNumeric(spendField, rec.data, fieldById) : null;

      allEntriesByProject.set(projId, (allEntriesByProject.get(projId) || 0) + 1);
      allEntriesBySection.set(sec.id, (allEntriesBySection.get(sec.id) || 0) + 1);
      if (!lastRecordByProject.has(projId)) lastRecordByProject.set(projId, rec.created_at);
      if (!lastUpdatedBySection.has(sec.id)) lastUpdatedBySection.set(sec.id, rec.updated_at);

      if (amount !== null) {
        allSpendByProject.set(projId, (allSpendByProject.get(projId) || 0) + amount);
        allSpendBySection.set(sec.id, (allSpendBySection.get(sec.id) || 0) + amount);
      }

      const inRange =
        (!fromDate || (rec.effective_date && rec.effective_date >= fromDate)) &&
        (!toDate || (rec.effective_date && rec.effective_date <= toDate));

      if (!inRange) continue;

      totalPeriodEntries += 1;
      if (rec.effective_date) activeDatesSet.add(rec.effective_date);
      periodEntriesByProject.set(projId, (periodEntriesByProject.get(projId) || 0) + 1);
      periodEntriesBySection.set(sec.id, (periodEntriesBySection.get(sec.id) || 0) + 1);

      if (amount !== null) {
        totalPeriodSpend += amount;
        periodSpendByProject.set(projId, (periodSpendByProject.get(projId) || 0) + amount);
        periodSpendBySection.set(sec.id, (periodSpendBySection.get(sec.id) || 0) + amount);
      }

      if (proj && statementEntries.length < 250) {
        const label = pickEntryLabel(fieldsBySection.get(sec.id) || [], rec.data, spendField);
        statementEntries.push({
          id:             rec.id,
          date:           rec.effective_date,
          projectId:      proj.id,
          projectName:    proj.name,
          sectionId:      sec.id,
          sectionName:    sec.name,
          label:          label || (spendField?.name ? `${spendField.name} entry` : 'Entry'),
          amount:         amount !== null ? Math.round(amount * 100) / 100 : null,
        });
      }
    }

    let totalBudget = 0;
    const projectRowsOut = projects.map((p) => {
      const budget = Math.round((budgetByProject.get(p.id) || 0) * 100) / 100;
      totalBudget += budget;
      const projSections = sections.filter((s) => s.project_id === p.id);
      const projFields = projSections.reduce(
        (sum, s) => sum + (fieldsBySection.get(s.id)?.length || 0),
        0
      );
      return {
        id:            p.id,
        name:          p.name,
        client:        p.client,
        location:      p.location,
        status:        p.status,
        startDate:     p.start_date ? p.start_date.toISOString().split('T')[0] : null,
        budget,
        periodSpend:   Math.round((periodSpendByProject.get(p.id) || 0) * 100) / 100,
        allTimeSpend:  Math.round((allSpendByProject.get(p.id) || 0) * 100) / 100,
        periodRecords: periodEntriesByProject.get(p.id) || 0,
        sectionCount:  projSections.length,
        fieldCount:    projFields,
        recordCount:   allEntriesByProject.get(p.id) || 0,
        lastRecordAt:  lastRecordByProject.get(p.id) || null,
      };
    }).sort((a, b) => b.periodSpend - a.periodSpend || b.allTimeSpend - a.allTimeSpend);

    const sectionRowsOut = sections.map((s) => {
      const proj = projectMap.get(s.project_id);
      return {
        id:            s.id,
        projectId:     s.project_id,
        projectName:   proj?.name || '',
        sectionName:   s.name,
        fieldCount:    fieldsBySection.get(s.id)?.length || 0,
        recordCount:   allEntriesBySection.get(s.id) || 0,
        periodRecords: periodEntriesBySection.get(s.id) || 0,
        periodSpend:   Math.round((periodSpendBySection.get(s.id) || 0) * 100) / 100,
        allTimeSpend:  Math.round((allSpendBySection.get(s.id) || 0) * 100) / 100,
        lastUpdated:   lastUpdatedBySection.get(s.id) || null,
      };
    }).sort((a, b) => b.periodSpend - a.periodSpend || b.periodRecords - a.periodRecords);

    const daySpan = activePreset === '7d'
      ? 7
      : activePreset === '30d'
        ? 30
        : Math.max(activeDatesSet.size, 1);

    res.json({
      success: true,
      data: {
        range: {
          preset: activePreset,
          from:   fromDate,
          to:     toDate,
        },
        summary: {
          totalSpend:     Math.round(totalPeriodSpend * 100) / 100,
          totalBudget:    Math.round(totalBudget * 100) / 100,
          totalEntries:   totalPeriodEntries,
          activeDays:     activeDatesSet.size,
          avgDailySpend:  Math.round((totalPeriodSpend / daySpan) * 100) / 100,
          projectCount:   projects.length,
        },
        projects: projectRowsOut,
        sections: sectionRowsOut,
        entries:  statementEntries,
      },
    });
  } catch (err) {
    next(err);
  }
};
