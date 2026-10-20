const AdapterFactory = require('../services/messaging/adapterFactory');
const conversationHandOff = require('../services/messaging/conversationHandOff');
const logger = require('../logger');

class WebhookController {
  verifyWebhook(req, res) {
    const adapter = AdapterFactory.getAdapter();
    const { isValid, challenge } = adapter.verifyWebhook(req.query);

    if (isValid) {
      logger.info('Webhook verification challenge successful');
      // Echo the challenge as plain text so it can never be interpreted as a web page.
      return res.status(200).type('text/plain').send(String(challenge ?? ''));
    }

    logger.warn('Webhook verification challenge failed');
    return res.status(403).json({
      error: {
        code: 403,
        message: 'Forbidden: Invalid verification token.'
      }
    });
  }

  async handleWebhookEvent(req, res) {
    const adapter = AdapterFactory.getAdapter();
    const normalizedMessages = adapter.normalizeInboundPayload(req.body);

    // Hand off normalized batch to Phase 4 Stub
    await conversationHandOff.handleInboundBatch(normalizedMessages);

    // Always acknowledge provider with 200 OK
    return res.status(200).json({ status: 'acknowledged', count: normalizedMessages.length });
  }
}

module.exports = new WebhookController();
