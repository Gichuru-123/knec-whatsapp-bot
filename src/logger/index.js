const SENSITIVE_KEYS = [
  'token', 'authorization', 'password', 'secret', 'verifytoken', 'key',
  'body', 'text', 'message', 'stack', 'cause', 'response', 'payload', 'cookie',
  'headers', 'query', 'reason', 'error', 'data'
];

// Call sites must use static event labels, never interpolate message text or provider responses.
// Redact configured credentials and phone-like values as an additional boundary on strings.
function sanitizeString(value) {
  let result = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (/(token|secret|password|api_?key)/i.test(key) && secret) {
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result
    .replace(/([?&][^\s=]+)=([^\s&]*)/g, '$1=[REDACTED]')
    .replace(/(?<![A-Za-z0-9-])\+?\d(?:[ ().-]*\d){6,14}(?![A-Za-z0-9-])/g, '[REDACTED_PHONE]')
    .replace(/[\r\n]/g, ' ');
}

function sanitizeMeta(meta, seen = new WeakSet()) {
  if (!meta || typeof meta !== 'object') return '[REDACTED]';
  if (meta instanceof Error) {
    return { error: '[REDACTED]' };
  }
  if (seen.has(meta)) return '[CIRCULAR]';
  seen.add(meta);

  const sanitized = Array.isArray(meta) ? [] : {};
  for (const [key, value] of Object.entries(meta)) {
    // These two established fields contain identifiers/counts, not message contents.
    const safeMessageField = (key === 'messageId' && typeof value === 'string') ||
      (key === 'textLength' && Number.isSafeInteger(value) && value >= 0);
    if (!safeMessageField && SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (/phone|recipient|^from$|^to$/i.test(key)) {
      // Preserve the existing handoff mask; never preserve a full number here.
      sanitized[key] = typeof value === 'string' && /^\*{6}\d{3}$/.test(value) ? value : '[REDACTED_PHONE]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMeta(value, seen);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// LOG_LEVEL threshold: a line is written only if its level is at or above the configured level.
// (src/config validates LOG_LEVEL at startup; it is read here on each call so it always matches.)
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function isEnabled(level) {
  const configured = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
  return LEVELS[level] >= configured;
}

class Logger {
  constructor(defaultContext = {}) {
    this.defaultContext = defaultContext;
  }

  formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    const context = sanitizeMeta(this.defaultContext);
    const details = meta === undefined ? {} : sanitizeMeta(meta);
    const mergedMeta = { ...context, ...(typeof details === 'object' ? details : { detail: '[REDACTED]' }) };
    // Suppress both the exception and any label made by interpolating that exception.
    const safeMessage = message instanceof Error || meta instanceof Error || typeof message !== 'string'
      ? 'Application event (details redacted)'
      : sanitizeString(message);
    let metaStr = '';
    if (Object.keys(mergedMeta).length > 0) {
      metaStr = ' ' + JSON.stringify(mergedMeta);
    }
    return '[' + level.toUpperCase() + '] ' + timestamp + ': ' + safeMessage + metaStr;
  }

  child(context = {}) {
    return new Logger({ ...this.defaultContext, ...context });
  }

  info(message, meta) {
    if (isEnabled('info')) console.log(this.formatMessage('info', message, meta));
  }

  error(message, err) {
    if (isEnabled('error')) console.error(this.formatMessage('error', message, err));
  }

  warn(message, meta) {
    if (isEnabled('warn')) console.warn(this.formatMessage('warn', message, meta));
  }

  debug(message, meta) {
    if (isEnabled('debug')) console.log(this.formatMessage('debug', message, meta));
  }
}

module.exports = new Logger();
