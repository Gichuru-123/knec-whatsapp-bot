'use strict';

const { databaseError } = require('./deliveryStore');
const { validateState } = require('../services/conversation/navigation');
const { randomUUID } = require('node:crypto');

// Revisions are monotonic even after expiry; a stale writer cannot revive an old session.
class ConversationSessionStore {
  constructor(pool, { ttlSeconds } = {}) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 2592000) throw new Error('INVALID_SESSION_TTL');
    this.pool = pool;
    this.ttlSeconds = ttlSeconds;
  }

  async read(id) {
    this.validateId(id);
    try {
      const { rows } = await this.pool.query(`SELECT state, revision, expires_at > clock_timestamp() AS active
        FROM conversation.sessions WHERE conversation_id=$1`, [id]);
      if (!rows.length) return null;
      const row = rows[0];
      if (row.active) validateState(row.state);
      return { state: row.active ? row.state : null, revision: row.revision, expired: !row.active };
    } catch { throw databaseError(); }
  }

  async save(id, state, expectedRevision, { resetExpired = false } = {}) {
    this.validateId(id);
    validateState(state);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('INVALID_SESSION_REVISION');
    // Persist only the explicitly approved navigation fields, never arbitrary input.
    const clean = { version: state.version, currentNodeId: state.currentNodeId, path: [...state.path], invalidAttempts: state.invalidAttempts };
    try {
      let result;
      if (expectedRevision === 0) {
        result = await this.pool.query(`INSERT INTO conversation.sessions(conversation_id,state,expires_at)
          VALUES($1,$2,clock_timestamp()+$3*interval '1 second') ON CONFLICT DO NOTHING RETURNING revision`, [id, clean, this.ttlSeconds]);
      } else {
        result = await this.pool.query(`UPDATE conversation.sessions SET state=$2,revision=revision+1,
          updated_at=clock_timestamp(),expires_at=clock_timestamp()+$4*interval '1 second'
          WHERE conversation_id=$1 AND revision=$3 AND (expires_at > clock_timestamp()) = $5 RETURNING revision`,
        [id, clean, expectedRevision, this.ttlSeconds, !resetExpired]);
      }
      return result.rows.length ? { revision: result.rows[0].revision } : null;
    } catch { throw databaseError(); }
  }

  async applyEvent(id, eventId, accountSid, operation) {
    this.validateId(id);
    this.validateEventId(eventId);
    this.validateAccountSid(accountSid);
    if (typeof operation !== 'function') throw new Error('INVALID_CONVERSATION_OPERATION');
    let client;
    let broken = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // The advisory lock also serializes first-message races before a session row exists.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,418))', [id]);
      const previous = await client.query(`SELECT response,session_revision FROM conversation.events
        WHERE conversation_id=$1 AND event_id=$2`, [id, eventId]);
      if (previous.rows.length) {
        await client.query('COMMIT');
        return { duplicate: true, response: previous.rows[0].response, revision: previous.rows[0].session_revision };
      }
      const found = await client.query(`SELECT state,revision,expires_at>clock_timestamp() AS active
        FROM conversation.sessions WHERE conversation_id=$1 FOR UPDATE`, [id]);
      const row = found.rows[0];
      const started = !row;
      const restarted = Boolean(row && !row.active);
      const current = row?.active ? row.state : null;
      if (current) validateState(current);
      const outcome = await operation({ state: current, started, restarted });
      if (!outcome || typeof outcome !== 'object') throw new Error();
      validateState(outcome.state);
      const encoded = JSON.stringify(outcome.response);
      if (!outcome.response || Array.isArray(outcome.response) || typeof outcome.response !== 'object' || encoded.length > 16000) throw new Error();
      if (typeof outcome.outboundBody !== 'string' || outcome.outboundBody.length < 1 || outcome.outboundBody.length > 1600) throw new Error();
      let revision;
      if (started) {
        const inserted = await client.query(`INSERT INTO conversation.sessions(conversation_id,state,expires_at)
          VALUES($1,$2,clock_timestamp()+$3*interval '1 second') RETURNING revision`, [id, outcome.state, this.ttlSeconds]);
        revision = inserted.rows[0].revision;
      } else {
        const updated = await client.query(`UPDATE conversation.sessions SET state=$2,revision=revision+1,
          updated_at=clock_timestamp(),expires_at=clock_timestamp()+$3*interval '1 second'
          WHERE conversation_id=$1 RETURNING revision`, [id, outcome.state, this.ttlSeconds]);
        revision = updated.rows[0].revision;
      }
      await client.query(`INSERT INTO conversation.events(conversation_id,event_id,session_revision,response)
        VALUES($1,$2,$3,$4)`, [id, eventId, revision, outcome.response]);
      await client.query(`INSERT INTO conversation.outbox(id,account_sid,conversation_id,event_id,session_revision,body)
        VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), accountSid, id, eventId, revision, outcome.outboundBody]);
      await client.query('COMMIT');
      return { duplicate: false, response: outcome.response, revision, started, restarted };
    } catch {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
      }
      throw databaseError();
    } finally {
      if (client) client.release(broken);
    }
  }

  async claimOutbox(owner) {
    if (typeof owner !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner)) {
      throw new Error('INVALID_OUTBOX_OWNER');
    }
    let client;
    let broken = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      await client.query(`UPDATE conversation.outbox SET state='uncertain',outcome='lease_expired',
        claim_owner=NULL,claim_token=NULL,lease_until=NULL
        WHERE state='sending' AND lease_until<=clock_timestamp()`);
      const pending = await client.query(`SELECT id,conversation_id,event_id,session_revision,body
        FROM conversation.outbox WHERE state='pending' AND eligible_at<=clock_timestamp()
        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      if (!pending.rows.length) {
        await client.query('COMMIT');
        return null;
      }
      const job = pending.rows[0];
      const token = randomUUID();
      await client.query(`UPDATE conversation.outbox SET state='sending',attempts=attempts+1,
        claim_owner=$2,claim_token=$3,lease_until=clock_timestamp()+interval '60 seconds'
        WHERE id=$1`, [job.id, owner, token]);
      await client.query('COMMIT');
      return { ...job, owner, token };
    } catch {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
      }
      throw databaseError();
    } finally {
      if (client) client.release(broken);
    }
  }

  async ownsOutbox(claim) {
    try {
      const { rows } = await this.pool.query(`SELECT 1 FROM conversation.outbox
        WHERE id=$1 AND claim_owner=$2 AND claim_token=$3 AND state='sending'
        AND lease_until>clock_timestamp()`, [claim?.id, claim?.owner, claim?.token]);
      return rows.length === 1;
    } catch { throw databaseError(); }
  }

  async finishOutbox(claim, result) {
    if (!result || !['accepted', 'failed', 'uncertain'].includes(result.kind)) throw new Error('INVALID_OUTBOX_RESULT');
    let client;
    let broken = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const locked = await client.query(`SELECT *,lease_until>clock_timestamp() AS lease_active
        FROM conversation.outbox WHERE id=$1 FOR UPDATE`, [claim?.id]);
      const job = locked.rows[0];
      if (!job || job.state !== 'sending' || job.claim_owner !== claim.owner || job.claim_token !== claim.token || !job.lease_active) throw new Error();
      let providerSid = null;
      let providerStatus = null;
      if (result.kind === 'accepted') {
        if (typeof result.messageId !== 'string' || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(result.messageId) ||
            !['accepted','queued','sending','sent','delivered','read'].includes(result.status)) throw new Error();
        providerSid = result.messageId;
        providerStatus = result.status;
      }
      await client.query(`UPDATE conversation.outbox SET state=$2,outcome=$2,provider_sid=$3,
        provider_status=$4,claim_owner=NULL,claim_token=NULL,lease_until=NULL WHERE id=$1`,
      [job.id, result.kind, providerSid, providerStatus]);
      if (result.kind === 'accepted') await this.reconcileOutbox(client, job.account_sid, providerSid);
      await client.query('COMMIT');
    } catch {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
      }
      throw databaseError();
    } finally {
      if (client) client.release(broken);
    }
  }

  async recordCallback({ accountSid, messageSid, status, errorCode = -1 } = {}) {
    this.validateAccountSid(accountSid);
    if (typeof messageSid !== 'string' || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(messageSid) ||
        !['accepted','scheduled','canceled','queued','sending','sent','delivered','undelivered','failed','read','unknown'].includes(status) ||
        !Number.isSafeInteger(errorCode) || errorCode < -1) throw new Error('INVALID_CONVERSATION_CALLBACK');
    let client;
    let broken = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      await client.query(`INSERT INTO conversation.callbacks(account_sid,message_sid,status,error_code)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [accountSid, messageSid, status, errorCode]);
      await this.reconcileOutbox(client, accountSid, messageSid);
      await client.query('COMMIT');
    } catch {
      if (client) {
        try { await client.query('ROLLBACK'); } catch { broken = true; }
      }
      throw databaseError();
    } finally {
      if (client) client.release(broken);
    }
  }

  async reconcileOutbox(client, accountSid, messageSid) {
    const found = await client.query(`SELECT * FROM conversation.outbox
      WHERE account_sid=$1 AND provider_sid=$2 FOR UPDATE`, [accountSid, messageSid]);
    if (!found.rows.length) return;
    const job = found.rows[0];
    const events = await client.query(`SELECT status FROM conversation.callbacks
      WHERE account_sid=$1 AND message_sid=$2`, [accountSid, messageSid]);
    const positive = ['accepted','queued','sending','sent','delivered','read'];
    const statuses = [job.provider_status, ...events.rows.map(row => row.status)].filter(Boolean);
    const rank = Math.max(-1, ...statuses.map(status => positive.indexOf(status)));
    const failures = [...new Set(statuses.filter(status => ['failed','undelivered','canceled'].includes(status)))];
    const conflict = failures.length > 1 || (failures.length > 0 && rank >= 4);
    const status = rank >= 4 ? positive[rank] : failures[0] || positive[rank] || 'unknown';
    await client.query(`UPDATE conversation.outbox SET provider_status=$2,
      review_required=review_required OR $3 WHERE id=$1`,
    [job.id, status, conflict || statuses.includes('unknown') || statuses.includes('scheduled')]);
  }

  async cleanupExpired({ retentionSeconds, limit = 500 } = {}) {
    if (!Number.isInteger(retentionSeconds) || retentionSeconds < 86400 || retentionSeconds > 7776000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('INVALID_SESSION_RETENTION');
    try {
      const result = await this.pool.query(`WITH doomed AS (
        SELECT s.conversation_id FROM conversation.sessions s
        WHERE s.expires_at < clock_timestamp()-$1*interval '1 second'
          AND NOT EXISTS (
            SELECT 1 FROM conversation.outbox o
            WHERE o.conversation_id=s.conversation_id
              AND (o.state IN ('pending','sending','uncertain') OR o.review_required)
          )
        ORDER BY s.expires_at LIMIT $2 FOR UPDATE OF s SKIP LOCKED
      ) DELETE FROM conversation.sessions s USING doomed d
        WHERE s.conversation_id=d.conversation_id`, [retentionSeconds, limit]);
      return result.rowCount;
    } catch { throw databaseError(); }
  }

  async cleanupCallbacks({ retentionSeconds, limit = 1000 } = {}) {
    if (!Number.isInteger(retentionSeconds) || retentionSeconds < 86400 || retentionSeconds > 7776000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('INVALID_CALLBACK_RETENTION');
    try {
      const result = await this.pool.query(`WITH doomed AS (
        SELECT ctid FROM conversation.callbacks
        WHERE received_at < clock_timestamp()-$1*interval '1 second'
        ORDER BY received_at LIMIT $2 FOR UPDATE SKIP LOCKED
      ) DELETE FROM conversation.callbacks c USING doomed d WHERE c.ctid=d.ctid`, [retentionSeconds, limit]);
      return result.rowCount;
    } catch { throw databaseError(); }
  }

  validateId(id) {
    if (typeof id !== 'string' || !/^v[1-9][0-9]*:[0-9a-f]{64}$/.test(id)) throw new Error('INVALID_CONVERSATION_ID');
  }

  validateEventId(id) {
    if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) throw new Error('INVALID_CONVERSATION_EVENT_ID');
  }

  validateAccountSid(id) {
    if (typeof id !== 'string' || !/^AC[0-9a-fA-F]{32}$/.test(id)) throw new Error('INVALID_CONVERSATION_ACCOUNT');
  }
}

module.exports = { ConversationSessionStore };
