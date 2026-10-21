const MessagingAdapter = require('./messagingAdapter');
const config = require('../../config');
const logger = require('../../logger');
const conversationHandOff = require('./conversationHandOff');

class MockWhatsAppAdapter extends MessagingAdapter {
  constructor() {
    super();
    this.verifyToken = config.whatsappVerifyToken;
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
    return true; // Mock mode accepts all signatures
  }

  normalizeInboundPayload(body) {
    if (!body || !body.senderPhone || !body.textBody) {
      return [];
    }

    return [{
      messageId: body.messageId || 'mock-msg-' + Date.now(),
      senderPhone: body.senderPhone,
      timestamp: Date.now(),
      type: 'text',
      textBody: body.textBody,
      rawProvider: 'mock'
    }];
  }

  async sendTextMessage(to, text) {
    // Same privacy rule as the real adapter: never log the full phone number or the message text.
    logger.info('[MOCK_DELIVERY] Simulated outbound message', {
      recipient: conversationHandOff.maskPhoneNumber(to),
      textLength: typeof text === 'string' ? text.length : 0
    });
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to }],
      messages: [{ id: 'mock-msg-uuid-' + Date.now() }]
    };
  }
}

module.exports = MockWhatsAppAdapter;
