import pool from '../db/index.js';

/**
 * Maps a PostgreSQL project row into camelCase API format.
 */
const toProject = (row) => ({
  id:           row.id,
  name:         row.name,
  location:     row.location,
  client:       row.client,
  status:       row.status,
  description:  row.description || '',
  startDate:    row.start_date ? row.start_date.toISOString().split('T')[0] : null,
  sectionCount: row.section_count !== undefined ? parseInt(row.section_count, 10) : 0,
  recordCount:  row.record_count !== undefined ? parseInt(row.record_count, 10) : 0,
  createdAt:    row.created_at,
  updatedAt:    row.updated_at,
});

// GET /api/projects
export const getAllProjects = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        COUNT(DISTINCT ps.id) AS section_count,
        COUNT(DISTINCT sr.id) AS record_count
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, count: rows.length, data: rows.map(toProject) });
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
        COUNT(DISTINCT sr.id) AS record_count
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: toProject(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects
export const createProject = async (req, res, next) => {
  try {
    const { name, location, client, status = 'planning', startDate, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO projects (name, location, client, status, start_date, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        location?.trim() || null,
        client?.trim() || null,
        status,
        startDate || null,
        description?.trim() || null,
      ]
    );
    res.status(201).json({ success: true, data: toProject(rows[0]) });
  } catch (err) {
    next(err);
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
    const { rows } = await pool.query(
      `UPDATE projects
       SET name        = $1,
           location    = $2,
           client      = $3,
           status      = $4,
           start_date  = $5,
           description = $6
       WHERE id = $7
       RETURNING *`,
      [
        name !== undefined ? name.trim() : cur.name,
        location !== undefined ? (location?.trim() || null) : cur.location,
        client !== undefined ? (client?.trim() || null) : cur.client,
        status ?? cur.status,
        startDate !== undefined ? (startDate || null) : cur.start_date,
        description !== undefined ? (description?.trim() || null) : cur.description,
        req.params.id,
      ]
    );
    res.json({ success: true, data: toProject(rows[0]) });
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
