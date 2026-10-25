/* WebSocket transport: forum temporary-token auth, opaque session resume,
 * heartbeat/reconnect, history sync and the offline outbox. */
class AuthFlowError extends Error {
  constructor(message, { code = 'auth_flow', retryAfterMs = 0, permanent = false } = {}) {
    super(message);
    this.name = 'AuthFlowError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
    this.permanent = permanent;
  }
}

const PERMANENT_AUTH_CODES = new Set([
  'access_denied',
  'not_allowed',
  'banned',
  'forbidden',
  'user_banned',
  'disabled',
]);

function getCsrfToken() {
  const input = document.querySelector('input[name="_xfToken"]');
  if (input?.value) return input.value;
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.content || '';
}

function normalizeClientUser(user) {
  if (!user || !user.id) return null;
  return {
    id: Number(user.id),
    username: String(user.username || 'unknown'),
    usernameHtml: String(user.usernameHtml || ''),
    avatar: user.avatar || null,
    color: user.color || null,
    profileUrl: user.profileUrl || `https://lolz.team/members/${user.id}/`,
  };
}

async function fetchTemporaryToken() {
  const csrf = getCsrfToken();
  if (!csrf) {
    throw new AuthFlowError('Не удалось получить CSRF-токен. Обновите страницу.', {
      code: 'missing_csrf',
      permanent: true,
    });
  }
  const body = new URLSearchParams();
  body.append('scope[]', 'read');
  body.append('_xfRequestUri', location.pathname + location.search);
  body.append('_xfNoRedirect', '1');
  body.append('_xfToken', csrf);
  body.append('_xfResponseType', 'json');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      const origin = PAGE_WINDOW?.location?.origin || location.origin;
      response = await fetch(new URL('/login/generate-temporary-token', origin).href, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new AuthFlowError('Нет связи с форумом. Проверьте интернет.', {
        code: 'network',
        retryAfterMs: 3000,
      });
    }

    if (response.status === 403 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      continue;
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
      throw new AuthFlowError('Форум временно ограничил запросы. Подождите немного.', {
        code: 'forum_busy',
        retryAfterMs: retryAfter || 5000,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthFlowError(
        'Не удалось подтвердить вход. Обновите страницу и войдите в аккаунт.',
        { code: 'forum_auth', retryAfterMs: 5000, permanent: true },
      );
    }
    if (!response.ok) {
      throw new AuthFlowError(`Форум ответил ошибкой ${response.status}.`, {
        code: 'forum_unavailable',
        retryAfterMs: 5000,
      });
    }

    let json = null;
    try {
      json = await response.json();
    } catch {
      throw new AuthFlowError('Форум вернул некорректный ответ при подтверждении входа.', {
        code: 'forum_bad_response',
        retryAfterMs: 4000,
      });
    }
    if (json?.token) return String(json.token);
    const errors = json?.errors;
    const message =
      (Array.isArray(errors) && errors.filter(Boolean).join(' ')) ||
      (typeof errors === 'string' ? errors : '') ||
      json?.error ||
      'Форум не выдал временный токен.';
    throw new AuthFlowError(String(message), {
      code: 'forum_token_rejected',
      retryAfterMs: 5000,
    });
  }

  throw new AuthFlowError('Не удалось пройти проверку форума. Попробуйте ещё раз.', {
    code: 'forum_auth',
    retryAfterMs: 5000,
  });
}

function sendFrame(payload) {
  const ws = state.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function sendWs(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (
    state.ws &&
    state.ws.readyState === WebSocket.OPEN &&
    state.wsAuthenticated
  ) {
    return sendFrame(payload);
  }
  if (payload.type === 'message.send' && payload.clientId) {
    if (!state.outbox.some((item) => item.clientId === payload.clientId)) {
      state.outbox.push(payload);
    }
  }
  return false;
}

function flushOutbox() {
  if (!state.wsAuthenticated || !state.outbox.length) return;
  const queued = state.outbox.splice(0, state.outbox.length);
  for (const payload of queued) {
    const pending = payload.clientId ? state.pending.get(payload.clientId) : null;
    if (pending?.failed) continue;
    if (!sendFrame(payload)) {
      state.outbox.push(payload);
      continue;
    }
    if (pending) {
      pending.queued = false;
      state.pending.set(payload.clientId, pending);
    }
  }
}

async function connectNoRules({ forceToken = false, userInitiated = false } = {}) {
  if (state.destroyed || state.connecting) return;
  if (!state.initialized) return;
  if (!state.session && !state.active && !userInitiated) return;
  if (
    !forceToken &&
    state.wsAuthenticated &&
    state.ws?.readyState === WebSocket.OPEN
  ) {
    return;
  }

  state.connecting = true;
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  stopHeartbeat();
  if (state.ws) {
    const previous = state.ws;
    state.ws = null;
    try {
      previous.close(1000, 'reconnect');
    } catch {
      // ignore
    }
  }

  state.wsAuthenticated = false;
  state.pendingTemporaryToken = null;
  state.connectionError = '';
  if (userInitiated) {
    state.authFailedPermanently = false;
    state.authError = '';
    state.tokenRetryCount = 0;
  }
  setWsState('connecting');

  try {
    const needsTemporary = forceToken || !state.session;
    if (needsTemporary) {
      state.pendingTemporaryToken = await fetchTemporaryToken();
    }
    openNoRulesSocket(needsTemporary ? 'auth' : 'resume');
  } catch (error) {
    const flowError =
      error instanceof AuthFlowError
        ? error
        : new AuthFlowError(error?.message || 'Не удалось подключиться к No Rules', {
            code: 'connect_failed',
            retryAfterMs: 4000,
          });
    state.authError = flowError.message;
    state.connectionError = flowError.message;
    state.wsAuthenticated = false;
    setWsState('disconnected');
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    if (flowError.permanent) {
      state.authFailedPermanently = true;
    } else {
      scheduleReconnect(flowError.retryAfterMs);
    }
  } finally {
    state.connecting = false;
  }
}

function openNoRulesSocket(mode) {
  let ws;
  try {
    ws = new WebSocket(BUILD.wsUrl);
  } catch {
    state.connectionError = 'Не удалось открыть соединение с No Rules.';
    setWsState('disconnected');
    scheduleReconnect(4000);
    return;
  }
  state.ws = ws;
  state.wsAuthStartedAt = now();
  state.lastPongAt = now();

  ws.onopen = () => {
    if (state.ws !== ws) return;
    state.lastPongAt = now();
    startHeartbeat();
    if (mode === 'resume' && state.session) {
      sendFrame({
        type: 'resume',
        session: state.session,
        accessKey: BUILD.accessKey,
        clientVersion: BUILD.version,
      });
    } else {
      sendFrame({
        type: 'auth',
        token: state.pendingTemporaryToken,
        accessKey: BUILD.accessKey,
        clientVersion: BUILD.version,
      });
    }
  };

  ws.onmessage = (event) => {
    if (state.ws !== ws) return;
    state.lastPongAt = now();
    let payload;
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    handleSocketMessage(payload);
  };

  ws.onerror = () => {
    if (state.ws !== ws) return;
    state.connectionError = 'Ошибка соединения с No Rules.';
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
  };

  ws.onclose = () => {
    if (state.ws !== ws) return;
    state.ws = null;
    state.wsAuthenticated = false;
    stopHeartbeat();
    setWsState('disconnected');
    if (state.active && !state.connectionError) {
      state.connectionError = 'Соединение потеряно. Переподключение…';
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    scheduleReconnect();
  };
}

function handleSocketMessage(payload) {
  switch (payload.type) {
    case 'hello':
      if (typeof payload.roomTitle === 'string' && payload.roomTitle.trim()) {
        BUILD.roomTitle = payload.roomTitle.trim().slice(0, 32);
      }
      return;

    case 'auth.ok':
      handleAuthOk(payload);
      return;

    case 'auth.error':
      handleAuthError(payload);
      return;

    case 'presence':
      state.online = Math.max(0, Number(payload.online) || 0);
      state.onlineUsers = Array.isArray(payload.users) ? payload.users : [];
      updateOnline();
      updateUnreadBadge();
      if (state.active) updateHeader();
      return;

    case 'history':
      applyHistoryPage(payload);
      return;

    case 'message.new':
      handleIncomingMessage(payload);
      return;

    case 'message.edit':
      handleIncomingEdit(payload);
      return;

    case 'message.delete':
      handleIncomingDelete(payload);
      return;

    case 'typing':
      markTyping(payload.user);
      return;

    case 'pong':
      state.lastPongAt = now();
      return;

    case 'error':
      handleServerError(payload);
      if (payload.code === 'auth_required') {
        state.wsAuthenticated = false;
        setWsState('disconnected');
        scheduleReconnect(1000);
      }
      return;

    case 'report.ok':
      return;

    case 'system':
      if (payload.message) showSystemMessage(String(payload.message));
      return;

    default:
      return;
  }
}

function handleAuthOk(payload) {
  const user = normalizeClientUser(payload.user);
  if (!user) {
    state.authError = 'Сервер вернул некорректные данные пользователя.';
    state.connectionError = state.authError;
    scheduleReconnect(4000);
    return;
  }
  state.user = user;
  state.wsAuthenticated = true;
  state.online = Math.max(0, Number(payload.online) || 0);
  state.onlineUsers = Array.isArray(payload.users) ? payload.users : [];
  state.reconnectAttempt = 0;
  state.tokenRetryCount = 0;
  state.forceTokenOnReconnect = false;
  state.authFailedPermanently = false;
  state.authError = '';
  state.connectionError = '';
  state.pendingTemporaryToken = null;
  if (payload.session) saveSession(payload.session, payload.expiresAt);
  setWsState('connected');
  updateOnline();
  updateSocketIndicator();
  if (state.active) updateHeader();
  flushOutbox();

  if (!state.historyLoaded) {
    requestInitialHistory();
  } else {
    state.syncPages = 0;
    requestSyncAfter();
  }
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
}

function handleAuthError(payload) {
  const code = String(payload?.code || 'auth_failed');
  const message = String(payload?.message || 'Не удалось авторизоваться');
  state.wsAuthenticated = false;
  state.authError = message;
  state.connectionError = message;
  setWsState('disconnected');

  if (code === 'invalid_session' || code === 'session_expired') {
    clearSession();
    state.forceTokenOnReconnect = true;
    scheduleReconnect(Number(payload?.retryAfterMs) || 300);
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    return;
  }

  if (
    code === 'invalid_token' ||
    code === 'token_expired' ||
    code === 'auth_failed'
  ) {
    clearSession();
    state.forceTokenOnReconnect = true;
    if (state.active && state.tokenRetryCount < 2) {
      state.tokenRetryCount += 1;
      scheduleReconnect(600);
      return;
    }
    state.authFailedPermanently = true;
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    return;
  }

  if (PERMANENT_AUTH_CODES.has(code)) {
    clearSession();
    state.authFailedPermanently = true;
    showToast(message, 'error');
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    return;
  }

  if (code === 'rate_limited' || code === 'forum_busy') {
    scheduleReconnect(Number(payload?.retryAfterMs) || 5000);
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    }
    return;
  }

  scheduleReconnect(Number(payload?.retryAfterMs) || 5000);
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
}

function scheduleReconnect(delayOverride = 0) {
  if (state.destroyed || state.authFailedPermanently) return;
  if (!state.active && !state.session) return;
  if (!navigator.onLine) {
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      scheduleReconnect(5000);
    }, 5000);
    return;
  }
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  const attempt = Math.min(state.reconnectAttempt, 5);
  const delay = delayOverride > 0
    ? delayOverride
    : Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 400);
  state.reconnectAttempt += 1;
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    if (state.destroyed || state.authFailedPermanently) return;
    connectNoRules({ forceToken: state.forceTokenOnReconnect });
  }, delay);
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    if (now() - state.lastPongAt > 75_000) {
      try {
        state.ws.close(4000, 'heartbeat_timeout');
      } catch {
        // ignore
      }
      return;
    }
    sendFrame({ type: 'ping', t: now() });
  }, 25_000);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function requestInitialHistory() {
  if (state.historyLoading || !state.wsAuthenticated) return;
  state.historyLoading = true;
  state.syncPages = 0;
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: false });
  }
  const sent = sendWs({ type: 'history', limit: 60 });
  if (!sent) state.historyLoading = false;
}

function requestOlderMessages() {
  if (
    !state.active ||
    state.historyLoading ||
    !state.historyHasMore ||
    !state.oldestId ||
    !state.wsAuthenticated
  ) {
    return;
  }
  state.historyLoading = true;
  renderMessages({ preserveScroll: true, forceBottom: false });
  const sent = sendWs({
    type: 'history',
    before: Number(state.oldestId),
    limit: 50,
  });
  if (!sent) {
    state.historyLoading = false;
    renderMessages({ preserveScroll: true, forceBottom: false });
  }
}

function requestSyncAfter() {
  if (!state.wsAuthenticated || state.historyLoading || !state.lastMessageId) return;
  state.historyLoading = true;
  const sent = sendWs({
    type: 'history',
    after: Number(state.lastMessageId),
    limit: 100,
  });
  if (!sent) state.historyLoading = false;
}

function disconnectNoRules({ clear = false } = {}) {
  stopHeartbeat();
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.ws) {
    const ws = state.ws;
    state.ws = null;
    try {
      ws.close(1000, 'client_disconnect');
    } catch {
      // ignore
    }
  }
  state.wsAuthenticated = false;
  state.connecting = false;
  setWsState('disconnected');
  if (clear) {
    clearSession();
    state.user = null;
    state.messages.clear();
    state.deletedIds.clear();
    state.onlineUsers = [];
    state.pending.clear();
    state.outbox = [];
    state.typing.clear();
    state.historyLoaded = false;
    state.historyHasMore = false;
    state.lastMessageId = 0;
    state.oldestId = null;
    state.unread = 0;
  }
}
