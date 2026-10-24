'use strict';
const twilio = require('twilio');
const config = require('../../config');
const MessagingAdapter = require('./messagingAdapter');

const MESSAGE_SID = /^(SM|MM)[\da-fA-F]{32}$/;
const ADDRESS = /^whatsapp:\+[1-9]\d{0,14}$/;
const STATUSES = new Set(['accepted', 'scheduled', 'canceled', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'read']);

function failure(code, statusCode) {
  const error = new Error('Twilio offline operation failed.');
  error.code = code;
  if (statusCode !== undefined) error.statusCode = statusCode;
  return error;
}

class TwilioWhatsAppAdapter extends MessagingAdapter {
  #settings;
  #httpClient;
  #now;

  constructor({ settings = config, httpClient, now = Date.now } = {}) {
    super();
    if (settings.nodeEnv !== 'test' || settings.whatsappProvider !== 'twilio' || !settings.twilio || settings.twilio.liveSendEnabled !== false) {
      throw failure('TWILIO_OFFLINE_ONLY');
    }
    if (httpClient !== undefined && (!httpClient || typeof httpClient.request !== 'function')) throw failure('TWILIO_INVALID_TEST_TRANSPORT');
    this.#settings = settings.twilio;
    this.#httpClient = httpClient;
    this.#now = now;
  }

  verifyWebhook() {
    return { isValid: false, challenge: null };
  }

  validateSignature(req, endpoint = 'inbound') {
    try {
      if (!['inbound', 'status'].includes(endpoint) || req.method !== 'POST') return false;
      const selected = this.#settings[endpoint];
      if (req.originalUrl !== selected.target) return false;
      const signature = req.headers['x-twilio-signature'];
      const headers = req.rawHeaders || [];
      let count = 0;
      for (let i = 0; i < headers.length; i += 2) if (headers[i].toLowerCase() === 'x-twilio-signature') count++;
      if (count !== 1 || typeof signature !== 'string' || !/^[A-Za-z0-9+/]{27}=$/.test(signature)) return false;
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.values(req.body).some(value => typeof value !== 'string')) return false;
      return twilio.validateRequest(this.#settings.authToken, signature, selected.url, req.body);
    } catch {
      return false;
    }
  }

  #identity(body) {
    if (!body || body.AccountSid !== this.#settings.accountSid || typeof body.MessageSid !== 'string' || !MESSAGE_SID.test(body.MessageSid)) {
      throw failure('TWILIO_INVALID_EVENT', 400);
    }
  }

  normalizeInboundPayload(body) {
    this.#identity(body);
    if (body.To !== this.#settings.from || typeof body.From !== 'string' || !ADDRESS.test(body.From) ||
        typeof body.NumMedia !== 'string' || !/^\d+$/.test(body.NumMedia) || !Number.isSafeInteger(Number(body.NumMedia)) || Number(body.NumMedia) > 100) {
      throw failure('TWILIO_INVALID_EVENT', 400);
    }
    if (Number(body.NumMedia) > 0) return []; // No downloads, caption forwarding or automatic reply.
    if (typeof body.Body !== 'string') throw failure('TWILIO_INVALID_EVENT', 400);
    if (body.Body.length === 0) return [];
    return [{
      messageId: body.MessageSid,
      senderPhone: body.From.slice('whatsapp:+'.length),
      timestamp: Math.floor(this.#now() / 1000),
      type: 'text',
      textBody: body.Body,
      rawProvider: 'twilio'
    }];
  }

  normalizeStatusCallback(body) {
    this.#identity(body);
    if (typeof body.MessageStatus !== 'string' || !body.MessageStatus.trim() || body.MessageStatus.length > 64 ||
        (body.From !== undefined && body.From !== this.#settings.from) ||
        (body.To !== undefined && body.To !== this.#settings.recipient)) throw failure('TWILIO_INVALID_EVENT', 400);
    let errorCode;
    if (body.ErrorCode !== undefined && body.ErrorCode !== '') {
      if (typeof body.ErrorCode !== 'string' || !/^\d+$/.test(body.ErrorCode) || !Number.isSafeInteger(Number(body.ErrorCode))) throw failure('TWILIO_INVALID_EVENT', 400);
      errorCode = Number(body.ErrorCode);
    }
    return {
      messageId: body.MessageSid,
      status: STATUSES.has(body.MessageStatus) ? body.MessageStatus : 'unknown',
      ...(errorCode === undefined ? {} : { errorCode }),
      timestamp: Math.floor(this.#now() / 1000)
    };
  }

  async sendTextMessage(to, text) {
    if (!this.#httpClient) throw failure('TWILIO_SEND_DISABLED');
    if (typeof to !== 'string' || !ADDRESS.test(to) || to !== this.#settings.recipient ||
        !ADDRESS.test(this.#settings.from) || typeof text !== 'string' || text.length === 0 || text.length > 1600) {
      throw failure('TWILIO_INVALID_OUTBOUND');
    }
    let timer;
    let safeFailure;
    try {
      // This client can only use the explicitly injected test transport, never the SDK default.
      const client = twilio(this.#settings.accountSid, this.#settings.authToken, {
        httpClient: this.#httpClient,
        autoRetry: false,
        logLevel: 'silent',
        timeout: this.#settings.timeoutMs
      });
      const request = Promise.resolve().then(() => client.messages.create({
        from: this.#settings.from,
        to,
        body: text,
        statusCallback: this.#settings.status.url
      }));
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          safeFailure = failure('TWILIO_ACCEPTANCE_UNKNOWN');
          reject(safeFailure);
        }, this.#settings.timeoutMs);
      });
      const result = await Promise.race([request, deadline]);
      if (!result || !MESSAGE_SID.test(result.sid) || !STATUSES.has(result.status)) {
        safeFailure = failure('TWILIO_INVALID_RESPONSE');
        throw safeFailure;
      }
      return { messageId: result.sid, status: result.status };
    } catch (error) {
      if (safeFailure && error === safeFailure) throw safeFailure;
      const status = error && error.status;
      const safe = failure('TWILIO_TRANSPORT_FAILURE');
      if (Number.isInteger(status) && status >= 400 && status <= 599) {
        safe.code = 'TWILIO_HTTP_FAILURE';
        safe.providerStatus = status;
      }
      // Provider exceptions can retain credentials, bodies and SDK request history; discard them.
      throw safe;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = TwilioWhatsAppAdapter;
