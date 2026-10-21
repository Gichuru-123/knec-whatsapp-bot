const express = require('express');
const config = require('../config');

// Reads a JSON webhook body as raw bytes (without parsing it), up to the configured size limit.
const rawJsonParser = express.raw({ type: 'application/json', limit: config.webhookBodyLimit });

/**
 * Step 1 (before the signature check): keep the exact bytes in req.rawBody.
 * Requests that are not JSON, or have no body, end up with no raw body and fail the signature check.
 */
function readRawJsonBody(req, res, next) {
  rawJsonParser(req, res, (err) => {
    if (err) return next(err);
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : undefined;
    req.body = undefined;
    return next();
  });
}

/**
 * Step 2 (only after the signature has been verified): parse the bytes as JSON.
 * A correctly signed body that is not valid JSON is rejected with 400.
 */
function parseVerifiedJsonBody(req, res, next) {
  try {
    req.body = JSON.parse(req.rawBody.toString('utf8'));
    return next();
  } catch (err) {
    return res.status(400).json({
      error: {
        code: 400,
        message: 'Bad Request: webhook body is not valid JSON.'
      }
    });
  }
}

module.exports = { readRawJsonBody, parseVerifiedJsonBody };
