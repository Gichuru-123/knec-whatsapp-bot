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

module.exports = { createConversationIdentity };
