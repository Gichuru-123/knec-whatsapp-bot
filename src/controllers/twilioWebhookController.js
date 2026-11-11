'use strict';
const handoff = require('../services/messaging/conversationHandOff');
const logger = require('../logger');

module.exports = {
  async inbound(req, res) {
    if (req.app.locals.conversationRuntime) {
      await req.app.locals.conversationRuntime.inbound(req.body, res.locals.twilioAdapter);
      return res.status(200).type('text/xml').send('<Response></Response>');
    }
    if (req.app.locals.deliveryService) {
      await req.app.locals.deliveryService.inbound(req.body);
      return res.status(200).type('text/xml').send('<Response></Response>');
    }
    const messages = res.locals.twilioAdapter.normalizeInboundPayload(req.body);
    await handoff.handleInboundBatch(messages);
    return res.status(200).type('text/xml').send('<Response></Response>');
  },
  async status(req, res) {
    if (req.app.locals.conversationRuntime) {
      await req.app.locals.conversationRuntime.status(req.body, res.locals.twilioAdapter);
      return res.status(204).end();
    }
    if (req.app.locals.deliveryService) {
      await req.app.locals.deliveryService.status(req.body);
      return res.status(204).end();
    }
    const event = res.locals.twilioAdapter.normalizeStatusCallback(req.body);
    // Receipt metadata only: this is not a persistent delivery record.
    logger.info('Twilio offline status callback received', event);
    return res.status(204).end();
  }
};
