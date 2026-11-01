'use strict';
const { createPool, databaseError, migrationSource } = require('../src/repository/deliveryStore');

async function migrate(pool) {
  let client;
  let broken = false;
  try {
    const { sql, checksum } = await migrationSource();
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(418, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.knec_migrations (
      version integer PRIMARY KEY, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
    const applied = await client.query('SELECT version, checksum FROM public.knec_migrations ORDER BY version');
    if (applied.rows.length > 1 || applied.rows.some(row => row.version !== 1 || row.checksum !== checksum)) throw new Error();
    if (applied.rows.length === 0) {
      await client.query(sql);
      await client.query('INSERT INTO public.knec_migrations(version, checksum) VALUES(1,$1)', [checksum]);
    }
    await client.query('COMMIT');
  } catch {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { broken = true; }
    }
    throw databaseError('DATABASE_MIGRATION_FAILED');
  } finally { if (client) client.release(broken); }
}

if (require.main === module) {
  (async () => {
    const pool = createPool(process.env.DATABASE_MIGRATION_URL);
    try { await migrate(pool); process.stdout.write('Database migrations verified.\n'); }
    finally { await pool.end(); }
  })().catch(() => { process.stderr.write('Database migration failed.\n'); process.exitCode = 1; });
}

module.exports = { migrate };
