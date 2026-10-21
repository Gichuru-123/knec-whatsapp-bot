const logger = require('../../logger');

/**
 * Privacy-safe phone number masking for logs (owner decision 2A).
 * Only the last 3 characters are shown, behind a fixed-length mask that does not reveal the
 * number's length: "254712345678" -> "******678". Values shorter than 7 characters are fully hidden.
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '[UNKNOWN_PHONE]';
  const trimmed = phone.trim();
  if (trimmed.length < 7) return '[REDACTED_PHONE]';
  return `******${trimmed.slice(-3)}`;
}

/**
 * Phase 4 Hand-off Stub Interface.
 * Processes normalized WhatsApp message collections without logging message text
 * or implementing Phase 5 conversation state machine/menu routing.
 */
class ConversationHandOff {
  maskPhoneNumber(phone) {
    return maskPhoneNumber(phone);
  }

  async handleInboundMessage(normalizedMessage) {
    if (!normalizedMessage) {
      logger.debug('Hand-off stub received null or unparseable event.');
      return { status: 'ignored', reason: 'unsupported_event' };
    }

    const maskedPhone = maskPhoneNumber(normalizedMessage.senderPhone);

    // CRITICAL PRIVACY BOUNDARY: Do NOT log normalizedMessage.textBody or text previews
    logger.info(`Phase 4 Hand-Off Received Message`, {
      messageId: normalizedMessage.messageId,
      type: normalizedMessage.type,
      senderPhone: maskedPhone,
      provider: normalizedMessage.rawProvider
    });

    return {
      status: 'received',
      messageId: normalizedMessage.messageId,
      handOffPhase: 'Phase 4 Stub'
    };
  }

  async handleInboundBatch(normalizedMessages) {
    if (!Array.isArray(normalizedMessages) || normalizedMessages.length === 0) {
      return { processedCount: 0 };
    }

    const results = [];
    for (const msg of normalizedMessages) {
      const res = await this.handleInboundMessage(msg);
      results.push(res);
    }

    return { processedCount: results.length, results };
  }
}

module.exports = new ConversationHandOff();
