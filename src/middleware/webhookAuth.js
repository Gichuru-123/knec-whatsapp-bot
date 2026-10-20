const AdapterFactory = require('../services/messaging/adapterFactory');
const logger = require('../logger');

function webhookAuth(req, res, next) {
  const adapter = AdapterFactory.getAdapter();
  
  if (!adapter.validateSignature(req)) {
    logger.warn('Webhook HMAC signature validation failed', {
      ip: req.ip,
      requestId: req.headers['x-request-id']
    });
    return res.status(401).json({
      error: {
        code: 401,
        message: 'Unauthorized: Invalid or missing webhook signature.'
      }
    });
  }

  next();
}

module.exports = webhookAuth;
