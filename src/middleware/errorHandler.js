const logger = require('../logger');
const { STATUS_CODES } = require('http');

function errorHandler(err, req, res, next) {
  const candidate = err && (err.statusCode || err.status);
  const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  // Exceptions can contain submitted JSON, credentials or provider responses. Never log them.
  logger.error('HTTP request failed', { statusCode, requestId: req.requestId });
  const response = {
    error: {
      message: STATUS_CODES[statusCode] || 'Request Failed',
      code: statusCode
    }
  };

  // The same safe boundary applies to development servers exposed through a tunnel.
  res.status(statusCode).json(response);
}

module.exports = errorHandler;
