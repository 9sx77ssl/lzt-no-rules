/* Message rendering and message actions: grouping, optimistic sends,
 * history paging, replies, edits, deletes and the native typing indicator. */
function findMessage(id) {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) return null;
  return state.messages.get(numeric) || null;
}

function saveDraftStorage() {
  if (!state.active) return;
  try {
    const html = getEditorHtml();
    if (!html || editorIsEmpty()) {
      removeKey(STORAGE_KEYS.draft);
    } else {
      writeJson(STORAGE_KEYS.draft, { html, at: now() });
    }
  } catch {
    // ignore
  }
}

function loadDraftStorage() {
  const saved = readJson(STORAGE_KEYS.draft);
  if (saved && typeof saved.html === 'string' && now() - Number(saved.at || 0) < 7 * 86_400_000) {
    state.draft = saved.html;
  } else if (saved) {
    removeKey(STORAGE_KEYS.draft);
  }
}

function scheduleRender(options = {}) {
  if (state.renderTimer) clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(() => {
    state.renderTimer = null;
    renderMessages(options);
  }, 16);
}

function renderMessages({ preserveScroll = false, forceBottom = false } = {}) {
  let container =
    els.messages && els.messages.isConnected
      ? els.messages
      : document.getElementById('no-rules-messages');
  if (!container) {
    if (!state.active || !ensureMessagesContainer()) return;
    container = els.messages || document.getElementById('no-rules-messages');
    if (!container) return;
  }
  els.messages = container;
  const scroll = getScrollElement();
  const previousTop = scroll?.scrollTop || 0;
  const previousHeight = scroll?.scrollHeight || 0;
  const wasNearBottom = isNearBottom();

  const existingMessages = new Map();
  for (const element of container.querySelectorAll('[data-nr-message]')) {
    const id = element.dataset.messageId;
    if (id) existingMessages.set(id, element);
  }
  // Keep the already loaded avatar nodes alive across optimistic sends. A new
  // <img> for the same URL makes the browser re-decode/re-composite it and
  // looks like the avatar is twitching.
  const existingAvatars = new Map();
  for (const group of container.querySelectorAll('.chat2-message-group[data-user-id]')) {
    const id = String(group.dataset.userId || '');
    if (!id || existingAvatars.has(id)) continue;
    const avatar = group.querySelector(':scope > .chat2-group-avatar');
    if (!avatar) continue;
    avatar.remove();
    existingAvatars.set(id, avatar);
  }
  const usedAvatars = new Set();
  const takeAvatar = (user) => {
    const id = String(user?.id || '');
    const cached = existingAvatars.get(id);
    if (!cached) return createAvatar(user);
    if (!usedAvatars.has(id)) {
      usedAvatars.add(id);
      return updateAvatar(cached, user);
    }
    return updateAvatar(cached.cloneNode(true), user);
  };
  const renderMessage = (message, showHeader) => {
    const id = String(message.id);
    const key = messageRenderKey(message, showHeader);
    const existing = existingMessages.get(id);
    existingMessages.delete(id);
    if (existing && existing.dataset.nrRenderKey === key) return existing;
    const element = createMessageElement(message, { showHeader });
    element.dataset.nrRenderKey = key;
    return element;
  };

  const rendered = [];
  if (state.historyLoading && state.historyHasMore) {
    const loading = document.createElement('div');
    loading.className = 'nr-loading-top';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка истории…';
    rendered.push(loading);
  }

  const messages = allVisibleMessages();
  if (messages.length) {
    const groups = [];
    let current = null;
    for (const message of messages) {
      const createdAt = new Date(message.createdAt || Date.now());
      const dayKey = createdAt.toDateString();
      if (
        !current ||
        current.userId !== message.user?.id ||
        current.dayKey !== dayKey
      ) {
        current = {
          userId: message.user?.id,
          dayKey,
          messages: [],
          tagged: false,
        };
        groups.push(current);
      }
      current.messages.push(message);
      if (messageMentionsMe(message)) current.tagged = true;
    }

    let lastDay = null;
    for (const group of groups) {
      const first = group.messages[0];
      const separatorLabel = group.dayKey !== lastDay
        ? dayLabel(new Date(first.createdAt || Date.now()))
        : null;
      rendered.push(
        createGroup(group.messages, {
          dayLabel: separatorLabel,
          tagged: group.tagged,
          renderMessage,
          avatar: takeAvatar(first.user),
        }),
      );
      lastDay = group.dayKey;
    }
  }

  container.replaceChildren(...rendered);
  prepareMessageVideos(container);
  activateNativeContent(container);
  renderTypingInto(container);
  observeBottomFollow(container);

  requestAnimationFrame(() => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;
    if (forceBottom || (!preserveScroll && wasNearBottom)) {
      state.bottomFollow = true;
      scrollToBottom('auto');
      // Images/videos may not have a decoded height yet. Keep following the
      // bottom while the content grows; a wheel/touch/pointer gesture turns
      // this off immediately.
      scheduleBottomFollow();
      return;
    }
    state.bottomFollow = false;
    if (preserveScroll && previousHeight > 0) {
      const delta = scrollElement.scrollHeight - previousHeight;
      scrollElement.scrollTop = previousTop + Math.max(0, delta);
      return;
    }
    scrollElement.scrollTop = previousTop;
  });

  updatePaused();
  updateUnreadBadge();
  updateConnectionError();
  updateComposerError();
}

function renderTypingInto(container) {
  let typing = container.querySelector('#no-rules-typing');
  if (!typing) {
    typing = document.createElement('div');
    typing.id = 'no-rules-typing';
    typing.className = `chat2-typingDetails ${HASH.typing}`;
    typing.innerHTML = `<div class="lztui-spinner-wrapper lztui-spinner-full ${HASH.spinner}"><div class="lztui-spinner lztui-spinner-small lztui-spinner-full ${HASH.spinner}"><div class="lztui-spinner-bounce lztui-spinner-bounce1 ${HASH.spinner}"></div><div class="lztui-spinner-bounce lztui-spinner-bounce2 ${HASH.spinner}"></div><div class="lztui-spinner-bounce lztui-spinner-bounce3 ${HASH.spinner}"></div></div></div><span class="chat2-typingUsers ${HASH.typing}"></span>`;
    container.appendChild(typing);
  }
  const users = [...state.typing.values()]
    .filter((entry) => entry && entry.user?.id !== state.user?.id && now() - entry.at < 3000)
    .map((entry) => entry.user)
    .filter((user) => user?.username);
  const spinner = typing.querySelector('.lztui-spinner-wrapper');
  const text = typing.querySelector('.chat2-typingUsers');
  if (!spinner || !text) return;

  if (!users.length) {
    typing.classList.remove('visible');
    spinner.style.display = 'none';
    text.textContent = '';
    return;
  }

  typing.classList.add('visible');
  spinner.style.display = '';
  if (users.length === 1) {
    text.textContent = `${users[0].username} печатает`;
  } else if (users.length === 2) {
    text.textContent = `${users[0].username} и ${users[1].username} печатают`;
  } else {
    text.textContent = `${users[0].username} и еще ${users.length - 1} печатают`;
  }
}

function renderTypingOnly() {
  const container = els.messages || document.getElementById('no-rules-messages');
  if (!container) return;
  const wasNearBottom = isNearBottom();
  renderTypingInto(container);
  if (wasNearBottom) scrollToBottom('auto');
}

function markTyping(user) {
  if (!state.active || !user?.id || user.id === state.user?.id) return;
  const previous = state.typing.get(user.id);
  if (previous?.timer) clearTimeout(previous.timer);
  const entry = {
    user: {
      id: user.id,
      username: user.username || 'unknown',
    },
    at: now(),
    timer: null,
  };
  // Native chat re-inserts the user on every typing packet, so the most
  // recently active person is shown first; the same user never duplicates.
  state.typing.delete(user.id);
  state.typing.set(user.id, entry);
  entry.timer = setTimeout(() => {
    state.typing.delete(user.id);
    renderTypingOnly();
  }, 3000);
  renderTypingOnly();
}

function removeTyping(userId) {
  const entry = state.typing.get(Number(userId));
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  state.typing.delete(Number(userId));
  renderTypingOnly();
}

function clearTypingState() {
  for (const entry of state.typing.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  state.typing.clear();
}

function mergeHistoryMessages(messages, { mode = 'initial' } = {}) {
  if (!Array.isArray(messages)) return;
  let changed = false;
  for (const message of messages) {
    if (!message || !Number.isFinite(Number(message.id)) || !message.user?.id) continue;
    const id = Number(message.id);
    if (message.deleted) {
      state.deletedIds.add(id);
      if (state.messages.delete(id)) changed = true;
      // Deleted rows are still part of the server-side id stream. Advance the
      // sync cursor so an all-deleted history page cannot be requested twice.
      updateLastMessageId([message]);
      continue;
    }
    const existing = state.messages.get(id);
    if (!existing) {
      state.messages.set(id, message);
      changed = true;
    } else {
      if (message.deleted && !existing.deleted) {
        state.messages.set(id, message);
        changed = true;
      } else if (
        message.editedAt &&
        Number(message.editedAt) >= Number(existing.editedAt || 0)
      ) {
        state.messages.set(id, message);
        changed = true;
      } else if (!existing.user?.avatar && message.user?.avatar) {
        existing.user = { ...existing.user, ...message.user };
        changed = true;
      }
    }
    if (message.clientId) {
      removePending(message.clientId);
    }
    updateLastMessageId([message]);
  }

  saveOutbox();
  const ids = [...state.messages.keys()];
  if (ids.length) {
    state.oldestId = Math.min(...ids);
    state.lastMessageId = Math.max(state.lastMessageId, Math.max(...ids));
  }
  return changed;
}

function handleIncomingMessage(payload) {
  const message = payload?.message;
  if (!message || !Number.isFinite(Number(message.id)) || !message.user?.id) return;
  const id = Number(message.id);
  const clientId = payload.clientId || message.clientId || null;
  const isAck = Boolean(payload.ack);
  const pending = clientId ? state.pending.get(clientId) : null;

  removeTyping(message.user.id);

  const existing = state.messages.get(id);
  if (existing) {
    if (message.deleted) state.messages.set(id, message);
    else if (message.editedAt) state.messages.set(id, message);
    else if (!existing.user?.avatar && message.user?.avatar) existing.user = message.user;
  } else {
    state.messages.set(id, message);
  }
  updateLastMessageId([message]);

  if (pending) {
    // No artificial minimum: the clock is visible exactly while the socket
    // request is in flight. On ack the real message replaces it immediately.
    state.outbox = state.outbox.filter((item) => item.clientId !== clientId);
    saveOutbox();
    removePending(clientId, { render: false });
  }

  const own = message.user.id === state.user?.id;
  const wasNearBottom = isNearBottom();
  const active = state.active && !state.destroyed;
  if (!own && (!active || document.hidden || !wasNearBottom)) {
    state.unread += 1;
    updateUnreadBadge();
    if (messageMentionsMe(message) && document.hidden) {
      showBrowserNotification(message);
    }
  }

  if (active) {
    renderMessages({
      preserveScroll: !wasNearBottom,
      forceBottom: wasNearBottom,
    });
  }
  if (!active) updateUnreadBadge();

  if (isAck) {
    state.lastPongAt = now();
  }
}

function handleIncomingEdit(payload) {
  const message = payload?.message;
  if (!message || !Number.isFinite(Number(message.id))) return;
  const id = Number(message.id);
  const existing = state.messages.get(id);
  if (!existing) {
    if (message.user?.id) state.messages.set(id, message);
  } else {
    state.messages.set(id, {
      ...existing,
      ...message,
      user: message.user || existing.user,
      reply: message.reply || existing.reply,
    });
  }
  state.pendingEdits.delete(id);
  updateLastMessageId([message]);
  if (state.active) {
    renderMessages({
      preserveScroll: true,
      forceBottom: isNearBottom(),
    });
  }
}

function handleIncomingDelete(payload) {
  const id = Number(payload?.id ?? payload?.message?.id);
  if (!Number.isFinite(id)) return;
  state.deletedIds.add(id);
  state.messages.delete(id);
  if (id > state.lastMessageId) state.lastMessageId = id;
  state.pendingEdits.delete(id);
  if (state.replyTo?.id === id) cancelReply();
  if (state.editing?.id === id) cancelEdit({ restore: true });
  if (state.active) {
    renderMessages({
      preserveScroll: true,
      forceBottom: isNearBottom(),
    });
  }
}

function focusComposer() {
  const apply = () => {
    if (!state.active) return;
    const editor = getTiptap();
    const element = getEditorElement();
    try {
      if (editor && !editor.isDestroyed) editor.commands.focus();
    } catch {
      // fall through to the DOM focus below
    }
    try {
      if (element && document.activeElement !== element) element.focus({ preventScroll: true });
    } catch {
      // ignore focus errors from a detached composer
    }
  };
  // A pointerdown on the avatar/menu can steal focus back after the click
  // handler. Focus now and once more after the browser finishes the gesture.
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 35);
}

function startReply(message) {
  if (!state.active || !message || message.deleted || message.pending) return;
  if (state.editing) {
    showToast('Сначала завершите редактирование', 'info');
    return;
  }
  state.replyTo = {
    id: message.id,
    user: message.user,
    text: message.text || extractTextFromHtml(message.html) || '[вложение]',
    html: message.html || '',
  };
  renderReplyBar();
  focusComposer();
}

function cancelReply() {
  if (!state.replyTo) return;
  state.replyTo = null;
  document.getElementById('no-rules-reply')?.remove();
  focusComposer();
}

function renderReplyBar() {
  document.getElementById('no-rules-reply')?.remove();
  if (!state.replyTo) return;
  const inputBox = getChatRoot()?.querySelector('.chat2-footer .chat2-inputBox');
  if (!inputBox) return;
  const bar = document.createElement('div');
  bar.id = 'no-rules-reply';
  bar.className = `chat2-replying ${HASH.footer}`;

  const icon = document.createElement('div');
  icon.className = `svg-icon-reply ${HASH.footer}`;
  icon.innerHTML = NR_ICONS.replyBar;
  icon.querySelector('svg')?.classList.add(HASH.footer);
  bar.appendChild(icon);

  const container = document.createElement('div');
  container.className = `chat2-replying-container ${HASH.footer}`;
  const author = document.createElement('span');
  author.className = `chat2-replying-author ${HASH.footer}`;
  let authorHtml = state.replyTo.user?.usernameHtml ||
    `<span class="styleUserNickname">${escapeHtml(state.replyTo.user?.username || 'unknown')}</span>`;
  authorHtml = sanitizeUsernameHtml(authorHtml);
  author.innerHTML = `Ответ ${authorHtml}`;
  const text = document.createElement('span');
  text.className = `chat2-replying-text ${HASH.footer}`;
  if (state.replyTo.html) {
    text.innerHTML = enhanceUnfurls(state.replyTo.html);
    applyMentionHighlights(text);
    hydrateForumTitles(text);
    hydrateMarketCards(text);
    prepareLightboxImages(text);
    applySingleSmilie(text);
    prepareReplyVideos(text);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = state.replyTo.text || '[вложение]';
    text.appendChild(paragraph);
  }
  container.appendChild(author);
  container.appendChild(text);
  bar.appendChild(container);

  const cancel = document.createElement('span');
  cancel.className = `chat2-cancel-reply ${HASH.footer}`;
  cancel.setAttribute('role', 'button');
  cancel.tabIndex = 0;
  cancel.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    cancelReply();
  });
  cancel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cancelReply();
    }
  });
  bar.appendChild(cancel);

  inputBox.prepend(bar);
}

function startEdit(message) {
  if (!state.active || !message || message.deleted || message.pending) return;
  if (message.user?.id !== state.user?.id) return;
  if (state.editing?.id === message.id) return;
  if (state.editing) {
    cancelEdit({ restore: true });
  }
  state.replyTo = null;
  renderReplyBar();
  state.editDraft = getEditorHtml();
  state.editing = message;
  setEditorHtml(message.html || '');
  renderEditBar();
  const editor = getTiptap();
  if (editor) editor.commands.focus('end');
  else getEditorElement()?.focus();
  document.querySelector('.chat2-footer')?.scrollIntoView({ block: 'end' });
}

function renderEditBar() {
  document.getElementById('no-rules-editing')?.remove();
  if (!state.editing) return;
  const footer = getChatRoot()?.querySelector('.chat2-footer');
  const inputBox = footer?.querySelector('.chat2-inputBox');
  if (!footer || !inputBox) return;
  const bar = document.createElement('div');
  bar.id = 'no-rules-editing';
  bar.className = `chat2-message-editing ${HASH.footer}`;
  bar.appendChild(document.createTextNode('Редактирование сообщения '));
  const cancel = document.createElement('span');
  cancel.className = `chat2-cancel-editing ${HASH.footer}`;
  cancel.setAttribute('role', 'button');
  cancel.tabIndex = 0;
  cancel.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    cancelEdit({ restore: true });
  });
  cancel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cancelEdit({ restore: true });
    }
  });
  bar.appendChild(cancel);
  footer.insertBefore(bar, inputBox);
}

async function saveEdit() {
  if (!state.editing) return;
  if (editorIsEmpty()) {
    showComposerError('Пожалуйста, введите корректное сообщение.');
    return;
  }
  const id = state.editing.id;
  const target = state.messages.get(id);
  if (!target || target.deleted) {
    cancelEdit({ restore: true });
    return;
  }
  if (!enforceEditorLimit() || editorMessageLength() > MAX_MESSAGE_CHARS) {
    showComposerError(editorLimitMessage());
    return;
  }
  const rawHtml = resolveBbcode(normalizeClientHtml(getEditorHtml()));
  const text = getEditorText().trim() || extractTextFromHtml(rawHtml);
  if (messageCharacterCount(text) > MAX_MESSAGE_CHARS) {
    showComposerError(editorLimitMessage());
    return;
  }
  let html = rawHtml;
  try {
    html = await resolvePlainUnfurls(rawHtml);
  } catch {
    html = rawHtml;
  }
  try {
    html = await resolvePlainMentions(html);
  } catch {
    // keep already resolved unfurls
  }
  const previous = { ...target };
  target.html = sanitizeClientHtml(html);
  target.text = text;
  target.editedAt = now();
  state.pendingEdits.set(id, previous);
  state.messages.set(id, target);

  const sent = sendWs({ type: 'message.edit', id, html });
  if (!sent) {
    state.messages.set(id, previous);
    state.pendingEdits.delete(id);
    showToast('Нет соединения. Изменение не отправлено.', 'error');
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    return;
  }

  state.editing = null;
  state.editDraft = '';
  document.getElementById('no-rules-editing')?.remove();
  clearEditor();
  state.draft = '';
  saveDraftStorage();
  renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
}

function cancelEdit({ restore = true } = {}) {
  if (!state.editing) return;
  const draft = state.editDraft || '';
  state.editing = null;
  state.editDraft = '';
  document.getElementById('no-rules-editing')?.remove();
  if (restore) {
    setEditorHtml(draft);
    state.draft = draft;
  } else {
    clearEditor();
    state.draft = '';
  }
  saveDraftStorage();
  getTiptap()?.commands.focus();
}

function mentionMessage(message) {
  if (!state.active || !message || message.deleted) return;
  insertEditorMention(message.user);
  getEditorElement()?.focus();
  saveDraftStorage();
  sendTyping();
}

function deleteMessage(message) {
  if (!state.active || !message || message.deleted || message.pending) return;
  if (message.user?.id !== state.user?.id) return;
  const sent = sendWs({ type: 'message.delete', id: message.id });
  if (!sent) {
    showToast('Нет соединения. Сообщение не удалено.', 'error');
  }
}

function removePending(clientId, { render = true } = {}) {
  if (!clientId) return;
  const pending = state.pending.get(clientId);
  if (pending) state.pending.delete(clientId);
  state.outbox = state.outbox.filter((payload) => payload.clientId !== clientId);
  saveOutbox();
  if (pending && state.active && render) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
}

function failPending(clientId, message) {
  const pending = state.pending.get(clientId);
  if (!pending) {
    showComposerError(message);
    return;
  }
  const wrapper = [...document.querySelectorAll('#no-rules-messages [data-nr-message]')]
    .find((element) => String(element.dataset.messageId) === String(pending.id));
  if (pending.html && editorIsEmpty()) {
    setEditorHtml(pending.html);
    saveDraftStorage();
  }
  if (pending.reply && !state.replyTo) {
    state.replyTo = pending.reply;
    if (state.active) renderReplyBar();
  }
  state.pending.delete(clientId);
  state.outbox = state.outbox.filter((item) => item.clientId !== clientId);
  saveOutbox();
  if (wrapper) wrapper.classList.add('nr-message-failed-out');
  showComposerError(message);
  if (wrapper) {
    setTimeout(() => {
      wrapper.remove();
      if (state.active) {
        renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
      }
    }, 220);
  } else if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
}

function resetMessageCache() {
  state.messages.clear();
  state.deletedIds.clear();
  state.pendingEdits.clear();
  state.historyLoaded = false;
  state.historyHasMore = false;
  state.historyHasNewer = false;
  state.historyWindow = null;
  state.viewingHistory = false;
  state.jumpTargetId = null;
  state.historyLoading = false;
  state.syncPages = 0;
  state.lastMessageId = 0;
  state.oldestId = null;
}

function editLastOwnMessage() {
  const own = allVisibleMessages().filter(
    (message) =>
      message.user?.id === state.user?.id &&
      !message.deleted &&
      !message.pending &&
      !message.failed &&
      !message.queued,
  );
  const last = own.at(-1);
  if (!last) return false;
  startEdit(last);
  return true;
}

function editorLimitMessage() {
  return `Максимум ${MAX_MESSAGE_CHARS} символов.`;
}

function bindEditorLimit() {
  const editor = getTiptap();
  if (!editor || state.limitEditor === editor) return;
  state.limitEditor = editor;
  editor.on('update', () => {
    if (!state.active || state.limitRestoring) return;
    enforceEditorLimit();
  });
}

function enforceEditorLimit() {
  if (!state.active || state.limitRestoring) return true;
  const length = editorMessageLength();
  const previous = Number(state.lastEditorLength) || 0;
  if (length > MAX_MESSAGE_CHARS && length > previous) {
    state.limitRestoring = true;
    try {
      setEditorHtml(state.lastEditorHtml || '');
      syncEditorLimitState();
    } finally {
      state.limitRestoring = false;
    }
    showComposerError(editorLimitMessage());
    return false;
  }
  state.lastEditorHtml = getEditorHtml();
  state.lastEditorLength = length;
  return true;
}

function onEditorPasteCapture(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!state.active || !target?.closest('.chat2-footer .tiptap')) return;
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  const editor = getTiptap();
  let selected = '';
  try {
    const selection = editor?.state?.selection;
    if (selection) {
      selected = editor.state.doc.textBetween(selection.from, selection.to, '\n', ' ');
    }
  } catch {
    // Selection can disappear between paste events; fall back to the total.
  }
  const nextLength = editorMessageLength() - messageCharacterCount(selected) + messageCharacterCount(text);
  if (nextLength > MAX_MESSAGE_CHARS) {
    event.preventDefault();
    event.stopPropagation();
    showComposerError(editorLimitMessage());
  }
}

async function sendCurrentMessage() {
  if (!state.active) return;
  if (state.editing) {
    return saveEdit();
  }
  if (editorIsEmpty()) {
    showComposerError('Пожалуйста, введите корректное сообщение.');
    return;
  }
  if (!state.user || state.authFailedPermanently) {
    showComposerError('Подключение ещё не завершено. Подождите немного.');
    return;
  }
  if (!enforceEditorLimit() || editorMessageLength() > MAX_MESSAGE_CHARS) {
    showComposerError(editorLimitMessage());
    return;
  }
  const rawHtml = resolveBbcode(normalizeClientHtml(getEditorHtml()));
  const text = getEditorText().trim() || extractTextFromHtml(rawHtml);
  if (messageCharacterCount(text) > MAX_MESSAGE_CHARS) {
    showComposerError(editorLimitMessage());
    return;
  }
  let html = rawHtml;
  try {
    html = await resolvePlainUnfurls(rawHtml);
  } catch {
    html = rawHtml;
  }
  try {
    html = await resolvePlainMentions(html);
  } catch {
    // keep already resolved unfurls
  }
  if (html.length > 24_000) {
    showComposerError('Сообщение слишком длинное');
    return;
  }
  const clientId = randomId();
  const reply = state.replyTo
    ? {
        id: state.replyTo.id,
        user: state.replyTo.user,
        text: state.replyTo.text,
        html: state.replyTo.html || '',
      }
    : null;
  const payload = {
    type: 'message.send',
    clientId,
    html,
    replyTo: reply?.id ?? null,
  };
  const pending = {
    id: `pending:${clientId}`,
    clientId,
    user: state.user,
    html: sanitizeClientHtml(html),
    text,
    reply,
    createdAt: now(),
    pending: true,
    failed: false,
    queued: false,
    payload,
  };
  state.pending.set(clientId, pending);
  clearEditor();
  cancelReply();
  state.draft = '';
  saveDraftStorage();
  state.lastTypingAt = 0;
  renderMessages({ forceBottom: true });
  scrollToBottom('auto');
  maybeRequestNotifications();

  const sent = sendWs(payload);
  if (!sent) {
    pending.queued = true;
    queueOutbox(payload);
  }
}

function handleServerError(payload) {
  const code = String(payload?.code || '');
  const message = String(payload?.message || 'Ошибка сервера');
  const clientId = payload?.clientId;
  const messageId = Number(payload?.messageId ?? payload?.id);

  if (!clientId && !Number.isFinite(messageId) && state.historyLoading) {
    // A failed history page must not leave the room permanently stuck behind
    // the loading spinner. Retry after the server's backoff window.
    state.historyLoading = false;
    scheduleHistoryRetry(Number(payload?.retryAfterMs) || 4000);
    if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    return;
  }

  if (code === 'rate_limited') {
    const pending = clientId ? state.pending.get(clientId) : null;
    if (pending) {
      pending.queued = true;
      state.pending.set(clientId, pending);
    }
    // The payload stays in the outbox and will be retried after the server's
    // token bucket refills. This is expected during a large offline replay.
    scheduleOutboxFlush(Number(payload?.retryAfterMs) || 4000);
    if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    return;
  }

  if (code === 'duplicate' && clientId) {
    removePending(clientId);
    saveOutbox();
    return;
  }

  if (clientId && state.pending.has(clientId)) {
    failPending(
      clientId,
      code === 'empty' ? 'Пожалуйста, введите корректное сообщение.' : message,
    );
    return;
  }
  if (clientId) {
    state.outbox = state.outbox.filter((item) => item.clientId !== clientId);
    saveOutbox();
  }
  if (Number.isFinite(messageId)) {
    if (state.pendingEdits.has(messageId)) {
      const previous = state.pendingEdits.get(messageId);
      state.pendingEdits.delete(messageId);
      state.messages.set(messageId, previous);
    }
    if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
  showComposerError(message);
}

function showBrowserNotification(message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (now() - state.lastNotificationAt < 2500) return;
  state.lastNotificationAt = now();
  try {
    const notification = new Notification(`No Rules · ${message.user?.username || 'Сообщение'}`, {
      body: (message.text || extractTextFromHtml(message.html) || '[вложение]').slice(0, 180),
      icon: message.user?.avatar || DEFAULT_AVATAR,
      tag: 'no-rules-chat',
    });
    notification.onclick = () => {
      try {
        window.focus();
        if (!state.active) activateRoom({ fromNotification: true });
      } finally {
        notification.close();
      }
    };
  } catch {
    // notifications can be blocked by the browser
  }
}

function maybeRequestNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default' || state.notificationPermissionRequested) return;
  state.notificationPermissionRequested = true;
  try {
    const result = Notification.requestPermission();
    if (result?.catch) result.catch(() => {});
  } catch {
    // ignore
  }
}

function sendTyping() {
  if (!state.active || state.editing || editorIsEmpty()) return;
  if (now() - state.lastTypingAt < 3000) return;
  state.lastTypingAt = now();
  sendWs({ type: 'typing' });
}

function applyHistoryPage(payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const mode =
    payload?.near != null
      ? 'near'
      : payload?.after != null
        ? 'after'
        : payload?.before != null
          ? 'before'
          : 'initial';
  state.historyLoading = false;
  if (state.historyRetryTimer) {
    clearTimeout(state.historyRetryTimer);
    state.historyRetryTimer = null;
  }

  if (mode === 'near') {
    state.messages.clear();
    state.deletedIds.clear();
    mergeHistoryMessages(messages, { mode: 'near' });
    state.historyLoaded = true;
    state.viewingHistory = true;
    state.historyHasMore = Boolean(payload.hasMoreBefore ?? payload.hasMore);
    state.historyHasNewer = Boolean(payload.hasMoreAfter);
    const ids = [...state.messages.keys()];
    state.historyWindow = ids.length
      ? { min: Math.min(...ids), max: Math.max(...ids) }
      : null;
    state.oldestId = state.historyWindow?.min ?? null;
    state.jumpTargetId = Number(payload.near) || null;
    state.historyNewerReadyAt = now() + 1200;
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: false });
      requestAnimationFrame(() => {
        const target = document.querySelector(
          `#no-rules-messages [data-message-id="${state.jumpTargetId}"]`,
        );
        if (target) {
          highlightElement(target);
          state.jumpTargetId = null;
        }
      });
    }
    return;
  }

  mergeHistoryMessages(messages, { mode });

  if (mode === 'initial') {
    state.historyLoaded = true;
    state.viewingHistory = false;
    state.historyWindow = null;
    state.historyHasNewer = false;
    state.historyHasMore = Boolean(payload.hasMoreBefore ?? payload.hasMore);
    const ids = [...state.messages.keys()];
    if (ids.length) state.oldestId = Math.min(...ids);
    if (state.active) {
      renderMessages({ forceBottom: true });
    }
    return;
  }

  if (mode === 'before') {
    state.historyHasMore = Boolean(payload.hasMoreBefore ?? payload.hasMore);
    const ids = [...state.messages.keys()];
    if (ids.length) state.oldestId = Math.min(...ids);
    if (state.viewingHistory && state.historyWindow && ids.length) {
      state.historyWindow.min = Math.min(state.historyWindow.min, Math.min(...ids));
    }
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: false });
    }
    return;
  }

  const ids = [...state.messages.keys()];
  if (ids.length) state.oldestId = Math.min(...ids);
  if (state.viewingHistory) {
    state.historyHasNewer = Boolean(payload.hasMoreAfter ?? payload.hasMore);
    if (ids.length && state.historyWindow) {
      state.historyWindow.max = Math.max(state.historyWindow.max, Math.max(...ids));
    }
    if (!state.historyHasNewer) {
      state.viewingHistory = false;
      state.historyWindow = null;
    }
  }
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
  if (payload.hasMore && messages.length && state.syncPages < 50 && !state.viewingHistory) {
    state.syncPages += 1;
    requestSyncAfter();
  }
}

function requestHistoryNear(nearId) {
  if (!nearId || !state.wsAuthenticated) return false;
  state.jumpTargetId = Number(nearId);
  state.historyLoading = true;
  const sent = sendWs({ type: 'history', near: Number(nearId), limit: 60 });
  if (!sent) {
    state.historyLoading = false;
    state.jumpTargetId = null;
    showComposerError('Не удалось загрузить историю сообщения');
  }
  return sent;
}

function returnToLatest() {
  resetMessageCache();
  requestInitialHistory();
  if (state.active) renderMessages({ preserveScroll: true, forceBottom: true });
}
