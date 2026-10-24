'use strict';
const express = require('express');
const { TextDecoder } = require('node:util');
const config = require('../config');

const read = express.raw({ type: () => true, limit: config.webhookBodyLimit, inflate: false });
const badForm = res => res.status(400).json({ error: { code: 400, message: 'Bad Request: invalid webhook form.' } });

function twilioWebhookBody(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType) ||
      (req.headers['content-encoding'] && req.headers['content-encoding'].toLowerCase() !== 'identity')) {
    return res.status(415).json({ error: { code: 415, message: 'Unsupported Media Type' } });
  }
  read(req, res, error => {
    if (error) return next(error);
    try {
      if (!Buffer.isBuffer(req.body)) return badForm(res);
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(req.body);
      const pairs = text ? text.split('&') : [];
      if (pairs.length > 100) return badForm(res);
      const values = Object.create(null);
      for (const pair of pairs) {
        const separator = pair.indexOf('=');
        if (separator < 1) return badForm(res);
        const decode = value => decodeURIComponent(value.replace(/\+/g, ' '));
        const name = decode(pair.slice(0, separator));
        const value = decode(pair.slice(separator + 1));
        if (!name || Object.hasOwn(values, name)) return badForm(res);
        values[name] = value;
      }
      req.body = values;
    } catch {
      return badForm(res);
    }
    return next();
  });
}

module.exports = twilioWebhookBody;
