export const PROTOCOL_VERSION = 1;

export const ClientType = Object.freeze({
  AUTH: 'auth',
  RESUME: 'resume',
  HISTORY: 'history',
  SEND: 'message.send',
  EDIT: 'message.edit',
  DELETE: 'message.delete',
  TYPING: 'typing',
  PING: 'ping',
  PRESENCE: 'presence',
  REPORT: 'message.report',
});

export const ServerType = Object.freeze({
  HELLO: 'hello',
  AUTH_OK: 'auth.ok',
  AUTH_ERROR: 'auth.error',
  READY: 'ready',
  HISTORY: 'history',
  NEW: 'message.new',
  EDIT: 'message.edit',
  DELETE: 'message.delete',
  TYPING: 'typing',
  PRESENCE: 'presence',
  ERROR: 'error',
  PONG: 'pong',
  SYSTEM: 'system',
});

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseFrame(raw, maxBytes = 64 * 1024) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    return { ok: false, error: 'frame_too_large' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!isPlainObject(data) || typeof data.type !== 'string') {
    return { ok: false, error: 'invalid_frame' };
  }
  return { ok: true, data };
}

export function safeInteger(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function safeText(value, maxLength = 2_000) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

export function protocolError(code, message, extra = {}) {
  return { type: ServerType.ERROR, code, message, ...extra };
}
