/* Lifecycle and native integration: boot in the full Chatbox or floating
 * widget, room activation, URL/hash persistence, global listeners and the
 * debug API used by the Playwright suite. */
function cancelNativeComposerUI() {
  const nativeReply = document.querySelector(
    '.chat2-footer .chat2-replying:not(#no-rules-reply) .chat2-cancel-reply',
  );
  if (nativeReply) nativeReply.click();
  const nativeEdit = document.querySelector(
    '.chat2-footer .chat2-message-editing:not(#no-rules-editing) .chat2-cancel-editing',
  );
  if (nativeEdit) nativeEdit.click();
}

function restoreNoRulesDraft() {
  const draft = state.draft || '';
  if (draft && !/^<p>\s*(<br\s*\/?>)?\s*<\/p>$/i.test(draft)) {
    setEditorHtml(draft);
  } else {
    clearEditor();
  }
}

function persistActiveUrl() {
  if (!isFullChat()) return;
  if (location.pathname !== '/chatbox/' && location.pathname !== '/chatbox') return;
  if (location.hash !== '#no-rules') {
    history.replaceState(null, '', '/chatbox/#no-rules');
  }
}

function activateRoom({ fromNotification = false } = {}) {
  if (!state.initialized) return;
  if (state.active) {
    closeMenu();
    persistActiveUrl();
    setActivePreference(true);
    return;
  }

  cancelNativeComposerUI();
  state.nativeDraft = getEditorHtml();
  state.active = true;
  state.unread = 0;
  state.replyTo = null;
  state.editing = null;
  state.editDraft = '';
  document.getElementById('no-rules-reply')?.remove();
  document.getElementById('no-rules-editing')?.remove();
  document.getElementById('no-rules-paused')?.setAttribute('hidden', '');

  ensureMessagesContainer();
  restoreNoRulesDraft();
  enforceActiveUI();
  renderMessages({ forceBottom: true });
  scrollToBottom('auto');
  updateRoomLinkActive();
  updateHeader();
  updateUnreadBadge();
  updatePaused();

  persistActiveUrl();
  setActivePreference(true);
  closeSideMenu();

  if (state.wsAuthenticated) {
    if (!state.historyLoaded) requestInitialHistory();
    else {
      state.syncPages = 0;
      requestSyncAfter();
    }
  } else {
    connectNoRules({ userInitiated: true });
  }

  if (!IS_TOUCH) {
    setTimeout(() => {
      try {
        getTiptap()?.commands.focus();
      } catch {
        // ignore
      }
    }, 60);
  }
  if (fromNotification) {
    state.unread = 0;
    updateUnreadBadge();
  }
}

function deactivateRoom({ restoreHeader = true, nativeRoomClick = false } = {}) {
  if (!state.active) return;

  if (state.editing) {
    state.editing = null;
    state.editDraft = '';
    document.getElementById('no-rules-editing')?.remove();
    clearEditor();
    state.draft = '';
    removeKey(STORAGE_KEYS.draft);
  } else {
    state.draft = getEditorHtml();
    if (editorIsEmpty()) {
      state.draft = '';
      removeKey(STORAGE_KEYS.draft);
    } else {
      writeJson(STORAGE_KEYS.draft, { html: state.draft, at: now() });
    }
    clearEditor();
  }

  state.active = false;
  state.replyTo = null;
  state.unread = 0;
  document.getElementById('no-rules-reply')?.remove();
  document.getElementById('no-rules-editing')?.remove();
  document.getElementById('no-rules-paused')?.setAttribute('hidden', '');

  enforceActiveUI();
  updateRoomLinkActive();
  updateHeader();
  updateUnreadBadge();
  updatePaused();
  closeMenu();
  closeOnlineModal();

  if (state.nativeDraft) {
    setEditorHtml(state.nativeDraft);
  }
  state.nativeDraft = '';

  if (restoreHeader) updateHeader();
  setActivePreference(false);
  if (location.hash === '#no-rules') {
    const path = isFullChat() ? '/chatbox/' : location.pathname + location.search;
    history.replaceState(null, '', path);
  }

  if (!state.session) {
    disconnectNoRules();
  }
}

function mentionPopupIsOpen() {
  const current = now();
  if (current - state.mentionPopupCheckAt < 120) {
    return state.mentionPopupOpen === true;
  }
  state.mentionPopupCheckAt = current;
  const selectors = [
    '.tippy-box[data-state="visible"]',
    '.tippy-popper[data-state="visible"]',
    '.chat2-mention-popup',
    '.chat2-mention-suggestions',
    '.mention-suggestions',
    '.chat2-suggestions',
  ];
  let open = false;
  for (const element of document.querySelectorAll(selectors.join(','))) {
    if (!element.getClientRects().length) continue;
    const style = getComputedStyle(element);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      open = true;
      break;
    }
  }
  state.mentionPopupOpen = open;
  return open;
}

function onDocumentClickCapture(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (state.active && target.closest('.roomTitleBlock > .roomOnline')) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openOnlineModal();
    return;
  }

  const roomLink = target.closest('.goto-room');
  if (roomLink) {
    if (roomLink.dataset.noRules === '1') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      activateRoom();
      return;
    }
    if (state.active) {
      deactivateRoom({ restoreHeader: false, nativeRoomClick: true });
    }
  }

  if (!state.active) return;

  const submit = target.closest(
    '.chat2-footer .submit-btn, .chat2-footer .chat2-submit, .chat2-footer button[type="submit"]',
  );
  if (submit) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    sendCurrentMessage();
    return;
  }

  if (target.closest('.nr-connection-retry')) {
    event.preventDefault();
    event.stopPropagation();
    state.authFailedPermanently = false;
    state.connectionError = '';
    connectNoRules({ forceToken: true, userInitiated: true });
    return;
  }

  if (target.closest('#no-rules-paused')) {
    event.preventDefault();
    event.stopPropagation();
    state.unread = 0;
    updateUnreadBadge();
    updatePaused();
    scrollToBottom('smooth');
  }
}

function onDocumentKeydownCapture(event) {
  const target = event.target instanceof Element ? event.target : null;
  const editor = target?.closest('.chat2-footer .tiptap');

  if (state.active && editor) {
    if (
      event.key === 'ArrowUp' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.isComposing &&
      !mentionPopupIsOpen() &&
      !editor.querySelector('.svelte-renderer')
    ) {
      if (editLastOwnMessage()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (event.key === 'Enter') {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.shiftKey) return;
      if (mentionPopupIsOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      sendCurrentMessage();
      return;
    }
    if (event.key === 'Escape') {
      if (state.editing) {
        event.preventDefault();
        event.stopPropagation();
        cancelEdit({ restore: true });
        return;
      }
      if (state.replyTo) {
        event.preventDefault();
        event.stopPropagation();
        cancelReply();
        return;
      }
    }
  }

  if (event.key === 'Escape' && state.menuEl) {
    event.preventDefault();
    closeMenu();
  }
}

function onEditorInputCapture(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!state.active || !target?.closest('.chat2-footer .tiptap')) return;
  state.draft = getEditorHtml();
  if (state.draftTimer) clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(() => {
    state.draftTimer = null;
    saveDraftStorage();
  }, 350);
  sendTyping();
}

function handleWindowOnline() {
  state.connectionError = '';
  state.reconnectAttempt = 0;
  if (state.active || state.session) {
    connectNoRules({ userInitiated: state.active });
  }
}

function handleWindowOffline() {
  state.connectionError = 'Нет подключения к интернету.';
  state.wsAuthenticated = false;
  setWsState('disconnected');
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    if ((state.active || state.unread > 0) && !state.wsAuthenticated) {
      connectNoRules({ userInitiated: state.active });
    }
    if (state.active) enforceActiveUI();
    return;
  }
  if (state.active) {
    state.draft = getEditorHtml();
    saveDraftStorage();
  }
}

function handleStorageChange(event) {
  if (event.key !== STORAGE_KEYS.session) return;
  if (!event.newValue) {
    state.session = null;
    state.sessionExpiresAt = 0;
    disconnectNoRules();
    state.connectionError = 'Сессия завершена. Нажмите «Повторить», чтобы войти снова.';
    state.authFailedPermanently = true;
    if (state.active) renderMessages({ preserveScroll: true });
  }
}

function installGlobalListeners() {
  document.addEventListener('click', onDocumentClickCapture, true);
  document.addEventListener('keydown', onDocumentKeydownCapture, true);
  document.addEventListener('input', onEditorInputCapture, true);
  window.addEventListener('online', handleWindowOnline);
  window.addEventListener('offline', handleWindowOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('popstate', () => {
    if (location.hash === '#no-rules') activateRoom();
    else if (state.active) deactivateRoom({ restoreHeader: true });
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#no-rules' && !state.active) activateRoom();
    else if (state.active && location.hash !== '#no-rules') {
      deactivateRoom({ restoreHeader: true });
    }
  });
  window.addEventListener('beforeunload', () => {
    if (!state.active) return;
    try {
      const html = getEditorHtml();
      if (html && !editorIsEmpty()) {
        writeJson(STORAGE_KEYS.draft, { html, at: now() });
      }
    } catch {
      // ignore
    }
  });
  window.addEventListener(
    'resize',
    debounce(() => {
      if (state.active) enforceActiveUI();
    }, 180),
  );
}

function observeDom() {
  if (state.observer) state.observer.disconnect();
  state.observer = new MutationObserver(
    debounce(() => {
      if (!state.initialized || state.destroyed) return;
      if (state.active) ensureMessagesContainer();
      ensureRoomLink();
      enforceActiveUI();
    }, 120),
  );
  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function exposeDebugApi() {
  const api = {
    initialized: true,
    version: BUILD.version,
    state: () => debugState(),
    activate: () => activateRoom(),
    deactivate: () => deactivateRoom(),
    reconnect: () => connectNoRules({ forceToken: true, userInitiated: true }),
    disconnect: () => disconnectNoRules(),
    requestHistory: () => requestInitialHistory(),
    requestOlder: () => requestOlderMessages(),
    simulateTyping: (username = 'test') => {
      if (!state.active) activateRoom();
      markTyping({ id: 999999999, username: String(username || 'test').slice(0, 32) });
      renderTypingOnly();
    },
    send: (text, { html = false } = {}) => {
      if (!state.active) activateRoom();
      setEditorHtml(html ? String(text || '') : `<p>${escapeHtml(text)}</p>`);
      sendCurrentMessage();
    },
    openMenu: (id) => {
      const message = findMessage(id);
      if (message) openMessageMenu(message, window.innerWidth / 2, window.innerHeight / 2);
    },
    edit: (id) => {
      const message = findMessage(id);
      if (message) startEdit(message);
    },
    reply: (id) => {
      const message = findMessage(id);
      if (message) startReply(message);
    },
    delete: (id) => {
      const message = findMessage(id);
      if (message) deleteMessage(message);
    },
    clearSession: () => {
      clearSession();
      disconnectNoRules({ clear: true });
    },
  };
  PAGE_WINDOW.__noRulesChat = api;
}

function watchForChatRoot() {
  if (state.rootObserver) return;
  state.rootObserver = new MutationObserver(
    debounce(() => {
      if (getChatRoot() && !state.initialized) init();
    }, 50),
  );
  state.rootObserver.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });
}

async function init() {
  if (state.destroyed || state.initialized || state.initRunning) return;
  state.initRunning = true;
  try {
    if (!document.body) {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          state.initRunning = false;
          init();
        },
        { once: true },
      );
      return;
    }
    if (!getChatRoot()) {
      watchForChatRoot();
      return;
    }
    try {
      await waitFor('.chat2[aria-label="chatbox"] .chat2-footer .tiptap', 30_000);
    } catch {
      watchForChatRoot();
      return;
    }
    if (state.destroyed || state.initialized) return;
    state.initStartedAt = now();
    injectStyles();
    captureTemplates();
    state.nativeMessagesEl = getChatMessages();
    ensureRoomLink();
    installGlobalListeners();
    loadSession();
    loadOutbox();
    loadDraftStorage();
    observeDom();
    state.initialized = true;
    state.rootObserver?.disconnect();
    state.rootObserver = null;
    exposeDebugApi();

    const wantActive = location.hash === '#no-rules' || hasActivePreference();
    if (wantActive) {
      setTimeout(() => activateRoom(), 250);
    } else if (state.session) {
      setTimeout(() => {
        if (!state.active) connectNoRules({ userInitiated: false });
      }, 1400);
    }
  } finally {
    state.initRunning = false;
  }
}

init();
