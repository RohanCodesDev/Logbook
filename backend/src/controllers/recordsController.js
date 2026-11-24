import pool from '../db/index.js';

const toRecord = (row) => ({
  id:        row.id,
  sectionId: row.section_id,
  data:      row.data || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// GET /api/sections/:sectionId/records
export const getRecordsBySection = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM section_records
       WHERE section_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.params.sectionId]
    );
    res.json({ success: true, count: rows.length, data: rows.map(toRecord) });
  } catch (err) {
    next(err);
  }
};

// POST /api/sections/:sectionId/records
export const createRecord = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Record data object is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO section_records (section_id, data)
       VALUES ($1, $2::jsonb)
       RETURNING *`,
      [sectionId, JSON.stringify(data)]
    );

    res.status(201).json({ success: true, data: toRecord(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/records/:recordId
export const updateRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Record data object is required' });
    }

    const { rows } = await pool.query(
      `UPDATE section_records
       SET data = $1::jsonb
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(data), recordId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, data: toRecord(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/records/:recordId
export const deleteRecord = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM section_records WHERE id = $1',
      [req.params.recordId]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    next(err);
  }
};
