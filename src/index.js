const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const kbRepository = require('./repository/kbRepository');

logger.info("Initializing KNEC WhatsApp Bot Application...");

// Pre-load Knowledge Base on startup
kbRepository.loadKBData();

const server = app.listen(config.port, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

module.exports = server;
