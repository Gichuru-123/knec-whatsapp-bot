'use strict';
const express = require('express');
const rateLimit = require('../middleware/rateLimiter');
const body = require('../middleware/twilioWebhookBody');
const authenticate = require('../middleware/twilioWebhookAuth');
const controller = require('../controllers/twilioWebhookController');
const router = express.Router({ strict: true });

for (const [path, endpoint, handler] of [
  ['/whatsapp', 'inbound', controller.inbound],
  ['/status', 'status', controller.status]
]) {
  router.all(path, rateLimit, (req, res, next) => {
    if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).json({ error: { code: 405, message: 'Method Not Allowed' } });
    return next();
  }, body, authenticate(endpoint), (req, res, next) => handler(req, res).catch(next));
}
router.use((req, res) => res.status(404).json({ error: { code: 404, message: 'Not Found' } }));
module.exports = router;
