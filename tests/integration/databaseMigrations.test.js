'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDatabase } = require('../helpers/postgres');
const { migrate } = require('../../scripts/migrate-db');

test('PostgreSQL migration is repeatable and refuses altered history', async () => {
  const fixture = await prepareDatabase();
  try {
    await Promise.all([migrate(fixture.pool), migrate(fixture.pool)]);
    const history = await fixture.pool.query('SELECT count(*)::integer AS count FROM public.knec_migrations');
    assert.equal(history.rows[0].count, 1);
    await fixture.pool.query("UPDATE public.knec_migrations SET checksum='altered'");
    await assert.rejects(migrate(fixture.pool), /DATABASE_MIGRATION_FAILED/);
  } finally { await fixture.close(); }
});
