const crypto = require('crypto');
const logger = require('../logger');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
}

module.exports = requestLogger;
