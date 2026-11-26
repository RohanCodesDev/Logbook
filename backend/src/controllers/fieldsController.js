import pool from '../db/index.js';

const VALID_TYPES = ['text', 'number', 'currency', 'date', 'select', 'textarea', 'checkbox', 'formula'];
const VALID_OPERATORS = ['add', 'sub', 'mul', 'div'];
const VALID_FORMATS = ['currency', 'number'];

export const toField = (row) => ({
  id:         row.id,
  sectionId:  row.section_id,
  name:       row.name,
  fieldType:  row.field_type,
  options:    Array.isArray(row.options) ? row.options : [],
  formula:    row.formula || null,
  isRequired: row.is_required,
  sortOrder:  row.sort_order,
  createdAt:  row.created_at,
});

function sanitizeFormula(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const leftFieldId = Number(raw.leftFieldId);
  const rightFieldId = Number(raw.rightFieldId);
  if (!Number.isInteger(leftFieldId) || !Number.isInteger(rightFieldId)) return null;
  const operator = VALID_OPERATORS.includes(raw.operator) ? raw.operator : 'mul';
  const format = VALID_FORMATS.includes(raw.format) ? raw.format : 'currency';
  return { leftFieldId, operator, rightFieldId, format };
}

// POST /api/sections/:sectionId/fields
export const createField = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { name, fieldType = 'text', options = [], formula = null, isRequired = false } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Field name is required' });
    }
    if (!VALID_TYPES.includes(fieldType)) {
      return res.status(400).json({ success: false, message: 'Invalid field type' });
    }

    const cleanFormula = fieldType === 'formula' ? sanitizeFormula(formula) : null;
    if (fieldType === 'formula' && !cleanFormula) {
      return res.status(400).json({ success: false, message: 'Select two valid columns for a formula field' });
    }

    const { rows: orderRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM section_fields WHERE section_id = $1',
      [sectionId]
    );

    const cleanOptions = fieldType === 'select' && Array.isArray(options)
      ? options.map((o) => String(o).trim()).filter(Boolean)
      : [];

    const { rows } = await pool.query(
      `INSERT INTO section_fields (section_id, name, field_type, options, formula, is_required, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        sectionId,
        name.trim(),
        fieldType,
        JSON.stringify(cleanOptions),
        cleanFormula ? JSON.stringify(cleanFormula) : null,
        fieldType === 'formula' ? false : Boolean(isRequired),
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
    const { name, fieldType, options, formula, isRequired } = req.body;

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
      : (nextType === 'select' ? cur.options : []);

    let nextFormula = cur.formula;
    if (nextType !== 'formula') {
      nextFormula = null;
    } else if (formula !== undefined) {
      nextFormula = sanitizeFormula(formula);
      if (!nextFormula) {
        return res.status(400).json({ success: false, message: 'Select two valid columns for a formula field' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE section_fields
       SET name        = $1,
           field_type  = $2,
           options     = $3::jsonb,
           formula     = $4::jsonb,
           is_required = $5
       WHERE id = $6
       RETURNING *`,
      [
        name !== undefined ? name.trim() : cur.name,
        nextType,
        JSON.stringify(nextOptions),
        nextFormula ? JSON.stringify(nextFormula) : null,
        nextType === 'formula' ? false : (isRequired !== undefined ? Boolean(isRequired) : cur.is_required),
        fieldId,
      ]
    );

    res.json({ success: true, data: toField(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sections/:sectionId/fields/reorder
export const reorderFields = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { sectionId } = req.params;
    const { fieldIds } = req.body;

    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      return res.status(400).json({ success: false, message: 'fieldIds array is required' });
    }

    await client.query('BEGIN');
    for (let i = 0; i < fieldIds.length; i++) {
      await client.query(
        'UPDATE section_fields SET sort_order = $1 WHERE id = $2 AND section_id = $3',
        [i, Number(fieldIds[i]), sectionId]
      );
    }
    const { rows } = await client.query(
      'SELECT * FROM section_fields WHERE section_id = $1 ORDER BY sort_order ASC, id ASC',
      [sectionId]
    );
    await client.query('COMMIT');

    res.json({ success: true, data: rows.map(toField) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
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
