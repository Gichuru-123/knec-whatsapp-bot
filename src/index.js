const config = require('./config');
const logger = require('./logger');

logger.info("Starting KNEC WhatsApp Bot Application Initialization...");

function main() {
  logger.info("Phase 1 initialization successful. Environment loaded.", {
    environment: config.nodeEnv,
    port: config.port
  });
}

main();
