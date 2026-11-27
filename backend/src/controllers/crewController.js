import pool from '../db/index.js';

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
      ORDER BY
        CASE cm.status WHEN 'active' THEN 0 WHEN 'on_leave' THEN 1 ELSE 2 END,
        cm.created_at DESC
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
      name,
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

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const parsedRate =
      wageRate === '' || wageRate === null || wageRate === undefined ? null : Number(wageRate);
    const parsedProjectId =
      projectId === '' || projectId === null || projectId === undefined ? null : Number(projectId);

    const { rows } = await pool.query(
      `INSERT INTO crew_members
         (name, role, phone, vehicle_machine, project_id, wage_rate, wage_basis, license_no, joining_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        name.trim(),
        role,
        phone?.trim() || null,
        vehicleMachine?.trim() || null,
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
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
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
        name !== undefined ? String(name).trim() : cur.name,
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
