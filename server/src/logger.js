const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = '[redacted]';
const SECRET_KEYS = /(token|session|authorization|cookie|secret|password|key)/i;

function redact(value, depth = 0) {
  if (depth > 6) return '[deep]';
  if (value == null) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) out[key] = REDACTED;
    else out[key] = redact(item, depth + 1);
  }
  return out;
}

export function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function write(levelName, message, fields) {
    if ((LEVELS[levelName] ?? 0) < threshold) return;
    const entry = {
      ts: new Date().toISOString(),
      level: levelName,
      msg: String(message ?? ''),
      ...redact(fields ?? {}),
    };
    const line = JSON.stringify(entry);
    if (levelName === 'error') console.error(line);
    else if (levelName === 'warn') console.warn(line);
    else console.log(line);
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    child: (base) => {
      const scoped = createLogger(level);
      return {
        debug: (message, fields) => scoped.debug(message, { ...base, ...fields }),
        info: (message, fields) => scoped.info(message, { ...base, ...fields }),
        warn: (message, fields) => scoped.warn(message, { ...base, ...fields }),
        error: (message, fields) => scoped.error(message, { ...base, ...fields }),
        child: (more) => scoped.child({ ...base, ...more }),
      };
    },
  };
}
