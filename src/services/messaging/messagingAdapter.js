class MessagingAdapter {
  verifyWebhook(query) {
    throw new Error('verifyWebhook() method must be implemented by subclass.');
  }

  validateSignature(req) {
    throw new Error('validateSignature() method must be implemented by subclass.');
  }

  normalizeInboundPayload(body) {
    throw new Error('normalizeInboundPayload() method must be implemented by subclass.');
  }

  async sendTextMessage(to, text) {
    throw new Error('sendTextMessage() method must be implemented by subclass.');
  }
}

module.exports = MessagingAdapter;
