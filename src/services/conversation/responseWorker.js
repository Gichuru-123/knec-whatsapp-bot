'use strict';
const { randomUUID } = require('node:crypto');

class ConversationResponseWorker {
  constructor({ store, send, participant }) {
    if (!store || typeof store.claimOutbox !== 'function' || typeof store.ownsOutbox !== 'function' ||
        typeof store.finishOutbox !== 'function' || typeof send !== 'function' || typeof participant !== 'string') {
      throw new Error('INVALID_CONVERSATION_WORKER_CONFIGURATION');
    }
    this.store = store;
    this.send = send;
    this.participant = participant;
    this.owner = randomUUID();
  }

  async tick() {
    const claim = await this.store.claimOutbox(this.owner);
    if (!claim || !await this.store.ownsOutbox(claim)) return false;
    let result;
    try {
      const accepted = await this.send(this.participant, claim.body);
      result = { kind: 'accepted', messageId: accepted.messageId, status: accepted.status };
    } catch {
      result = { kind: 'uncertain' };
    }
    await this.store.finishOutbox(claim, result);
    return true;
  }
}

module.exports = { ConversationResponseWorker };
