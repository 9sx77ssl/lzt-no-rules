import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AuthError,
  AuthService,
  decodeJwtPayload,
  normalizeForumUser,
  sha256,
} from '../src/auth.js';
import { openDatabase } from '../src/db.js';
import { createSanitizer } from '../src/sanitize.js';

const baseConfig = {
  accessKey: 'test-access-key-123456',
  allowedUserIds: new Set(),
  adminUserIds: new Set(),
  lolzApiBase: 'https://api.lolz.team',
  authCacheTtlMs: 5 * 60 * 1000,
  sessionTtlDays: 1,
  maxSessionsPerUser: 10,
  allowExternalImages: false,
  rate: { auth: { capacity: 100, refillPerSec: 1 } },
};

const noopLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return noopLogger;
  },
};

function makeToken(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

function makeApp(fetchImpl) {
  const dir = mkdtempSync(join(tmpdir(), 'no-rules-auth-'));
  const db = openDatabase({ path: join(dir, 'test.db') });
  const sanitizer = createSanitizer();
  const auth = new AuthService({
    config: baseConfig,
    db,
    logger: noopLogger,
    sanitizer,
    fetchImpl,
  });
  return {
    auth,
    db,
    sanitizer,
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function userResponse() {
  return {
    user: {
      user_id: 424242,
      username: 'test_user',
      rendered: {
        username: '<span style="color: #949494;" class="styleUserNickname">test_user</span>',
        avatars: {
          s: 'https://nztcdn.com/avatar/s/1792359851/424242.webp',
        },
      },
      is_banned: false,
      short_link: 'test_user',
      view_url: 'https://lolz.team/test_user/',
    },
  };
}

test('decodes JWT payload', () => {
  const token = makeToken({ sub: 1, iss: 'lzt', exp: 123 });
  assert.deepEqual(decodeJwtPayload(token), { sub: 1, iss: 'lzt', exp: 123 });
  assert.equal(decodeJwtPayload('nope'), null);
});

test('normalizes public forum user fields', () => {
  const user = normalizeForumUser(userResponse().user);
  assert.equal(user.id, 424242);
  assert.equal(user.avatar, 'https://nztcdn.com/avatar/s/1792359851/424242.webp');
  assert.equal(user.profileUrl, 'https://lolz.team/test_user/');
  assert.equal(user.isBanned, false);
});

test('verifies a temporary token through the forum API and caches it', async () => {
  let calls = 0;
  const app = makeApp(async (url, options) => {
    calls += 1;
    assert.match(String(url), /\/users\/424242$/);
    assert.match(options.headers.Authorization, /^Bearer header\./);
    return {
      ok: true,
      status: 200,
      async json() {
        return userResponse();
      },
    };
  });

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken({
      sub: 424242,
      iss: 'lzt',
      exp: now + 3600,
      iat: now,
      scope: 'chatbox read',
    });
    const user = await app.auth.verifyTemporaryToken(token, { ip: '127.0.0.1' });
    assert.equal(user.id, 424242);
    assert.equal(user.username, 'test_user');
    assert.equal(user.color, '#949494');
    const cached = await app.auth.verifyTemporaryToken(token, { ip: '127.0.0.1' });
    assert.equal(cached.id, 424242);
    assert.equal(calls, 1);
    assert.equal(app.auth.verifyAccessKey(baseConfig.accessKey), true);
    assert.equal(app.auth.verifyAccessKey('wrong-key-1234567890'), false);
  } finally {
    app.close();
  }
});

test('creates and resumes an opaque session without the forum token', async () => {
  const app = makeApp(async () => ({
    ok: true,
    status: 200,
    async json() {
      return userResponse();
    },
  }));

  try {
    const now = Math.floor(Date.now() / 1000);
    const temporaryToken = makeToken({
      sub: 424242,
      iss: 'lzt',
      exp: now + 3600,
      iat: now,
      scope: 'read',
    });
    const first = await app.auth.authenticate({
      temporaryToken,
      accessKey: baseConfig.accessKey,
      ip: '127.0.0.1',
    });
    assert.ok(first.sessionToken);
    assert.equal(first.resumed, false);
    assert.equal(app.db.getUser(424242)?.username, 'test_user');

    const second = await app.auth.authenticate({
      sessionToken: first.sessionToken,
      accessKey: baseConfig.accessKey,
      ip: '127.0.0.1',
    });
    assert.equal(second.user.id, 424242);
    assert.equal(second.resumed, true);
    assert.equal(second.tokenHash, sha256(first.sessionToken));
  } finally {
    app.close();
  }
});

test('rejects a post-scoped temporary token', async () => {
  const app = makeApp(async () => {
    throw new Error('should not be called');
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken({
      sub: 424242,
      iss: 'lzt',
      exp: now + 3600,
      iat: now,
      scope: 'basic post',
    });
    await assert.rejects(
      app.auth.verifyTemporaryToken(token, { ip: '127.0.0.1' }),
      (error) => error instanceof AuthError && error.code === 'invalid_token',
    );
  } finally {
    app.close();
  }
});

test('rejects an expired temporary token', async () => {
  const app = makeApp(async () => {
    throw new Error('should not be called');
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken({ sub: 1, iss: 'lzt', exp: now - 60, iat: now - 3600 });
    await assert.rejects(
      app.auth.verifyTemporaryToken(token, { ip: '127.0.0.1' }),
      (error) => error instanceof AuthError && error.code === 'token_expired',
    );
  } finally {
    app.close();
  }
});


test('rejects a temporary token without read/chatbox scope', async () => {
  const app = makeApp(async () => {
    throw new Error('should not be called');
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken({ sub: 424242, iss: 'lzt', exp: now + 3600, iat: now });
    await assert.rejects(
      app.auth.verifyTemporaryToken(token, { ip: '127.0.0.1' }),
      (error) => error instanceof AuthError && error.code === 'invalid_token',
    );
  } finally {
    app.close();
  }
});
