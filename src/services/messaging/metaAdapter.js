const crypto = require('crypto');
const MessagingAdapter = require('./messagingAdapter');
const config = require('../../config');

class MetaWhatsAppAdapter extends MessagingAdapter {
  constructor() {
    super();
    this.verifyToken = config.whatsappVerifyToken;
    this.appSecret = config.whatsappAppSecret;
    this.apiVersion = config.metaGraphApiVersion;
    this.phoneNumberId = config.whatsappPhoneNumberId;
    this.accessToken = config.whatsappAccessToken;
    this.timeoutMs = config.metaRequestTimeoutMs;
  }

  getApiEndpoint() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      return { isValid: true, challenge };
    }
    return { isValid: false, challenge: null };
  }

  validateSignature(req) {
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (!signatureHeader) {
      return false;
    }

    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(rawBody);
    const expectedSignature = 'sha256=' + hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      return false;
    }
  }

  normalizeInboundPayload(body) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.entry)) {
      return [];
    }

    const normalizedMessages = [];

    for (const entry of body.entry) {
      if (!entry || !Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (!change || !change.value || typeof change.value !== 'object') continue;
        const value = change.value;

        // Status / Read receipts / Delivery events contain value.statuses - ignore cleanly
        if (!value.messages || !Array.isArray(value.messages)) {
          continue;
        }

        for (const msg of value.messages) {
          if (!msg || typeof msg.id !== 'string' || !msg.id.trim() ||
              typeof msg.from !== 'string' || !/^\d{7,15}$/.test(msg.from)) continue;

          const senderPhone = msg.from;
          const messageId = msg.id;
          const rawTimestamp = msg.timestamp === undefined ? Math.floor(Date.now() / 1000) : msg.timestamp;
          if (typeof rawTimestamp !== 'number' && !(typeof rawTimestamp === 'string' && /^\d+$/.test(rawTimestamp))) continue;
          const timestamp = Number(rawTimestamp);
          if (!Number.isSafeInteger(timestamp) || timestamp < 0) continue;

          let textBody = '';
          let type = msg.type;

          if (type === 'text') {
            if (!msg.text || typeof msg.text.body !== 'string') continue;
            textBody = msg.text.body.trim();
          } else if (type === 'interactive') {
            if (!msg.interactive || typeof msg.interactive !== 'object') continue;
            const reply = msg.interactive.type === 'button_reply' ? msg.interactive.button_reply
              : msg.interactive.type === 'list_reply' ? msg.interactive.list_reply : null;
            if (!reply || typeof reply !== 'object') continue;
            if (reply.id !== undefined && typeof reply.id !== 'string') continue;
            if (reply.title !== undefined && typeof reply.title !== 'string') continue;
            textBody = reply.id || reply.title || '';
          } else {
            type = 'unsupported';
          }

          normalizedMessages.push({
            messageId,
            senderPhone,
            timestamp,
            type,
            textBody,
            rawProvider: 'meta'
          });
        }
      }
    }

    return normalizedMessages;
  }

  async sendTextMessage(to, text) {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('Meta API credentials missing. Cannot execute outbound delivery.');
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text }
    };

    const endpoint = this.getApiEndpoint();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    let safeFailure;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        // Provider error bodies may echo submitted text or credentials. Do not consume or attach them.
        if (response.body) await response.body.cancel();
        safeFailure = new Error(`Meta Cloud API HTTP Error ${response.status}.`);
        safeFailure.code = 'META_HTTP_ERROR';
        safeFailure.providerStatus = response.status;
        throw safeFailure;
      }

      try {
        return await response.json();
      } catch {
        if (controller.signal.aborted) throw new Error('aborted');
        safeFailure = new Error('Meta API returned an unreadable response.');
        safeFailure.code = 'META_RESPONSE_ERROR';
        throw safeFailure;
      }
    } catch (err) {
      if (controller.signal.aborted) {
        const error = new Error(`Meta API Request Timed Out after ${this.timeoutMs}ms.`);
        error.code = 'META_TIMEOUT';
        throw error;
      }
      if (safeFailure && err === safeFailure) throw safeFailure;
      // Do not attach the original error/cause: network errors may include URLs or request details.
      const error = new Error('Meta API request failed.');
      error.code = 'META_NETWORK_ERROR';
      throw error;
    } finally {
      // fetch resolves at headers; the deadline must also cover response.json().
      clearTimeout(timeoutId);
    }
  }
}

module.exports = MetaWhatsAppAdapter;
