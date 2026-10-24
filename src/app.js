const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const kbRoutes = require('./routes/kbRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const twilioWebhookRoutes = require('./routes/twilioWebhookRoutes');
const kbRepository = require('./repository/kbRepository');

// Initialize and freeze Knowledge Base in memory on app startup (Fail-Fast Boundary)
kbRepository.loadKBData();

const app = express();

// Proxy trust: by default no proxy is trusted, so a client cannot fake its address with an
// X-Forwarded-For header. Set TRUST_PROXY_HOPS only to the exact number of tunnels/proxies in front of the app.
if (config.trustProxyHops > 0) {
  app.set('trust proxy', config.trustProxyHops);
}

// Helmet Security Headers
app.use(helmet());

// CORS: this API has no browser clients that send data. Meta calls the webhook server-to-server,
// which CORS does not affect, so browsers are only allowed simple GET requests.
app.use(cors((req, callback) => callback(null, {
  origin: config.allowedOrigins,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-request-id'],
  // Let webhook routers enforce their own allowed methods, including OPTIONS.
  preflightContinue: /^\/api\/v1\/webhook\/twilio(?:\/|$)/i.test(req.path)
})));

// Request Correlation & Logging
app.use(requestLogger);

// Provider webhooks precede the general JSON parser. Meta authenticates raw JSON before parsing;
// Twilio strictly decodes the bounded form before authenticating its scalar parameters.
const inactiveWebhook = (req, res) => res.status(404).json({ error: { code: 404, message: 'Not Found' } });
if (config.whatsappProvider === 'twilio') {
  app.use('/api/v1/webhook/twilio', twilioWebhookRoutes);
  app.use('/api/v1/webhook/whatsapp', inactiveWebhook);
} else {
  app.use('/api/v1/webhook/twilio', inactiveWebhook);
  app.use('/api/v1/webhook', webhookRoutes);
}

// All other routes: small JSON bodies only.
app.use(express.json({ limit: '10kb' }));

// Mount Application Routes
app.use('/health', healthRoutes);
app.use('/api/v1/kb', kbRoutes);

// Request-body size errors from any route
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 413,
        message: 'Payload Too Large: request body exceeds the configured limit.'
      }
    });
  }
  next(err);
});

// Centralized Fallback & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
