'use strict';

const { createHmac } = require('node:crypto');

// JSON array encoding preserves field boundaries. The key is deliberately separate
// from provider credentials; callers must persist and check its version binding.
function createConversationIdentity({ secret, version, accountSid, sender, participant }) {
  if (!Buffer.isBuffer(secret) || secret.length < 32 ||
      !Number.isSafeInteger(version) || version < 1 ||
      typeof accountSid !== 'string' || !/^AC[0-9a-fA-F]{32}$/.test(accountSid) ||
      ![sender, participant].every(value => typeof value === 'string' && /^whatsapp:\+[1-9]\d{0,14}$/.test(value))) {
    throw new Error('Invalid conversation identity configuration');
  }
  const digest = createHmac('sha256', secret)
    .update(JSON.stringify(['twilio', accountSid, sender, participant]))
    .digest('hex');
  return `v${version}:${digest}`;
}

function createConversationEventIdentity({ secret, accountSid, messageSid }) {
  if (!Buffer.isBuffer(secret) || secret.length < 32 ||
      typeof accountSid !== 'string' || !/^AC[0-9a-fA-F]{32}$/.test(accountSid) ||
      typeof messageSid !== 'string' || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(messageSid)) {
    throw new Error('Invalid conversation event identity configuration');
  }
  return createHmac('sha256', secret)
    .update(JSON.stringify(['twilio-event-v1', accountSid, messageSid]))
    .digest('hex');
}

module.exports = { createConversationIdentity, createConversationEventIdentity };
