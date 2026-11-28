import { Router } from 'express';
import pool from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM projects)         AS projects,
        (SELECT COUNT(*)::int FROM project_sections) AS sections,
        (SELECT COUNT(*)::int FROM section_fields)   AS fields,
        (SELECT COUNT(*)::int FROM section_records)  AS records,
        (SELECT COUNT(*)::int FROM crew_members)          AS crew,
        (SELECT COUNT(*)::int FROM agreements)            AS agreements,
        (SELECT COUNT(*)::int FROM agreement_attachments) AS agreement_attachments
    `);

    res.json({
      status: 'ok',
      message: 'Backend API & Neon PostgreSQL connected',
      database: {
        connected: true,
        provider: 'Neon PostgreSQL',
        latencyMs,
        counts: rows[0],
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      port: process.env.PORT || 5000,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      database: { connected: false },
    });
  }
});

export default router;
