'use strict';
const { createPool } = require('../src/repository/deliveryStore');

(async () => {
  const pool = createPool(process.env.DATABASE_URL);
  try {
    const result = await pool.query('SELECT state,count(*)::integer AS count FROM delivery.jobs GROUP BY state ORDER BY state');
    process.stdout.write(JSON.stringify(result.rows) + '\n');
  } finally { await pool.end(); }
})().catch(() => { process.stderr.write('Delivery status unavailable.\n'); process.exitCode = 1; });
