import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const isProduction = process.env.NODE_ENV === 'production';

function int(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function number(value, fallback) {
  const n = Number(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function perSecond(seconds, fallbackSeconds) {
  const value = number(seconds, fallbackSeconds);
  return 1 / Math.max(0.1, value);
}

function list(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultOrigins = [
  'https://lolz.team',
  'https://lolz.live',
  'https://lolz.guru',
  'https://zelenka.guru',
];

const allowedOrigins = list(process.env.ALLOWED_ORIGINS || defaultOrigins.join(','));
if (!isProduction) {
  allowedOrigins.push(
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  );
}

const accessKey = String(process.env.ACCESS_KEY || '').trim();

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  host: process.env.HOST || '127.0.0.1',
  port: int(process.env.PORT, 8787),
  publicUrl: process.env.PUBLIC_URL || 'wss://lztws.d9v.uk/ws',
  tlsKeyPath: process.env.TLS_KEY_PATH || '',
  tlsCertPath: process.env.TLS_CERT_PATH || '',
  version: process.env.SERVER_VERSION || '1.1.14',
  roomTitle: process.env.ROOM_TITLE || 'No Rules',

  dbPath: process.env.DB_PATH || fileURLToPath(new URL('../data/no-rules.db', import.meta.url)),
  accessKey,
  allowedUserIds: new Set(
    list(process.env.ALLOWED_USER_IDS)
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0),
  ),
  adminUserIds: new Set(
    list(process.env.ADMIN_USER_IDS)
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0),
  ),
  allowedOrigins: [...new Set(allowedOrigins)],
  trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
  allowMissingOrigin: process.env.ALLOW_MISSING_ORIGIN !== '0',

  lolzApiBase: (process.env.LOLZ_API_BASE || 'https://api.lolz.team').replace(/\/+$/, ''),
  authCacheTtlMs: int(process.env.AUTH_CACHE_TTL_MS, 5 * 60 * 1000),
  authTimeoutMs: int(process.env.AUTH_TIMEOUT_MS, 10_000),
  sessionTtlDays: int(process.env.SESSION_TTL_DAYS, 30),
  maxSessionsPerUser: int(process.env.MAX_SESSIONS_PER_USER, 20),

  maxMessageHtml: int(process.env.MAX_MESSAGE_HTML, 12_000),
  maxMessageText: int(process.env.MAX_MESSAGE_TEXT, 2_000),
  maxMessageBytes: int(process.env.MAX_MESSAGE_BYTES, 64 * 1024),
  maxImagesPerMessage: int(process.env.MAX_IMAGES_PER_MESSAGE, 4),
  maxLinksPerMessage: int(process.env.MAX_LINKS_PER_MESSAGE, 5),
  maxMentionsPerMessage: int(process.env.MAX_MENTIONS_PER_MESSAGE, 8),
  maxNewlinesPerMessage: int(process.env.MAX_NEWLINES_PER_MESSAGE, 30),
  allowExternalImages: process.env.ALLOW_EXTERNAL_IMAGES === '1',
  historyPageSize: int(process.env.HISTORY_PAGE_SIZE, 50),
  maxHistoryPageSize: int(process.env.MAX_HISTORY_PAGE_SIZE, 100),
  presenceDebounceMs: int(process.env.PRESENCE_DEBOUNCE_MS, 350),
  heartbeatMs: int(process.env.HEARTBEAT_MS, 30_000),
  authTimeoutWindowMs: int(process.env.AUTH_TIMEOUT_WINDOW_MS, 10_000),

  rate: {
    auth: {
      capacity: int(process.env.RATE_AUTH_BURST, 12),
      refillPerSec: perSecond(process.env.RATE_AUTH_REFILL, 60),
    },
    message: {
      capacity: int(process.env.RATE_MESSAGE_BURST, 8),
      refillPerSec: perSecond(process.env.RATE_MESSAGE_REFILL, 1.5),
    },
    typing: {
      capacity: int(process.env.RATE_TYPING_BURST, 1),
      refillPerSec: perSecond(process.env.RATE_TYPING_REFILL, 3),
    },
    history: {
      capacity: int(process.env.RATE_HISTORY_BURST, 20),
      refillPerSec: perSecond(process.env.RATE_HISTORY_REFILL, 3),
    },
    edit: {
      capacity: int(process.env.RATE_EDIT_BURST, 6),
      refillPerSec: perSecond(process.env.RATE_EDIT_REFILL, 2),
    },
    delete: {
      capacity: int(process.env.RATE_DELETE_BURST, 6),
      refillPerSec: perSecond(process.env.RATE_DELETE_REFILL, 2),
    },
  },

  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
};

if (!config.accessKey) {
  throw new Error(
    'ACCESS_KEY is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
  );
}
if (config.accessKey.length < 16) {
  throw new Error('ACCESS_KEY must contain at least 16 characters');
}
if (!Number.isFinite(config.port) || config.port <= 0) {
  throw new Error('PORT must be a positive integer');
}

export { config };
