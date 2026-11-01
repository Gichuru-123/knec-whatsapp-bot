'use strict';
const { createHmac } = require('node:crypto');
const { createConversationIdentity } = require('./conversationIdentity');

const DIAGNOSTIC_REPLY = 'KNEC Digital Assistant development test: your message reached the test system. This is a connectivity check; no KNEC service request has been submitted.';

class DeliveryService {
  constructor({ store, adapter, accountSid, sender, participant, secret, version, runId, maxAttempts }) {
    this.store = store;
    this.adapter = adapter;
    this.participant = participant;
    this.runId = runId;
    this.accountSid = accountSid;
    this.conversationId = createConversationIdentity({ secret, version, accountSid, sender, participant });
    this.binding = createHmac('sha256', secret)
      .update(JSON.stringify(['knec-delivery-run-v1', accountSid, sender, participant, version]))
      .digest('hex');
    this.maxAttempts = maxAttempts;
  }

  async initialize() {
    await this.store.openRun({ id: this.runId, accountSid: this.accountSid,
      binding: this.binding, maxAttempts: this.maxAttempts });
  }

  async inbound(body) {
    // Keep provider normalization as the structural/account validation boundary.
    const messages = this.adapter.normalizeInboundPayload(body);
    if (body.From !== this.participant) {
      const error = new Error('Participant is not permitted');
      error.statusCode = 403;
      throw error;
    }
    return this.store.accept({ runId: this.runId, accountSid: this.accountSid,
      messageSid: body.MessageSid, conversationId: this.conversationId, supported: messages.length > 0 });
  }

  async status(body) {
    const event = this.adapter.normalizeStatusCallback(body);
    return this.store.callback({ runId: this.runId, accountSid: this.accountSid,
      messageSid: event.messageId, status: event.status, errorCode: event.errorCode });
  }
}

module.exports = { DeliveryService, DIAGNOSTIC_REPLY };
