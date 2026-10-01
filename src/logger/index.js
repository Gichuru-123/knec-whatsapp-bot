const SENSITIVE_KEYS = ['token', 'authorization', 'password', 'secret', 'verifytoken', 'key'];

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  if (meta instanceof Error) {
    return { message: meta.message, stack: meta.stack };
  }

  const sanitized = Array.isArray(meta) ? [] : {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMeta(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  constructor(defaultContext = {}) {
    this.defaultContext = defaultContext;
  }

  formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    const mergedMeta = { ...this.defaultContext, ...sanitizeMeta(meta) };
    let metaStr = '';
    if (Object.keys(mergedMeta).length > 0) {
      metaStr = ' ' + JSON.stringify(mergedMeta);
    }
    return '[' + level.toUpperCase() + '] ' + timestamp + ': ' + message + metaStr;
  }

  child(context = {}) {
    return new Logger({ ...this.defaultContext, ...context });
  }

  info(message, meta) {
    console.log(this.formatMessage('info', message, meta));
  }

  error(message, err) {
    console.error(this.formatMessage('error', message, err));
  }

  warn(message, meta) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  debug(message, meta) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const logLevel = process.env.LOG_LEVEL || 'info';
    if (nodeEnv !== 'production' || logLevel === 'debug') {
      console.log(this.formatMessage('debug', message, meta));
    }
  }
}

module.exports = new Logger();
