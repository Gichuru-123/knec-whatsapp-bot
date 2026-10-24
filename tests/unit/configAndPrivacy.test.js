'use strict';
const assert = require('assert');
const test = require('node:test');
const conversationHandOff = require('../../src/services/messaging/conversationHandOff');
const logger = require('../../src/logger');

test('Phone Number Privacy: Masks senderPhone correctly', () => {
  const fullPhone = '254712345678';
  const masked = conversationHandOff.maskPhoneNumber(fullPhone);

  // R2b (decision 2A): only the last 3 digits are shown. This replaces the earlier "2547****5678" format.
  assert.strictEqual(masked, '******678');
  assert.ok(!masked.includes('2547'));
  assert.ok(!masked.includes('5678'));
});

test('Privacy Boundary: Hand-Off logging does NOT include text message content', async () => {
  let capturedLog = '';
  const originalLog = console.log;
  console.log = (msg) => { capturedLog += msg; };

  await conversationHandOff.handleInboundMessage({
    messageId: 'test-msg-101',
    senderPhone: '254700112233',
    type: 'text',
    textBody: 'SENSITIVE_STUDENT_ID_9999',
    rawProvider: 'meta'
  });

  console.log = originalLog;

  assert.ok(capturedLog.includes('test-msg-101'));
  assert.ok(capturedLog.includes('******233'));
  assert.ok(!capturedLog.includes('254700112233'), 'Log output MUST NOT contain the full phone number');
  assert.ok(!capturedLog.includes('SENSITIVE_STUDENT_ID_9999'), 'Log output MUST NOT contain raw message text');
});

test('R2b Phone masking: shows only the last 3 digits, hides the length, and fully hides short values', () => {
  const cases = [
    ['254712345678', '******678'],
    ['+254712345678', '******678'],
    ['12345678', '******678'],
    ['1234567', '******567'],
    ['123456', '[REDACTED_PHONE]'],
    ['12', '[REDACTED_PHONE]'],
    ['', '[UNKNOWN_PHONE]'],
    [null, '[UNKNOWN_PHONE]'],
    [254712345678, '[UNKNOWN_PHONE]']
  ];

  for (const [input, expected] of cases) {
    assert.strictEqual(conversationHandOff.maskPhoneNumber(input), expected, `mask(${input})`);
  }

  // Numbers of different lengths produce masks of the same length.
  assert.strictEqual(
    conversationHandOff.maskPhoneNumber('254712345678').length,
    conversationHandOff.maskPhoneNumber('1234567').length
  );
});

test('R2b Mock adapter: simulated outbound messages log neither the full phone number nor the text', async () => {
  const MockWhatsAppAdapter = require('../../src/services/messaging/mockAdapter');
  let captured = '';
  const originalLog = console.log;
  console.log = (...args) => { captured += args.join(' ') + '\n'; };

  try {
    const result = await new MockWhatsAppAdapter().sendTextMessage('254711223344', 'PRIVATE_REPLY_TEXT_123');
    assert.ok(result.messages[0].id);
  } finally {
    console.log = originalLog;
  }

  assert.ok(captured.includes('[MOCK_DELIVERY]'), 'mock delivery line must be logged');
  assert.ok(captured.includes('******344'), 'masked recipient must be logged');
  assert.ok(!captured.includes('254711223344'), 'full phone number must not be logged');
  assert.ok(!captured.includes('PRIVATE_REPLY_TEXT_123'), 'message text must not be logged');
});

// Runs fn with LOG_LEVEL temporarily set, capturing everything the logger writes to the console.
function captureLogsAt(level, fn) {
  const saved = { level: process.env.LOG_LEVEL, log: console.log, warn: console.warn, error: console.error };
  let captured = '';
  const capture = (...args) => { captured += args.join(' ') + '\n'; };
  process.env.LOG_LEVEL = level;
  console.log = capture;
  console.warn = capture;
  console.error = capture;
  try {
    fn();
  } finally {
    if (saved.level === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = saved.level;
    console.log = saved.log;
    console.warn = saved.warn;
    console.error = saved.error;
  }
  return captured;
}

function writeOneOfEach() {
  logger.debug('DEBUG_LINE');
  logger.info('INFO_LINE');
  logger.warn('WARN_LINE');
  logger.error('ERROR_LINE');
}

test('R2b LOG_LEVEL: "warn" hides debug and info lines but keeps warnings and errors', () => {
  const out = captureLogsAt('warn', writeOneOfEach);
  assert.ok(!out.includes('DEBUG_LINE'));
  assert.ok(!out.includes('INFO_LINE'));
  assert.ok(out.includes('WARN_LINE'));
  assert.ok(out.includes('ERROR_LINE'));
});

test('R2b LOG_LEVEL: debug lines appear only when LOG_LEVEL is "debug"', () => {
  const atInfo = captureLogsAt('info', writeOneOfEach);
  assert.ok(!atInfo.includes('DEBUG_LINE'), 'debug must be hidden at the default "info" level');
  assert.ok(atInfo.includes('INFO_LINE'));

  const atDebug = captureLogsAt('debug', writeOneOfEach);
  assert.ok(atDebug.includes('DEBUG_LINE'));
  assert.ok(atDebug.includes('INFO_LINE'));

  const atError = captureLogsAt('error', writeOneOfEach);
  assert.ok(!atError.includes('WARN_LINE'));
  assert.ok(atError.includes('ERROR_LINE'));
});

// Configuration tests below validate explicit settings objects. They never modify process.env
// and never read a developer's .env file, so they give the same result on every machine.
const config = require('../../src/config');
const TEST_ENV = require('../helpers/testEnv');
const { validateConfig } = config;

// Builds an explicit settings object from the test fixtures. Setting a key to undefined removes it.
function settings(overrides = {}) {
  return { ...TEST_ENV, ...overrides };
}

test('Production Configuration: Rejects mock mode in production or staging', () => {
  assert.throws(() => {
    validateConfig(settings({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'mock' }));
  }, /WHATSAPP_PROVIDER="mock" is allowed ONLY in "development" or "test" environments/);
});

test('Production Configuration: Rejects missing Meta access token and phone number ID in production', () => {
  assert.throws(() => {
    validateConfig(settings({ NODE_ENV: 'production', WHATSAPP_ACCESS_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined }));
  }, (err) => /WHATSAPP_ACCESS_TOKEN is required in production/.test(err.message)
    && /WHATSAPP_PHONE_NUMBER_ID is required in production/.test(err.message));
});

test('R1 No fallback secrets: missing WHATSAPP_APP_SECRET is rejected outside production (meta provider)', () => {
  for (const nodeEnv of ['development', 'test']) {
    assert.throws(() => {
      validateConfig(settings({ NODE_ENV: nodeEnv, WHATSAPP_APP_SECRET: undefined }));
    }, /Missing WHATSAPP_APP_SECRET/, `NODE_ENV=${nodeEnv} must not fall back to a built-in app secret`);
  }
});

test('R1 No fallback secrets: missing WHATSAPP_VERIFY_TOKEN is rejected in every environment', () => {
  for (const nodeEnv of ['development', 'test', 'production']) {
    assert.throws(() => {
      validateConfig(settings({ NODE_ENV: nodeEnv, WHATSAPP_VERIFY_TOKEN: undefined }));
    }, /Missing WHATSAPP_VERIFY_TOKEN/, `NODE_ENV=${nodeEnv} must not fall back to a built-in verify token`);
  }
});

test('R1 API version: META_GRAPH_API_VERSION has no default and must be explicit for the meta provider', () => {
  assert.throws(() => {
    validateConfig(settings({ META_GRAPH_API_VERSION: undefined }));
  }, /Missing META_GRAPH_API_VERSION/);

  for (const badValue of ['19.0', 'v19', 'latest', 'v26.0; rm']) {
    assert.throws(() => {
      validateConfig(settings({ META_GRAPH_API_VERSION: badValue }));
    }, /Invalid META_GRAPH_API_VERSION/, `"${badValue}" must be rejected`);
  }

  const explicit = validateConfig(settings({ META_GRAPH_API_VERSION: 'v25.0' }));
  assert.strictEqual(explicit.metaGraphApiVersion, 'v25.0');
});

test('R1 Placeholders: publicly known placeholder credentials are rejected without echoing the value', () => {
  const cases = [
    ['WHATSAPP_APP_SECRET', 'test-app-secret-456'],
    ['WHATSAPP_APP_SECRET', 'your_app_secret_here'],
    ['WHATSAPP_VERIFY_TOKEN', 'test-verify-token-123'],
    ['WHATSAPP_VERIFY_TOKEN', 'your_verify_token_here'],
    ['WHATSAPP_ACCESS_TOKEN', 'your_access_token_here'],
    ['WHATSAPP_PHONE_NUMBER_ID', 'your_phone_number_id_here']
  ];

  for (const [name, value] of cases) {
    assert.throws(() => {
      validateConfig(settings({ [name]: value }));
    }, (err) => err.message.includes(`Insecure ${name}`) && !err.message.includes(value),
    `${name} placeholder must be rejected and its value must not appear in the error`);
  }
});

test('R1 Local development: mock provider starts without any Meta credentials or API version', () => {
  const local = validateConfig({
    NODE_ENV: 'development',
    WHATSAPP_PROVIDER: 'mock',
    WHATSAPP_VERIFY_TOKEN: 'my-own-local-verify-token'
  });

  assert.strictEqual(local.whatsappProvider, 'mock');
  assert.strictEqual(local.whatsappAppSecret, '');
  assert.strictEqual(local.whatsappAccessToken, '');
  assert.strictEqual(local.metaGraphApiVersion, '');
});

test('R1 Determinism: test runtime configuration comes from test fixtures, not a personal .env file', () => {
  assert.strictEqual(config.nodeEnv, 'test');
  assert.strictEqual(config.whatsappVerifyToken, TEST_ENV.WHATSAPP_VERIFY_TOKEN);
  assert.strictEqual(config.whatsappAppSecret, TEST_ENV.WHATSAPP_APP_SECRET);
  assert.strictEqual(config.metaGraphApiVersion, TEST_ENV.META_GRAPH_API_VERSION);

  // validateConfig reads only the object it is given, never process.env.
  const isolated = validateConfig(settings({ PORT: '4321' }));
  assert.strictEqual(isolated.port, 4321);
  assert.strictEqual(config.port, 3000);

  // The helper is not part of the listed configuration values.
  assert.ok(!Object.keys(config).includes('validateConfig'));
  assert.ok(!JSON.stringify(config).includes('validateConfig'));
});

test('R2a TRUST_PROXY_HOPS: defaults to 0 (trust no proxy) and accepts only whole numbers from 0 to 10', () => {
  assert.strictEqual(validateConfig(settings({ TRUST_PROXY_HOPS: undefined })).trustProxyHops, 0);
  assert.strictEqual(validateConfig(settings({ TRUST_PROXY_HOPS: '1' })).trustProxyHops, 1);

  for (const badValue of ['-1', 'true', '1.5', '11', 'one']) {
    assert.throws(() => {
      validateConfig(settings({ TRUST_PROXY_HOPS: badValue }));
    }, /Invalid TRUST_PROXY_HOPS/, `"${badValue}" must be rejected`);
  }
});

test('R2a WEBHOOK_BODY_LIMIT: accepts sizes such as 100kb and rejects malformed values', () => {
  for (const goodValue of ['100kb', '1mb', '512b', '64KB']) {
    assert.strictEqual(validateConfig(settings({ WEBHOOK_BODY_LIMIT: goodValue })).webhookBodyLimit, goodValue);
  }

  for (const badValue of ['abc', '100 kb', '-5kb', '10gb', '1.5mb']) {
    assert.throws(() => {
      validateConfig(settings({ WEBHOOK_BODY_LIMIT: badValue }));
    }, /Invalid WEBHOOK_BODY_LIMIT/, `"${badValue}" must be rejected`);
  }
});

test('Phase 4 repair: provider selection must be explicit', () => {
  for (const value of [undefined, '', ' ', 'unknown']) {
    assert.throws(() => validateConfig(settings({ WHATSAPP_PROVIDER: value })), /Invalid WHATSAPP_PROVIDER/);
  }
});

test('Phase 4 repair: inspection defaults off and requires an appropriate explicit opt-in', () => {
  for (const nodeEnv of ['development', 'test']) {
    assert.strictEqual(validateConfig(settings({ NODE_ENV: nodeEnv, ENABLE_DEV_INSPECTION_ROUTES: undefined })).enableDevInspectionRoutes, false);
    assert.strictEqual(validateConfig(settings({ NODE_ENV: nodeEnv, ENABLE_DEV_INSPECTION_ROUTES: 'true' })).enableDevInspectionRoutes, true);
  }
  assert.throws(() => validateConfig(settings({ NODE_ENV: 'production', ENABLE_DEV_INSPECTION_ROUTES: 'true' })), /only be enabled for local development or tests/);
  assert.throws(() => validateConfig(settings({ NODE_ENV: 'development', ENABLE_DEV_INSPECTION_ROUTES: 'true', TRUST_PROXY_HOPS: '1' })), /must be disabled/);
});

test('Phase 4 repair: numeric configuration rejects partial, unsafe and overflowing values', () => {
  for (const name of ['PORT', 'META_REQUEST_TIMEOUT_MS', 'WEBHOOK_RATE_LIMIT_WINDOW_MS', 'WEBHOOK_RATE_LIMIT_MAX', 'TRUST_PROXY_HOPS']) {
    for (const value of ['', '1000junk', '1.5', '-1', ' 1000', '1000 ', '1e3', '0x10', 'Infinity', '9007199254740992']) {
      assert.throws(() => validateConfig(settings({ [name]: value })), new RegExp(`Invalid ${name}`), `${name} must reject ${value}`);
    }
  }
  for (const name of ['META_REQUEST_TIMEOUT_MS', 'WEBHOOK_RATE_LIMIT_WINDOW_MS']) {
    assert.throws(() => validateConfig(settings({ [name]: '2147483648' })), new RegExp(`Invalid ${name}`));
  }
  for (const value of ['', '0kb', '9007199254740992mb']) {
    assert.throws(() => validateConfig(settings({ WEBHOOK_BODY_LIMIT: value })), /Invalid WEBHOOK_BODY_LIMIT/);
  }
  assert.strictEqual(validateConfig(settings({ PORT: '4321', META_REQUEST_TIMEOUT_MS: '2000' })).port, 4321);
});

test('Phase 4 repair: public fixture credentials are rejected in production without being echoed', () => {
  for (const [name, value] of Object.entries(TEST_ENV).filter(([name, value]) => /TOKEN|SECRET/.test(name) && value)) {
    assert.throws(() => validateConfig(settings({ NODE_ENV: 'production', ENABLE_DEV_INSPECTION_ROUTES: 'false' })),
      err => err.message.includes(`Insecure ${name}`) && !err.message.includes(value));
  }
  for (const name of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']) {
    assert.throws(() => validateConfig(settings({ NODE_ENV: 'production', ENABLE_DEV_INSPECTION_ROUTES: 'false', [name]: 'test-fixture-value-not-a-secret' })),
      err => err.message.includes(`Insecure ${name}`) && !err.message.includes('test-fixture-value-not-a-secret'));
  }
});

test('Phase 4 repair: child context, nested payloads and errors cannot disclose private data', () => {
  const privateText = 'PRIVATE_CONTENT_SENTINEL';
  const privatePhone = '254711223344';
  const child = logger.child({
    token: 'PRIVATE_TOKEN_SENTINEL',
    nested: [{ textBody: privateText, response: { arbitrary: privateText }, senderPhone: privatePhone }],
    problem: new Error(privateText)
  }).child({ requestId: 'safe-correlation-id' });
  const formatted = child.formatMessage('warn', 'Static event label', { recipient: privatePhone });
  assert.ok(formatted.includes('safe-correlation-id'));
  for (const value of [privateText, privatePhone, 'PRIVATE_TOKEN_SENTINEL']) assert.ok(!formatted.includes(value));
  assert.ok(!formatted.includes('configAndPrivacy.test.js'), 'stack paths must not be logged');

  const err = new Error(privateText);
  const withError = logger.formatMessage('error', `Failure: ${err.message}`, err);
  assert.ok(!withError.includes(privateText));
  assert.ok(!logger.formatMessage('error', err).includes(privateText));
  assert.ok(!logger.formatMessage('error', 'Rejected promise', privateText).includes(privateText));
});

test('Phase 4 repair: configured secrets and full phone numbers are scrubbed from string metadata', () => {
  const line = logger.formatMessage('info', `Event ${TEST_ENV.WHATSAPP_VERIFY_TOKEN}`, {
    requestId: TEST_ENV.WHATSAPP_APP_SECRET,
    userAgent: 'contact +254711223344',
    nested: { url: 'https://example.invalid/?hub.verify_token=private-query-value' }
  });
  for (const value of [TEST_ENV.WHATSAPP_VERIFY_TOKEN, TEST_ENV.WHATSAPP_APP_SECRET, '254711223344', 'private-query-value']) assert.ok(!line.includes(value));
});

test('Phase 4 repair: circular error context remains loggable without exposing exception content', () => {
  const context = { failure: new Error('PRIVATE_CIRCULAR_SENTINEL') };
  context.self = context;
  const line = logger.child(context).formatMessage('error', 'Static failure');
  assert.ok(line.includes('[CIRCULAR]'));
  assert.ok(!line.includes('PRIVATE_CIRCULAR_SENTINEL'));
});

test('Phase 4 repair: phone redaction preserves UUID correlation identifiers', () => {
  const requestId = '0a4d0cec-ad2f-48c5-9ad8-123456789012';
  assert.ok(logger.formatMessage('info', 'Request finished', { requestId }).includes(requestId));
});

const TWILIO_ENV = {
  ...TEST_ENV, WHATSAPP_PROVIDER: 'twilio', ENABLE_DEV_INSPECTION_ROUTES: 'false',
  META_GRAPH_API_VERSION: '', WHATSAPP_VERIFY_TOKEN: '', WHATSAPP_APP_SECRET: '',
  TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'test-fixture-twilio-not-a-secret',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+15005550006', TWILIO_TEST_RECIPIENT: 'whatsapp:+15005550007',
  TWILIO_INBOUND_WEBHOOK_URL: 'https://example.test/api/v1/webhook/twilio/whatsapp',
  TWILIO_STATUS_CALLBACK_URL: 'https://example.test/api/v1/webhook/twilio/status'
};

test('Twilio configuration: test-only provider needs no Meta credentials and cannot enable sending', () => {
  const accepted = validateConfig(TWILIO_ENV);
  assert.equal(accepted.whatsappVerifyToken, '');
  assert.equal(accepted.twilio.liveSendEnabled, false);
  for (const NODE_ENV of ['development', 'production']) {
    assert.throws(() => validateConfig({ ...TWILIO_ENV, NODE_ENV }), /restricted to NODE_ENV=test/);
  }
  for (const value of ['true', 'FALSE', '', '1', true]) {
    assert.throws(() => validateConfig({ ...TWILIO_ENV, TWILIO_LIVE_SEND_ENABLED: value }), /TWILIO_LIVE_SEND_ENABLED/);
  }
  assert.equal(validateConfig({ ...TWILIO_ENV, TWILIO_LIVE_SEND_ENABLED: undefined }).twilio.liveSendEnabled, false);
  assert.equal(validateConfig({ ...TEST_ENV, TWILIO_AUTH_TOKEN: 'ignored inactive value' }).twilio, undefined);
});

test('Twilio configuration: required fields, numbers and endpoint binding fail without echoing values', () => {
  for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', 'TWILIO_TEST_RECIPIENT', 'TWILIO_INBOUND_WEBHOOK_URL', 'TWILIO_STATUS_CALLBACK_URL']) {
    for (const value of [undefined, '', ' ']) assert.throws(() => validateConfig({ ...TWILIO_ENV, [name]: value }), new RegExp(name));
  }
  for (const value of ['', '10junk', '1.5', ' 100', '99', '30001', '9007199254740992']) {
    assert.throws(() => validateConfig({ ...TWILIO_ENV, TWILIO_REQUEST_TIMEOUT_MS: value }), /TWILIO_REQUEST_TIMEOUT_MS/);
  }
  // Build a clearly synthetic credential-bearing URL to exercise rejection without storing a Basic Auth literal.
  const credentialUrl = new URL(TWILIO_ENV.TWILIO_INBOUND_WEBHOOK_URL);
  credentialUrl.username = 'public-fixture-user';
  credentialUrl.password = 'public-fixture-password';
  for (const value of ['http://example.test/api/v1/webhook/twilio/whatsapp', credentialUrl.href,
    'https://example.test/wrong', 'https://example.test/api/v1/webhook/twilio/whatsapp/',
    'https://example.test/api/v1/webhook/twilio/whatsapp#fragment', 'https://example.test/api/v1/webhook/twilio/whatsapp?bad=%zz']) {
    assert.throws(() => validateConfig({ ...TWILIO_ENV, TWILIO_INBOUND_WEBHOOK_URL: value }), err => /TWILIO_INBOUND_WEBHOOK_URL/.test(err.message) && !err.message.includes(value));
  }
  for (const value of ['+15005550006', 'whatsapp:+0', 'whatsapp:+1234567890123456', 'whatsapp:+12x']) {
    assert.throws(() => validateConfig({ ...TWILIO_ENV, TWILIO_WHATSAPP_FROM: value }), /TWILIO_WHATSAPP_FROM/);
  }
  const url = TWILIO_ENV.TWILIO_INBOUND_WEBHOOK_URL + '?note=a%20b&x=%2B';
  assert.equal(validateConfig({ ...TWILIO_ENV, TWILIO_INBOUND_WEBHOOK_URL: url }).twilio.inbound.url, url);
});

test('Twilio privacy: configured Auth Token is redacted in labels and child context', () => {
  const previous = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_AUTH_TOKEN = TWILIO_ENV.TWILIO_AUTH_TOKEN;
  try {
    const line = logger.child({ twilioAuthToken: TWILIO_ENV.TWILIO_AUTH_TOKEN }).formatMessage('info', `Event ${TWILIO_ENV.TWILIO_AUTH_TOKEN}`);
    assert.ok(!line.includes(TWILIO_ENV.TWILIO_AUTH_TOKEN));
  } finally { process.env.TWILIO_AUTH_TOKEN = previous; }
});
