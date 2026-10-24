'use strict';
const AdapterFactory = require('../services/messaging/adapterFactory');

module.exports = endpoint => (req, res, next) => {
  const adapter = AdapterFactory.getAdapter();
  if (!adapter.validateSignature(req, endpoint)) {
    return res.status(401).json({ error: { code: 401, message: 'Unauthorized: invalid webhook signature.' } });
  }
  res.locals.twilioAdapter = adapter;
  return next();
};
