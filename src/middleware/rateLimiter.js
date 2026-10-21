const rateLimit = require('express-rate-limit');
const config = require('../config');

const webhookRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 429,
      message: 'Too many requests. Webhook rate limit exceeded.'
    }
  }
});

module.exports = webhookRateLimiter;
