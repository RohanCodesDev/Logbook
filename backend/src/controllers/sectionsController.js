import pool from '../db/index.js';
import { toField } from './fieldsController.js';
import { insertSectionWithFields } from '../utils/spendCalculator.js';

const FLEET_SHEET_RE = /\b(machines?|machinery|equipments?|hyvas?|tippers?|dumpers?|vehicles?|trucks?|excavators?|loaders?|cranes?|rollers?|jcb|fleet)\b/i;
const MODEL_FIELD_RE = /\b(model|machine|hyva|vehicle|equipment|tipper|dumper|truck)\b/i;

const toSection = (row, fields = [], recordCount = 0, modelCount = null) => ({
  id:          row.id,
  projectId:   row.project_id,
  name:        row.name,
  description: row.description || '',
  icon:        row.icon || 'folder',
  models:      Array.isArray(row.models) ? row.models : [],
  sortOrder:   row.sort_order,
  fields,
  recordCount,
  modelCount:  modelCount !== null ? modelCount : (Array.isArray(row.models) ? row.models.length : 0),
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

    // Compute distinct machine/hyva model count for fleet sheets
    const fleetSectionIds = sections
      .filter((sec) => {
        const secFields = fieldsBySection[sec.id] || [];
        const hasModelField = secFields.some(
          (f) => (f.fieldType === 'text' || f.fieldType === 'select') && MODEL_FIELD_RE.test(f.name || '')
        );
        return FLEET_SHEET_RE.test(sec.name || '') || (Array.isArray(sec.models) && sec.models.length > 0) || hasModelField;
      })
      .map((s) => s.id);

    const recordsBySection = {};
    if (fleetSectionIds.length > 0) {
      const { rows: fleetRecords } = await pool.query(
        `SELECT section_id, data FROM section_records WHERE section_id = ANY($1::int[])`,
        [fleetSectionIds]
      );
      for (const r of fleetRecords) {
        if (!recordsBySection[r.section_id]) recordsBySection[r.section_id] = [];
        recordsBySection[r.section_id].push(r.data || {});
      }
    }

    const result = sections.map((sec) => {
      const secFields = fieldsBySection[sec.id] || [];
      const modelSet = new Set(
        (Array.isArray(sec.models) ? sec.models : [])
          .map((m) => String(m || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const modelField = secFields.find(
        (f) => (f.fieldType === 'text' || f.fieldType === 'select') && MODEL_FIELD_RE.test(f.name || '')
      );
      if (modelField && Array.isArray(modelField.options)) {
        modelField.options.forEach((opt) => {
          const clean = String(opt || '').trim().toLowerCase();
          if (clean) modelSet.add(clean);
        });
      }
      (recordsBySection[sec.id] || []).forEach((d) => {
        const raw = modelField ? d[String(modelField.id)] : d.__model;
        const clean = raw !== undefined && raw !== null ? String(raw).trim().toLowerCase() : '';
        if (clean) modelSet.add(clean);
      });
      return toSection(sec, secFields, sec.record_count, modelSet.size);
    });

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
    const { name, description, icon = 'folder', fields = [], models = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Section name is required' });
    }

    await client.query('BEGIN');

    const { section, fields: createdFields } = await insertSectionWithFields(client, projectId, {
      name,
      description,
      icon,
      models,
      fields,
    });

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
    const { name, description, icon, models } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM project_sections WHERE id = $1',
      [sectionId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const cur = existing[0];
    const nextModels =
      models !== undefined && Array.isArray(models)
        ? Array.from(new Set(models.map((m) => String(m || '').trim()).filter(Boolean)))
        : (Array.isArray(cur.models) ? cur.models : []);

    const { rows } = await pool.query(
      `UPDATE project_sections
       SET name        = $1,
           description = $2,
           icon        = $3,
           models      = $4::jsonb
       WHERE id = $5
       RETURNING *`,
      [
        name !== undefined ? name.trim() : cur.name,
        description !== undefined ? (description?.trim() || null) : cur.description,
        icon ?? cur.icon,
        JSON.stringify(nextModels),
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
