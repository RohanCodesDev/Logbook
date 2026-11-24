import pool from '../db/index.js';

const VALID_TYPES = ['text', 'number', 'currency', 'date', 'select', 'textarea', 'checkbox'];

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

// POST /api/sections/:sectionId/fields
export const createField = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { name, fieldType = 'text', options = [], isRequired = false } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Field name is required' });
    }
    if (!VALID_TYPES.includes(fieldType)) {
      return res.status(400).json({ success: false, message: 'Invalid field type' });
    }

    const { rows: orderRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM section_fields WHERE section_id = $1',
      [sectionId]
    );

    const cleanOptions = fieldType === 'select' && Array.isArray(options)
      ? options.map((o) => String(o).trim()).filter(Boolean)
      : [];

    const { rows } = await pool.query(
      `INSERT INTO section_fields (section_id, name, field_type, options, is_required, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        sectionId,
        name.trim(),
        fieldType,
        JSON.stringify(cleanOptions),
        Boolean(isRequired),
        orderRows[0].next_order,
      ]
    );

    res.status(201).json({ success: true, data: toField(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/fields/:fieldId
export const updateField = async (req, res, next) => {
  try {
    const { fieldId } = req.params;
    const { name, fieldType, options, isRequired } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM section_fields WHERE id = $1',
      [fieldId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    const cur = existing[0];
    const nextType = fieldType && VALID_TYPES.includes(fieldType) ? fieldType : cur.field_type;
    const nextOptions = options !== undefined
      ? (nextType === 'select' && Array.isArray(options)
          ? options.map((o) => String(o).trim()).filter(Boolean)
          : [])
      : cur.options;

    const { rows } = await pool.query(
      `UPDATE section_fields
       SET name        = $1,
           field_type  = $2,
           options     = $3::jsonb,
           is_required = $4
       WHERE id = $5
       RETURNING *`,
      [
        name !== undefined ? name.trim() : cur.name,
        nextType,
        JSON.stringify(nextOptions),
        isRequired !== undefined ? Boolean(isRequired) : cur.is_required,
        fieldId,
      ]
    );

    res.json({ success: true, data: toField(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/fields/:fieldId
export const deleteField = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM section_fields WHERE id = $1',
      [req.params.fieldId]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }
    res.json({ success: true, message: 'Field removed successfully' });
  } catch (err) {
    next(err);
  }
};
