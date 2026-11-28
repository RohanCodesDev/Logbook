import pool from '../db/index.js';
import {
  evalFieldNumeric,
  pickSpendField,
  insertSectionWithFields,
  PRESET_SHEET_DEFINITIONS,
} from '../utils/spendCalculator.js';

/**
 * Maps a PostgreSQL project row into camelCase API format.
 */
const toProject = (row, loggedSpend = 0) => ({
  id:           row.id,
  name:         row.name,
  location:     row.location,
  client:       row.client,
  status:       row.status,
  description:  row.description || '',
  startDate:    row.start_date ? row.start_date.toISOString().split('T')[0] : null,
  sectionCount: row.section_count !== undefined ? parseInt(row.section_count, 10) : 0,
  recordCount:  row.record_count !== undefined ? parseInt(row.record_count, 10) : 0,
  agreementId:  row.agreement_id !== undefined && row.agreement_id !== null ? parseInt(row.agreement_id, 10) : null,
  budget:       row.budget !== undefined && row.budget !== null ? Number(row.budget) : 0,
  loggedSpend:  Math.round(Number(loggedSpend || 0) * 100) / 100,
  createdAt:    row.created_at,
  updatedAt:    row.updated_at,
});

async function computeSpendForProjects(projectIds = []) {
  if (!projectIds.length) return new Map();
  const [{ rows: sectionRows }, { rows: fieldRows }, { rows: recordRows }] = await Promise.all([
    pool.query('SELECT id, project_id FROM project_sections WHERE project_id = ANY($1::int[])', [projectIds]),
    pool.query(`
      SELECT sf.id, sf.section_id, sf.name, sf.field_type, sf.formula
      FROM section_fields sf
      JOIN project_sections ps ON ps.id = sf.section_id
      WHERE ps.project_id = ANY($1::int[])
      ORDER BY sf.sort_order ASC, sf.id ASC
    `, [projectIds]),
    pool.query(`
      SELECT sr.section_id, sr.data
      FROM section_records sr
      JOIN project_sections ps ON ps.id = sr.section_id
      WHERE ps.project_id = ANY($1::int[])
    `, [projectIds]),
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
    spendFieldBySection.set(sec.id, pickSpendField(fieldsBySection.get(sec.id) || []));
  }

  const spendByProject = new Map();
  for (const rec of recordRows) {
    const sf = spendFieldBySection.get(rec.section_id);
    if (!sf) continue;
    const val = evalFieldNumeric(sf, rec.data, fieldById);
    if (val === null) continue;
    const pid = projectBySection.get(rec.section_id);
    if (pid) spendByProject.set(pid, (spendByProject.get(pid) || 0) + val);
  }
  return spendByProject;
}

// GET /api/projects
export const getAllProjects = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        COUNT(DISTINCT ps.id) AS section_count,
        COUNT(DISTINCT sr.id) AS record_count,
        (SELECT a.id FROM agreements a WHERE a.project_id = p.id ORDER BY a.id ASC LIMIT 1) AS agreement_id,
        COALESCE((SELECT SUM(a.contract_value) FROM agreements a WHERE a.project_id = p.id AND a.status NOT IN ('terminated', 'expired')), 0) AS budget
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    const spendMap = await computeSpendForProjects(rows.map((r) => r.id));
    res.json({
      success: true,
      count: rows.length,
      data: rows.map((r) => toProject(r, spendMap.get(r.id) || 0)),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:id
export const getProjectById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        COUNT(DISTINCT ps.id) AS section_count,
        COUNT(DISTINCT sr.id) AS record_count,
        (SELECT a.id FROM agreements a WHERE a.project_id = p.id ORDER BY a.id ASC LIMIT 1) AS agreement_id,
        COALESCE((SELECT SUM(a.contract_value) FROM agreements a WHERE a.project_id = p.id AND a.status NOT IN ('terminated', 'expired')), 0) AS budget
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const spendMap = await computeSpendForProjects([rows[0].id]);
    res.json({ success: true, data: toProject(rows[0], spendMap.get(rows[0].id) || 0) });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects
export const createProject = async (req, res, next) => {
  const clientDb = await pool.connect();
  try {
    const {
      name,
      location,
      client,
      status = 'planning',
      startDate,
      description,
      contractValue,
      presetSheets = [],
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const cleanName = name.trim();
    const cleanClient = client?.trim() || null;
    const cleanLocation = location?.trim() || null;
    const cleanDesc = description?.trim() || null;
    const parsedBudget =
      contractValue === '' || contractValue === null || contractValue === undefined
        ? null
        : Number(contractValue);

    await clientDb.query('BEGIN');

    const { rows } = await clientDb.query(
      `INSERT INTO projects (name, location, client, status, start_date, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [cleanName, cleanLocation, cleanClient, status, startDate || null, cleanDesc]
    );
    const createdProject = rows[0];

    // Automatically create the respective agreement for this project
    const { rows: agrRows } = await clientDb.query(
      `INSERT INTO agreements (title, agreement_type, party_name, project_id, start_date, contract_value, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        cleanName,
        'client',
        cleanClient || '',
        createdProject.id,
        startDate || null,
        Number.isFinite(parsedBudget) ? parsedBudget : null,
        'active',
        cleanDesc,
      ]
    );

    // Optionally pre-configure selected 1-click preset sheets (Machines, Hyvas, Materials, Daily Labor, Expenses)
    let createdSectionCount = 0;
    if (Array.isArray(presetSheets)) {
      for (const presetKey of presetSheets) {
        const def = PRESET_SHEET_DEFINITIONS[presetKey];
        if (!def) continue;
        await insertSectionWithFields(clientDb, createdProject.id, {
          name: def.name,
          fields: def.fields,
          sortOrder: createdSectionCount,
        });
        createdSectionCount += 1;
      }
    }

    await clientDb.query('COMMIT');

    res.status(201).json({
      success: true,
      data: toProject({
        ...createdProject,
        section_count: createdSectionCount,
        record_count: 0,
        agreement_id: agrRows[0]?.id ?? null,
        budget: Number.isFinite(parsedBudget) ? parsedBudget : 0,
      }, 0),
    });
  } catch (err) {
    await clientDb.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    clientDb.release();
  }
};

// PUT /api/projects/:id
export const updateProject = async (req, res, next) => {
  try {
    const { name, location, client, status, startDate, description } = req.body;
    const { rows: existing } = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const cur = existing[0];
    const nextName = name !== undefined ? name.trim() : cur.name;
    const { rows } = await pool.query(
      `UPDATE projects
       SET name        = $1,
           location    = $2,
           client      = $3,
           status      = $4,
           start_date  = $5,
           description = $6
       WHERE id = $7
       RETURNING *,
         (SELECT a.id FROM agreements a WHERE a.project_id = projects.id ORDER BY a.id ASC LIMIT 1) AS agreement_id,
         COALESCE((SELECT SUM(a.contract_value) FROM agreements a WHERE a.project_id = projects.id AND a.status NOT IN ('terminated', 'expired')), 0) AS budget`,
      [
        nextName,
        location !== undefined ? (location?.trim() || null) : cur.location,
        client !== undefined ? (client?.trim() || null) : cur.client,
        status ?? cur.status,
        startDate !== undefined ? (startDate || null) : cur.start_date,
        description !== undefined ? (description?.trim() || null) : cur.description,
        req.params.id,
      ]
    );

    // Keep linked default project agreement title in sync when renamed
    if (nextName && nextName !== cur.name) {
      await pool.query(
        `UPDATE agreements SET title = $1 WHERE project_id = $2 AND title = $3`,
        [nextName, req.params.id, cur.name]
      );
    }

    const spendMap = await computeSpendForProjects([rows[0].id]);
    res.json({ success: true, data: toProject(rows[0], spendMap.get(rows[0].id) || 0) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/projects/:id
export const deleteProject = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM projects WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
};
