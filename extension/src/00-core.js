/**
 * Shared state, storage helpers and DOM sanitizers for the No Rules room.
 *
 * The userscript is split into five plain-JS modules that the build step
 * concatenates into one file. Keeping the state in a single typed object makes
 * the WebSocket lifecycle, optimistic messages and native DOM bindings
 * predictable; there are no third-party runtime dependencies.
 *
 * @typedef {Object} NrUser
 * @property {number} id
 * @property {string} username
 * @property {string} [usernameHtml]
 * @property {string|null} [avatar]
 * @property {string|null} [color]
 * @property {string} [profileUrl]
 *
 * @typedef {Object} NrReply
 * @property {number} id
 * @property {NrUser} user
 * @property {string} text
 * @property {boolean} [deleted]
 *
 * @typedef {Object} NrMessage
 * @property {number|string} id
 * @property {NrUser} user
 * @property {string} html
 * @property {string} text
 * @property {number} createdAt
 * @property {number|null} [editedAt]
 * @property {boolean} [deleted]
 * @property {boolean} [pending]
 * @property {boolean} [failed]
 * @property {string} [clientId]
 * @property {NrReply|null} [reply]
 */
const BUILD = {
  wsUrl: '__WS_URL__',
  accessKey: '__ACCESS_KEY__',
  version: '__VERSION__',
  roomTitle: 'No Rules',
};

const STORAGE_KEYS = {
  session: 'lzt.no-rules.session.v1',
  draft: 'lzt.no-rules.draft.v1',
  active: 'lzt.no-rules.active.v1',
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
  spinner: 'lztng-1f69oee',
  online: 'lztng-yzgsen',
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
  initRunning: false,
  rootObserver: null,
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
  deletedIds: new Set(),
  pending: new Map(),
  pendingEdits: new Map(),
  outbox: [],
  lastMessageId: 0,
  historyLoaded: false,
  historyHasMore: false,
  historyLoading: false,
  syncPages: 0,
  oldestId: null,
  online: 0,
  onlineUsers: [],
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
  month: 'short',
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

function getChatRoot() {
  return (
    document.querySelector('.chat2[aria-label="chatbox"]') ||
    document.querySelector('.chat2-full-inner, .chat2-widget-inner')
  );
}

function getChatMessages() {
  return getChatRoot()?.querySelector('.chat2-messages:not(#no-rules-messages)') || null;
}

function isFullChat() {
  const root = getChatRoot();
  return Boolean(root && !root.classList.contains('chat2-widget-inner'));
}

function setActivePreference(active) {
  try {
    if (active) localStorage.setItem(STORAGE_KEYS.active, '1');
    else localStorage.removeItem(STORAGE_KEYS.active);
  } catch {
    // ignore
  }
}

function hasActivePreference() {
  try {
    return localStorage.getItem(STORAGE_KEYS.active) === '1';
  } catch {
    return false;
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
  'unfurl-renderer',
  'unfurl-wrapper',
  'unfurl-content',
  'unfurlMarketTitle',
  'unfurl-link-loading',
  'node-unfurl',
  'node-media',
  'svelte-renderer',
  'embed-link',
  'embed-link-wrapper',
  'mini_unfurl_icon',
  'embed-icon',
  'internal-link',
  'visit-icon',
  'forum-wrapper',
  'forum-icon',
  'forum-title',
  'market-wrapper',
  'market-icon',
  'market-title',
  'link-unfurl-loading-widget',
  'spinner-mask',
  'loading-logo',
  'ProseMirror-widget',
  'shorted',
  'marketItem',
  'text',
  'SvgIcon',
  'categoryIcon',
  'title',
  'telegram',
  'steam',
  'discord',
  'market',
  'vkontakte',
  'vk',
  'youtube',
  'tiktok',
  'instagram',
  'twitter',
  'github',
  'twitch',
  'spotify',
  'soundcloud',
  'apple',
  'google',
  'epicgames',
  'riot',
  'minecraft',
  'valorant',
  'fortnite',
  'internalNodeLink',
  'internalLinkClicker',
  'LinkClicker',
  'short',
  'KWMOver',
  'videoContainer',
  'videoWrapper',
  'spoiler',
  'bbCodeSpoiler',
]);

const CLIENT_ALLOWED_CLASS_RE = /^(?:node\d+|category--[a-z0-9_-]+|Av\d+s|lztng-[a-z0-9-]+|fa[a-z0-9-]*)$/i;

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

const USERNAME_ALLOWED_TAGS = new Set([
  'span',
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'title',
  'desc',
  'metadata',
  'animate',
  'animatetransform',
]);

const USERNAME_ALLOWED_ATTRIBUTES = new Set([
  'viewbox',
  'width',
  'height',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'preserveaspectratio',
  'xmlns',
  'role',
  'transform',
  'opacity',
  'd',
  'fill-rule',
  'clip-rule',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'gradientunits',
  'fx',
  'fy',
  'offset',
  'stop-color',
  'stop-opacity',
  'clippathunits',
  'attributename',
  'values',
  'from',
  'to',
  'by',
  'dur',
  'begin',
  'repeatcount',
  'keysplines',
  'calcmode',
  'type',
]);

const SAFE_ANIMATED_ATTRIBUTES = new Set([
  'transform',
  'stroke',
  'fill',
  'opacity',
  'r',
  'stroke-width',
  'stroke-dasharray',
  'd',
  'cx',
  'cy',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'offset',
  'stop-color',
  'stop-opacity',
]);

function sanitizeUsernameHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const element of nodes) {
    const tag = element.tagName.toLowerCase();
    if (!USERNAME_ALLOWED_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    if (tag === 'animate' || tag === 'animatetransform') {
      const attributeName = String(element.getAttribute('attributeName') || '').toLowerCase();
      if (!SAFE_ANIMATED_ATTRIBUTES.has(attributeName)) {
        element.remove();
        continue;
      }
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name;
      const lower = name.toLowerCase();
      if (lower.startsWith('on') || lower === 'href' || lower === 'xlink:href' || lower === 'id') {
        element.removeAttribute(name);
        continue;
      }
      if (lower === 'style') {
        if (tag !== 'span') {
          element.removeAttribute(name);
          continue;
        }
        const safeStyle = sanitizeClientStyle(attribute.value);
        if (safeStyle) element.setAttribute('style', safeStyle);
        else element.removeAttribute(name);
        continue;
      }
      if (lower === 'class') {
        if (tag !== 'span') {
          element.removeAttribute(name);
          continue;
        }
        const classes = String(attribute.value || '')
          .split(/\s+/)
          .filter((value) => value === 'styleUserNickname' || value === 'uniqUsernameIcon--custom');
        if (classes.length) element.setAttribute('class', classes.join(' '));
        else element.removeAttribute(name);
        continue;
      }
      if (!USERNAME_ALLOWED_ATTRIBUTES.has(lower)) {
        element.removeAttribute(name);
      }
    }
  }
  template.content.querySelectorAll('.uniqUsernameIcon--custom').forEach((element) => {
    if (!element.querySelector('svg')) element.remove();
  });
  return template.innerHTML;
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
        const kept = value
          .split(/\s+/)
          .filter(
            (className) =>
              CLIENT_ALLOWED_CLASSES.has(className) || CLIENT_ALLOWED_CLASS_RE.test(className),
          );
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

const URL_TEXT_RE = /https?:\/\/[^\s<>"'`]+/gi;

function linkifyHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest('a, code, pre, abbr, .unfurlContainer, .internalNodeLink, .Tooltip, .SvgIcon')
    ) {
      continue;
    }
    const text = node.nodeValue || '';
    if (!URL_TEXT_RE.test(text)) continue;
    URL_TEXT_RE.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = URL_TEXT_RE.exec(text))) {
      const raw = match[0];
      const trailing = raw.match(/[.,;:!?)\]]+$/);
      const url = trailing ? raw.slice(0, -trailing[0].length) : raw;
      if (!url || !/^https?:\/\//i.test(url)) continue;
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const anchor = document.createElement('a');
      let host = '';
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        // keep as text
      }
      if (!host) {
        fragment.appendChild(document.createTextNode(raw));
      } else {
        const internal = /(^|\.)(lolz\.(team|live|guru)|zelenka\.guru|lzt\.market)$/.test(host);
        anchor.href = url;
        anchor.textContent = url;
        anchor.className = internal ? 'internalLink' : 'externalLink ProxyLink';
        if (!internal) {
          anchor.target = '_blank';
          anchor.rel = 'nofollow noopener';
          anchor.dataset.proxyHref = url;
        }
        fragment.appendChild(anchor);
      }
      if (trailing) fragment.appendChild(document.createTextNode(trailing[0]));
      lastIndex = match.index + raw.length;
    }
    if (!fragment.childNodes.length) continue;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(fragment, node);
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
  const nativeMessages = getChatMessages() || els.nativeMessagesEl;
  const parent = nativeMessages?.parentElement;
  if (parent && parent.classList.contains('scrollable-content')) return parent;
  return getChatRoot()?.querySelector('.scrollable > .scrollable-content') || null;
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
  // The native Lolzteam Chatbox has no toast/notice stack. Keep diagnostics in
  // the console only; never render our own transient UI over the chat.
  try {
    console.debug(`[NoRules:${type}] ${String(message)}`);
  } catch {
    // ignore logging errors
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
  const messages = sortedMessages().filter((message) => !message.deleted);
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
    socketOpen: state.ws?.readyState === 1,
    chatRoot: getChatRoot()
      ? getChatRoot().classList.contains('chat2-widget-inner')
        ? 'widget'
        : 'full'
      : null,
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
