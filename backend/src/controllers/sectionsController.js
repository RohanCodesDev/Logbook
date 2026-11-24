import pool from '../db/index.js';

const toField = (row) => ({
  id:         row.id,
  sectionId:  row.section_id,
  name:       row.name,
  fieldType:  row.field_type,
  options:    Array.isArray(row.options) ? row.options : [],
  isRequired: row.is_required,
  sortOrder:  row.sort_order,
  createdAt:  row.created_at,
});

const toSection = (row, fields = [], recordCount = 0) => ({
  id:          row.id,
  projectId:   row.project_id,
  name:        row.name,
  description: row.description || '',
  icon:        row.icon || 'folder',
  sortOrder:   row.sort_order,
  fields,
  recordCount,
  createdAt:   row.created_at,
  updatedAt:   row.updated_at,
});

// GET /api/projects/:projectId/sections
export const getSectionsByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const { rows: sections } = await pool.query(
      `SELECT ps.*, COUNT(sr.id)::int AS record_count
       FROM project_sections ps
       LEFT JOIN section_records sr ON sr.section_id = ps.id
       WHERE ps.project_id = $1
       GROUP BY ps.id
       ORDER BY ps.sort_order ASC, ps.created_at ASC`,
      [projectId]
    );

    if (!sections.length) {
      return res.json({ success: true, data: [] });
    }

    const sectionIds = sections.map((s) => s.id);
    const { rows: allFields } = await pool.query(
      `SELECT * FROM section_fields
       WHERE section_id = ANY($1::int[])
       ORDER BY sort_order ASC, id ASC`,
      [sectionIds]
    );

    const fieldsBySection = {};
    for (const f of allFields) {
      if (!fieldsBySection[f.section_id]) fieldsBySection[f.section_id] = [];
      fieldsBySection[f.section_id].push(toField(f));
    }

    const result = sections.map((sec) =>
      toSection(sec, fieldsBySection[sec.id] || [], sec.record_count)
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects/:projectId/sections
export const createSection = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { name, description, icon = 'folder', fields = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Section name is required' });
    }

    await client.query('BEGIN');

    // Determine next sort order
    const { rows: orderRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM project_sections WHERE project_id = $1',
      [projectId]
    );
    const nextOrder = orderRows[0].next_order;

    const { rows: secRows } = await client.query(
      `INSERT INTO project_sections (project_id, name, description, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, name.trim(), description?.trim() || null, icon, nextOrder]
    );
    const section = secRows[0];

    // Insert initial custom fields if provided (e.g., from a template)
    const createdFields = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.name || !f.name.trim()) continue;
      const { rows: fRows } = await client.query(
        `INSERT INTO section_fields (section_id, name, field_type, options, is_required, sort_order)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         RETURNING *`,
        [
          section.id,
          f.name.trim(),
          f.fieldType || 'text',
          JSON.stringify(Array.isArray(f.options) ? f.options : []),
          Boolean(f.isRequired),
          i,
        ]
      );
      createdFields.push(toField(fRows[0]));
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: toSection(section, createdFields, 0) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PUT /api/sections/:sectionId
export const updateSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { name, description, icon } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM project_sections WHERE id = $1',
      [sectionId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const cur = existing[0];
    const { rows } = await pool.query(
      `UPDATE project_sections
       SET name        = $1,
           description = $2,
           icon        = $3
       WHERE id = $4
       RETURNING *`,
      [
        name !== undefined ? name.trim() : cur.name,
        description !== undefined ? (description?.trim() || null) : cur.description,
        icon ?? cur.icon,
        sectionId,
      ]
    );

    res.json({ success: true, data: toSection(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sections/:sectionId
export const deleteSection = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM project_sections WHERE id = $1',
      [req.params.sectionId]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (err) {
    next(err);
  }
};
