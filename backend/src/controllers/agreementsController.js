import pool from '../db/index.js';

const formatDateOnly = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
};

const toAgreement = (row) => ({
  id:              row.id,
  title:           row.title,
  agreementType:   row.agreement_type || 'subcontract',
  partyName:       row.party_name || '',
  partyPhone:      row.party_phone || '',
  projectId:       row.project_id ?? null,
  projectName:     row.project_name || '',
  projectLocation: row.project_location || '',
  projectStatus:   row.project_status || '',
  startDate:       formatDateOnly(row.start_date),
  endDate:         formatDateOnly(row.end_date),
  contractValue:   row.contract_value !== null && row.contract_value !== undefined ? Number(row.contract_value) : null,
  paymentTerms:    row.payment_terms || '',
  referenceNo:     row.reference_no || '',
  status:          row.status || 'active',
  notes:           row.notes || '',
  clauses:         row.clauses || '',
  attachmentCount: row.attachment_count !== undefined ? parseInt(row.attachment_count, 10) : 0,
  createdAt:       row.created_at,
  updatedAt:       row.updated_at,
});

const toAttachment = (row) => ({
  id:          row.id,
  agreementId: row.agreement_id,
  fileName:    row.file_name,
  mimeType:    row.mime_type,
  caption:     row.caption || '',
  dataUrl:     row.data_url,
  fileSize:    row.file_size ?? 0,
  source:      row.source || 'upload',
  sortOrder:   row.sort_order ?? 0,
  createdAt:   row.created_at,
});

const AGREEMENT_SELECT = `
  SELECT
    a.*,
    p.name     AS project_name,
    p.location AS project_location,
    p.status   AS project_status,
    (SELECT COUNT(*)::int FROM agreement_attachments aa WHERE aa.agreement_id = a.id) AS attachment_count
  FROM agreements a
  LEFT JOIN projects p ON p.id = a.project_id
`;

// GET /api/agreements
export const getAllAgreements = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      ${AGREEMENT_SELECT}
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

// GET /api/agreements/:id
export const getAgreementById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${AGREEMENT_SELECT} WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Agreement not found' });
    }

    const { rows: attachmentRows } = await pool.query(
      `SELECT * FROM agreement_attachments
       WHERE agreement_id = $1
       ORDER BY sort_order ASC, id DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...toAgreement(rows[0]),
        attachments: attachmentRows.map(toAttachment),
      },
    });
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
      partyName = '',
      partyPhone,
      projectId,
      startDate,
      endDate,
      contractValue,
      paymentTerms,
      referenceNo,
      status = 'active',
      notes,
      clauses,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Agreement title is required' });
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
         (title, agreement_type, party_name, party_phone, project_id, start_date, end_date, contract_value, payment_terms, reference_no, status, notes, clauses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title.trim(),
        agreementType,
        String(partyName || '').trim(),
        partyPhone?.trim() || null,
        Number.isFinite(parsedProjectId) ? parsedProjectId : null,
        startDate || null,
        endDate || null,
        Number.isFinite(parsedValue) ? parsedValue : null,
        paymentTerms?.trim() || null,
        referenceNo?.trim() || null,
        status,
        notes?.trim() || null,
        clauses?.trim() || null,
      ]
    );

    const { rows: joined } = await pool.query(
      `${AGREEMENT_SELECT} WHERE a.id = $1`,
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
      clauses,
    } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Agreement title cannot be empty' });
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
           notes          = $12,
           clauses        = $13
       WHERE id = $14
       RETURNING *`,
      [
        title !== undefined ? String(title).trim() : cur.title,
        agreementType ?? cur.agreement_type,
        partyName !== undefined ? String(partyName || '').trim() : (cur.party_name || ''),
        partyPhone !== undefined ? (partyPhone?.trim() || null) : cur.party_phone,
        nextProjectId !== null && Number.isFinite(nextProjectId) ? nextProjectId : null,
        startDate !== undefined ? (startDate || null) : cur.start_date,
        endDate !== undefined ? (endDate || null) : cur.end_date,
        nextValue !== null && Number.isFinite(nextValue) ? nextValue : null,
        paymentTerms !== undefined ? (paymentTerms?.trim() || null) : cur.payment_terms,
        referenceNo !== undefined ? (referenceNo?.trim() || null) : cur.reference_no,
        status ?? cur.status,
        notes !== undefined ? (notes?.trim() || null) : cur.notes,
        clauses !== undefined ? (clauses?.trim() || null) : cur.clauses,
        req.params.id,
      ]
    );

    const { rows: joined } = await pool.query(
      `${AGREEMENT_SELECT} WHERE a.id = $1`,
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

// POST /api/agreements/:id/attachments
export const addAgreementAttachments = async (req, res, next) => {
  try {
    const { rows: exists } = await pool.query(
      'SELECT id FROM agreements WHERE id = $1',
      [req.params.id]
    );
    if (!exists.length) {
      return res.status(404).json({ success: false, message: 'Agreement not found' });
    }

    const rawItems = Array.isArray(req.body?.attachments)
      ? req.body.attachments
      : [req.body];

    const validItems = rawItems.filter(
      (item) => item && typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:image/')
    );

    if (!validItems.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid image attachment is required',
      });
    }

    const inserted = [];
    for (const item of validItems) {
      const { rows } = await pool.query(
        `INSERT INTO agreement_attachments
           (agreement_id, file_name, mime_type, caption, data_url, file_size, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.params.id,
          (item.fileName || 'agreement-photo.jpg').slice(0, 255),
          (item.mimeType || 'image/jpeg').slice(0, 100),
          item.caption?.trim() || null,
          item.dataUrl,
          Number.isFinite(Number(item.fileSize)) ? Math.round(Number(item.fileSize)) : item.dataUrl.length,
          item.source === 'camera' ? 'camera' : 'upload',
        ]
      );
      inserted.push(toAttachment(rows[0]));
    }

    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    next(err);
  }
};

// PUT /api/agreements/:id/attachments/:attachmentId
export const updateAgreementAttachment = async (req, res, next) => {
  try {
    const { caption } = req.body;
    const { rows } = await pool.query(
      `UPDATE agreement_attachments
       SET caption = $1
       WHERE id = $2 AND agreement_id = $3
       RETURNING *`,
      [caption?.trim() || null, req.params.attachmentId, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    res.json({ success: true, data: toAttachment(rows[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/agreements/:id/attachments/:attachmentId
export const deleteAgreementAttachment = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM agreement_attachments WHERE id = $1 AND agreement_id = $2',
      [req.params.attachmentId, req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    res.json({ success: true, message: 'Attachment deleted' });
  } catch (err) {
    next(err);
  }
};
