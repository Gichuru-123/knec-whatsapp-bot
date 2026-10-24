'use strict';
const handoff = require('../services/messaging/conversationHandOff');
const logger = require('../logger');

module.exports = {
  async inbound(req, res) {
    const messages = res.locals.twilioAdapter.normalizeInboundPayload(req.body);
    await handoff.handleInboundBatch(messages);
    return res.status(200).type('text/xml').send('<Response></Response>');
  },
  async status(req, res) {
    const event = res.locals.twilioAdapter.normalizeStatusCallback(req.body);
    // Receipt metadata only: this is not a persistent delivery record.
    logger.info('Twilio offline status callback received', event);
    return res.status(204).end();
  }
};
