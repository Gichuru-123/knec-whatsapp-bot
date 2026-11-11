'use strict';
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function migrationSource() {
  const sql = (await fs.readFile(path.join(__dirname, '../../db/migrations/001_delivery.sql'), 'utf8')).replace(/\r\n/g, '\n');
  return { sql, checksum: createHash('sha256').update(sql).digest('hex') };
}

async function migrationSources() {
  const first = await migrationSource();
  const sql = (await fs.readFile(path.join(__dirname, '../../db/migrations/002_conversation.sql'), 'utf8')).replace(/\r\n/g, '\n');
  return [{ version: 1, ...first }, { version: 2, sql, checksum: createHash('sha256').update(sql).digest('hex') }];
}

function databaseError(code = 'DATABASE_OPERATION_FAILED') {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 503;
  return error;
}

// Parse explicitly so URL query parameters cannot override TLS or timeout policy.
// Never use ambient PG* defaults for the application's target or credentials.
function connectionOptions(connectionString, { ca } = {}) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash ||
        !url.username || !url.password || !/^\/[a-z][a-z0-9_]{0,62}$/.test(url.pathname)) throw new Error();
    const local = ['127.0.0.1', '[::1]'].includes(host);
    const port = url.port ? Number(url.port) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    return {
      host: host === '[::1]' ? '::1' : host,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
      max: 4,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      lock_timeout: 1000,
      idle_in_transaction_session_timeout: 5000,
      application_name: 'knec_delivery'
    };
  } catch {
    throw databaseError('INVALID_DATABASE_CONFIGURATION');
  }
}

function createPool(connectionString, options) {
  const pool = new Pool(connectionOptions(connectionString, options));
  // An idle socket failure must not become an uncaught exception with credentials.
  // Subsequent operations surface fixed errors through transaction()/health().
  pool.on('error', () => {});
  return pool;
}

class DeliveryStore {
  constructor(pool) { this.pool = pool; }

  async openRun({ id, accountSid, binding, maxAttempts }) {
    return this.transaction(async client => {
      await client.query(`INSERT INTO delivery.runs(id,account_sid,binding,max_attempts)
        VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`, [id, accountSid, binding, maxAttempts]);
      const { rows } = await client.query('SELECT * FROM delivery.runs WHERE id=$1 FOR UPDATE', [id]);
      const run = rows[0];
      if (!run || run.closed_at || run.account_sid !== accountSid || run.binding !== binding || run.max_attempts !== maxAttempts) throw new Error();
    });
  }

  async accept({ runId, accountSid, messageSid, conversationId, supported }) {
    return this.transaction(async client => {
      const { rows } = await client.query('SELECT * FROM delivery.runs WHERE id=$1 FOR UPDATE', [runId]);
      const run = rows[0];
      if (!run || run.closed_at || run.account_sid !== accountSid) throw new Error();
      const previous = await client.query('SELECT conversation_id,supported FROM delivery.receipts WHERE account_sid=$1 AND message_sid=$2', [accountSid, messageSid]);
      if (previous.rows.length) {
        if (previous.rows[0].conversation_id !== conversationId || previous.rows[0].supported !== supported) throw new Error();
        return { duplicate: true };
      }
      if (run.receipt_count >= 1000 || (supported && run.used_attempts >= run.max_attempts)) throw new Error();
      const inserted = await client.query(`INSERT INTO delivery.receipts(account_sid,message_sid,run_id,conversation_id,supported)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING message_sid`, [accountSid, messageSid, runId, conversationId, supported]);
      if (!inserted.rows.length) {
        const conflict = await client.query('SELECT conversation_id,supported FROM delivery.receipts WHERE account_sid=$1 AND message_sid=$2', [accountSid, messageSid]);
        if (conflict.rows[0]?.conversation_id !== conversationId || conflict.rows[0]?.supported !== supported) throw new Error();
        return { duplicate: true };
      }
      await client.query('UPDATE delivery.runs SET receipt_count=receipt_count+1 WHERE id=$1', [runId]);
      if (supported) await client.query(`INSERT INTO delivery.jobs(id,run_id,account_sid,receipt_sid)
        VALUES($1,$2,$3,$4)`, [randomUUID(), runId, accountSid, messageSid]);
      return { duplicate: false };
    });
  }

  async claim(runId, owner) {
    return this.transaction(async client => {
      const locked = await client.query(`SELECT *, lease_until > clock_timestamp() AS leased,
        last_dispatch_at > clock_timestamp()-interval '3 seconds' AS paced
        FROM delivery.runs WHERE id=$1 FOR UPDATE`, [runId]);
      const run = locked.rows[0];
      if (!run || run.closed_at) throw new Error();
      if (run.leased || run.paced) return null;
      await client.query(`UPDATE delivery.attempts SET outcome='uncertain',finished_at=clock_timestamp()
        WHERE finished_at IS NULL AND job_id IN (SELECT id FROM delivery.jobs WHERE run_id=$1 AND state='sending')`, [runId]);
      await client.query("UPDATE delivery.jobs SET state='uncertain',outcome='interrupted' WHERE run_id=$1 AND state='sending'", [runId]);
      await client.query(`UPDATE delivery.jobs SET state='expired',outcome='expired'
        WHERE run_id=$1 AND state='pending' AND created_at < clock_timestamp()-interval '10 minutes'`, [runId]);
      if (run.used_attempts >= run.max_attempts) return null;
      const pending = await client.query(`SELECT * FROM delivery.jobs WHERE run_id=$1 AND state='pending'
        AND eligible_at<=clock_timestamp() AND attempts<3 ORDER BY created_at,id LIMIT 1 FOR UPDATE`, [runId]);
      if (!pending.rows.length) return null;
      const job = pending.rows[0];
      const token = randomUUID();
      const lease = await client.query(`UPDATE delivery.runs SET lease_owner=$2,
        lease_until=clock_timestamp()+interval '60 seconds',lease_generation=lease_generation+1,
        used_attempts=used_attempts+1,last_dispatch_at=clock_timestamp() WHERE id=$1 RETURNING lease_generation`, [runId, owner]);
      await client.query("UPDATE delivery.jobs SET state='sending',attempts=attempts+1,claim_token=$2 WHERE id=$1", [job.id, token]);
      await client.query('INSERT INTO delivery.attempts(job_id,attempt_number) VALUES($1,$2)', [job.id, job.attempts + 1]);
      return { id: job.id, token, runId, owner, generation: lease.rows[0].lease_generation, attempt: job.attempts + 1 };
    });
  }

  async owns(claim) {
    try {
      const { rows } = await this.pool.query(`SELECT 1 FROM delivery.runs r JOIN delivery.jobs j ON j.run_id=r.id
        WHERE r.id=$1 AND r.lease_owner=$2 AND r.lease_generation=$3 AND r.lease_until>clock_timestamp()
        AND j.id=$4 AND j.claim_token=$5 AND j.state='sending'`,
      [claim.runId, claim.owner, claim.generation, claim.id, claim.token]);
      return rows.length === 1;
    } catch { throw databaseError(); }
  }

  async finish(claim, result) {
    const allowed = ['accepted', 'failed', 'uncertain', 'retry'];
    if (!allowed.includes(result.kind)) throw databaseError();
    return this.transaction(async client => {
      const locked = await client.query(`SELECT *,lease_until>clock_timestamp() AS valid
        FROM delivery.runs WHERE id=$1 FOR UPDATE`, [claim.runId]);
      const run = locked.rows[0];
      if (!run || !run.valid || run.lease_owner !== claim.owner || run.lease_generation !== claim.generation) throw new Error();
      const { rows } = await client.query("SELECT * FROM delivery.jobs WHERE id=$1 AND claim_token=$2 AND state='sending' FOR UPDATE", [claim.id, claim.token]);
      const job = rows[0];
      if (!job) throw new Error();
      let state = result.kind;
      let delay = 0;
      if (state === 'retry') {
        delay = result.retryAfterMs;
        if (!Number.isSafeInteger(delay) || delay < (job.attempts === 1 ? 5000 : 15000) || delay > 600000) throw new Error();
        state = job.attempts < 3 && run.used_attempts < run.max_attempts ? 'pending' : 'failed';
      }
      const status = result.kind === 'accepted' ? result.status : null;
      if (status && !['accepted','queued','sending','sent','delivered','read'].includes(status)) throw new Error();
      await client.query(`UPDATE delivery.jobs SET state=$2,outcome=$3,provider_sid=$4,
        delivery_status=$5,eligible_at=clock_timestamp()+$6*interval '1 millisecond' WHERE id=$1`,
      [job.id, state, result.kind, result.kind === 'accepted' ? result.messageId : null, status, delay]);
      await client.query(`UPDATE delivery.attempts SET finished_at=clock_timestamp(),outcome=$3 WHERE job_id=$1 AND attempt_number=$2`, [job.id, job.attempts, result.kind]);
      await client.query('UPDATE delivery.runs SET lease_owner=NULL,lease_until=NULL WHERE id=$1', [run.id]);
      if (result.kind === 'accepted') await this.reconcile(client, job.account_sid, result.messageId);
    });
  }

  async reconcile(client, accountSid, messageSid) {
    const found = await client.query('SELECT * FROM delivery.jobs WHERE account_sid=$1 AND provider_sid=$2 FOR UPDATE', [accountSid, messageSid]);
    if (!found.rows.length) return;
    const job = found.rows[0];
    const events = await client.query('SELECT status FROM delivery.callbacks WHERE account_sid=$1 AND message_sid=$2', [accountSid, messageSid]);
    const positive = ['accepted','queued','sending','sent','delivered','read'];
    const statuses = [job.delivery_status, ...events.rows.map(row => row.status)].filter(Boolean);
    const rank = Math.max(-1, ...statuses.map(status => positive.indexOf(status)));
    const failures = [...new Set(statuses.filter(status => ['failed','undelivered','canceled'].includes(status)))];
    const conflict = failures.length > 1 || (failures.length > 0 && rank >= 4);
    const status = rank >= 4 ? positive[rank] : failures[0] || positive[rank] || 'unknown';
    await client.query('UPDATE delivery.jobs SET delivery_status=$2,review_required=review_required OR $3 WHERE id=$1',
      [job.id, status, conflict || statuses.includes('unknown') || statuses.includes('scheduled')]);
  }

  async callback({ runId, accountSid, messageSid, status, errorCode = -1 }) {
    return this.transaction(async client => {
      const { rows } = await client.query('SELECT * FROM delivery.runs WHERE id=$1 FOR UPDATE', [runId]);
      const run = rows[0];
      if (!run || run.closed_at || run.account_sid !== accountSid) throw new Error();
      const previous = await client.query('SELECT 1 FROM delivery.callbacks WHERE account_sid=$1 AND message_sid=$2 AND status=$3 AND error_code=$4', [accountSid, messageSid, status, errorCode]);
      if (previous.rows.length) return;
      if (run.callback_count >= 5000) throw new Error();
      const inserted = await client.query(`INSERT INTO delivery.callbacks(run_id,account_sid,message_sid,status,error_code)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING message_sid`, [runId, accountSid, messageSid, status, errorCode]);
      if (inserted.rows.length) await client.query('UPDATE delivery.runs SET callback_count=callback_count+1 WHERE id=$1', [runId]);
      await this.reconcile(client, accountSid, messageSid);
    });
  }

  async transaction(operation) {
    let client;
    let broken = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
      }
      throw databaseError();
    } finally {
      if (client) client.release(broken);
    }
  }

  async health() {
    try {
      const result = await this.pool.query('SELECT version,checksum FROM public.knec_migrations ORDER BY version');
      const sources = await migrationSources();
      if (result.rows.length !== sources.length || result.rows.some((row, i) => row.version !== sources[i].version || row.checksum !== sources[i].checksum)) throw new Error();
      const role = await this.pool.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user');
      if (!role.rows[0] || Object.values(role.rows[0]).some(Boolean)) throw new Error();
      const privilege = await this.pool.query(`SELECT
        has_schema_privilege(current_user,'delivery','CREATE') AS can_create_delivery,
        has_schema_privilege(current_user,'conversation','CREATE') AS can_create_conversation`);
      if (privilege.rows[0].can_create_delivery || privilege.rows[0].can_create_conversation) throw new Error();
    } catch { throw databaseError('DATABASE_NOT_READY'); }
  }

  async closeRun(runId) {
    return this.transaction(async client => {
      const active = await client.query('SELECT lease_until>clock_timestamp() AS active FROM delivery.runs WHERE id=$1 FOR UPDATE', [runId]);
      if (!active.rows.length || active.rows[0].active) throw new Error();
      await client.query('UPDATE delivery.runs SET closed_at=COALESCE(closed_at,clock_timestamp()) WHERE id=$1', [runId]);
    });
  }

  async cleanup(runId) {
    return this.transaction(async client => {
      const { rows } = await client.query(`SELECT closed_at<clock_timestamp()-interval '7 days' AS eligible
        FROM delivery.runs WHERE id=$1 FOR UPDATE`, [runId]);
      if (!rows[0]?.eligible) return false;
      await client.query('DELETE FROM delivery.attempts WHERE job_id IN (SELECT id FROM delivery.jobs WHERE run_id=$1)', [runId]);
      await client.query('DELETE FROM delivery.jobs WHERE run_id=$1', [runId]);
      await client.query('DELETE FROM delivery.callbacks WHERE run_id=$1', [runId]);
      await client.query('DELETE FROM delivery.receipts WHERE run_id=$1', [runId]);
      // Keep the closed run and its original budget/binding as a tombstone.
      return true;
    });
  }

  async close() { await this.pool.end(); }
}

module.exports = { DeliveryStore, createPool, connectionOptions, databaseError, migrationSource, migrationSources };
