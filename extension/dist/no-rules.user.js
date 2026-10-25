// Generated 2026-10-25T17:04:12.788Z — build with scripts/build-extension.mjs
// ==UserScript==
// @name         Lolzteam Chatbox — No Rules
// @namespace    https://lolz.team/no-rules
// @version      1.0.1
// @description  Приватная комната No Rules внутри нативного Chatbox Lolzteam
// @author       No Rules
// @match        https://lolz.team/*
// @match        https://lolz.live/*
// @match        https://lolz.guru/*
// @match        https://zelenka.guru/*
// @run-at       document-idle
// @grant        none
// @noframes
// @homepageURL  https://github.com/9sx77ssl/lzt-no-rules
// @supportURL   https://github.com/9sx77ssl/lzt-no-rules/issues
// @updateURL    https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js
// @downloadURL  https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js
// ==/UserScript==

(function () {
'use strict';

// ---- 00-core.js ----
const BUILD = {
  wsUrl: 'wss://lztws.d9v.uk/ws',
  accessKey: '0cOA4tSSZe5f3IRTdtu_LaAmDClOedGe5vyKzCnpEJs9SUa2',
  version: '1.0.1',
  roomTitle: 'No Rules',
};

const STORAGE_KEYS = {
  session: 'lzt.no-rules.session.v1',
  draft: 'lzt.no-rules.draft.v1',
};

const HASH = {
  message: 'lztng-1tr4piy',
  footer: 'lztng-1s6zp7u',
  username: 'lztng-1169pvz',
  date: 'lztng-1487ndf',
  socket: 'lztng-1ffvkad',
  menu: 'lztng-36rp8q',
  paused: 'lztng-b261a2',
  typing: 'lztng-1pt7lw4',
};

const IS_TOUCH =
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window;
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
const PAGE_WINDOW = typeof unsafeWindow !== 'undefined' && unsafeWindow ? unsafeWindow : window;

const state = {
  active: false,
  initialized: false,
  initStartedAt: 0,
  user: null,
  session: null,
  sessionExpiresAt: 0,
  ws: null,
  wsState: 'disconnected',
  wsAuthenticated: false,
  wsAuthStartedAt: 0,
  connecting: false,
  pendingTemporaryToken: null,
  forceTokenOnReconnect: false,
  tokenRetryCount: 0,
  reconnectAttempt: 0,
  reconnectTimer: null,
  heartbeatTimer: null,
  lastPongAt: 0,
  messages: new Map(),
  pending: new Map(),
  pendingEdits: new Map(),
  pendingDeletes: new Map(),
  outbox: [],
  lastMessageId: 0,
  historyLoaded: false,
  historyHasMore: false,
  historyLoading: false,
  syncPages: 0,
  oldestId: null,
  online: 0,
  typing: new Map(),
  unread: 0,
  replyTo: null,
  editing: null,
  editDraft: '',
  nativeDraft: '',
  draft: '',
  lastTypingAt: 0,
  connectionError: '',
  authError: '',
  authFailedPermanently: false,
  templates: null,
  nativeTitle: '',
  nativeOnline: '',
  scrollEl: null,
  observer: null,
  enforceTimer: null,
  renderTimer: null,
  menuEl: null,
  confirmEl: null,
  toastEl: null,
  toastTimer: null,
  roomLink: null,
  socketEl: null,
  nativeSocketEl: null,
  nativeMessagesEl: null,
  hiddenNative: [],
  lastNotificationAt: 0,
  notificationPermissionRequested: false,
  mentionPopupCheckAt: 0,
  mentionPopupOpen: false,
  draftTimer: null,
  destroyed: false,
};

const els = {
  messages: null,
  typing: null,
  paused: null,
  loading: null,
  replyBar: null,
  editBar: null,
};

const TIME_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
const FULL_DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const DAY_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function now() {
  return Date.now();
}

function randomId() {
  if (PAGE_WINDOW.crypto?.randomUUID) return PAGE_WINDOW.crypto.randomUUID();
  return `nr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable; keep the session in memory
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function loadSession() {
  const saved = readJson(STORAGE_KEYS.session);
  if (
    saved &&
    typeof saved.token === 'string' &&
    saved.token.length > 20 &&
    Number(saved.expiresAt) > now() + 60_000
  ) {
    state.session = saved.token;
    state.sessionExpiresAt = Number(saved.expiresAt);
    return true;
  }
  state.session = null;
  state.sessionExpiresAt = 0;
  if (saved) removeKey(STORAGE_KEYS.session);
  return false;
}

function saveSession(token, expiresAt) {
  if (typeof token !== 'string' || token.length <= 20) return;
  state.session = token;
  state.sessionExpiresAt = Number(expiresAt) || now() + 30 * 86_400_000;
  writeJson(STORAGE_KEYS.session, {
    token,
    expiresAt: state.sessionExpiresAt,
  });
}

function clearSession() {
  state.session = null;
  state.sessionExpiresAt = 0;
  removeKey(STORAGE_KEYS.session);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Сегодня';
  if (isSameDay(date, yesterday)) return 'Вчера';
  return DAY_FORMAT.format(date);
}

function formatTime(date) {
  return TIME_FORMAT.format(date);
}

function formatFullDate(date) {
  return FULL_DATE_FORMAT.format(date);
}

function escapeRegExpText(value) {
  return escapeRegExp(value);
}

const CLIENT_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'hr',
  'sub',
  'sup',
  'a',
  'img',
  'span',
  'div',
  'abbr',
  'video',
  'source',
]);

const CLIENT_ALLOWED_CLASSES = new Set([
  'mceSmilie',
  'mceSmilieLarge',
  'big',
  'bbCodeImage',
  'LbImage',
  'avatar',
  'LbTrigger',
  'internalLink',
  'externalLink',
  'username',
  'mention',
  'styleUserNickname',
  'notranslate',
  'Tooltip',
  'muted',
  'unfurlContainer',
  'unfurlLink',
  'unfurlImage',
  'videoContainer',
  'videoWrapper',
  'spoiler',
  'bbCodeSpoiler',
]);

const CLIENT_ALLOWED_STYLE_PROPS = new Map([
  ['color', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i],
  ['-webkit-text-fill-color', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i],
  ['background', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|(linear|radial)-gradient\([^<>{};]{1,300}\))$/i],
  ['background-image', /^((linear|radial)-gradient\([^<>{};]{1,300}\)|none)$/i],
  ['background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['-webkit-background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['text-shadow', /^[0-9a-z#.,%()\s-]{1,200}$/i],
  ['font-weight', /^(normal|bold|bolder|lighter|[1-9]00)$/i],
]);

function sanitizeClientStyle(value) {
  const declarations = [];
  for (const part of String(value || '').split(';')) {
    const declaration = part.trim();
    if (!declaration) continue;
    const separator = declaration.indexOf(':');
    if (separator <= 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    const pattern = CLIENT_ALLOWED_STYLE_PROPS.get(property);
    if (!pattern || !pattern.test(rawValue)) continue;
    if (/url\s*\(|expression\s*\(|javascript:|@import|[<>{}]/i.test(rawValue)) continue;
    declarations.push(`${property}:${rawValue}`);
  }
  return declarations.join(';');
}

function sanitizeClientHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const element of nodes) {
    const tag = element.tagName.toLowerCase();
    if (!CLIENT_ALLOWED_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith('on') || name === 'srcdoc') {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'style') {
        const safeStyle = sanitizeClientStyle(value);
        if (safeStyle) element.setAttribute('style', safeStyle);
        else element.removeAttribute('style');
        continue;
      }
      if (
        (name === 'href' || name === 'src' || name === 'data-url' || name === 'data-fallback-src') &&
        /^\s*(javascript|data|vbscript):/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'class') {
        const kept = value.split(/\s+/).filter((className) => CLIENT_ALLOWED_CLASSES.has(className));
        if (kept.length) element.className = kept.join(' ');
        else element.removeAttribute('class');
      }
    }
    if (tag === 'img') {
      const src = element.getAttribute('src') || '';
      if (!/^https:\/\//i.test(src)) element.remove();
    }
  }
  return template.innerHTML;
}

function extractTextFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeClientHtml(html);
  for (const image of template.content.querySelectorAll('img')) {
    image.replaceWith(image.getAttribute('alt') || '[изображение]');
  }
  for (const video of template.content.querySelectorAll('video')) {
    video.replaceWith('[видео]');
  }
  for (const br of template.content.querySelectorAll('br')) {
    br.replaceWith('\n');
  }
  for (const block of template.content.querySelectorAll('p, div, li, blockquote, pre')) {
    block.append('\n');
  }
  return String(template.content.textContent || '')
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getEditorElement() {
  return document.querySelector('.chat2-footer .tiptap');
}

function getTiptap() {
  const element = getEditorElement();
  const editor = element?.editor;
  return editor && typeof editor.getHTML === 'function' ? editor : null;
}

function getEditorHtml() {
  const editor = getTiptap();
  if (editor) return editor.getHTML();
  return getEditorElement()?.innerHTML || '';
}

function getEditorText() {
  const editor = getTiptap();
  if (editor) return editor.getText();
  return getEditorElement()?.innerText || '';
}

function editorHasMedia() {
  const element = getEditorElement();
  return Boolean(element?.querySelector('img, video'));
}

function editorIsEmpty() {
  if (getEditorText().trim()) return false;
  if (editorHasMedia()) return false;
  return true;
}

function clearEditor() {
  const editor = getTiptap();
  if (editor) {
    editor.commands.setContent('');
    editor.commands.focus();
    return;
  }
  const element = getEditorElement();
  if (!element) return;
  element.innerHTML = '<p></p>';
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
}

function setEditorHtml(html) {
  const editor = getTiptap();
  if (editor) {
    editor.commands.setContent(html || '');
    editor.commands.focus();
    return;
  }
  const element = getEditorElement();
  if (!element) return;
  element.innerHTML = html || '<p></p>';
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
}

function insertEditorText(text) {
  const editor = getTiptap();
  if (editor) {
    editor.chain().focus().insertContent(text).run();
    return;
  }
  const element = getEditorElement();
  if (!element) return;
  element.focus();
  document.execCommand('insertText', false, text);
}

function insertEditorMention(user) {
  const editor = getTiptap();
  if (editor && user?.avatar) {
    try {
      editor
        .chain()
        .focus()
        .insertUser({
          username: user.username,
          highlightHtml: user.usernameHtml,
          usernameHtml: user.usernameHtml,
          avatar: user.avatar,
          userId: user.id,
        })
        .insertContent(' ')
        .run();
      return;
    } catch {
      // fall through to plain text
    }
  }
  insertEditorText(`@${user?.username || 'unknown'} `);
}

function getScrollElement() {
  const nativeMessages =
    els.nativeMessagesEl || document.querySelector('.chat2-full-inner .chat2-messages');
  const parent = nativeMessages?.parentElement;
  if (parent && parent.classList.contains('scrollable-content')) return parent;
  return document.querySelector('.chat2-full-inner > .scrollable > .scrollable-content');
}

function isNearBottom(threshold = 140) {
  const scroll = getScrollElement();
  if (!scroll) return true;
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < threshold;
}

function scrollToBottom(behavior = 'auto') {
  const scroll = getScrollElement();
  if (!scroll) return;
  scroll.scrollTo({ top: scroll.scrollHeight, behavior });
}

function waitFor(selector, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    let timer;
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(element);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeout);
  });
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, delay) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const remaining = delay - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = Date.now();
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

function showToast(message, type = 'info') {
  try {
    if (!els.toast) {
      const toast = document.createElement('div');
      toast.className = 'nr-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
      els.toast = toast;
    }
    els.toast.textContent = String(message);
    els.toast.dataset.type = type;
    els.toast.classList.add('nr-toast-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      els.toast?.classList.remove('nr-toast-visible');
    }, 2600);
  } catch {
    // ignore UI errors
  }
}

function setConnectionError(message) {
  state.connectionError = String(message || '');
  renderMessages({ preserveScroll: true });
}

function clearConnectionError() {
  if (!state.connectionError) return;
  state.connectionError = '';
  renderMessages({ preserveScroll: true });
}

function isOwnMessage(message) {
  return Boolean(message?.user?.id && state.user?.id === message.user.id);
}

function messageMentionsMe(message) {
  if (!message || !state.user) return false;
  if (message.user?.id === state.user.id) return false;
  if (message.reply?.user?.id === state.user.id) return true;
  const html = String(message.html || '');
  if (
    html.includes(`data-user="${state.user.id},`) ||
    html.includes(`data-user="${state.user.id}"`)
  ) {
    return true;
  }
  if (!state.user.username) return false;
  const pattern = new RegExp(
    `(^|[\\s(\\[>])@${escapeRegExp(state.user.username)}(?=$|[\\s.,!?;:)\\]])`,
    'i',
  );
  return pattern.test(String(message.text || ''));
}

function messageStyleClass(message) {
  const classes = ['chat2-message'];
  classes.push(isOwnMessage(message) ? 'chat2-message-fromSelf' : 'chat2-message-general');
  if (messageMentionsMe(message)) classes.push('chat2-message-tagged');
  return classes.join(' ');
}

function sortedMessages() {
  return [...state.messages.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function allVisibleMessages() {
  const messages = sortedMessages();
  const pending = [...state.pending.values()].sort((a, b) => a.createdAt - b.createdAt);
  return messages.concat(pending);
}

function updateLastMessageId(messages) {
  for (const message of messages) {
    const id = Number(message.id);
    if (Number.isFinite(id) && id > state.lastMessageId) state.lastMessageId = id;
  }
}

function setWsState(next) {
  state.wsState = next;
  updateSocketIndicator();
}

function closeSideMenu() {
  const background = document.querySelector('.side-menu-background');
  if (background && background.getClientRects().length) {
    background.click();
    return;
  }
  const sideMenu = document.querySelector('.side-menu');
  if (!sideMenu || !sideMenu.getClientRects().length) return;
  const trigger = document.querySelector('.side-menu-trigger');
  if (trigger) trigger.click();
}

function debugState() {
  return {
    active: state.active,
    initialized: state.initialized,
    wsState: state.wsState,
    wsAuthenticated: state.wsAuthenticated,
    user: state.user
      ? {
          id: state.user.id,
          username: state.user.username,
        }
      : null,
    online: state.online,
    messages: state.messages.size,
    pending: state.pending.size,
    outbox: state.outbox.length,
    historyHasMore: state.historyHasMore,
    historyLoading: state.historyLoading,
    oldestId: state.oldestId,
    lastMessageId: state.lastMessageId,
    unread: state.unread,
    typing: state.typing.size,
    editing: state.editing?.id || null,
    replyTo: state.replyTo?.id || null,
    error: state.connectionError || '',
  };
}


// ---- 10-ui.js ----
const DEFAULT_AVATAR = 'https://lolz.team/styles/default/xenforo/avatars/avatar_s.png';

const NR_ICONS = {
  reply:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.7914 12.6072C21.0355 12.398 21.1575 12.2933 21.2023 12.1688C21.2415 12.0596 21.2415 11.94 21.2023 11.8308C21.1575 11.7063 21.0355 11.6016 20.7914 11.3924L12.3206 4.13178C11.9004 3.77158 11.6903 3.59148 11.5124 3.58707C11.3578 3.58323 11.2101 3.65115 11.1124 3.77103C11 3.90897 11 4.18571 11 4.73918V9.03444C8.86532 9.40789 6.91159 10.4896 5.45971 12.1137C3.87682 13.8843 3.00123 16.1757 3 18.5508V19.1628C4.04934 17.8987 5.35951 16.8763 6.84076 16.1657C8.1467 15.5392 9.55842 15.1681 11 15.0703V19.2604C11 19.8139 11 20.0906 11.1124 20.2286C11.2101 20.3485 11.3578 20.4164 11.5124 20.4125C11.6903 20.4081 11.9004 20.228 12.3206 19.8678L20.7914 12.6072Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mention:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  copy:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2"/></svg>',
  edit:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m13.5 6.5 3 3" stroke="currentColor" stroke-width="2"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2"/></svg>',
  link:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  select:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-6 1-3 6L5 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  retry:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.3 6.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const NR_CSS = `
#no-rules-messages {
  padding: 10px 20px 0 20px;
  box-sizing: border-box;
}
#no-rules-messages.nr-hidden { display: none !important; }
#no-rules-messages .nr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  color: var(--mutedTextColor, #8c8c8c);
  text-align: center;
  user-select: none;
}
#no-rules-messages .nr-empty i { font-size: 28px; opacity: .65; }
#no-rules-messages .nr-empty .nr-empty-title { color: var(--contentText, #d6d6d6); font-weight: 600; }
#no-rules-messages .nr-connection-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 106, 112, .55);
  background: rgba(255, 106, 112, .09);
  color: #ffb3b6;
  font-size: 13px;
  line-height: 1.4;
}
#no-rules-messages .nr-connection-banner .nr-connection-text { flex: 1; min-width: 0; }
#no-rules-messages .nr-connection-banner .button { flex-shrink: 0; padding: 4px 10px; font-size: 12px; }
#no-rules-messages .nr-loading-top {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  color: var(--mutedTextColor, #8c8c8c);
  font-size: 12px;
}
#no-rules-messages .nr-loading-top i { margin-right: 6px; }
#no-rules-messages .chat2-message-group { display: flex; align-items: flex-start; gap: 10px; margin-top: 10px; }
#no-rules-messages .chat2-message-group-content { flex: 1; min-width: 0; }
#no-rules-messages .chat2-group-avatar {
  position: sticky;
  bottom: 8px;
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  cursor: pointer;
  align-self: flex-end;
  margin-top: 4px;
  border-radius: 50%;
}
#no-rules-messages .chat2-group-avatar img { width: 35px; height: 35px; border-radius: 50%; display: block; }
#no-rules-messages .chat2-message-block {
  border-radius: 13px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}
#no-rules-messages .chat2-message-header { display: flex; margin-bottom: 4px; }
#no-rules-messages .chat2-message-text { width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; gap: 10px; }
#no-rules-messages .chat2-message-text:has(.LbTrigger) { flex-direction: column; }
#no-rules-messages .chat2-message-text-inner { word-break: break-word; overflow: hidden; min-width: 0; }
#no-rules-messages .reply-message {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  padding: 4px 8px;
  margin-bottom: 5px;
  border-left: 3px solid var(--primary, #2a6a4a);
  border-radius: 6px;
  background: rgba(11, 80, 49, .18);
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
  overflow: hidden;
}
#no-rules-messages .reply-message.reply-message-your { background: linear-gradient(90deg, rgb(11, 80, 49) 0%, var(--primaryLighter, #153a2a) 100%) !important; }
#no-rules-messages .chat2-reply-text-label { font-weight: 700; white-space: nowrap; }
#no-rules-messages .chat2-reply-text { color: var(--mutedTextColor, #9a9a9a); min-width: 0; overflow: hidden; text-overflow: ellipsis; }
#no-rules-messages .chat2-reply-text p { margin: 0; }
#no-rules-messages .chat2-day-separator {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--mutedTextColor, #8c8c8c);
  padding: 10px 0;
  font-size: 12px;
}
#no-rules-messages .chat2-day-separator::before,
#no-rules-messages .chat2-day-separator::after { content: ''; flex: 1; border-bottom: 1px solid var(--primary, #2a2a2a); }
#no-rules-messages .chat2-day-separator::before { margin-right: .25em; }
#no-rules-messages .chat2-day-separator::after { margin-left: .25em; }
#no-rules-messages .chat2-message-tagged .chat2-message-block {
  background: #0b503157;
  box-shadow: 0 0 0 1px inset #0b5031b0;
}
#no-rules-messages .nr-message-pending { opacity: .7; }
#no-rules-messages .nr-message-pending.nr-failed { opacity: 1; }
#no-rules-messages .nr-message-deleting { opacity: .45; pointer-events: none; }
#no-rules-messages .nr-failed .chat2-message-block { box-shadow: 0 0 0 1px inset #ff6a708f; }
#no-rules-messages .nr-message-deleted { opacity: .72; }
#no-rules-messages .nr-retry {
  color: #ff8b8f;
  cursor: pointer;
  margin-left: 8px;
  font-size: 12px;
  white-space: nowrap;
}
#no-rules-messages .nr-retry:hover { text-decoration: underline; }
#no-rules-messages .nr-highlight .chat2-message-block { box-shadow: 0 0 0 2px var(--primaryMedium, #2f8a5d); transition: box-shadow .2s ease; }
#no-rules-messages .nr-swipe { transform: translateX(8px); transition: transform .12s ease; }
#no-rules-messages .chat2-typingDetails { color: var(--mutedTextColor, #8c8c8c); min-height: 18px; display: flex; align-items: center; padding: 0 0 5px 0; gap: 5px; user-select: none; margin-top: 8px; }
#no-rules-messages .chat2-typingUsers { display: block; width: 100%; }

.nr-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%) translateY(16px);
  max-width: min(520px, calc(100vw - 32px));
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid var(--primary, #2a2a2a);
  background: var(--primaryDark, #1b211f);
  color: var(--contentText, #d6d6d6);
  font-size: 13px;
  line-height: 1.35;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .38);
  opacity: 0;
  pointer-events: none;
  z-index: 2147483000;
  transition: opacity .18s ease, transform .18s ease;
}
.nr-toast.nr-toast-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
.nr-toast[data-type="error"] { border-color: #ff6a70; color: #ffc0c2; }
.nr-toast[data-type="success"] { border-color: #2f8a5d; color: #b6e7ce; }

.nr-menu {
  position: fixed;
  z-index: 2147483000;
  min-width: 200px;
  max-width: 260px;
  overflow: hidden;
  border: 1px solid var(--primary, #2a2a2a);
  border-radius: 8px;
  background: var(--primaryDarker, #141918);
  box-shadow: 0 12px 36px rgba(0, 0, 0, .45);
}
.nr-menu .menu { list-style: none; margin: 0; padding: 4px; }
.nr-menu .action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--contentText, #d6d6d6);
  font-size: 13px;
  line-height: 1.2;
  user-select: none;
}
.nr-menu .action:hover { background: var(--primaryDark, #1b211f); }
.nr-menu .action.nr-danger { color: #ff8b8f; }
.nr-menu .Svg-Icon { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; opacity: .85; }
.nr-menu .Svg-Icon svg { width: 20px; height: 20px; }
.nr-menu .nr-menu-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nr-modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, .58);
  z-index: 2147483000;
}
.nr-modal {
  width: min(380px, 100%);
  border: 1px solid var(--primary, #2a2a2a);
  border-radius: 10px;
  padding: 20px;
  background: var(--contentBackground, #111615);
  color: var(--contentText, #d6d6d6);
  box-shadow: 0 16px 48px rgba(0, 0, 0, .5);
}
.nr-modal-title { font-weight: 700; font-size: 15px; margin-bottom: 8px; }
.nr-modal-text { color: var(--mutedTextColor, #8c8c8c); font-size: 13px; line-height: 1.45; margin-bottom: 18px; }
.nr-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

.nr-room-unread {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 6px;
  border-radius: 9px;
  background: #ff6a70;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
}
.nr-room-unread[hidden] { display: none !important; }

#no-rules-reply {
  display: flex;
  flex-direction: row;
  background: var(--primaryDark, #1b211f);
  gap: 8px;
  padding: 8px 10px;
  align-items: center;
  position: relative;
}
#no-rules-reply .svg-icon-reply svg { fill: var(--mutedTextColor, #8c8c8c); width: 20px; height: 20px; }
#no-rules-reply .chat2-replying-container { display: flex; flex-direction: column; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
#no-rules-reply .chat2-replying-author { font-weight: 600; color: var(--contentText, #d6d6d6); }
#no-rules-reply .chat2-replying-text { color: var(--mutedTextColor, #8c8c8c); line-height: 150%; word-break: break-all; overflow: hidden; text-overflow: ellipsis; }
#no-rules-reply .chat2-cancel-reply { margin-left: auto; flex-shrink: 0; }
#no-rules-reply .chat2-cancel-reply:not([class*="lztng-"]) {
  width: 18px;
  height: 18px;
  display: inline-block;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' stroke='rgb(214,214,214)' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'/%3E%3Cline x1='6' y1='6' x2='18' y2='18'/%3E%3C/svg%3E");
  background-size: 100%;
  opacity: .65;
  cursor: pointer;
}
#no-rules-reply .chat2-cancel-reply:not([class*="lztng-"]):hover { opacity: 1; }

#no-rules-editing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: var(--primaryDark, #1b211f);
  color: var(--contentText, #d6d6d6);
  font-size: 13px;
  border-bottom: 1px solid var(--primary, #2a2a2a);
}
#no-rules-editing .chat2-cancel-editing { margin-left: auto; }
#no-rules-editing .chat2-cancel-editing:not([class*="lztng-"]) {
  width: 15px;
  height: 15px;
  display: block;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' stroke='rgb(148,148,148)' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'/%3E%3Cline x1='6' y1='6' x2='18' y2='18'/%3E%3C/svg%3E");
  background-size: 100%;
  cursor: pointer;
}
#no-rules-editing .chat2-cancel-editing:not([class*="lztng-"])::before { content: none; }

#no-rules-paused {
  position: absolute;
  right: 16%;
  left: 16%;
  bottom: 0;
  margin-bottom: 10px;
  z-index: 101;
}
#no-rules-paused[hidden] { display: none !important; }
#no-rules-paused .chat2-paused-button {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 34px;
  border-radius: 8px;
  background: var(--primaryDark, #1b211f);
  color: var(--contentText, #d6d6d6);
  border: 1px solid var(--primary, #2a2a2a);
  padding: 0 15px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
#no-rules-paused .chat2-paused-text { width: 100%; text-align: center; }
#no-rules-paused .chat2-paused-icon { display: inline-flex; align-items: center; justify-content: center; margin-left: 8px; }

@media (max-width: 700px) {
  #no-rules-messages { padding: 8px 10px 0 10px; }
  #no-rules-paused { left: 8%; right: 8%; }
  .nr-menu { min-width: 190px; max-width: 230px; }
  #no-rules-messages .chat2-message-block { padding: 7px 10px; }
}
`;

function classOf(element, fallback = '') {
  const value = element?.getAttribute?.('class');
  return value || fallback;
}

function pickHash(element, fallback) {
  if (!element || !element.classList) return fallback;
  for (const className of element.classList) {
    if (className.startsWith('lztng-')) return className;
  }
  return fallback;
}

function stripClassNames(className, names) {
  const blocked = new Set(names);
  return String(className || '')
    .split(/\s+/)
    .filter((value) => value && !blocked.has(value))
    .join(' ');
}

function injectStyles() {
  if (document.getElementById('no-rules-styles')) return;
  const style = document.createElement('style');
  style.id = 'no-rules-styles';
  style.textContent = NR_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function captureTemplates() {
  const nativeMessages = document.querySelector(
    '.chat2-full-inner .chat2-messages:not(#no-rules-messages)',
  );
  const nativeGroup = nativeMessages?.querySelector('.chat2-message-group');
  const nativeMessage = nativeGroup?.querySelector('.chat2-message') || nativeMessages?.querySelector('.chat2-message');
  const nativeBlock = nativeMessage?.querySelector('.chat2-message-block');
  const nativeHeader = nativeMessage?.querySelector('.chat2-message-header');
  const nativeUsername = nativeMessage?.querySelector('.chat2-message-username');
  const nativePoster = nativeUsername?.querySelector('a.username') || nativeUsername?.querySelector('a');
  const nativeGroupContent = nativeGroup?.querySelector('.chat2-message-group-content');
  const nativeAvatar = nativeGroup?.querySelector('.chat2-group-avatar');
  const nativeAvatarImg = nativeAvatar?.querySelector('img');
  const nativeText = nativeMessage?.querySelector('.chat2-message-text');
  const nativeInner = nativeMessage?.querySelector('.chat2-message-text-inner');
  const nativeDate = nativeMessage?.querySelector('.chat2-message-date');
  const nativeDay = nativeMessages?.querySelector('.chat2-day-separator');
  const nativeSocket = document.querySelector('.chat2-full-inner .chat2-socket-state');
  const nativeSocketInner = nativeSocket?.querySelector('div');
  const nativeFooter = document.querySelector('.chat2-footer');

  HASH.message = pickHash(nativeMessage, HASH.message);
  HASH.footer = pickHash(nativeFooter || nativeGroup, HASH.footer);
  HASH.username = pickHash(nativePoster, HASH.username);
  HASH.date = pickHash(nativeDate, HASH.date);
  HASH.socket = pickHash(nativeSocketInner, HASH.socket);

  const fallback = !nativeMessage;

  state.templates = {
    fallback,
    group: classOf(nativeGroup, `chat2-message-group ${HASH.footer}`),
    groupContent: classOf(nativeGroupContent, `chat2-message-group-content ${HASH.footer}`),
    avatar: stripClassNames(
      classOf(nativeAvatar, `chat2-group-avatar ${HASH.footer}`),
      [],
    ).replace(/\bAv\d+s\b/g, '').trim() || `chat2-group-avatar ${HASH.footer}`,
    avatarImg: classOf(nativeAvatarImg, HASH.footer),
    tag: `chat2-tag ${HASH.footer}`,
    messageBase: stripClassNames(
      classOf(
        nativeMessage,
        `chat2-message chat2-message-general ${HASH.message}`,
      ),
      ['chat2-message-general', 'chat2-message-fromSelf', 'chat2-message-tagged'],
    ).trim(),
    block: classOf(
      nativeBlock,
      `chat2-message-block lztng-primary-darker ${HASH.message}`,
    ),
    header: classOf(nativeHeader, `chat2-message-header ${HASH.message}`),
    usernameWrap: classOf(nativeUsername, 'chat2-message-username'),
    poster: stripClassNames(
      classOf(nativePoster, `username poster ${HASH.username}`),
      ['highlight'],
    ).trim(),
    text: classOf(nativeText, `chat2-message-text ${HASH.message}`),
    inner: classOf(nativeInner, `chat2-message-text-inner ${HASH.message}`),
    date: classOf(nativeDate, `chat2-message-date ${HASH.date} chat2-message-date-muted`),
    day: classOf(nativeDay, `chat2-day-separator ${HASH.footer}`),
    socket: classOf(nativeSocket, `chat2-socket-state ${HASH.footer}`),
    socketInner: classOf(nativeSocketInner, HASH.socket),
    footer: classOf(nativeFooter, HASH.footer),
    typing: `chat2-typingDetails ${HASH.typing}`,
    typingUsers: `chat2-typingUsers ${HASH.typing}`,
    paused: `chat2-paused ${HASH.paused}`,
    pausedButton: `chat2-paused-button ${HASH.paused}`,
    pausedText: `chat2-paused-text ${HASH.paused}`,
    pausedIcon: `chat2-paused-icon ${HASH.paused}`,
    menu: `message-actions nr-menu ${HASH.menu}`,
    menuList: `menu ${HASH.menu}`,
    menuAction: `action ${HASH.menu}`,
    menuIcon: `Svg-Icon ${HASH.menu}`,
  };

  if (!state.templates.messageBase) {
    state.templates.messageBase = `chat2-message ${HASH.message}`;
  }
  if (!state.templates.block) {
    state.templates.block = `chat2-message-block lztng-primary-darker ${HASH.message}`;
  }
  if (!state.templates.poster) {
    state.templates.poster = `username poster ${HASH.username}`;
  }
  if (!state.templates.date) {
    state.templates.date = `chat2-message-date ${HASH.date} chat2-message-date-muted`;
  }
}

function ensureMessagesContainer() {
  const nativeMessages =
    document.querySelector('.chat2-full-inner .chat2-messages:not(#no-rules-messages)') ||
    state.nativeMessagesEl;
  if (!nativeMessages || !nativeMessages.isConnected) return false;
  state.nativeMessagesEl = nativeMessages;

  if (!state.templates || state.templates.fallback) {
    captureTemplates();
  }

  let container = document.getElementById('no-rules-messages');
  if (!container || !container.isConnected) {
    container = document.createElement('div');
    container.id = 'no-rules-messages';
    container.className = 'no-rules-messages nr-hidden';
    container.setAttribute('role', 'log');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-relevant', 'additions');
    nativeMessages.after(container);
    els.messages = container;
    installMessageListeners(container);
    renderMessages({ forceBottom: true });
  } else if (container.previousElementSibling !== nativeMessages) {
    nativeMessages.after(container);
  }
  els.messages = container;
  attachScrollListener();
  return true;
}

function ensureRoomLink() {
  const sideMenu = document.querySelector('.side-menu');
  if (!sideMenu) {
    state.roomLink = null;
    return false;
  }
  const nativeLinks = [
    ...sideMenu.querySelectorAll('.goto-room:not([data-no-rules])'),
  ];
  if (!nativeLinks.length) return false;

  let link = sideMenu.querySelector('.goto-room[data-no-rules]');
  if (!link || !link.isConnected) {
    link = nativeLinks[0].cloneNode(true);
    link.dataset.noRules = '1';
    link.removeAttribute('target');
    link.classList.remove('active');
    link.href = '#no-rules';
    link.setAttribute('title', `${BUILD.roomTitle} — приватная комната`);
    const title = link.querySelector('.roomTitle');
    if (title) title.textContent = BUILD.roomTitle;
    else link.append(Object.assign(document.createElement('span'), { className: 'roomTitle', textContent: BUILD.roomTitle }));
    const online = link.querySelector('.roomOnline');
    if (online) online.innerHTML = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
    const unread = document.createElement('span');
    unread.className = 'nr-room-unread';
    unread.hidden = true;
    link.appendChild(unread);
    nativeLinks[nativeLinks.length - 1].after(link);
  }

  state.roomLink = link;
  const title = link.querySelector('.roomTitle');
  if (title && title.textContent !== BUILD.roomTitle) title.textContent = BUILD.roomTitle;
  const online = link.querySelector('.roomOnline');
  if (online) {
    const markup = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
    if (online.innerHTML.trim() !== markup) online.innerHTML = markup;
  }
  let unread = link.querySelector('.nr-room-unread');
  if (!unread) {
    unread = document.createElement('span');
    unread.className = 'nr-room-unread';
    link.appendChild(unread);
  }
  const unreadText = state.unread > 99 ? '99+' : String(state.unread);
  if (unread.hidden !== state.unread <= 0) unread.hidden = state.unread <= 0;
  if (unread.textContent !== unreadText) unread.textContent = unreadText;

  const lastNative = nativeLinks[nativeLinks.length - 1];
  if (lastNative && link.compareDocumentPosition(lastNative) & Node.DOCUMENT_POSITION_PRECEDING) {
    lastNative.after(link);
  }

  if (state.active) {
    link.classList.add('active');
    for (const nativeLink of nativeLinks) nativeLink.classList.remove('active');
  } else {
    link.classList.remove('active');
  }
  return true;
}

function hideNativeForRoom() {
  const nativeMessages = document.querySelector(
    '.chat2-full-inner .chat2-messages:not(#no-rules-messages)',
  );
  if (!nativeMessages) return;
  state.nativeMessagesEl = nativeMessages;
  const candidates = [
    nativeMessages,
    ...document.querySelectorAll(
      '.chat2-full-inner .chat2-prevmessages-loading, .chat2-full-inner .chat2-messages-loading, .chat2-full-inner .chat2-paused:not(#no-rules-paused)',
    ),
  ];
  for (const element of candidates) {
    if (!element || !element.isConnected) continue;
    if (state.hiddenNative.some((entry) => entry.element === element)) {
      if (element.style.display !== 'none') element.style.display = 'none';
      continue;
    }
    state.hiddenNative.push({ element, display: element.style.display });
    element.style.display = 'none';
  }
}

function showNativeForRoom() {
  for (const entry of state.hiddenNative) {
    if (entry.element?.isConnected) entry.element.style.display = entry.display;
  }
  state.hiddenNative = [];
}

function ensureSocketIndicator() {
  if (!state.active) return;
  const roomTitle = document.querySelector('.chat2-full-inner .room-title');
  if (!roomTitle) return;
  const nativeSocket = roomTitle.querySelector('.chat2-socket-state');
  let socket = roomTitle.querySelector('#no-rules-socket');
  if (!socket) {
    socket = document.createElement('div');
    socket.id = 'no-rules-socket';
    socket.dataset.nrSocket = '1';
    socket.className = state.templates?.socket || `chat2-socket-state ${HASH.footer}`;
    socket.innerHTML = `<div class="${state.templates?.socketInner || HASH.socket}"><span class="socket-disconnected ${HASH.socket}"></span></div>`;
    const titleSpan = roomTitle.querySelector(':scope > span:not(.chat2-socket-state):not(#no-rules-socket)');
    if (titleSpan) titleSpan.after(socket);
    else roomTitle.prepend(socket);
  }
  if (nativeSocket) nativeSocket.style.display = 'none';
  els.socket = socket;
  updateSocketIndicator();
}

function updateSocketIndicator() {
  const socket = els.socket;
  if (!socket) return;
  const span = socket.querySelector('span');
  if (!span) return;
  const status =
    state.wsState === 'connected'
      ? 'connected'
      : state.wsState === 'connecting'
        ? 'connecting'
        : 'disconnected';
  span.className = `socket-${status} ${HASH.socket}`;
  socket.setAttribute(
    'title',
    status === 'connected'
      ? 'Подключено'
      : status === 'connecting'
        ? 'Подключение…'
        : 'Нет соединения',
  );
}

function updateHeader() {
  const roomTitle = document.querySelector('.chat2-full-inner .room-title');
  const roomOnline = document.querySelector('.chat2-full-inner .roomTitleBlock > .roomOnline');
  if (!roomTitle) return;
  const titleSpan = roomTitle.querySelector(
    ':scope > span:not(.chat2-socket-state):not(#no-rules-socket)',
  );

  if (state.active) {
    if (titleSpan && !state.nativeTitle) state.nativeTitle = titleSpan.textContent || '';
    if (roomOnline && !state.nativeOnline) state.nativeOnline = roomOnline.textContent || '';
    if (titleSpan && titleSpan.textContent !== BUILD.roomTitle) titleSpan.textContent = BUILD.roomTitle;
    if (roomOnline) {
      const text = `Онлайн: ${Number(state.online) || 0}`;
      if (roomOnline.textContent !== text) roomOnline.textContent = text;
    }
    ensureSocketIndicator();
  } else {
    if (titleSpan && titleSpan.textContent === BUILD.roomTitle && state.nativeTitle) {
      titleSpan.textContent = state.nativeTitle;
    }
    if (roomOnline && /^Онлайн:/.test(roomOnline.textContent || '') && state.nativeOnline) {
      const restored = state.nativeOnline;
      if (roomOnline.textContent !== restored && state.nativeOnline) roomOnline.textContent = restored;
    }
    const socket = roomTitle.querySelector('#no-rules-socket');
    if (socket) socket.remove();
    const nativeSocket = roomTitle.querySelector('.chat2-socket-state');
    if (nativeSocket) nativeSocket.style.display = '';
    els.socket = null;
  }
}

function updateRoomLinkActive() {
  if (!state.roomLink?.isConnected) return;
  if (state.active) {
    state.roomLink.classList.add('active');
    for (const link of document.querySelectorAll('.side-menu .goto-room:not([data-no-rules])')) {
      link.classList.remove('active');
    }
  } else {
    state.roomLink.classList.remove('active');
  }
}

function updateUnreadBadge() {
  if (!state.roomLink?.isConnected) return;
  const badge = state.roomLink.querySelector('.nr-room-unread');
  if (!badge) return;
  const unreadText = state.unread > 99 ? '99+' : String(state.unread);
  if (badge.hidden !== state.unread <= 0) badge.hidden = state.unread <= 0;
  if (badge.textContent !== unreadText) badge.textContent = unreadText;
}

function updateOnline() {
  const onlineText = `Онлайн: ${Number(state.online) || 0}`;
  const roomOnline = document.querySelector('.chat2-full-inner .roomTitleBlock > .roomOnline');
  if (state.active && roomOnline && roomOnline.textContent !== onlineText) {
    roomOnline.textContent = onlineText;
  }
  if (state.roomLink?.isConnected) {
    const linkOnline = state.roomLink.querySelector('.roomOnline');
    if (linkOnline) {
      const markup = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
      if (linkOnline.innerHTML.trim() !== markup) linkOnline.innerHTML = markup;
    }
  }
}

function updatePaused() {
  let paused = document.getElementById('no-rules-paused');
  const shouldShow = state.active && state.unread > 0 && !isNearBottom();
  if (!paused) {
    paused = document.createElement('div');
    paused.id = 'no-rules-paused';
    paused.className = state.templates?.paused || `chat2-paused ${HASH.paused}`;
    paused.hidden = true;
    paused.innerHTML = `<button type="button" class="${state.templates?.pausedButton || `chat2-paused-button ${HASH.paused}`}"><div class="${state.templates?.pausedText || `chat2-paused-text ${HASH.paused}`}"><span></span></div><div class="${state.templates?.pausedIcon || `chat2-paused-icon ${HASH.paused}`}"><i class="fas fa-angle-double-down"></i></div></button>`;
    paused.addEventListener('click', (event) => {
      event.preventDefault();
      state.unread = 0;
      updateUnreadBadge();
      updatePaused();
      scrollToBottom('smooth');
    });
    const host = document.querySelector('.chat2-full-inner') || document.body;
    host.appendChild(paused);
  }
  const text = paused.querySelector('.chat2-paused-text span');
  const nextText = `Новых сообщений: ${state.unread}`;
  if (text && text.textContent !== nextText) text.textContent = nextText;
  if (paused.hidden !== !shouldShow) paused.hidden = !shouldShow;
}

function enforceActiveUI() {
  if (!state.initialized) return;
  const nativeMessages = document.querySelector(
    '.chat2-full-inner .chat2-messages:not(#no-rules-messages)',
  );
  if (state.active) {
    ensureMessagesContainer();
    ensureRoomLink();

    const container = document.getElementById('no-rules-messages');
    hideNativeForRoom();
    if (container) {
      container.classList.remove('nr-hidden');
      container.style.display = '';
    }
    if (nativeMessages) nativeMessages.style.display = 'none';
    if (state.replyTo && !document.getElementById('no-rules-reply')) renderReplyBar();
    if (state.editing && !document.getElementById('no-rules-editing')) renderEditBar();
    updateHeader();
    updateRoomLinkActive();
    updateUnreadBadge();
    updatePaused();
  } else {
    // While No Rules is inactive the native Svelte app owns this subtree and
    // re-renders it on every room switch. Keep our node out of its way instead
    // of hiding and repeatedly re-inserting it.
    document.getElementById('no-rules-messages')?.remove();
    els.messages = null;
    showNativeForRoom();
    if (nativeMessages) nativeMessages.style.display = '';
    ensureRoomLink();
    updateHeader();
    updateRoomLinkActive();
    updatePaused();
  }
}

function scheduleEnforceUI() {
  if (state.enforceTimer) return;
  state.enforceTimer = setTimeout(() => {
    state.enforceTimer = null;
    enforceActiveUI();
  }, 100);
}

function attachScrollListener() {
  const scroll = getScrollElement();
  if (!scroll || state.scrollEl === scroll) return;
  if (state.scrollEl && state.scrollHandler) {
    state.scrollEl.removeEventListener('scroll', state.scrollHandler);
  }
  state.scrollEl = scroll;
  state.scrollHandler = () => {
    if (!state.active) return;
    if (isNearBottom()) {
      if (state.unread > 0) {
        state.unread = 0;
        updateUnreadBadge();
        updatePaused();
      }
    } else {
      updatePaused();
    }
    if (scroll.scrollTop < 80 && state.historyHasMore && !state.historyLoading) {
      requestOlderMessages();
    }
  };
  scroll.addEventListener('scroll', state.scrollHandler, { passive: true });
}

function createAvatar(user, tagged) {
  const avatar = document.createElement('div');
  avatar.className = state.templates?.avatar || `chat2-group-avatar ${HASH.footer}`;
  avatar.setAttribute('role', 'button');
  avatar.tabIndex = 0;
  avatar.dataset.userId = String(user?.id || '');
  avatar.setAttribute('aria-label', `Ответить ${user?.username || ''}`);
  const img = document.createElement('img');
  img.className = state.templates?.avatarImg || HASH.footer;
  img.loading = 'lazy';
  img.alt = `avatar ${user?.username || ''}`;
  img.src = user?.avatar || DEFAULT_AVATAR;
  img.addEventListener('error', () => {
    if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
  });
  avatar.appendChild(img);
  if (tagged) {
    const tag = document.createElement('div');
    tag.className = state.templates?.tag || `chat2-tag ${HASH.footer}`;
    avatar.appendChild(tag);
  }
  return avatar;
}

function createDaySeparator(label) {
  const day = document.createElement('div');
  day.className = state.templates?.day || `chat2-day-separator ${HASH.footer}`;
  day.textContent = label;
  return day;
}

function createGroup(messages, { dayLabel = null, tagged = false } = {}) {
  const first = messages[0];
  const group = document.createElement('div');
  group.className = state.templates?.group || `chat2-message-group ${HASH.footer}`;
  group.dataset.userId = String(first.user.id);
  group.appendChild(createAvatar(first.user, tagged));

  const content = document.createElement('div');
  content.className = state.templates?.groupContent || `chat2-message-group-content ${HASH.footer}`;
  if (dayLabel) content.appendChild(createDaySeparator(dayLabel));

  messages.forEach((message, index) => {
    content.appendChild(createMessageElement(message, { showHeader: index === 0 }));
  });
  group.appendChild(content);
  return group;
}

function createMessageElement(message, { showHeader = true } = {}) {
  const wrapper = document.createElement('div');
  wrapper.dataset.messageId = String(message.id);
  wrapper.dataset.nrMessage = '1';
  wrapper.className = state.templates?.messageBase || `chat2-message ${HASH.message}`;
  wrapper.classList.add(...messageStyleClass(message).split(/\s+/).filter(Boolean));
  if (message.pending) wrapper.classList.add('nr-message-pending', 'chat2-message-pending');
  if (message.failed) wrapper.classList.add('nr-failed');
  if (message.deleting) wrapper.classList.add('nr-message-deleting');
  if (message.deleted) wrapper.classList.add('nr-message-deleted');

  const block = document.createElement('div');
  block.className = state.templates?.block || `chat2-message-block lztng-primary-darker ${HASH.message}`;
  wrapper.appendChild(block);

  if (showHeader) {
    const header = document.createElement('div');
    header.className = state.templates?.header || `chat2-message-header ${HASH.message}`;
    const usernameWrap = document.createElement('div');
    usernameWrap.className = state.templates?.usernameWrap || 'chat2-message-username';
    const anchor = document.createElement('a');
    anchor.className = state.templates?.poster || `username poster ${HASH.username}`;
    anchor.href = message.user.profileUrl || `https://lolz.team/members/${message.user.id}/`;
    let usernameHtml = message.user.usernameHtml ||
      `<span class="styleUserNickname">${escapeHtml(message.user.username || 'unknown')}</span>`;
    usernameHtml = sanitizeClientHtml(usernameHtml);
    if (!usernameHtml) {
      usernameHtml = `<span class="styleUserNickname">${escapeHtml(message.user.username || 'unknown')}</span>`;
    }
    anchor.innerHTML = usernameHtml;
    usernameWrap.appendChild(anchor);
    header.appendChild(usernameWrap);
    block.appendChild(header);
  }

  if (message.reply) {
    const reply = document.createElement('div');
    reply.className = `reply-message ${HASH.message}`;
    if (message.reply.user?.id && message.reply.user.id === state.user?.id) {
      reply.classList.add('reply-message-your');
    }
    reply.dataset.replyTo = String(message.reply.id);
    const label = document.createElement('span');
    label.className = `chat2-reply-text-label username ${HASH.message}`;
    let replyUsernameHtml = message.reply.user?.usernameHtml ||
      `<span class="styleUserNickname">${escapeHtml(message.reply.user?.username || 'unknown')}</span>`;
    replyUsernameHtml = sanitizeClientHtml(replyUsernameHtml);
    if (!replyUsernameHtml) {
      replyUsernameHtml = `<span class="styleUserNickname">${escapeHtml(message.reply.user?.username || 'unknown')}</span>`;
    }
    label.innerHTML = replyUsernameHtml;
    const text = document.createElement('span');
    text.className = `chat2-reply-text ${HASH.message}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = message.reply.text || '[сообщение]';
    text.appendChild(paragraph);
    reply.appendChild(label);
    reply.appendChild(document.createTextNode(' '));
    reply.appendChild(text);
    block.appendChild(reply);
  }

  const text = document.createElement('div');
  text.className = state.templates?.text || `chat2-message-text ${HASH.message}`;
  const inner = document.createElement('span');
  inner.className = state.templates?.inner || `chat2-message-text-inner ${HASH.message}`;
  if (message.deleted) {
    const deleted = document.createElement('span');
    deleted.className = 'muted';
    deleted.textContent = 'Сообщение удалено';
    inner.appendChild(deleted);
  } else {
    const html = sanitizeClientHtml(message.html || '');
    if (html) {
      inner.innerHTML = html;
    } else {
      inner.textContent = message.text || '';
    }
  }
  text.appendChild(inner);

  const date = document.createElement('span');
  date.className = state.templates?.date || `chat2-message-date ${HASH.date} chat2-message-date-muted`;
  const createdAt = new Date(message.createdAt || Date.now());
  date.textContent = formatTime(createdAt);
  date.title = formatFullDate(createdAt);
  text.appendChild(date);

  if (message.failed) {
    const retry = document.createElement('span');
    retry.className = 'nr-retry';
    retry.dataset.nrRetry = message.clientId || '';
    retry.textContent = 'Повторить';
    retry.title = 'Повторить отправку';
    text.appendChild(retry);
  }

  block.appendChild(text);
  return wrapper;
}

function installMessageListeners(container) {
  if (container.dataset.nrListeners === '1') return;
  container.dataset.nrListeners = '1';

  container.addEventListener('contextmenu', (event) => {
    const wrapper = event.target.closest?.('[data-nr-message]');
    if (!wrapper) return;
    const message = findMessageByElement(wrapper);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    openMessageMenu(message, event.clientX, event.clientY);
  });

  container.addEventListener('dblclick', (event) => {
    if (!state.active) return;
    if (event.target.closest?.('a, button, .nr-retry, .reply-message')) return;
    if (!window.getSelection()?.isCollapsed) return;
    const wrapper = event.target.closest?.('[data-nr-message]');
    if (!wrapper) return;
    const message = findMessageByElement(wrapper);
    if (!message || message.deleted || message.pending) return;
    event.preventDefault();
    startReply(message);
  });

  container.addEventListener('click', (event) => {
    const retry = event.target.closest?.('.nr-retry');
    if (retry) {
      event.preventDefault();
      event.stopPropagation();
      retryPending(retry.dataset.nrRetry);
      return;
    }
    const reply = event.target.closest?.('.reply-message');
    if (reply) {
      event.preventDefault();
      event.stopPropagation();
      scrollToMessage(Number(reply.dataset.replyTo));
      return;
    }
    const avatar = event.target.closest?.('.chat2-group-avatar');
    if (avatar) {
      event.preventDefault();
      event.stopPropagation();
      const group = avatar.closest('.chat2-message-group');
      const wrapper = group?.querySelector('[data-nr-message]');
      const message = wrapper ? findMessageByElement(wrapper) : null;
      if (message && !message.deleted && !message.pending) startReply(message);
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const avatar = event.target.closest?.('.chat2-group-avatar');
    if (!avatar) return;
    event.preventDefault();
    const group = avatar.closest('.chat2-message-group');
    const wrapper = group?.querySelector('[data-nr-message]');
    const message = wrapper ? findMessageByElement(wrapper) : null;
    if (message && !message.deleted && !message.pending) startReply(message);
  });

  if (IS_TOUCH) {
    installTouchGestures(container);
  }
}

function findMessageByElement(element) {
  const id = element?.dataset?.messageId;
  if (!id) return null;
  if (state.messages.has(Number(id))) return state.messages.get(Number(id));
  for (const pending of state.pending.values()) {
    if (String(pending.id) === String(id)) return pending;
  }
  return null;
}

function installTouchGestures(container) {
  let gesture = null;

  const clearLongPress = () => {
    if (gesture?.longPressTimer) clearTimeout(gesture.longPressTimer);
    if (gesture) gesture.longPressTimer = null;
  };

  container.addEventListener(
    'touchstart',
    (event) => {
      if (!state.active || event.touches.length !== 1) return;
      const wrapper = event.target.closest?.('[data-nr-message]');
      if (!wrapper) return;
      if (event.target.closest?.('a, button, .reply-message, .nr-retry')) return;
      const touch = event.touches[0];
      const message = findMessageByElement(wrapper);
      if (!message || message.deleted) return;
      gesture = {
        wrapper,
        message,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        longPressTimer: null,
        openedMenu: false,
      };
      clearLongPress();
      gesture.longPressTimer = setTimeout(() => {
        if (!gesture) return;
        gesture.openedMenu = true;
        openMessageMenu(message, gesture.lastX, gesture.lastY);
      }, 520);
    },
    { passive: true },
  );

  container.addEventListener(
    'touchmove',
    (event) => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearLongPress();
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        if (event.cancelable) event.preventDefault();
        const offset = clamp(dx, -10, 90);
        gesture.wrapper.style.transform = `translateX(${offset}px)`;
        gesture.wrapper.classList.add('nr-swipe');
      }
    },
    { passive: false },
  );

  const finish = (event) => {
    if (!gesture) return;
    clearLongPress();
    const wrapper = gesture.wrapper;
    const dx = gesture.lastX - gesture.startX;
    const dy = gesture.lastY - gesture.startY;
    const openedMenu = gesture.openedMenu;
    const message = gesture.message;
    wrapper.style.transform = '';
    wrapper.classList.remove('nr-swipe');
    gesture = null;
    if (!openedMenu && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (event?.cancelable) event.preventDefault();
      if (message && !message.deleted && !message.pending) startReply(message);
    }
  };

  container.addEventListener('touchend', finish, { passive: false });
  container.addEventListener('touchcancel', finish, { passive: true });
}

function openMessageMenu(message, x, y) {
  closeMenu();
  if (!message) return;

  const menu = document.createElement('div');
  menu.className = state.templates?.menu || `message-actions nr-menu ${HASH.menu}`;
  menu.style.position = 'fixed';
  menu.style.zIndex = '2147483000';
  const list = document.createElement('ul');
  list.className = state.templates?.menuList || `menu ${HASH.menu}`;
  menu.appendChild(list);

  const add = (icon, label, handler, options = {}) => {
    const item = document.createElement('li');
    item.className = state.templates?.menuAction || `action ${HASH.menu}`;
    if (options.danger) item.classList.add('nr-danger');
    if (options.disabled) item.setAttribute('aria-disabled', 'true');
    const iconWrap = document.createElement('span');
    iconWrap.className = state.templates?.menuIcon || `Svg-Icon ${HASH.menu}`;
    iconWrap.innerHTML = NR_ICONS[icon] || NR_ICONS.copy;
    const text = document.createElement('span');
    text.className = 'nr-menu-label';
    text.textContent = label;
    item.appendChild(iconWrap);
    item.appendChild(text);
    if (!options.disabled) {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        handler();
      });
    }
    list.appendChild(item);
  };

  if (message.pending) {
    if (message.failed) {
      add('retry', 'Повторить отправку', () => retryPending(message.clientId));
    }
    add('delete', 'Отменить сообщение', () => removePending(message.clientId), { danger: true });
  } else if (message.deleted) {
    add('copy', 'Сообщение удалено', () => {}, { disabled: true });
  } else {
    add('reply', 'Ответить', () => startReply(message));
    add('mention', 'Упомянуть', () => mentionMessage(message));
    add('copy', 'Скопировать текст', () => copyText(message.text || extractTextFromHtml(message.html)));
    if (message.user?.id === state.user?.id) {
      add('edit', 'Редактировать', () => startEdit(message));
      add('delete', 'Удалить', () => deleteMessage(message), { danger: true });
    }
    if (message.meta?.hasMedia) {
      const media = firstMediaUrl(message.html);
      if (media) {
        add('external', 'Открыть медиа', () => window.open(media, '_blank', 'noopener'));
        add('link', 'Скопировать ссылку', () => copyText(media));
      }
    }
    if (IS_TOUCH) {
      add('select', 'Выделить текст', () => selectMessageText(message));
    }
  }

  if (!list.children.length) return;
  document.body.appendChild(menu);
  positionMenu(menu, x, y);
  state.menuEl = menu;

  const close = (event) => {
    if (event?.type === 'pointerdown' && menu.contains(event.target)) return;
    closeMenu();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', onMenuKeydown, true);
    window.addEventListener('resize', closeMenu, { passive: true });
    window.addEventListener('scroll', closeMenu, true);
  }, 0);
}

function onMenuKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
}

function positionMenu(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  const padding = 8;
  let left = Number(x) || padding;
  let top = Number(y) || padding;
  if (left + rect.width > window.innerWidth - padding) left = window.innerWidth - rect.width - padding;
  if (top + rect.height > window.innerHeight - padding) top = Number(y) - rect.height - 6;
  left = clamp(left, padding, Math.max(padding, window.innerWidth - rect.width - padding));
  top = clamp(top, padding, Math.max(padding, window.innerHeight - rect.height - padding));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeMenu() {
  if (state.menuEl) {
    state.menuEl.remove();
    state.menuEl = null;
  }
}

function confirmAction({ title, text, confirmLabel = 'Подтвердить', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'nr-modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'nr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = document.createElement('div');
    heading.className = 'nr-modal-title';
    heading.textContent = title;
    const content = document.createElement('div');
    content.className = 'nr-modal-text';
    content.textContent = text;
    const actions = document.createElement('div');
    actions.className = 'nr-modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button';
    cancel.textContent = 'Отмена';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'button primary';
    confirm.textContent = confirmLabel;
    if (danger) {
      confirm.style.background = '#a33a3f';
      confirm.style.borderColor = '#a33a3f';
    }
    actions.appendChild(cancel);
    actions.appendChild(confirm);
    modal.appendChild(heading);
    modal.appendChild(content);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish(false);
    });
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => cancel.focus(), 0);
  });
}

function showSystemMessage(text) {
  showToast(text, 'info');
}

async function copyText(text) {
  const value = String(text || '');
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast('Скопировано', 'success');
  } catch {
    showToast('Не удалось скопировать', 'error');
  }
}

function selectMessageText(message) {
  const wrapper = document.querySelector(`#no-rules-messages [data-message-id="${message.id}"] .chat2-message-text-inner`);
  if (!wrapper) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
}

function firstMediaUrl(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeClientHtml(html);
  const image = template.content.querySelector('img');
  if (image?.src) return image.src;
  const video = template.content.querySelector('video');
  if (video?.src) return video.src;
  const link = template.content.querySelector('a.LbTrigger');
  if (link?.href) return link.href;
  return '';
}

function scrollToMessage(id) {
  const targetId = Number(id);
  if (!targetId) return;
  let element = document.querySelector(
    `#no-rules-messages [data-message-id="${targetId}"]`,
  );
  if (!element) {
    if (state.historyHasMore && !state.historyLoading) {
      requestOlderMessages();
      setTimeout(() => {
        element = document.querySelector(
          `#no-rules-messages [data-message-id="${targetId}"]`,
        );
        if (element) highlightElement(element);
      }, 900);
    } else {
      showToast('Сообщение находится в более старой истории', 'info');
    }
    return;
  }
  highlightElement(element);
}

function highlightElement(element) {
  element.classList.add('nr-highlight');
  const block = element.querySelector('.chat2-message-block') || element;
  block.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => element.classList.remove('nr-highlight'), 1600);
}


// ---- 20-messages.js ----
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
  const container = els.messages || document.getElementById('no-rules-messages');
  if (!container) return;
  els.messages = container;
  const scroll = getScrollElement();
  const previousTop = scroll?.scrollTop || 0;
  const previousHeight = scroll?.scrollHeight || 0;
  const wasNearBottom = isNearBottom();

  container.replaceChildren();

  if (state.connectionError) {
    container.appendChild(buildConnectionBanner());
  }

  if (state.historyLoading && state.historyHasMore) {
    const loading = document.createElement('div');
    loading.className = 'nr-loading-top';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка истории…';
    container.appendChild(loading);
  }

  const messages = allVisibleMessages();
  if (!messages.length) {
    container.appendChild(buildEmptyState());
  } else {
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
      container.appendChild(
        createGroup(group.messages, {
          dayLabel: separatorLabel,
          tagged: group.tagged,
        }),
      );
      lastDay = group.dayKey;
    }
  }

  renderTypingInto(container);

  requestAnimationFrame(() => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;
    if (forceBottom || (!preserveScroll && wasNearBottom)) {
      scrollToBottom('auto');
      return;
    }
    if (preserveScroll && previousHeight > 0) {
      const delta = scrollElement.scrollHeight - previousHeight;
      scrollElement.scrollTop = previousTop + Math.max(0, delta);
      return;
    }
    scrollElement.scrollTop = previousTop;
  });

  updatePaused();
  updateUnreadBadge();
}

function buildConnectionBanner() {
  const banner = document.createElement('div');
  banner.className = 'nr-connection-banner';
  const text = document.createElement('div');
  text.className = 'nr-connection-text';
  text.textContent = state.connectionError;
  banner.appendChild(text);
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button nr-connection-retry';
  retry.textContent = 'Повторить';
  retry.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.authFailedPermanently = false;
    state.connectionError = '';
    connectNoRules({ forceToken: true, userInitiated: true });
  });
  banner.appendChild(retry);
  return banner;
}

function buildEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'nr-empty';
  const icon = document.createElement('i');
  icon.className = state.wsState === 'connected' ? 'far fa-comments' : 'fas fa-spinner fa-spin';
  const title = document.createElement('div');
  title.className = 'nr-empty-title';
  const subtitle = document.createElement('div');
  subtitle.className = 'muted';
  if (state.wsState === 'connected') {
    title.textContent = 'Пока нет сообщений';
    subtitle.textContent = 'Напишите первым';
  } else if (state.connectionError) {
    title.textContent = 'Нет соединения';
    subtitle.textContent = 'Проверьте подключение и попробуйте снова';
  } else {
    title.textContent = 'Подключение к No Rules…';
    subtitle.textContent = 'Это может занять пару секунд';
  }
  empty.appendChild(icon);
  empty.appendChild(title);
  empty.appendChild(subtitle);
  return empty;
}

function renderTypingInto(container) {
  const existing = container.querySelector('#no-rules-typing');
  const users = [...state.typing.values()]
    .filter((entry) => entry && entry.user?.id !== state.user?.id && now() - entry.at < 5000)
    .map((entry) => entry.user);
  if (!users.length) {
    existing?.remove();
    return;
  }
  const typing = existing || document.createElement('div');
  typing.id = 'no-rules-typing';
  typing.className = state.templates?.typing || `chat2-typingDetails ${HASH.typing}`;
  const text = document.createElement('span');
  text.className = state.templates?.typingUsers || `chat2-typingUsers ${HASH.typing}`;
  const names = users.map((user) => user.username).filter(Boolean);
  if (!names.length) {
    typing.remove();
    return;
  }
  text.textContent =
    names.length === 1
      ? `${names[0]} печатает…`
      : names.length === 2
        ? `${names[0]} и ${names[1]} печатают…`
        : `${names[0]}, ${names[1]} и ещё ${names.length - 2} печатают…`;
  typing.replaceChildren(text);
  if (!existing) container.appendChild(typing);
}

function renderTypingOnly() {
  const container = els.messages || document.getElementById('no-rules-messages');
  if (!container) return;
  renderTypingInto(container);
}

function markTyping(user) {
  if (!user?.id || user.id === state.user?.id) return;
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
  entry.timer = setTimeout(() => {
    state.typing.delete(user.id);
    renderTypingOnly();
  }, 4500);
  state.typing.set(user.id, entry);
  renderTypingOnly();
}

function removeTyping(userId) {
  const entry = state.typing.get(Number(userId));
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  state.typing.delete(Number(userId));
  renderTypingOnly();
}

function mergeHistoryMessages(messages, { mode = 'initial' } = {}) {
  if (!Array.isArray(messages)) return;
  let changed = false;
  for (const message of messages) {
    if (!message || !Number.isFinite(Number(message.id)) || !message.user?.id) continue;
    const id = Number(message.id);
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
      state.outbox = state.outbox.filter((payload) => payload.clientId !== message.clientId);
    }
    updateLastMessageId([message]);
  }

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

  if (clientId) removePending(clientId);
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
  const existing = state.messages.get(id);
  if (payload.message?.user?.id) {
    state.messages.set(id, payload.message);
  } else if (existing) {
    existing.deleted = true;
    existing.html = '';
    existing.text = '';
    existing.deleting = false;
    existing.deletedAt = Date.now();
    state.messages.set(id, existing);
  }
  state.pendingEdits.delete(id);
  state.pendingDeletes.delete(id);
  if (state.active) {
    renderMessages({
      preserveScroll: true,
      forceBottom: isNearBottom(),
    });
  }
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
  };
  renderReplyBar();
  getTiptap()?.commands.focus();
}

function cancelReply() {
  if (!state.replyTo) return;
  state.replyTo = null;
  document.getElementById('no-rules-reply')?.remove();
  getTiptap()?.commands.focus();
}

function renderReplyBar() {
  document.getElementById('no-rules-reply')?.remove();
  if (!state.replyTo) return;
  const inputBox = document.querySelector('.chat2-footer .chat2-inputBox');
  if (!inputBox) return;
  const bar = document.createElement('div');
  bar.id = 'no-rules-reply';
  bar.className = `chat2-replying ${HASH.footer}`;

  const icon = document.createElement('div');
  icon.className = `svg-icon-reply ${HASH.footer}`;
  icon.innerHTML = NR_ICONS.reply;
  bar.appendChild(icon);

  const container = document.createElement('div');
  container.className = `chat2-replying-container ${HASH.footer}`;
  const author = document.createElement('span');
  author.className = `chat2-replying-author ${HASH.footer}`;
  let authorHtml = state.replyTo.user?.usernameHtml ||
    `<span class="styleUserNickname">${escapeHtml(state.replyTo.user?.username || 'unknown')}</span>`;
  authorHtml = sanitizeClientHtml(authorHtml);
  author.innerHTML = authorHtml;
  const text = document.createElement('span');
  text.className = `chat2-replying-text ${HASH.footer}`;
  text.textContent = state.replyTo.text || '[вложение]';
  text.title = state.replyTo.text || '';
  container.appendChild(author);
  container.appendChild(text);
  bar.appendChild(container);

  const cancel = document.createElement('div');
  cancel.className = `chat2-cancel-reply ${HASH.footer}`;
  cancel.setAttribute('role', 'button');
  cancel.tabIndex = 0;
  cancel.title = 'Отменить ответ';
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
  getEditorElement()?.focus();
  document.querySelector('.chat2-footer')?.scrollIntoView({ block: 'end' });
}

function renderEditBar() {
  document.getElementById('no-rules-editing')?.remove();
  if (!state.editing) return;
  const footer = document.querySelector('.chat2-footer');
  const inputBox = footer?.querySelector('.chat2-inputBox');
  if (!footer || !inputBox) return;
  const bar = document.createElement('div');
  bar.id = 'no-rules-editing';
  bar.className = `chat2-message-editing ${HASH.footer}`;
  bar.appendChild(document.createTextNode('Редактирование сообщения'));
  const cancel = document.createElement('div');
  cancel.className = `chat2-cancel-editing ${HASH.footer}`;
  cancel.setAttribute('role', 'button');
  cancel.tabIndex = 0;
  cancel.title = 'Отменить редактирование';
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

function saveEdit() {
  if (!state.editing) return;
  if (editorIsEmpty()) {
    showToast('Сообщение пустое', 'error');
    return;
  }
  const id = state.editing.id;
  const target = state.messages.get(id);
  if (!target || target.deleted) {
    cancelEdit({ restore: true });
    return;
  }
  const html = getEditorHtml();
  const text = getEditorText().trim() || extractTextFromHtml(html);
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

async function deleteMessage(message) {
  if (!state.active || !message || message.deleted || message.pending) return;
  if (message.user?.id !== state.user?.id) return;
  const ok = await confirmAction({
    title: 'Удалить сообщение?',
    text: 'Сообщение будет удалено для всех участников комнаты.',
    confirmLabel: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  const existing = state.messages.get(message.id);
  if (!existing) return;
  const previous = { ...existing };
  existing.deleting = true;
  state.messages.set(existing.id, existing);
  renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  const sent = sendWs({ type: 'message.delete', id: existing.id });
  if (!sent) {
    existing.deleting = false;
    state.messages.set(existing.id, existing);
    showToast('Нет соединения. Сообщение не удалено.', 'error');
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    return;
  }
  state.pendingDeletes.set(existing.id, previous);
}

function retryPending(clientId) {
  const pending = state.pending.get(clientId);
  if (!pending) return;
  pending.failed = false;
  pending.createdAt = now();
  pending.queued = false;
  state.pending.set(clientId, pending);
  renderMessages({ forceBottom: true });
  const sent = sendWs(pending.payload);
  if (!sent) {
    pending.queued = true;
    if (!state.outbox.some((payload) => payload.clientId === clientId)) {
      state.outbox.push(pending.payload);
    }
    showToast('Сообщение будет отправлено после подключения.', 'info');
  }
}

function removePending(clientId) {
  if (!clientId) return;
  const pending = state.pending.get(clientId);
  if (!pending) return;
  state.pending.delete(clientId);
  state.outbox = state.outbox.filter((payload) => payload.clientId !== clientId);
  if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
}

function sendCurrentMessage() {
  if (!state.active) return;
  if (state.editing) {
    saveEdit();
    return;
  }
  if (editorIsEmpty()) return;
  if (!state.user || state.authFailedPermanently) {
    showToast('Подключение ещё не завершено. Подождите немного.', 'error');
    return;
  }
  const html = getEditorHtml();
  if (html.length > 24_000) {
    showToast('Сообщение слишком длинное', 'error');
    return;
  }
  const text = getEditorText().trim() || extractTextFromHtml(html);
  const clientId = randomId();
  const reply = state.replyTo
    ? {
        id: state.replyTo.id,
        user: state.replyTo.user,
        text: state.replyTo.text,
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
    if (!state.outbox.some((item) => item.clientId === clientId)) {
      state.outbox.push(payload);
    }
    showToast('Нет соединения. Сообщение будет отправлено после подключения.', 'info');
  }
}

function handleServerError(payload) {
  const code = String(payload?.code || '');
  const message = String(payload?.message || 'Ошибка сервера');
  const clientId = payload?.clientId;
  const messageId = Number(payload?.messageId ?? payload?.id);
  if (clientId && state.pending.has(clientId)) {
    const pending = state.pending.get(clientId);
    if (code === 'duplicate') {
      state.pending.delete(clientId);
      state.outbox = state.outbox.filter((item) => item.clientId !== clientId);
      renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
      showToast('Такое сообщение уже отправлено', 'info');
      return;
    }
    pending.failed = true;
    pending.queued = false;
    state.outbox = state.outbox.filter((item) => item.clientId !== clientId);
    state.pending.set(clientId, pending);
    if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
    showToast(message, 'error');
    return;
  }
  if (Number.isFinite(messageId)) {
    if (state.pendingEdits.has(messageId)) {
      const previous = state.pendingEdits.get(messageId);
      state.pendingEdits.delete(messageId);
      state.messages.set(messageId, previous);
    }
    if (state.pendingDeletes.has(messageId)) {
      const previous = state.pendingDeletes.get(messageId);
      state.pendingDeletes.delete(messageId);
      state.messages.set(messageId, previous);
    }
    if (state.active) renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
  showToast(message, 'error');
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
  const mode = payload?.after != null ? 'after' : payload?.before != null ? 'before' : 'initial';
  mergeHistoryMessages(messages, { mode });
  state.historyLoading = false;

  if (mode === 'initial') {
    state.historyLoaded = true;
    state.historyHasMore = Boolean(payload.hasMore);
    const ids = [...state.messages.keys()];
    if (ids.length) state.oldestId = Math.min(...ids);
    if (state.active) {
      renderMessages({ forceBottom: true });
    }
    return;
  }

  if (mode === 'before') {
    state.historyHasMore = Boolean(payload.hasMore);
    const ids = [...state.messages.keys()];
    if (ids.length) state.oldestId = Math.min(...ids);
    if (state.active) {
      renderMessages({ preserveScroll: true, forceBottom: false });
    }
    return;
  }

  const ids = [...state.messages.keys()];
  if (ids.length) state.oldestId = Math.min(...ids);
  if (state.active) {
    renderMessages({ preserveScroll: true, forceBottom: isNearBottom() });
  }
  if (payload.hasMore && messages.length && state.syncPages < 10) {
    state.syncPages += 1;
    requestSyncAfter();
  }
}


// ---- 30-ws.js ----
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
      response = await fetch('/login/generate-temporary-token', {
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
      showToast('Жалоба отправлена', 'success');
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


// ---- 40-main.js ----
function isChatboxPage() {
  return /^\/chatbox\/?$/.test(location.pathname);
}

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

function activateRoom({ fromNotification = false } = {}) {
  if (!state.initialized) return;
  if (state.active) {
    closeMenu();
    if (location.hash !== '#no-rules') {
      history.replaceState(null, '', '#no-rules');
    }
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

  if (location.hash !== '#no-rules') {
    history.replaceState(null, '', '#no-rules');
  }
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

  if (state.nativeDraft) {
    setEditorHtml(state.nativeDraft);
  }
  state.nativeDraft = '';

  if (restoreHeader) updateHeader();
  if (location.hash === '#no-rules') {
    history.replaceState(null, '', location.pathname + location.search);
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

async function init() {
  if (state.destroyed || state.initialized) return;
  if (!isChatboxPage()) return;
  if (document.body?.dataset.noRulesBoot === '1') return;
  if (document.body) document.body.dataset.noRulesBoot = '1';
  state.initStartedAt = now();

  try {
    await waitFor('.chat2-full-inner', 30_000);
    await waitFor('.chat2-footer .tiptap', 30_000);
  } catch {
    return;
  }

  injectStyles();
  captureTemplates();
  state.nativeMessagesEl = document.querySelector(
    '.chat2-full-inner .chat2-messages:not(#no-rules-messages)',
  );
  ensureRoomLink();
  installGlobalListeners();
  loadSession();
  loadDraftStorage();
  observeDom();
  state.initialized = true;
  exposeDebugApi();

  if (location.hash === '#no-rules') {
    setTimeout(() => activateRoom(), 250);
  } else if (state.session) {
    setTimeout(() => {
      if (!state.active) connectNoRules({ userInitiated: false });
    }, 1400);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

})();
