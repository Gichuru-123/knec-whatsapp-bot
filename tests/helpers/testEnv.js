'use strict';
/**
 * Test-only configuration fixtures, loaded by `npm test` (via --require) before any test file runs.
 *
 * - Sets NODE_ENV=test, so src/config never reads the developer's personal .env file.
 * - Sets every configuration value explicitly, so test results are the same on every machine.
 *
 * These values are deliberately public and are NOT secrets. They exist only for automated tests
 * and must never be copied into a .env file or used to run the application.
 */
const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  LOG_LEVEL: 'info',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  ENABLE_DEV_INSPECTION_ROUTES: 'true',
  WHATSAPP_PROVIDER: 'meta',
  META_GRAPH_API_VERSION: 'v26.0',
  WHATSAPP_VERIFY_TOKEN: 'test-fixture-verify-token-not-a-secret',
  WHATSAPP_APP_SECRET: 'test-fixture-app-secret-not-a-secret',
  WHATSAPP_ACCESS_TOKEN: '',
  WHATSAPP_PHONE_NUMBER_ID: '',
  META_REQUEST_TIMEOUT_MS: '10000',
  WEBHOOK_BODY_LIMIT: '100kb',
  WEBHOOK_RATE_LIMIT_WINDOW_MS: '60000',
  WEBHOOK_RATE_LIMIT_MAX: '100',
  TRUST_PROXY_HOPS: '0'
};

Object.assign(process.env, TEST_ENV);

module.exports = TEST_ENV;
