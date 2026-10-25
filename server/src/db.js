import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Bun ships a native SQLite driver; Node uses better-sqlite3. Keeping the
// adapter here means the server and tests run on both runtimes without a
// separate database implementation.
const isBun = Boolean(process.versions?.bun);
const { Database } = isBun
  ? await import('bun:sqlite')
  : { Database: (await import('better-sqlite3')).default };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  username_html TEXT,
  avatar_url TEXT,
  color TEXT,
  stats TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  username TEXT NOT NULL,
  username_html TEXT,
  avatar_url TEXT,
  color TEXT,
  html TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  reply_to INTEGER,
  reply_user_id INTEGER,
  reply_username TEXT,
  reply_username_html TEXT,
  reply_color TEXT,
  reply_text TEXT,
  client_id TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  deleted_by INTEGER,
  meta TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client
  ON messages(user_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  reporter_user_id INTEGER NOT NULL REFERENCES users(user_id),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

function parseMeta(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function rowToMessage(row) {
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    user: {
      id: row.user_id,
      username: row.username,
      usernameHtml: row.username_html || '',
      avatar: row.avatar_url || null,
      color: row.color || null,
      profileUrl: `https://lolz.team/members/${row.user_id}/`,
    },
    html: deleted ? '' : row.html,
    text: deleted ? '' : row.text,
    deleted,
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    clientId: row.client_id || null,
    reply: row.reply_to
      ? {
          id: row.reply_to,
          user: {
            id: row.reply_user_id,
            username: row.reply_username || 'unknown',
            usernameHtml: row.reply_username_html || '',
            color: row.reply_color || null,
          },
          text: row.reply_text || '',
          html: '',
        }
      : null,
    meta: parseMeta(row.meta),
  };
}

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    username: row.username,
    usernameHtml: row.username_html || '',
    avatar: row.avatar_url || null,
    color: row.color || null,
    profileUrl: `https://lolz.team/members/${row.user_id}/`,
    stats: parseMeta(row.stats) || {
      likes: 0,
      likes2: 0,
      messages: 0,
      trophies: 0,
      contests: 0,
    },
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at || null,
  };
}

export function openDatabase({ path, logger }) {
  if (!path) throw new Error('Database path is required');
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(SCHEMA);

  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version || 0);
  const messageColumns = new Set(
    db
      .prepare('PRAGMA table_info(messages)')
      .all()
      .map((column) => column.name),
  );
  if (!messageColumns.has('reply_username_html')) {
    db.exec('ALTER TABLE messages ADD COLUMN reply_username_html TEXT');
  }
  if (!messageColumns.has('reply_color')) {
    db.exec('ALTER TABLE messages ADD COLUMN reply_color TEXT');
  }
  const userColumns = new Set(
    db
      .prepare('PRAGMA table_info(users)')
      .all()
      .map((column) => column.name),
  );
  if (!userColumns.has('stats')) {
    db.exec('ALTER TABLE users ADD COLUMN stats TEXT');
  }
  if (version <= 2) db.exec('PRAGMA user_version = 3');
  else if (version > 3) {
    throw new Error(`Unsupported database schema version ${version}`);
  }

  // Bun's named-parameter binding requires the SQL prefix (@name) in the
  // object keys, while better-sqlite3 expects the bare key. Normalize once.
  function bindParams(value) {
    if (!isBun || !value || typeof value !== 'object' || Array.isArray(value)) return value;
    const normalized = {};
    for (const [key, entry] of Object.entries(value)) {
      normalized[key.startsWith('@') ? key : `@${key}`] = entry;
    }
    return normalized;
  }

  function prepare(sql) {
    const statement = db.prepare(sql);
    if (!isBun) return statement;
    return {
      run: (...args) => statement.run(...args.map(bindParams)),
      get: (...args) => statement.get(...args.map(bindParams)),
      all: (...args) => statement.all(...args.map(bindParams)),
    };
  }

  const stmts = {
    upsertUser: prepare(`
      INSERT INTO users (user_id, username, username_html, avatar_url, color, stats, created_at, updated_at, last_seen_at)
      VALUES (@user_id, @username, @username_html, @avatar_url, @color, @stats, @now, @now, @now)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        username_html = excluded.username_html,
        avatar_url = excluded.avatar_url,
        color = excluded.color,
        stats = excluded.stats,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
    `),
    getUser: prepare('SELECT * FROM users WHERE user_id = ?'),
    touchUser: prepare('UPDATE users SET last_seen_at = ? WHERE user_id = ?'),

    insertSession: prepare(`
      INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_used_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getSession: prepare(`
      SELECT s.token_hash, s.user_id, s.created_at AS session_created_at,
             s.expires_at, s.last_used_at, u.*
      FROM sessions s
      JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ?
    `),
    touchSession: prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?'),
    deleteSession: prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteExpiredSessions: prepare('DELETE FROM sessions WHERE expires_at < ?'),
    pruneUserSessions: prepare(`
      DELETE FROM sessions
      WHERE token_hash IN (
        SELECT token_hash FROM sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT -1 OFFSET ?
      )
    `),

    getMessageById: prepare('SELECT * FROM messages WHERE id = ?'),
    getMessageByClient: prepare('SELECT * FROM messages WHERE user_id = ? AND client_id = ?'),
    insertMessage: prepare(`
      INSERT INTO messages (
        user_id, username, username_html, avatar_url, color, html, text,
        reply_to, reply_user_id, reply_username, reply_username_html, reply_color, reply_text,
        client_id, created_at, meta
      ) VALUES (
        @user_id, @username, @username_html, @avatar_url, @color, @html, @text,
        @reply_to, @reply_user_id, @reply_username, @reply_username_html, @reply_color, @reply_text,
        @client_id, @created_at, @meta
      )
    `),
    updateMessage: prepare(`
      UPDATE messages
      SET html = @html, text = @text, edited_at = @edited_at, meta = @meta
      WHERE id = @id AND deleted_at IS NULL
    `),
    deleteMessage: prepare(`
      UPDATE messages
      SET deleted_at = @deleted_at, deleted_by = @deleted_by, html = '', text = ''
      WHERE id = @id AND deleted_at IS NULL
    `),
    lastMessages: prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?'),
    messagesBefore: prepare('SELECT * FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?'),
    messagesAfter: prepare('SELECT * FROM messages WHERE id > ? ORDER BY id ASC LIMIT ?'),
    countMessages: prepare('SELECT COUNT(*) AS count FROM messages'),
    insertReport: prepare(`
      INSERT INTO reports (message_id, reporter_user_id, reason, created_at)
      VALUES (?, ?, ?, ?)
    `),
  };

  const insertMessageTx = db.transaction((message) => {
    if (message.client_id) {
      const existing = stmts.getMessageByClient.get(message.user_id, message.client_id);
      if (existing) return { row: existing, duplicate: true };
    }
    const info = stmts.insertMessage.run(message);
    return { row: stmts.getMessageById.get(info.lastInsertRowid), duplicate: false };
  });

  function upsertUser(user) {
    const now = Date.now();
    stmts.upsertUser.run({
      user_id: user.id,
      username: user.username,
      username_html: user.usernameHtml || '',
      avatar_url: user.avatar || null,
      color: user.color || null,
      stats: JSON.stringify(user.stats || {}),
      now,
    });
    return rowToUser(stmts.getUser.get(user.id));
  }

  function getUser(userId) {
    return rowToUser(stmts.getUser.get(userId));
  }

  function touchUser(userId, now = Date.now()) {
    stmts.touchUser.run(now, userId);
  }

  function createSession(session) {
    stmts.insertSession.run(
      session.tokenHash,
      session.userId,
      session.createdAt,
      session.expiresAt,
      session.createdAt,
    );
    if (session.maxPerUser > 0) {
      stmts.pruneUserSessions.run(session.userId, session.maxPerUser);
    }
  }

  function getSession(tokenHash) {
    const row = stmts.getSession.get(tokenHash);
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      userId: row.user_id,
      createdAt: row.session_created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      user: rowToUser(row),
    };
  }

  function touchSession(tokenHash, now = Date.now()) {
    stmts.touchSession.run(now, tokenHash);
  }

  function deleteSession(tokenHash) {
    stmts.deleteSession.run(tokenHash);
  }

  function deleteExpiredSessions(now = Date.now()) {
    return stmts.deleteExpiredSessions.run(now).changes;
  }

  function insertMessage(message) {
    const result = insertMessageTx({
      user_id: message.user.id,
      username: message.user.username,
      username_html: message.user.usernameHtml || '',
      avatar_url: message.user.avatar || null,
      color: message.user.color || null,
      html: message.html,
      text: message.text,
      reply_to: message.reply?.id ?? null,
      reply_user_id: message.reply?.user?.id ?? null,
      reply_username: message.reply?.user?.username ?? null,
      reply_username_html: message.reply?.user?.usernameHtml ?? null,
      reply_color: message.reply?.user?.color ?? null,
      reply_text: message.reply?.text ?? null,
      client_id: message.clientId ?? null,
      created_at: message.createdAt ?? Date.now(),
      meta: message.meta ? JSON.stringify(message.meta) : null,
    });
    return { message: rowToMessage(result.row), duplicate: result.duplicate };
  }

  function getMessage(id) {
    const row = stmts.getMessageById.get(id);
    return row ? rowToMessage(row) : null;
  }

  function getMessageByClient(userId, clientId) {
    if (!clientId) return null;
    const row = stmts.getMessageByClient.get(userId, clientId);
    return row ? rowToMessage(row) : null;
  }

  function getHistory({ before = null, after = null, limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    let rows;
    if (after != null) {
      rows = stmts.messagesAfter.all(Number(after), safeLimit + 1);
    } else if (before != null) {
      rows = stmts.messagesBefore.all(Number(before), safeLimit + 1);
    } else {
      rows = stmts.lastMessages.all(safeLimit + 1);
    }
    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit);
    if (after == null) page.reverse();
    return {
      messages: page.map(rowToMessage),
      hasMore,
    };
  }

  function updateMessage({ id, html, text, meta, editedAt = Date.now() }) {
    const info = stmts.updateMessage.run({
      id,
      html,
      text,
      edited_at: editedAt,
      meta: meta ? JSON.stringify(meta) : null,
    });
    if (info.changes === 0) return null;
    const row = stmts.getMessageById.get(id);
    return row ? rowToMessage(row) : null;
  }

  function deleteMessage({ id, deletedBy, deletedAt = Date.now() }) {
    const info = stmts.deleteMessage.run({ id, deleted_at: deletedAt, deleted_by: deletedBy });
    if (info.changes === 0) return null;
    const row = stmts.getMessageById.get(id);
    return row ? rowToMessage(row) : null;
  }

  function addReport({ messageId, reporterUserId, reason }) {
    stmts.insertReport.run(messageId, reporterUserId, reason, Date.now());
  }

  function countMessages() {
    return stmts.countMessages.get().count;
  }

  function close() {
    try {
      stmts.deleteExpiredSessions.run(Date.now());
    } catch {
      // ignore
    }
    db.close();
  }

  logger?.info('database.opened', { path });

  return {
    raw: db,
    upsertUser,
    getUser,
    touchUser,
    createSession,
    getSession,
    touchSession,
    deleteSession,
    deleteExpiredSessions,
    insertMessage,
    getMessage,
    getMessageByClient,
    getHistory,
    updateMessage,
    deleteMessage,
    addReport,
    countMessages,
    close,
  };
}
