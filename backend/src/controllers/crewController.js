import pool from '../db/index.js';
import { insertSectionWithFields } from '../utils/spendCalculator.js';

const formatDateOnly = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
};

const toCrewMember = (row) => ({
  id:             row.id,
  name:           row.name,
  role:           row.role || 'driver',
  phone:          row.phone || '',
  vehicleMachine: row.vehicle_machine || '',
  projectId:      row.project_id ?? null,
  projectName:    row.project_name || '',
  wageRate:       row.wage_rate !== null && row.wage_rate !== undefined ? Number(row.wage_rate) : null,
  wageBasis:      row.wage_basis || 'daily',
  licenseNo:      row.license_no || '',
  joiningDate:    formatDateOnly(row.joining_date),
  status:         row.status || 'active',
  notes:          row.notes || '',
  createdAt:      row.created_at,
  updatedAt:      row.updated_at,
});

// GET /api/crew
export const getAllCrew = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT cm.*, p.name AS project_name
      FROM crew_members cm
      LEFT JOIN projects p ON p.id = cm.project_id
      ORDER BY cm.id ASC
    `);
    res.json({ success: true, count: rows.length, data: rows.map(toCrewMember) });
  } catch (err) {
    next(err);
  }
};

// POST /api/crew
export const createCrewMember = async (req, res, next) => {
  try {
    const {
      name = '',
      role = 'driver',
      phone,
      vehicleMachine,
      projectId,
      wageRate,
      wageBasis = 'daily',
      licenseNo,
      joiningDate,
      status = 'active',
      notes,
    } = req.body;

    const cleanName = String(name || '').trim();
    const cleanPhone = phone?.trim() || null;
    const cleanVehicle = vehicleMachine?.trim() || null;
    const parsedProjectId =
      projectId === '' || projectId === null || projectId === undefined ? null : Number(projectId);

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Person name is required' });
    }

    const parsedRate =
      wageRate === '' || wageRate === null || wageRate === undefined ? null : Number(wageRate);

    const { rows } = await pool.query(
      `INSERT INTO crew_members
         (name, role, phone, vehicle_machine, project_id, wage_rate, wage_basis, license_no, joining_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        cleanName,
        role,
        cleanPhone,
        cleanVehicle,
        Number.isFinite(parsedProjectId) ? parsedProjectId : null,
        Number.isFinite(parsedRate) ? parsedRate : null,
        wageBasis,
        licenseNo?.trim() || null,
        joiningDate || null,
        status,
        notes?.trim() || null,
      ]
    );

    const { rows: joined } = await pool.query(
      `SELECT cm.*, p.name AS project_name
       FROM crew_members cm
       LEFT JOIN projects p ON p.id = cm.project_id
       WHERE cm.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ success: true, data: toCrewMember(joined[0]) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/crew/:id
export const updateCrewMember = async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM crew_members WHERE id = $1',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Crew member not found' });
    }
    const cur = existing[0];
    const {
      name,
      role,
      phone,
      vehicleMachine,
      projectId,
      wageRate,
      wageBasis,
      licenseNo,
      joiningDate,
      status,
      notes,
    } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Person name cannot be empty' });
    }

    const nextRate =
      wageRate === undefined
        ? cur.wage_rate
        : wageRate === '' || wageRate === null
          ? null
          : Number(wageRate);

    const nextProjectId =
      projectId === undefined
        ? cur.project_id
        : projectId === '' || projectId === null
          ? null
          : Number(projectId);

    const { rows } = await pool.query(
      `UPDATE crew_members
       SET name            = $1,
           role            = $2,
           phone           = $3,
           vehicle_machine = $4,
           project_id      = $5,
           wage_rate       = $6,
           wage_basis      = $7,
           license_no      = $8,
           joining_date    = $9,
           status          = $10,
           notes           = $11
       WHERE id = $12
       RETURNING *`,
      [
        name !== undefined ? String(name || '').trim() : (cur.name || ''),
        role ?? cur.role,
        phone !== undefined ? (phone?.trim() || null) : cur.phone,
        vehicleMachine !== undefined ? (vehicleMachine?.trim() || null) : cur.vehicle_machine,
        nextProjectId !== null && Number.isFinite(nextProjectId) ? nextProjectId : null,
        nextRate !== null && Number.isFinite(nextRate) ? nextRate : null,
        wageBasis ?? cur.wage_basis,
        licenseNo !== undefined ? (licenseNo?.trim() || null) : cur.license_no,
        joiningDate !== undefined ? (joiningDate || null) : cur.joining_date,
        status ?? cur.status,
        notes !== undefined ? (notes?.trim() || null) : cur.notes,
        req.params.id,
      ]
    );

    const { rows: joined } = await pool.query(
      `SELECT cm.*, p.name AS project_name
       FROM crew_members cm
       LEFT JOIN projects p ON p.id = cm.project_id
       WHERE cm.id = $1`,
      [rows[0].id]
    );

    res.json({ success: true, data: toCrewMember(joined[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/crew/:id
export const deleteCrewMember = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM crew_members WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Crew member not found' });
    }
    res.json({ success: true, message: 'Crew member deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/crew/log-wages — auto-post crew daily rates as project spend entries
export const logCrewWagesToSpend = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { memberIds = [], entryDate = null, days = 1 } = req.body;
    const numDays = Number(days) > 0 ? Number(days) : 1;
    const cleanDate =
      entryDate && /^\d{4}-\d{2}-\d{2}$/.test(String(entryDate).trim())
        ? String(entryDate).trim()
        : null;

    const query = Array.isArray(memberIds) && memberIds.length > 0
      ? `SELECT cm.*, p.name AS project_name
         FROM crew_members cm
         LEFT JOIN projects p ON p.id = cm.project_id
         WHERE cm.id = ANY($1::int[])`
      : `SELECT cm.*, p.name AS project_name
         FROM crew_members cm
         LEFT JOIN projects p ON p.id = cm.project_id
         WHERE cm.project_id IS NOT NULL AND cm.wage_rate IS NOT NULL AND cm.wage_rate > 0`;

    const { rows: members } = await client.query(
      query,
      Array.isArray(memberIds) && memberIds.length > 0 ? [memberIds.map(Number).filter(Number.isFinite)] : []
    );

    const eligible = members.filter(
      (m) => m.project_id && m.wage_rate !== null && Number(m.wage_rate) > 0
    );

    if (!eligible.length) {
      return res.status(400).json({
        success: false,
        message: 'Selected crew members need both a Project and a Daily Rate (> ₹0) to log spend.',
      });
    }

    await client.query('BEGIN');

    // Cache or find/create Labour/Wages section per project
    const sectionCache = new Map();
    const posted = [];
    let totalPostedAmount = 0;

    for (const m of eligible) {
      let target = sectionCache.get(m.project_id);
      if (!target) {
        const { rows: secRows } = await client.query(
          `SELECT * FROM project_sections
           WHERE project_id = $1 AND name ~* '\\m(labou?r|wages?|workforce|crew)\\M'
           ORDER BY sort_order ASC, id ASC
           LIMIT 1`,
          [m.project_id]
        );

        let secRow = secRows[0];
        let secFields = [];

        if (secRow) {
          const { rows: fRows } = await client.query(
            'SELECT * FROM section_fields WHERE section_id = $1 ORDER BY sort_order ASC, id ASC',
            [secRow.id]
          );
          secFields = fRows.map((f) => ({
            id: f.id,
            name: f.name,
            fieldType: f.field_type,
            formula: f.formula,
          }));
        } else {
          const created = await insertSectionWithFields(client, m.project_id, {
            name: 'Daily Labor',
            fields: [
              { name: 'Worker / Team', fieldType: 'text', isRequired: true },
              { name: 'Days / Count', fieldType: 'number' },
              { name: 'Wage Rate', fieldType: 'currency' },
              {
                name: 'Total',
                fieldType: 'formula',
                formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' },
              },
              { name: 'Vehicle / Role', fieldType: 'text' },
            ],
          });
          secRow = created.section;
          secFields = created.fields;
        }

        const workerField =
          secFields.find((f) => /\b(worker|team|person|name|operator|driver)\b/i.test(f.name) && f.fieldType === 'text') ||
          secFields.find((f) => f.fieldType === 'text');
        const countField = secFields.find((f) => /\b(day|count|qty|hours|shift)\b/i.test(f.name) && f.fieldType === 'number');
        const rateField =
          secFields.find((f) => /\b(wage|rate|salary|amount)\b/i.test(f.name) && (f.fieldType === 'currency' || f.fieldType === 'number')) ||
          secFields.find((f) => f.fieldType === 'currency');
        const noteField = secFields.find(
          (f) => f.id !== workerField?.id && /\b(vehicle|work|note|role|machine)\b/i.test(f.name) && f.fieldType === 'text'
        );

        target = { section: secRow, workerField, countField, rateField, noteField };
        sectionCache.set(m.project_id, target);
      }

      const rateNum = Number(m.wage_rate);
      const data = {};
      if (target.workerField) data[String(target.workerField.id)] = m.name || 'Crew';
      if (target.countField) data[String(target.countField.id)] = numDays;
      if (target.rateField) {
        data[String(target.rateField.id)] = target.countField ? rateNum : rateNum * numDays;
      }
      if (target.noteField && m.vehicle_machine) {
        data[String(target.noteField.id)] = m.vehicle_machine;
      }

      const { rows: recRows } = await client.query(
        `INSERT INTO section_records (section_id, entry_date, data)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3::jsonb)
         RETURNING id, section_id, TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date_str`,
        [target.section.id, cleanDate, JSON.stringify(data)]
      );

      const lineAmount = Math.round(rateNum * numDays * 100) / 100;
      totalPostedAmount += lineAmount;
      posted.push({
        memberId: m.id,
        memberName: m.name,
        projectId: m.project_id,
        projectName: m.project_name || '',
        sectionId: target.section.id,
        sectionName: target.section.name,
        recordId: recRows[0].id,
        amount: lineAmount,
      });
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: {
        count: posted.length,
        totalAmount: Math.round(totalPostedAmount * 100) / 100,
        posted,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};
