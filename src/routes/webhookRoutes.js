const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const webhookAuth = require('../middleware/webhookAuth');
const webhookRateLimiter = require('../middleware/rateLimiter');
const { readRawJsonBody, parseVerifiedJsonBody } = require('../middleware/webhookBody');

router.get('/whatsapp', webhookRateLimiter, (req, res) => webhookController.verifyWebhook(req, res));

// Order matters: limit the request rate, read the raw bytes, verify the signature on those exact
// bytes, and only then parse the JSON. Nothing in the message is processed before it is authenticated.
router.post(
  '/whatsapp',
  webhookRateLimiter,
  readRawJsonBody,
  webhookAuth,
  parseVerifiedJsonBody,
  (req, res, next) => webhookController.handleWebhookEvent(req, res).catch(next)
);

module.exports = router;
