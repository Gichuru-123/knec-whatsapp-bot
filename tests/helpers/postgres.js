'use strict';
const { createPool, connectionOptions } = require('../../src/repository/deliveryStore');
const { migrate } = require('../../scripts/migrate-db');

// This suite requires an explicitly dedicated disposable database. It never
// loads dotenv and never falls back to the runtime connection string.
async function prepareDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  const options = connectionOptions(url);
  if (!/^knec_disposable_test_[a-z0-9_]+$/.test(options.database) ||
      !['127.0.0.1', '::1'].includes(options.host) || url === process.env.DATABASE_URL ||
      url === process.env.DATABASE_MIGRATION_URL) throw new Error('UNSAFE_TEST_DATABASE');
  const pool = createPool(url);
  let guard;
  try {
    // Tests must be the exclusive owner of this disposable database. Serialize
    // fixture lifecycle separately from the migration transaction lock.
    guard = await pool.connect();
    await guard.query('SET statement_timeout=30000');
    await guard.query('SET lock_timeout=30000');
    await guard.query('SELECT pg_advisory_lock(418, 2)');
    try {
      await guard.query('DROP SCHEMA IF EXISTS delivery CASCADE');
      await guard.query('DROP SCHEMA IF EXISTS conversation CASCADE');
      await guard.query('DROP TABLE IF EXISTS public.knec_migrations');
      await migrate(pool);
    } catch (error) {
      await guard.query('SELECT pg_advisory_unlock(418, 2)');
      guard.release();
      guard = null;
      throw error;
    }
    return { pool, async close() {
      await guard.query('SELECT pg_advisory_unlock(418, 2)');
      guard.release();
      await pool.end();
    } };
  } catch {
    if (guard) guard.release(true);
    await pool.end();
    throw new Error('TEST_DATABASE_SETUP_FAILED');
  }
}

module.exports = { prepareDatabase };
