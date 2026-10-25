import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthError } from './auth.js';
import { MessageError } from './sanitize.js';
import { createRateLimiters } from './ratelimit.js';
import {
  ClientType,
  PROTOCOL_VERSION,
  ServerType,
  parseFrame,
  protocolError,
  safeInteger,
} from './protocol.js';

class ClientError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ClientError';
    this.code = code;
    this.extra = extra;
  }
}

function getIp(req, config) {
  if (config.trustProxy) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || 'unknown';
}

function closeSoon(ws, code, reason, delay = 500) {
  setTimeout(() => {
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(code, String(reason).slice(0, 120));
      }
    } catch {
      // ignore
    }
  }, delay).unref?.();
}

function truncate(value, max) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function createWsServer({ server, config, db, auth, sanitizer, logger }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes });
  const limiters = createRateLimiters(config, logger);
  const typingState = new Map();
  let presenceTimer = null;
  let lastPresence = null;

  function send(ws, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      logger.warn('ws.send_failed', { error: error?.name || 'send_error' });
      return false;
    }
  }

  function broadcast(payload, except = null) {
    const data = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client === except) continue;
      if (client.readyState !== WebSocket.OPEN) continue;
      try {
        client.send(data);
      } catch (error) {
        logger.warn('ws.broadcast_failed', { error: error?.name || 'send_error' });
      }
    }
  }

  function onlineCount() {
    let count = 0;
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client.authenticated) count += 1;
    }
    return count;
  }

  function broadcastPresence() {
    const online = onlineCount();
    if (lastPresence === online) return;
    lastPresence = online;
    broadcast({ type: ServerType.PRESENCE, online, serverTime: Date.now() });
  }

  function schedulePresence() {
    if (presenceTimer) return;
    presenceTimer = setTimeout(() => {
      presenceTimer = null;
      broadcastPresence();
    }, config.presenceDebounceMs);
    presenceTimer.unref?.();
  }

  function sendPresence(ws) {
    send(ws, { type: ServerType.PRESENCE, online: onlineCount(), serverTime: Date.now() });
  }

  async function handleAuth(ws, data) {
    if (ws.authenticated || ws.authenticating) return;
    ws.authenticating = true;
    const startedAt = Date.now();
    try {
      const sessionToken =
        typeof data.session === 'string'
          ? data.session
          : typeof data.sessionToken === 'string'
            ? data.sessionToken
            : '';
      const temporaryToken =
        typeof data.token === 'string'
          ? data.token
          : typeof data.temporaryToken === 'string'
            ? data.temporaryToken
            : '';
      const accessKey = typeof data.accessKey === 'string' ? data.accessKey : '';

      if (!sessionToken && !temporaryToken) {
        throw new AuthError('bad_request', 'Не передан токен');
      }

      const result = await auth.authenticate({
        temporaryToken,
        sessionToken,
        accessKey,
        ip: ws.ip,
      });

      clearTimeout(ws.authTimer);
      ws.authenticated = true;
      ws.user = result.user;
      ws.sessionHash = result.tokenHash;
      ws.authenticatedAt = Date.now();
      db.touchUser(result.user.id);

      send(ws, {
        type: ServerType.AUTH_OK,
        protocol: PROTOCOL_VERSION,
        user: result.user,
        session: result.sessionToken,
        expiresAt: result.expiresAt,
        online: onlineCount(),
        serverTime: Date.now(),
      });
      sendPresence(ws);
      schedulePresence();

      logger.info('ws.authenticated', {
        userId: result.user.id,
        ip: ws.ip,
        resumed: result.resumed,
        ms: Date.now() - startedAt,
        clientVersion: typeof data.clientVersion === 'string' ? data.clientVersion.slice(0, 32) : null,
      });
    } catch (error) {
      const authError =
        error instanceof AuthError
          ? error
          : new AuthError('auth_failed', 'Не удалось авторизоваться', { cause: error });
      logger.warn('ws.auth_failed', {
        ip: ws.ip,
        code: authError.code,
        ms: Date.now() - startedAt,
      });
      send(ws, {
        type: ServerType.AUTH_ERROR,
        code: authError.code,
        message: authError.message,
        retryAfterMs: authError.retryAfterMs || 0,
      });
      closeSoon(ws, 4003, authError.code, 700);
    } finally {
      ws.authenticating = false;
    }
  }

  function currentDbUser(ws) {
    return db.getUser(ws.user.id) || ws.user;
  }

  function assertCanModify(ws, message) {
    if (!message) throw new ClientError('not_found', 'Сообщение не найдено');
    if (message.user.id !== ws.user.id && !config.adminUserIds.has(ws.user.id)) {
      throw new ClientError('forbidden', 'Нельзя изменять чужое сообщение');
    }
  }

  function buildReply(replyTo) {
    if (replyTo == null) return null;
    const target = db.getMessage(replyTo);
    if (!target) throw new ClientError('invalid_reply', 'Сообщение для ответа не найдено');
    if (target.deleted) throw new ClientError('invalid_reply', 'Нельзя ответить на удалённое сообщение');
    return {
      id: target.id,
      user: {
        id: target.user.id,
        username: target.user.username,
        usernameHtml: target.user.usernameHtml || '',
        color: target.user.color || null,
      },
      text: truncate(target.text || '[вложение]', 280),
    };
  }

  function handleSend(ws, data) {
    const rate = limiters.message.check(`message:${ws.user.id}`, config.rate.message);
    if (!rate.ok) {
      throw new ClientError('rate_limited', 'Слишком часто. Подождите немного.', {
        retryAfterMs: rate.retryAfterMs,
      });
    }

    const clientId =
      typeof data.clientId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(data.clientId)
        ? data.clientId
        : randomUUID();

    const existing = db.getMessageByClient(ws.user.id, clientId);
    if (existing) {
      send(ws, {
        type: ServerType.NEW,
        message: existing,
        clientId,
        ack: true,
        duplicate: true,
        serverTime: Date.now(),
      });
      return;
    }

    const html = typeof data.html === 'string' ? data.html : data.message?.html;
    let sanitized;
    try {
      sanitized = sanitizer.sanitizeMessage(html, { clientId });
    } catch (error) {
      if (error instanceof MessageError) {
        error.details = { ...(error.details || {}), clientId };
      }
      throw error;
    }
    if (limiters.duplicate.isDuplicate(`duplicate:${ws.user.id}`, sanitized.text)) {
      throw new ClientError('duplicate', 'Такое сообщение уже отправлено', { clientId });
    }

    const replyTo = data.replyTo == null ? null : safeInteger(data.replyTo);
    if (data.replyTo != null && replyTo == null) {
      throw new ClientError('invalid_reply', 'Некорректный ответ', { clientId });
    }
    const reply = buildReply(replyTo);
    const dbUser = currentDbUser(ws);
    const { message, duplicate } = db.insertMessage({
      user: dbUser,
      html: sanitized.html,
      text: sanitized.text,
      meta: sanitized.meta,
      reply,
      clientId,
      createdAt: Date.now(),
    });

    send(ws, {
      type: ServerType.NEW,
      message,
      clientId,
      ack: true,
      serverTime: Date.now(),
    });

    if (!duplicate) {
      broadcast({ type: ServerType.NEW, message, serverTime: Date.now() }, ws);
    }

    logger.info('chat.message_created', {
      id: message.id,
      userId: ws.user.id,
      duplicate,
      bytes: sanitized.html.length,
      images: sanitized.meta.images,
      links: sanitized.meta.links,
      replyTo: reply?.id ?? null,
    });
  }

  function handleEdit(ws, data) {
    const id = safeInteger(data.id);
    try {
      const rate = limiters.edit.check(`edit:${ws.user.id}`, config.rate.edit);
      if (!rate.ok) {
        throw new ClientError('rate_limited', 'Слишком часто. Подождите немного.', {
          retryAfterMs: rate.retryAfterMs,
        });
      }
      if (!id) throw new ClientError('bad_request', 'Некорректный id сообщения');
      const target = db.getMessage(id);
      assertCanModify(ws, target);
      if (target.deleted) throw new ClientError('deleted', 'Сообщение удалено');

      const sanitized = sanitizer.sanitizeMessage(data.html);
      const updated = db.updateMessage({
        id,
        html: sanitized.html,
        text: sanitized.text,
        meta: sanitized.meta,
      });
      if (!updated) throw new ClientError('not_found', 'Сообщение не найдено');

      broadcast({ type: ServerType.EDIT, message: updated, serverTime: Date.now() });
      logger.info('chat.message_edited', { id, userId: ws.user.id, bytes: sanitized.html.length });
    } catch (error) {
      if (error instanceof ClientError || error instanceof MessageError) {
        const details = { messageId: id, id };
        if (error instanceof ClientError) error.extra = { ...(error.extra || {}), ...details };
        else error.details = { ...(error.details || {}), ...details };
      }
      throw error;
    }
  }

  function handleDelete(ws, data) {
    const id = safeInteger(data.id);
    try {
      const rate = limiters.delete.check(`delete:${ws.user.id}`, config.rate.delete);
      if (!rate.ok) {
        throw new ClientError('rate_limited', 'Слишком часто. Подождите немного.', {
          retryAfterMs: rate.retryAfterMs,
        });
      }
      if (!id) throw new ClientError('bad_request', 'Некорректный id сообщения');
      const target = db.getMessage(id);
      assertCanModify(ws, target);
      const deleted = db.deleteMessage({ id, deletedBy: ws.user.id });
      if (!deleted) {
        const current = db.getMessage(id);
        if (current?.deleted) {
          broadcast({ type: ServerType.DELETE, id, message: current, serverTime: Date.now() });
          return;
        }
        throw new ClientError('not_found', 'Сообщение не найдено');
      }
      broadcast({ type: ServerType.DELETE, id, message: deleted, serverTime: Date.now() });
      logger.info('chat.message_deleted', { id, userId: ws.user.id });
    } catch (error) {
      if (error instanceof ClientError) {
        error.extra = { ...(error.extra || {}), messageId: id, id };
      }
      throw error;
    }
  }

  function handleHistory(ws, data) {
    const rate = limiters.history.check(`history:${ws.user.id}`, config.rate.history);
    if (!rate.ok) {
      throw new ClientError('rate_limited', 'Слишком часто. Подождите немного.', {
        retryAfterMs: rate.retryAfterMs,
      });
    }
    const before = data.before == null ? null : safeInteger(data.before);
    const after = data.after == null ? null : safeInteger(data.after);
    if (data.before != null && before == null) throw new ClientError('bad_request', 'Некорректный before');
    if (data.after != null && after == null) throw new ClientError('bad_request', 'Некорректный after');
    if (before != null && after != null) {
      throw new ClientError('bad_request', 'Нельзя одновременно before и after');
    }
    const limit = Math.max(
      1,
      Math.min(Number(data.limit) || config.historyPageSize, config.maxHistoryPageSize),
    );
    const result = db.getHistory({ before, after, limit });
    send(ws, {
      type: ServerType.HISTORY,
      messages: result.messages,
      hasMore: result.hasMore,
      before,
      after,
      limit,
      requestId: typeof data.requestId === 'string' ? data.requestId.slice(0, 64) : null,
      serverTime: Date.now(),
    });
  }

  function handleTyping(ws) {
    const rate = limiters.typing.check(`typing:${ws.user.id}`, config.rate.typing);
    if (!rate.ok) return;
    typingState.set(ws.user.id, { username: ws.user.username, at: Date.now() });
    broadcast(
      {
        type: ServerType.TYPING,
        user: { id: ws.user.id, username: ws.user.username },
        serverTime: Date.now(),
      },
      ws,
    );
  }

  function handleReport(ws, data) {
    const id = safeInteger(data.id);
    if (!id) throw new ClientError('bad_request', 'Некорректный id сообщения');
    const target = db.getMessage(id);
    if (!target) throw new ClientError('not_found', 'Сообщение не найдено');
    const reason = truncate(data.reason || 'Без причины', 500);
    db.addReport({ messageId: id, reporterUserId: ws.user.id, reason });
    send(ws, { type: 'report.ok', id, serverTime: Date.now() });
    logger.info('chat.report_created', { id, userId: ws.user.id });
  }

  async function handleRaw(ws, raw) {
    const parsed = parseFrame(raw, config.maxMessageBytes);
    if (!parsed.ok) {
      send(ws, protocolError(parsed.error, 'Некорректный кадр'));
      return;
    }
    const data = parsed.data;
    ws.isAlive = true;

    if (!ws.authenticated) {
      if (data.type === ClientType.AUTH || data.type === ClientType.RESUME) {
        await handleAuth(ws, data);
        return;
      }
      send(ws, protocolError('auth_required', 'Сначала авторизуйтесь'));
      return;
    }

    switch (data.type) {
      case ClientType.AUTH:
      case ClientType.RESUME:
        send(ws, protocolError('already_authenticated', 'Вы уже авторизованы'));
        break;
      case ClientType.HISTORY:
        handleHistory(ws, data);
        break;
      case ClientType.SEND:
        handleSend(ws, data);
        break;
      case ClientType.EDIT:
        handleEdit(ws, data);
        break;
      case ClientType.DELETE:
        handleDelete(ws, data);
        break;
      case ClientType.TYPING:
        handleTyping(ws);
        break;
      case ClientType.PRESENCE:
        sendPresence(ws);
        break;
      case ClientType.REPORT:
        handleReport(ws, data);
        break;
      case ClientType.PING:
        send(ws, { type: ServerType.PONG, t: data.t ?? null, serverTime: Date.now() });
        break;
      default:
        send(ws, protocolError('unknown_type', 'Неизвестный тип сообщения'));
    }
  }

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/ws' && url.pathname !== '/') {
      socket.write('HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    const origin = req.headers.origin;
    if (origin) {
      if (!config.allowedOrigins.includes(origin)) {
        logger.warn('ws.origin_rejected', { origin });
        socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n');
        socket.destroy();
        return;
      }
    } else if (!config.allowMissingOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.authenticated = false;
    ws.authenticating = false;
    ws.user = null;
    ws.sessionHash = null;
    ws.ip = getIp(req, config);
    ws.authTimer = setTimeout(() => {
      if (!ws.authenticated) closeSoon(ws, 4001, 'auth_timeout', 0);
    }, config.authTimeoutMs);
    ws.authTimer.unref?.();

    send(ws, {
      type: ServerType.HELLO,
      protocol: PROTOCOL_VERSION,
      version: config.version,
      roomTitle: config.roomTitle,
      serverTime: Date.now(),
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      handleRaw(ws, raw).catch((error) => {
        if (error instanceof MessageError) {
          send(ws, {
            type: ServerType.ERROR,
            code: error.code,
            message: error.message,
            ...(error.details || {}),
          });
          return;
        }
        if (error instanceof ClientError) {
          send(ws, {
            type: ServerType.ERROR,
            code: error.code,
            message: error.message,
            ...error.extra,
          });
          return;
        }
        logger.error('ws.handler_error', {
          error: error?.name || 'error',
          message: error?.message,
          userId: ws.user?.id ?? null,
        });
        send(ws, protocolError('internal_error', 'Внутренняя ошибка сервера'));
      });
    });

    ws.on('close', () => {
      clearTimeout(ws.authTimer);
      if (ws.user) {
        typingState.delete(ws.user.id);
        schedulePresence();
        logger.info('ws.disconnected', { userId: ws.user.id, ip: ws.ip });
      }
      ws.authenticated = false;
    });

    ws.on('error', (error) => {
      logger.warn('ws.socket_error', { userId: ws.user?.id ?? null, error: error?.name || 'error' });
    });

    logger.debug('ws.connected', { ip: ws.ip });
  });

  wss.on('error', (error) => {
    logger.error('ws.server_error', { error: error?.name || 'error', message: error?.message });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore
      }
    }
  }, config.heartbeatMs);
  heartbeat.unref?.();

  const typingCleanup = setInterval(() => {
    const cutoff = Date.now() - 30_000;
    for (const [userId, value] of typingState) {
      if (value.at < cutoff) typingState.delete(userId);
    }
    limiters.duplicate.cleanup();
  }, 15_000);
  typingCleanup.unref?.();

  function close() {
    clearInterval(heartbeat);
    clearInterval(typingCleanup);
    if (presenceTimer) clearTimeout(presenceTimer);
    for (const ws of wss.clients) {
      try {
        ws.close(1001, 'server_shutdown');
      } catch {
        // ignore
      }
    }
    return new Promise((resolve) => wss.close(() => resolve()));
  }

  return {
    wss,
    onlineCount,
    close,
  };
}
