'use strict';
const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const { createDeliveryRuntime } = require('./services/messaging/deliveryRuntime');
const { createConversationApplicationRuntime } = require('./services/conversation/applicationRuntime');

async function start() {
  let runtime;
  let server;
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    if (runtime) await runtime.stop();
    if (server) await new Promise(resolve => server.close(resolve));
    if (runtime) await runtime.close();
  }
  try {
    if (config.delivery) {
      runtime = config.conversation?.enabled
        ? await createConversationApplicationRuntime(config)
        : await createDeliveryRuntime(config);
      if (config.conversation?.enabled) app.locals.conversationRuntime = runtime.service;
      else app.locals.deliveryService = runtime.service;
    }
    await new Promise((resolve, reject) => {
      server = app.listen(config.port, config.delivery ? '127.0.0.1' : undefined, resolve);
      server.once('error', reject);
    });
    runtime?.start();
    logger.info('Application listener ready', { port: config.port });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      close().catch(() => { process.exitCode = 1; });
    });
    return { server, close };
  } catch {
    await close();
    throw new Error('Application startup failed');
  }
}

if (require.main === module) {
  // Never print unexpected exception objects: they may contain driver state.
  for (const event of ['uncaughtException', 'unhandledRejection']) process.once(event, () => {
    logger.error('Application fatal error');
    process.exit(1);
  });
  start().catch(() => {
    logger.error('Application startup failed');
    process.exitCode = 1;
  });
}

module.exports = { start };
