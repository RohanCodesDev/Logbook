import pool from '../db/index.js';

const toRecord = (row) => ({
  id:        row.id,
  sectionId: row.section_id,
  entryDate: row.entry_date_str || null,
  data:      row.data || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function sanitizeEntryDate(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

// GET /api/sections/:sectionId/records
export const getRecordsBySection = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date_str
       FROM section_records
       WHERE section_id = $1
       ORDER BY COALESCE(entry_date, created_at::date) DESC, created_at ASC, id ASC`,
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
    const { data, entryDate } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Record data object is required' });
    }

    const cleanDate = sanitizeEntryDate(entryDate);

    const { rows } = await pool.query(
      `INSERT INTO section_records (section_id, entry_date, data)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3::jsonb)
       RETURNING *, TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date_str`,
      [sectionId, cleanDate, JSON.stringify(data)]
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
    const { data, entryDate } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Record data object is required' });
    }

    const cleanDate = sanitizeEntryDate(entryDate);

    const { rows } = await pool.query(
      `UPDATE section_records
       SET data       = $1::jsonb,
           entry_date = COALESCE($2::date, entry_date, created_at::date)
       WHERE id = $3
       RETURNING *, TO_CHAR(COALESCE(entry_date, created_at::date), 'YYYY-MM-DD') AS entry_date_str`,
      [JSON.stringify(data), cleanDate, recordId]
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
