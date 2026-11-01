'use strict';
const { DeliveryStore, createPool } = require('../../repository/deliveryStore');
const { DeliveryService } = require('./deliveryService');
const { DeliveryWorker } = require('./deliveryWorker');
const { createSender } = require('./twilioHttpClient');
const Adapter = require('./twilioAdapter');

async function createDeliveryRuntime(settings) {
  if (!settings.delivery || settings.nodeEnv !== 'development' || settings.twilio?.mode !== 'sandbox') throw new Error('Invalid delivery runtime');
  const store = new DeliveryStore(createPool(settings.delivery.databaseUrl));
  try {
    await store.health();
    const service = new DeliveryService({ store, adapter: new Adapter({ settings }),
      accountSid: settings.twilio.accountSid, sender: settings.twilio.from, participant: settings.twilio.recipient,
      secret: settings.delivery.secret, version: settings.delivery.version,
      runId: settings.delivery.runId, maxAttempts: settings.delivery.maxAttempts });
    await service.initialize();
    const worker = settings.twilio.liveSendEnabled ? new DeliveryWorker({ store,
      send: createSender(settings.twilio), runId: settings.delivery.runId, participant: settings.twilio.recipient }) : null;
    return { service, start() { worker?.start(); }, async stop() { await worker?.stop(); },
      async close() { await worker?.stop(); await store.close(); } };
  } catch {
    await store.close();
    throw new Error('Delivery startup failed');
  }
}

module.exports = { createDeliveryRuntime };
