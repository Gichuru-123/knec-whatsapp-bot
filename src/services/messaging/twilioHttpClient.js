'use strict';
const https = require('node:https');
const http = require('node:http');
const twilio = require('twilio');
const { randomInt } = require('node:crypto');
const { DIAGNOSTIC_REPLY } = require('./deliveryService');

// A fresh client/outcome is owned by each send. Neither provider response bodies
// nor SDK exceptions escape this boundary. Test targets require NODE_ENV=test.
function createSender(settings, { testTarget } = {}) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${settings.accountSid}/Messages.json`;
  if (testTarget) {
    const target = new URL(testTarget);
    if (process.env.NODE_ENV !== 'test' || target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password) {
      throw new Error('Invalid test transport');
    }
  }
  return async (to, text) => {
    if (to !== settings.recipient || text !== DIAGNOSTIC_REPLY) throw new Error('Invalid diagnostic reply');
    let outcome = { kind: 'uncertain' };
    const httpClient = { request: async options => {
      const expected = { To: to, From: settings.from, Body: text, StatusCallback: settings.status.url };
      if (options.uri !== endpoint || options.method.toUpperCase() !== 'POST' ||
          Object.keys(options.data || {}).length !== 4 || Object.entries(expected).some(([key, value]) => options.data[key] !== value)) {
        throw new Error('Invalid transport request');
      }
      const body = new URLSearchParams(expected).toString();
      outcome = await new Promise(resolve => {
        let settled = false;
        let timer;
        let request;
        const finish = result => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        };
        try {
          request = (testTarget ? http : https).request(testTarget || endpoint, {
            method: 'POST', agent: false, rejectUnauthorized: true,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body),
              Authorization: 'Basic ' + Buffer.from(`${settings.accountSid}:${settings.authToken}`).toString('base64') }
          }, response => {
            let size = 0;
            const chunks = [];
            response.on('data', chunk => {
              size += chunk.length;
              if (size > 65536) { finish({ kind: 'uncertain' }); response.destroy(); request.destroy(); }
              else chunks.push(chunk);
            });
            response.on('error', () => finish({ kind: 'uncertain' }));
            response.on('aborted', () => finish({ kind: 'uncertain' }));
            response.on('end', () => {
              if (settled) return;
              try {
                const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (response.statusCode === 201 && value.account_sid === settings.accountSid &&
                    /^(SM|MM)[a-fA-F0-9]{32}$/.test(value.sid) && ['accepted','queued','sending','sent','delivered','read'].includes(value.status)) {
                  finish({ kind: 'accepted', messageId: value.sid, status: value.status });
                } else if (response.statusCode === 429 && value.code === 20429) {
                  const raw = response.headers['retry-after'];
                  const seconds = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 0;
                  // An unsupported or excessive provider delay fails closed.
                  if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(seconds) || seconds > 600) finish({ kind: 'failed' });
                  else finish({ kind: 'retry', retryAfterMs: Math.min(600000, Math.max(15000, seconds * 1000) + randomInt(0, 1001)) });
                } else if ([400,401,403,404].includes(response.statusCode) && Number.isSafeInteger(value.code)) finish({ kind: 'failed' });
                else finish({ kind: 'uncertain' });
              } catch { finish({ kind: 'uncertain' }); }
            });
          });
          request.on('error', () => finish({ kind: 'uncertain' }));
          timer = setTimeout(() => { finish({ kind: 'uncertain' }); request.destroy(); }, settings.timeoutMs);
          request.end(body);
        } catch { finish({ kind: 'uncertain' }); if (request) request.destroy(); }
      });
      // SDK receives only minimal synthetic fields. Trusted outcome classification
      // comes from the transport above, never arbitrary SDK exception properties.
      return outcome.kind === 'accepted'
        ? { statusCode: 201, body: JSON.stringify({ sid: outcome.messageId, status: outcome.status }), headers: {} }
        : { statusCode: 400, body: JSON.stringify({ code: 20000, message: 'Diagnostic send not confirmed' }), headers: {} };
    } };
    const client = twilio(settings.accountSid, settings.authToken, { httpClient, autoRetry: false, logLevel: 'silent' });
    try { await client.messages.create({ to, from: settings.from, body: text, statusCallback: settings.status.url }); }
    catch { /* Only the restricted transport's result is retained. */ }
    return outcome;
  };
}

module.exports = { createSender };
