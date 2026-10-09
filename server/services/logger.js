function serialize(value) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: process.env.NODE_ENV === 'production' ? undefined : value.stack };
  return value;
}

function write(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'tidal-ats-api',
    event,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, serialize(value)]))
  };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields)
};

export function requestLogger(req, res, next) {
  const started = Date.now();
  res.once('finish', () => {
    logger.info('http.request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      requestId: req.requestId || null
    });
  });
  next();
}
