'use strict';

const { createConversationIdentity, createConversationEventIdentity } = require('../messaging/conversationIdentity');

class ConversationRuntime {
  #secret;

  constructor({ service, store, worker, accountSid, sender, participant, secret, version }) {
    if (!service || typeof service.process !== 'function' || !store || typeof store.recordCallback !== 'function' ||
        !worker || typeof worker.tick !== 'function') throw new Error('INVALID_CONVERSATION_RUNTIME');
    this.service = service;
    this.store = store;
    this.worker = worker;
    this.accountSid = accountSid;
    this.sender = sender;
    this.participant = participant;
    this.#secret = secret;
    this.version = version;
    // Validate and derive once without retaining any reversible participant identifier in storage.
    this.conversationId = createConversationIdentity({ secret, version, accountSid, sender, participant });
  }

  async inbound(body, adapter) {
    if (!adapter || typeof adapter.normalizeInboundPayload !== 'function') throw new Error('INVALID_CONVERSATION_ADAPTER');
    const messages = adapter.normalizeInboundPayload(body);
    if (body.From !== this.participant) {
      const error = new Error('PARTICIPANT_NOT_PERMITTED');
      error.statusCode = 403;
      throw error;
    }
    if (messages.length === 0) return { supported: false, duplicate: false };
    if (messages.length !== 1 || messages[0].messageId !== body.MessageSid || messages[0].type !== 'text') {
      const error = new Error('INVALID_CONVERSATION_MESSAGE');
      error.statusCode = 400;
      throw error;
    }
    const eventId = createConversationEventIdentity({ secret: this.#secret, accountSid: this.accountSid, messageSid: body.MessageSid });
    const result = await this.service.process({ conversationId: this.conversationId, eventId,
      accountSid: this.accountSid, input: messages[0].textBody });
    return { supported: true, duplicate: result.duplicate, sessionRevision: result.session.revision };
  }

  async status(body, adapter) {
    if (!adapter || typeof adapter.normalizeStatusCallback !== 'function') throw new Error('INVALID_CONVERSATION_ADAPTER');
    const event = adapter.normalizeStatusCallback(body);
    await this.store.recordCallback({ accountSid: this.accountSid, messageSid: event.messageId,
      status: event.status, errorCode: event.errorCode });
  }

  async dispatchOne() {
    return this.worker.tick();
  }
}

module.exports = { ConversationRuntime };
