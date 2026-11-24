import pool from '../db/index.js';

// GET /api/reports
export const getBusinessReport = async (req, res, next) => {
  try {
    const { rows: projectSummaries } = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.client,
        p.location,
        p.status,
        p.start_date,
        COUNT(DISTINCT ps.id)::int AS section_count,
        COUNT(DISTINCT sf.id)::int AS field_count,
        COUNT(DISTINCT sr.id)::int AS record_count,
        MAX(sr.created_at)         AS last_record_at
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_fields sf   ON sf.section_id = ps.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    const { rows: sectionDetails } = await pool.query(`
      SELECT
        ps.id,
        ps.project_id,
        p.name                     AS project_name,
        ps.name                    AS section_name,
        COUNT(DISTINCT sf.id)::int AS field_count,
        COUNT(DISTINCT sr.id)::int AS record_count,
        MAX(sr.updated_at)         AS last_updated
      FROM project_sections ps
      JOIN projects p             ON p.id = ps.project_id
      LEFT JOIN section_fields sf ON sf.section_id = ps.id
      LEFT JOIN section_records sr ON sr.section_id = ps.id
      GROUP BY ps.id, p.name
      ORDER BY record_count DESC, ps.created_at DESC
    `);

    res.json({
      success: true,
      data: {
        projects: projectSummaries.map((r) => ({
          id:           r.id,
          name:         r.name,
          client:       r.client,
          location:     r.location,
          status:       r.status,
          startDate:    r.start_date ? r.start_date.toISOString().split('T')[0] : null,
          sectionCount: r.section_count,
          fieldCount:   r.field_count,
          recordCount:  r.record_count,
          lastRecordAt: r.last_record_at,
        })),
        sections: sectionDetails.map((s) => ({
          id:          s.id,
          projectId:   s.project_id,
          projectName: s.project_name,
          sectionName: s.section_name,
          fieldCount:  s.field_count,
          recordCount: s.record_count,
          lastUpdated: s.last_updated,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
