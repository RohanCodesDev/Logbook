import pool from '../db/index.js';

const formatDateOnly = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
};

const toAgreement = (row) => ({
  id:            row.id,
  title:         row.title,
  agreementType: row.agreement_type || 'subcontract',
  partyName:     row.party_name,
  partyPhone:    row.party_phone || '',
  projectId:     row.project_id ?? null,
  projectName:   row.project_name || '',
  startDate:     formatDateOnly(row.start_date),
  endDate:       formatDateOnly(row.end_date),
  contractValue: row.contract_value !== null && row.contract_value !== undefined ? Number(row.contract_value) : null,
  paymentTerms:  row.payment_terms || '',
  referenceNo:   row.reference_no || '',
  status:        row.status || 'active',
  notes:         row.notes || '',
  createdAt:     row.created_at,
  updatedAt:     row.updated_at,
});

// GET /api/agreements
export const getAllAgreements = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.name AS project_name
      FROM agreements a
      LEFT JOIN projects p ON p.id = a.project_id
      ORDER BY
        CASE a.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
        a.end_date ASC NULLS LAST,
        a.created_at DESC
    `);
    res.json({ success: true, count: rows.length, data: rows.map(toAgreement) });
  } catch (err) {
    next(err);
  }
};

// POST /api/agreements
export const createAgreement = async (req, res, next) => {
  try {
    const {
      title,
      agreementType = 'subcontract',
      partyName,
      partyPhone,
      projectId,
      startDate,
      endDate,
      contractValue,
      paymentTerms,
      referenceNo,
      status = 'active',
      notes,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Agreement title is required' });
    }
    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ success: false, message: 'Party / contractor name is required' });
    }

    const parsedValue =
      contractValue === '' || contractValue === null || contractValue === undefined
        ? null
        : Number(contractValue);
    const parsedProjectId =
      projectId === '' || projectId === null || projectId === undefined
        ? null
        : Number(projectId);

    const { rows } = await pool.query(
      `INSERT INTO agreements
         (title, agreement_type, party_name, party_phone, project_id, start_date, end_date, contract_value, payment_terms, reference_no, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        title.trim(),
        agreementType,
        partyName.trim(),
        partyPhone?.trim() || null,
        Number.isFinite(parsedProjectId) ? parsedProjectId : null,
        startDate || null,
        endDate || null,
        Number.isFinite(parsedValue) ? parsedValue : null,
        paymentTerms?.trim() || null,
        referenceNo?.trim() || null,
        status,
        notes?.trim() || null,
      ]
    );

    const { rows: joined } = await pool.query(
      `SELECT a.*, p.name AS project_name
       FROM agreements a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ success: true, data: toAgreement(joined[0]) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/agreements/:id
export const updateAgreement = async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM agreements WHERE id = $1',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Agreement not found' });
    }
    const cur = existing[0];
    const {
      title,
      agreementType,
      partyName,
      partyPhone,
      projectId,
      startDate,
      endDate,
      contractValue,
      paymentTerms,
      referenceNo,
      status,
      notes,
    } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Agreement title cannot be empty' });
    }
    if (partyName !== undefined && !String(partyName).trim()) {
      return res.status(400).json({ success: false, message: 'Party name cannot be empty' });
    }

    const nextValue =
      contractValue === undefined
        ? cur.contract_value
        : contractValue === '' || contractValue === null
          ? null
          : Number(contractValue);

    const nextProjectId =
      projectId === undefined
        ? cur.project_id
        : projectId === '' || projectId === null
          ? null
          : Number(projectId);

    const { rows } = await pool.query(
      `UPDATE agreements
       SET title          = $1,
           agreement_type = $2,
           party_name     = $3,
           party_phone    = $4,
           project_id     = $5,
           start_date     = $6,
           end_date       = $7,
           contract_value = $8,
           payment_terms  = $9,
           reference_no   = $10,
           status         = $11,
           notes          = $12
       WHERE id = $13
       RETURNING *`,
      [
        title !== undefined ? String(title).trim() : cur.title,
        agreementType ?? cur.agreement_type,
        partyName !== undefined ? String(partyName).trim() : cur.party_name,
        partyPhone !== undefined ? (partyPhone?.trim() || null) : cur.party_phone,
        nextProjectId !== null && Number.isFinite(nextProjectId) ? nextProjectId : null,
        startDate !== undefined ? (startDate || null) : cur.start_date,
        endDate !== undefined ? (endDate || null) : cur.end_date,
        nextValue !== null && Number.isFinite(nextValue) ? nextValue : null,
        paymentTerms !== undefined ? (paymentTerms?.trim() || null) : cur.payment_terms,
        referenceNo !== undefined ? (referenceNo?.trim() || null) : cur.reference_no,
        status ?? cur.status,
        notes !== undefined ? (notes?.trim() || null) : cur.notes,
        req.params.id,
      ]
    );

    const { rows: joined } = await pool.query(
      `SELECT a.*, p.name AS project_name
       FROM agreements a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.id = $1`,
      [rows[0].id]
    );

    res.json({ success: true, data: toAgreement(joined[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/agreements/:id
export const deleteAgreement = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM agreements WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Agreement not found' });
    }
    res.json({ success: true, message: 'Agreement deleted' });
  } catch (err) {
    next(err);
  }
};
