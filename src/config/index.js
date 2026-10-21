const path = require('path');

// A personal .env file is for running the app locally. Automated tests run with NODE_ENV=test
// and never read it, so test results cannot depend on the developer's own machine or credentials.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

// Values that have appeared in this repository's code or examples. They are public, so they are
// rejected as credentials in every environment.
const KNOWN_PUBLIC_PLACEHOLDER_VALUES = [
  'test-verify-token-123',
  'test-app-secret-456',
  'your_verify_token_here',
  'your_app_secret_here',
  'your_access_token_here',
  'your_phone_number_id_here'
];

function validateConfig(env) {
  const errors = [];

  // Reject partial numbers, blanks, fractions and values that overflow JS/Node timers.
  function integerSetting(name, fallback, min, max = Number.MAX_SAFE_INTEGER) {
    const raw = env[name] === undefined ? String(fallback) : env[name];
    const value = Number(raw);
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
      errors.push(`Invalid ${name}: must be a whole number from ${min} to ${max}.`);
    }
    return value;
  }

  // 1. PORT Validation
  const port = integerSetting('PORT', 3000, 1, 65535);

  // 2. NODE_ENV Validation
  const nodeEnv = env.NODE_ENV || 'development';
  const allowedEnvs = ['development', 'test', 'production'];
  if (!allowedEnvs.includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV configuration: "${env.NODE_ENV}". Must be one of: ${allowedEnvs.join(', ')}.`);
  }

  // 3. LOG_LEVEL Validation
  const logLevel = env.LOG_LEVEL || 'info';
  const allowedLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!allowedLogLevels.includes(logLevel)) {
    errors.push(`Invalid LOG_LEVEL configuration: "${env.LOG_LEVEL}". Must be one of: ${allowedLogLevels.join(', ')}.`);
  }

  // 4. ALLOWED_ORIGINS Validation
  const rawOrigins = env.ALLOWED_ORIGINS || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
  if (allowedOrigins.length === 0) {
    errors.push(`Invalid ALLOWED_ORIGINS configuration: "${env.ALLOWED_ORIGINS}". Must contain at least one valid origin.`);
  }

  // 5. ENABLE_DEV_INSPECTION_ROUTES Validation
  let enableDevInspectionRoutes;
  if (env.ENABLE_DEV_INSPECTION_ROUTES !== undefined) {
    const val = String(env.ENABLE_DEV_INSPECTION_ROUTES).toLowerCase();
    if (val !== 'true' && val !== 'false') {
      errors.push(`Invalid ENABLE_DEV_INSPECTION_ROUTES configuration: "${env.ENABLE_DEV_INSPECTION_ROUTES}". Must be "true" or "false".`);
    }
    enableDevInspectionRoutes = val === 'true';
  } else {
    enableDevInspectionRoutes = false;
  }

  if (enableDevInspectionRoutes && !['development', 'test'].includes(nodeEnv)) {
    errors.push('ENABLE_DEV_INSPECTION_ROUTES may only be enabled for local development or tests.');
  }

  // 6. Phase 4 WhatsApp Configuration
  const whatsappProvider = typeof env.WHATSAPP_PROVIDER === 'string' ? env.WHATSAPP_PROVIDER.toLowerCase() : '';
  if (!['meta', 'mock'].includes(whatsappProvider)) {
    errors.push('Invalid WHATSAPP_PROVIDER: explicit selection of "meta" or "mock" is required.');
  }

  // Strict Mock Mode Boundary: Allowed ONLY in development or test
  if (whatsappProvider === 'mock' && !['development', 'test'].includes(nodeEnv)) {
    errors.push(`Security Violation: WHATSAPP_PROVIDER="mock" is allowed ONLY in "development" or "test" environments. Current NODE_ENV="${nodeEnv}".`);
  }

  // Meta Graph API version: no built-in default. It must be set explicitly and checked against
  // Meta's list of supported versions before live use.
  const metaGraphApiVersion = env.META_GRAPH_API_VERSION || '';
  if (whatsappProvider === 'meta' && !metaGraphApiVersion) {
    errors.push('Missing META_GRAPH_API_VERSION: required when WHATSAPP_PROVIDER="meta". Set it explicitly after checking https://developers.facebook.com/docs/graph-api/changelog/versions/.');
  } else if (metaGraphApiVersion && !/^v\d+\.\d+$/.test(metaGraphApiVersion)) {
    errors.push(`Invalid META_GRAPH_API_VERSION: "${metaGraphApiVersion}". Must follow the format "vNN.N".`);
  }

  // Credentials: no fallback values in any environment.
  const whatsappVerifyToken = env.WHATSAPP_VERIFY_TOKEN || '';
  const whatsappAppSecret = env.WHATSAPP_APP_SECRET || '';
  const whatsappAccessToken = env.WHATSAPP_ACCESS_TOKEN || '';
  const whatsappPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || '';

  if (!whatsappVerifyToken) {
    errors.push('Missing WHATSAPP_VERIFY_TOKEN: required in every environment. Choose your own random string (Meta does not issue this value).');
  }
  if (whatsappProvider === 'meta' && !whatsappAppSecret) {
    errors.push('Missing WHATSAPP_APP_SECRET: required when WHATSAPP_PROVIDER="meta". For local development without Meta credentials, use WHATSAPP_PROVIDER=mock.');
  }

  // Reject publicly known placeholder values. Error messages name the setting, never its value.
  const credentialSettings = {
    WHATSAPP_VERIFY_TOKEN: whatsappVerifyToken,
    WHATSAPP_APP_SECRET: whatsappAppSecret,
    WHATSAPP_ACCESS_TOKEN: whatsappAccessToken,
    WHATSAPP_PHONE_NUMBER_ID: whatsappPhoneNumberId
  };
  for (const [name, value] of Object.entries(credentialSettings)) {
    if (typeof value !== 'string' || (value && (!value.trim() || value !== value.trim()))) {
      errors.push(`Invalid ${name}: must be a non-blank string without surrounding whitespace.`);
    }
    if (value && KNOWN_PUBLIC_PLACEHOLDER_VALUES.includes(value)) {
      errors.push(`Insecure ${name}: the configured value is a publicly known placeholder. Replace it with your own value.`);
    }
    if (nodeEnv === 'production' && /(?:^test[-_]|^fake[-_]|fixture|not-a-secret|^your[_-])/i.test(value)) {
      errors.push(`Insecure ${name}: test fixtures and example values cannot be used in production.`);
    }
  }

  // Strict Fail-Fast Validation for Production Meta Credentials
  if (nodeEnv === 'production' && whatsappProvider === 'meta') {
    if (!whatsappAccessToken) errors.push('Production Configuration Error: WHATSAPP_ACCESS_TOKEN is required in production.');
    if (!whatsappPhoneNumberId) errors.push('Production Configuration Error: WHATSAPP_PHONE_NUMBER_ID is required in production.');
  }

  // Meta Outbound Request Timeout (in ms)
  const metaRequestTimeoutMs = integerSetting('META_REQUEST_TIMEOUT_MS', 10000, 100, 2147483647);

  // Webhook JSON Body Size Limit (applies to the webhook only; other routes are limited to 10kb)
  const webhookBodyLimit = env.WEBHOOK_BODY_LIMIT === undefined ? '100kb' : env.WEBHOOK_BODY_LIMIT;
  const bodyMatch = typeof webhookBodyLimit === 'string' && /^(\d+)(b|kb|mb)$/i.exec(webhookBodyLimit);
  const bodyBytes = bodyMatch && Number(bodyMatch[1]) * ({ b: 1, kb: 1024, mb: 1048576 }[bodyMatch[2].toLowerCase()]);
  if (!bodyMatch || !Number.isSafeInteger(bodyBytes) || bodyBytes < 1) {
    errors.push(`Invalid WEBHOOK_BODY_LIMIT: "${webhookBodyLimit}". Must be a whole number followed by b, kb or mb (e.g. "100kb").`);
  }

  // Number of proxies/tunnels in front of the app. 0 (default) = trust none.
  const trustProxyHops = integerSetting('TRUST_PROXY_HOPS', 0, 0, 10);
  if (enableDevInspectionRoutes && nodeEnv === 'development' && trustProxyHops > 0) {
    errors.push('ENABLE_DEV_INSPECTION_ROUTES must be disabled when TRUST_PROXY_HOPS is greater than 0.');
  }

  // 7. Rate Limit Configuration
  const rateLimitWindowMs = integerSetting('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60000, 1000, 2147483647);
  const rateLimitMax = integerSetting('WEBHOOK_RATE_LIMIT_MAX', 100, 1);

  if (errors.length > 0) {
    throw new Error(`Configuration Error:\n - ${errors.join('\n - ')}`);
  }

  return {
    port,
    nodeEnv,
    logLevel,
    allowedOrigins,
    enableDevInspectionRoutes,
    whatsappProvider,
    metaGraphApiVersion,
    whatsappVerifyToken,
    whatsappAppSecret,
    whatsappAccessToken,
    whatsappPhoneNumberId,
    metaRequestTimeoutMs,
    webhookBodyLimit,
    trustProxyHops,
    rateLimitWindowMs,
    rateLimitMax
  };
}

const config = validateConfig(process.env);

// Exposed (non-enumerable, so it never appears when the config is listed or logged) so that tests can
// validate explicit settings without reloading this module or reading a developer's .env file.
Object.defineProperty(config, 'validateConfig', { value: validateConfig, enumerable: false });

module.exports = config;
