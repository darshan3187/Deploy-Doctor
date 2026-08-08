import pg from 'pg';

const { Pool } = pg;

// Use DATABASE_URL if available
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/deploydoctor';

export const pool = new Pool({
  connectionString,
  // Enable SSL if connecting to Zerops or managed SSL postgres
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function initDb() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS analyses (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      repo_url       TEXT NOT NULL,
      repo_owner     TEXT,
      repo_name      TEXT,
      detected_stack TEXT,
      zerops_yaml    TEXT NOT NULL,
      risk_report    JSONB NOT NULL,
      status         TEXT DEFAULT 'completed',
      created_at     TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses (repo_owner, repo_name);
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses (created_at DESC);
  `;

  try {
    await pool.query(createTableQuery);
    console.log('[Deploy Doctor DB] Database tables & indexes initialized successfully.');
  } catch (err) {
    console.warn('[Deploy Doctor DB] Database connection/init warning (will retry on demand):', err.message);
  }
}
