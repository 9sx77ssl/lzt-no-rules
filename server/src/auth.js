import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isAllowedMediaUrl } from './sanitize.js';
import { RateLimiter } from './ratelimit.js';

export class AuthError extends Error {
  constructor(code, message, { retryAfterMs = 0, cause = undefined } = {}) {
    super(message, { cause });
    this.name = 'AuthError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function normalizeScopes(scope) {
  const values = Array.isArray(scope)
    ? scope.map(String)
    : typeof scope === 'string'
      ? scope.split(/[\s,]+/)
      : [];
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function safeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function safeAvatar(value, allowExternalImages) {
  return isAllowedMediaUrl(value, { allowExternalImages }) ? value : null;
}

export function normalizeForumUser(apiUser, { allowExternalImages = false } = {}) {
  if (!apiUser || typeof apiUser !== 'object') {
    throw new AuthError('invalid_token', 'Не удалось проверить пользователя');
  }
  const id = Number(apiUser.user_id ?? apiUser.userId ?? apiUser.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AuthError('invalid_token', 'Не удалось проверить пользователя');
  }

  const rendered = apiUser.rendered && typeof apiUser.rendered === 'object' ? apiUser.rendered : {};
  const renderedAvatars =
    rendered.avatars && typeof rendered.avatars === 'object' ? rendered.avatars : {};
  const usernameHtml =
    apiUser.username_html || apiUser.usernameHtml || rendered.username || apiUser.username || '';

  const username = String(apiUser.username || '').trim() || `user_${id}`;
  const avatarCandidates = [
    apiUser.avatar_small,
    apiUser.avatar,
    apiUser.links?.avatar_small,
    apiUser.links?.avatar,
    renderedAvatars.s,
    renderedAvatars.m,
    renderedAvatars.l,
  ];
  const avatar = avatarCandidates.map((value) => safeAvatar(value, allowExternalImages)).find(Boolean) || null;

  let profileUrl = `https://lolz.team/members/${id}/`;
  if (typeof apiUser.view_url === 'string' && /^https:\/\//i.test(apiUser.view_url)) {
    try {
      const url = new URL(apiUser.view_url);
      if (/(^|\.)lolz\.(team|live|guru)$/.test(url.hostname) || /(^|\.)zelenka\.guru$/.test(url.hostname)) {
        profileUrl = url.toString();
      }
    } catch {
      // keep canonical URL
    }
  }

  return {
    id,
    username: username.slice(0, 64),
    usernameHtml: String(usernameHtml).slice(0, 4_000),
    avatar,
    isBanned: apiUser.is_banned === true || apiUser.isBanned === true,
    isStaff: apiUser.is_staff === true,
    isModerator: apiUser.is_moderator === true,
    profileUrl,
    shortLink: typeof apiUser.short_link === 'string' ? apiUser.short_link : null,
    stats: {
      likes: safeCount(apiUser.user_like_count),
      likes2: safeCount(apiUser.user_like2_count),
      messages: safeCount(apiUser.user_message_count),
      trophies: safeCount(apiUser.trophy_count),
      contests: safeCount(apiUser.contest_count),
    },
    raw: apiUser,
  };
}

export class AuthService {
  constructor({ config, db, logger, sanitizer, fetchImpl = globalThis.fetch }) {
    this.config = config;
    this.db = db;
    this.logger = logger;
    this.sanitizer = sanitizer;
    this.fetchImpl = fetchImpl;
    this.cache = new Map();
    this.authLimiter = new RateLimiter({ logger });
  }

  verifyAccessKey(provided) {
    if (typeof provided !== 'string' || provided.length < 8 || provided.length > 256) return false;
    const expected = createHash('sha256').update(this.config.accessKey).digest();
    const actual = createHash('sha256').update(provided).digest();
    return timingSafeEqual(expected, actual);
  }

  assertAllowed(user) {
    if (this.config.allowedUserIds.size > 0 && !this.config.allowedUserIds.has(user.id)) {
      throw new AuthError('not_allowed', 'У вас нет доступа к этой комнате');
    }
    if (user.isBanned) {
      throw new AuthError('banned', 'Аккаунт заблокирован');
    }
  }

  checkAuthRate(ip) {
    const key = `auth:${ip || 'unknown'}`;
    const result = this.authLimiter.check(key, this.config.rate.auth);
    if (!result.ok) {
      throw new AuthError('rate_limited', 'Слишком много попыток входа', {
        retryAfterMs: result.retryAfterMs,
      });
    }
  }

  async verifyTemporaryToken(token, { ip = 'unknown' } = {}) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4_096) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }

    const payload = decodeJwtPayload(token);
    if (!payload) throw new AuthError('invalid_token', 'Недействительный токен');

    const issuer = String(payload.iss || '').toLowerCase();
    if (!['lzt', 'lolz', 'lolzteam'].includes(issuer)) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }

    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }

    const now = Date.now();
    const expMs = Number(payload.exp) * 1000;
    if (!Number.isFinite(expMs) || expMs < now - 30_000) {
      throw new AuthError('token_expired', 'Срок действия токена истёк');
    }
    const iatMs = Number(payload.iat) * 1000;
    if (Number.isFinite(iatMs) && iatMs > now + 5 * 60_000) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }

    const scopes = normalizeScopes(payload.scope);
    const hasReadScope = scopes.some((scope) => scope === 'read' || scope === 'chatbox');
    const hasPostScope = scopes.includes('post');
    // Never accept an unscoped token: it would turn a generic forum token
    // into chat access. The temporary token must explicitly grant read/chatbox
    // and must not grant post.
    if (!hasReadScope || hasPostScope) {
      throw new AuthError('invalid_token', 'Для входа нужен read-only токен');
    }

    const cacheKey = sha256(token);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    let response;
    try {
      response = await this.fetchImpl(`${this.config.lolzApiBase}/users/${userId}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      this.logger.warn('auth.forum_request_failed', {
        userId,
        ip,
        error: error?.name || 'network_error',
      });
      throw new AuthError('forum_unavailable', 'Форум временно недоступен', { cause: error });
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }
    if (response.status === 429) {
      throw new AuthError('forum_busy', 'Форум временно ограничил запросы', { retryAfterMs: 5_000 });
    }
    if (!response.ok) {
      this.logger.warn('auth.forum_http_error', { userId, ip, status: response.status });
      throw new AuthError('forum_unavailable', 'Форум временно недоступен');
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new AuthError('forum_unavailable', 'Форум вернул некорректный ответ');
    }

    const rawUser = json?.user ?? json;
    const normalized = normalizeForumUser(rawUser, {
      allowExternalImages: this.config.allowExternalImages,
    });
    if (normalized.id !== userId) {
      throw new AuthError('invalid_token', 'Недействительный токен');
    }

    const usernameMeta = this.sanitizer.sanitizeUsername(normalized.usernameHtml, normalized.username);
    const user = {
      id: normalized.id,
      username: usernameMeta.username,
      usernameHtml: usernameMeta.usernameHtml,
      color: usernameMeta.color,
      isBanned: normalized.isBanned,
      avatar: normalized.avatar,
      profileUrl: normalized.profileUrl,
      shortLink: normalized.shortLink,
      stats: normalized.stats,
    };

    this.assertAllowed({ ...user, isBanned: normalized.isBanned });

    const ttl = Math.max(
      0,
      Math.min(this.config.authCacheTtlMs, expMs - now - 30_000),
    );
    if (ttl > 0) this.cache.set(cacheKey, { user, expiresAt: now + ttl });
    this.cleanupCache(now);

    this.logger.info('auth.token_verified', { userId: user.id, ip });
    return user;
  }

  createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const now = Date.now();
    const expiresAt = now + this.config.sessionTtlDays * 86_400_000;
    this.db.createSession({
      tokenHash,
      userId,
      createdAt: now,
      expiresAt,
      maxPerUser: this.config.maxSessionsPerUser,
    });
    return { token, expiresAt };
  }

  resumeSession(sessionToken) {
    if (typeof sessionToken !== 'string' || sessionToken.length < 20 || sessionToken.length > 256) {
      throw new AuthError('invalid_session', 'Сессия недействительна');
    }
    const tokenHash = sha256(sessionToken);
    const session = this.db.getSession(tokenHash);
    if (!session) throw new AuthError('invalid_session', 'Сессия недействительна');
    if (session.expiresAt < Date.now()) {
      this.db.deleteSession(tokenHash);
      throw new AuthError('session_expired', 'Сессия истекла');
    }
    if (!session.user.statsUpdatedAt) {
      // Older sessions predate the profile-stat fields. Force one temporary
      // token refresh so the online modal has the same counters as the forum.
      this.db.deleteSession(tokenHash);
      throw new AuthError('invalid_session', 'Сессия устарела, требуется повторный вход');
    }
    this.assertAllowed(session.user);
    this.db.touchSession(tokenHash);
    this.db.touchUser(session.user.id);
    return {
      user: session.user,
      expiresAt: session.expiresAt,
      tokenHash,
    };
  }

  async authenticate({ temporaryToken = '', sessionToken = '', accessKey = '', ip = 'unknown' } = {}) {
    // Count every attempt, including wrong/absent access keys, so the public
    // shared key cannot be brute-forced without a per-IP limit.
    this.checkAuthRate(ip);
    if (!this.verifyAccessKey(accessKey)) {
      throw new AuthError('access_denied', 'Доступ запрещён');
    }

    if (sessionToken) {
      const resumed = this.resumeSession(sessionToken);
      return {
        user: resumed.user,
        sessionToken,
        expiresAt: resumed.expiresAt,
        resumed: true,
        tokenHash: resumed.tokenHash,
      };
    }

    if (!temporaryToken) {
      throw new AuthError('bad_request', 'Не передан токен');
    }

    const user = await this.verifyTemporaryToken(temporaryToken, { ip });
    const stored = this.db.upsertUser(user);
    const session = this.createSession(user.id);
    this.logger.info('auth.session_created', { userId: user.id, ip });
    return {
      user: stored || user,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      resumed: false,
      tokenHash: sha256(session.token),
    };
  }

  cleanupCache(now = Date.now()) {
    if (this.cache.size < 500) return;
    for (const [key, value] of this.cache) {
      if (value.expiresAt <= now) this.cache.delete(key);
    }
  }

  cleanup() {
    const removed = this.db.deleteExpiredSessions();
    this.cleanupCache();
    if (removed > 0) this.logger.info('auth.sessions_cleaned', { removed });
  }
}
