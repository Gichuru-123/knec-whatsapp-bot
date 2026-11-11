'use strict';

const { createPool, DeliveryStore } = require('../../repository/deliveryStore');
const { ConversationSessionStore } = require('../../repository/conversationSessionStore');
const { createConversationSender } = require('../messaging/twilioHttpClient');
const { ConversationService } = require('./conversationService');
const { ConversationResponseWorker } = require('./responseWorker');
const { ConversationRuntime } = require('./conversationRuntime');
const logger = require('../../logger');

async function createConversationApplicationRuntime(settings, { senderFactory = createConversationSender } = {}) {
  if (!settings.delivery || !settings.conversation?.enabled || settings.nodeEnv !== 'development' ||
      settings.twilio?.mode !== 'sandbox') throw new Error('Invalid conversation runtime');
  const pool = createPool(settings.delivery.databaseUrl);
  let timer;
  let activeTick;
  let stopped = true;
  try {
    await new DeliveryStore(pool).health();
    const store = new ConversationSessionStore(pool, { ttlSeconds: settings.conversation.ttlSeconds });
    const conversationService = new ConversationService({ store });
    const responseWorker = settings.twilio.liveSendEnabled
      ? new ConversationResponseWorker({ store, send: senderFactory(settings.twilio), participant: settings.twilio.recipient })
      : null;
    const service = new ConversationRuntime({ service: conversationService, store,
      worker: responseWorker || { tick: async () => false }, accountSid: settings.twilio.accountSid,
      sender: settings.twilio.from, participant: settings.twilio.recipient,
      secret: settings.delivery.secret, version: settings.delivery.version });

    const schedule = () => {
      if (stopped || !responseWorker) return;
      timer = setTimeout(async () => {
        activeTick = responseWorker.tick();
        try { await activeTick; } catch { logger.error('Conversation response worker tick failed'); }
        finally { activeTick = null; schedule(); }
      }, settings.conversation.pollIntervalMs);
      timer.unref?.();
    };
    async function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      if (activeTick) await activeTick;
    }
    return { service,
      start() { if (!stopped) return; stopped = false; schedule(); },
      stop,
      async close() { await stop(); await pool.end(); } };
  } catch {
    await pool.end();
    throw new Error('Conversation startup failed');
  }
}

module.exports = { createConversationApplicationRuntime };
