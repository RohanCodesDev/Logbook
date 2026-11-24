import pool from './index.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[DB] Running migrations...');

    // 1. Auto-update timestamp trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        location    VARCHAR(255),
        client      VARCHAR(255),
        status      VARCHAR(50)  NOT NULL DEFAULT 'planning',
        start_date  DATE,
        description TEXT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure description column exists for tables created prior to this migration
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    // 3. Project Sections / Registers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_sections (
        id          SERIAL PRIMARY KEY,
        project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        icon        VARCHAR(50)  NOT NULL DEFAULT 'folder',
        sort_order  INTEGER      NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Custom Fields table (schema per section)
    await client.query(`
      CREATE TABLE IF NOT EXISTS section_fields (
        id          SERIAL PRIMARY KEY,
        section_id  INTEGER      NOT NULL REFERENCES project_sections(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        field_type  VARCHAR(50)  NOT NULL DEFAULT 'text',
        options     JSONB        NOT NULL DEFAULT '[]'::jsonb,
        is_required BOOLEAN      NOT NULL DEFAULT false,
        sort_order  INTEGER      NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Dynamic Records table (values stored as JSONB keyed by field id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS section_records (
        id          SERIAL PRIMARY KEY,
        section_id  INTEGER      NOT NULL REFERENCES project_sections(id) ON DELETE CASCADE,
        data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Attach updated_at triggers safely
    const triggerTables = ['projects', 'project_sections', 'section_records'];
    for (const table of triggerTables) {
      const triggerName = `${table}_updated_at`;
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = '${triggerName}'
          ) THEN
            CREATE TRIGGER ${triggerName}
            BEFORE UPDATE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
          END IF;
        END;
        $$;
      `);
    }

    console.log('[DB] Migrations complete — all tables ready.');
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
