import pool from '../db/index.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    // Aggregate project stats
    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'active')                         AS active,
        COUNT(*) FILTER (WHERE status = 'planning')                       AS planning,
        COUNT(*) FILTER (WHERE status = 'paused')                         AS paused,
        COUNT(*) FILTER (WHERE status = 'completed')                      AS completed,
        COUNT(*) FILTER (WHERE status = 'archived')                       AS archived,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')  AS new_this_month
      FROM projects
    `);

    // Aggregate workspace totals (sections & records)
    const { rows: workspaceRows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM project_sections) AS total_sections,
        (SELECT COUNT(*) FROM section_fields)   AS total_fields,
        (SELECT COUNT(*) FROM section_records)  AS total_records
    `);

    // Recent 5 updated projects with their section & record counts
    const { rows: recent } = await pool.query(`
      SELECT
        p.id, p.name, p.location, p.client, p.status, p.start_date, p.created_at, p.updated_at,
        COUNT(DISTINCT ps.id) AS section_count,
        COUNT(DISTINCT sr.id) AS record_count
      FROM projects p
      LEFT JOIN project_sections ps ON ps.project_id = p.id
      LEFT JOIN section_records sr  ON sr.section_id = ps.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 5
    `);

    const s = statRows[0];
    const w = workspaceRows[0];

    res.json({
      success: true,
      data: {
        stats: {
          total:         parseInt(s.total, 10),
          active:        parseInt(s.active, 10),
          planning:      parseInt(s.planning, 10),
          paused:        parseInt(s.paused, 10),
          completed:     parseInt(s.completed, 10),
          archived:      parseInt(s.archived, 10),
          newThisMonth:  parseInt(s.new_this_month, 10),
          totalSections: parseInt(w.total_sections, 10),
          totalFields:   parseInt(w.total_fields, 10),
          totalRecords:  parseInt(w.total_records, 10),
        },
        recentProjects: recent.map((r) => ({
          id:           r.id,
          name:         r.name,
          location:     r.location,
          client:       r.client,
          status:       r.status,
          startDate:    r.start_date ? r.start_date.toISOString().split('T')[0] : null,
          sectionCount: parseInt(r.section_count, 10),
          recordCount:  parseInt(r.record_count, 10),
          createdAt:    r.created_at,
          updatedAt:    r.updated_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
