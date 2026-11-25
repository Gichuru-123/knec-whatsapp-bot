'use strict';

const { randomUUID } = require('node:crypto');

const ACCEPTED_STATUSES = new Set(['accepted', 'queued', 'sending', 'sent', 'delivered', 'read']);

function isValidAcceptance(result) {
  return result && result.kind === 'accepted' &&
    typeof result.messageId === 'string' && /^(SM|MM)[0-9a-fA-F]{32}$/.test(result.messageId) &&
    ACCEPTED_STATUSES.has(result.status);
}

class ConversationResponseWorker {
  constructor({ store, send, recipientForConversation, participant, messagesPerParticipant = 50 }) {
    if (
      !store ||
      typeof store.claimOutbox !== 'function' ||
      typeof store.ownsOutbox !== 'function' ||
      typeof store.isWithinOutboxLimit !== 'function' ||
      typeof store.finishOutbox !== 'function' ||
      typeof send !== 'function' ||
      (typeof recipientForConversation !== 'function' && typeof participant !== 'string') ||
      !Number.isInteger(messagesPerParticipant) || messagesPerParticipant < 1 || messagesPerParticipant > 50
    ) {
      throw new Error('INVALID_CONVERSATION_WORKER_CONFIGURATION');
    }

    this.store = store;
    this.send = send;
    this.recipientForConversation = recipientForConversation || (() => participant);
    this.messagesPerParticipant = messagesPerParticipant;
    this.owner = randomUUID();
  }

  async tick() {
    const claim = await this.store.claimOutbox(this.owner);

    if (!claim || !await this.store.ownsOutbox(claim)) {
      return false;
    }

    if (!await this.store.isWithinOutboxLimit(claim, this.messagesPerParticipant)) {
      await this.store.finishOutbox(claim, { kind: 'failed' });
      return true;
    }

    let result;

    try {
      const participant = this.recipientForConversation(claim.conversation_id);
      if (typeof participant !== 'string') {
        await this.store.finishOutbox(claim, { kind: 'uncertain' });
        return true;
      }
      const sent = await this.send(participant, claim.body);

      if (isValidAcceptance(sent)) {
        result = {
          kind: 'accepted',
          messageId: sent.messageId,
          status: sent.status
        };
      } else if (
        sent &&
        (sent.kind === 'failed' || sent.kind === 'retry')
      ) {
        // Conversation outbox currently allows one send attempt.
        // Provider retry suggestions are not automatically replayed.
        result = { kind: 'failed' };
      } else {
        // Unknown acceptance must never trigger an automatic resend.
        result = { kind: 'uncertain' };
      }
    } catch {
      result = { kind: 'uncertain' };
    }

    await this.store.finishOutbox(claim, result);

    return true;
  }
}

module.exports = {
  ConversationResponseWorker
};
