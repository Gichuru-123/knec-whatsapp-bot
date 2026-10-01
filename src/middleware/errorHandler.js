const logger = require('../logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  logger.error(`Unhandled Error: ${err.message}`, err);

  const statusCode = err.statusCode || err.status || 500;
  const response = {
    error: {
      message: statusCode === 500 && config.nodeEnv === 'production' 
        ? 'Internal Server Error' 
        : err.message,
      code: statusCode
    }
  };

  if (config.nodeEnv !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
