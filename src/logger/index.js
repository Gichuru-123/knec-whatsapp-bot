function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  if (meta && Object.keys(meta).length > 0) {
    if (meta instanceof Error) {
      metaStr = ' ' + (meta.stack || meta.message);
    } else {
      metaStr = ' ' + JSON.stringify(meta);
    }
  }
  return '[' + level.toUpperCase() + '] ' + timestamp + ': ' + message + metaStr;
}

function info(message, meta) {
  console.log(formatMessage('info', message, meta));
}

function error(message, err) {
  console.error(formatMessage('error', message, err));
}

function warn(message, meta) {
  console.warn(formatMessage('warn', message, meta));
}

function debug(message, meta) {
  if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
    console.log(formatMessage('debug', message, meta));
  }
}

module.exports = {
  info,
  error,
  warn,
  debug
};
