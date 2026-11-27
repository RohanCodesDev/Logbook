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
        formula     JSONB,
        is_required BOOLEAN      NOT NULL DEFAULT false,
        sort_order  INTEGER      NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure formula column exists for tables created prior to this migration
    await client.query(`
      ALTER TABLE section_fields
      ADD COLUMN IF NOT EXISTS formula JSONB;
    `);

    // 5. Dynamic Records table (values stored as JSONB keyed by field id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS section_records (
        id          SERIAL PRIMARY KEY,
        section_id  INTEGER      NOT NULL REFERENCES project_sections(id) ON DELETE CASCADE,
        entry_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
        data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE section_records
      ADD COLUMN IF NOT EXISTS entry_date DATE;
    `);

    // 6. Drivers, Operators & Helpers directory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS crew_members (
        id              SERIAL PRIMARY KEY,
        name            VARCHAR(255) NOT NULL,
        role            VARCHAR(50)  NOT NULL DEFAULT 'driver',
        phone           VARCHAR(50),
        vehicle_machine VARCHAR(255),
        project_id      INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
        wage_rate       NUMERIC(12, 2),
        wage_basis      VARCHAR(30)  NOT NULL DEFAULT 'daily',
        license_no      VARCHAR(100),
        joining_date    DATE,
        status          VARCHAR(40)  NOT NULL DEFAULT 'active',
        notes           TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Agreements & Contracts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agreements (
        id              SERIAL PRIMARY KEY,
        title           VARCHAR(255) NOT NULL,
        agreement_type  VARCHAR(80)  NOT NULL DEFAULT 'subcontract',
        party_name      VARCHAR(255) NOT NULL,
        party_phone     VARCHAR(50),
        project_id      INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
        start_date      DATE,
        end_date        DATE,
        contract_value  NUMERIC(14, 2),
        payment_terms   VARCHAR(120),
        reference_no    VARCHAR(100),
        status          VARCHAR(40)  NOT NULL DEFAULT 'active',
        notes           TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Attach updated_at triggers safely
    const triggerTables = ['projects', 'project_sections', 'section_records', 'crew_members', 'agreements'];
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
