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

// The native chat rejects messages longer than this. Keep the composer and the
// server on the same hard limit so pasted text cannot slip through.
const MAX_MESSAGE_CHARS = 512;

const STORAGE_KEYS = {
  session: 'lzt.no-rules.session.v1',
  draft: 'lzt.no-rules.draft.v1',
  active: 'lzt.no-rules.active.v1',
  outbox: 'lzt.no-rules.outbox.v1',
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
  outboxTimer: null,
  lastMessageId: 0,
  historyLoaded: false,
  historyHasMore: false,
  historyLoading: false,
  historyRetryTimer: null,
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
  roomScrollTop: 0,
  roomAtBottom: true,
  roomSuspended: false,
  socketProbe: null,
  lastTypingAt: 0,
  connectionError: '',
  composerError: '',
  composerErrorTimer: null,
  viewingHistory: false,
  historyHasNewer: false,
  historyWindow: null,
  jumpTargetId: null,
  historyNewerReadyAt: 0,
  suppressScrollLoadUntil: 0,
  scrollPinToken: 0,
  bottomFollow: true,
  bottomFollowRaf: null,
  bottomResizeObserver: null,
  lastEditorHtml: '',
  lastEditorLength: 0,
  limitRestoring: false,
  limitEditor: null,
  clearEditorToken: 0,
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

function saveOutbox() {
  if (!state.outbox.length) {
    removeKey(STORAGE_KEYS.outbox);
    return;
  }
  writeJson(
    STORAGE_KEYS.outbox,
    state.outbox.slice(-100).map((payload) => ({
      type: 'message.send',
      clientId: payload.clientId,
      html: payload.html,
      replyTo: payload.replyTo ?? null,
      ownerId: Number(payload.ownerId || state.user?.id) || 0,
    })),
  );
}

function loadOutbox() {
  const saved = readJson(STORAGE_KEYS.outbox);
  if (!Array.isArray(saved)) return;
  const restored = [];
  const seen = new Set();
  for (const payload of saved.slice(-100)) {
    if (!payload || payload.type !== 'message.send') continue;
    if (typeof payload.clientId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(payload.clientId)) continue;
    if (typeof payload.html !== 'string' || !payload.html || payload.html.length > 24_000) continue;
    if (seen.has(payload.clientId)) continue;
    seen.add(payload.clientId);
    restored.push({
      type: 'message.send',
      clientId: payload.clientId,
      html: payload.html,
      replyTo:
        payload.replyTo == null
          ? null
          : Number.isFinite(Number(payload.replyTo))
            ? Number(payload.replyTo)
            : null,
      ownerId: Number(payload.ownerId) || 0,
    });
  }
  state.outbox = restored;
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
  'aside',
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
  'button',
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
  'uniqUsernameIcon--custom',
  'highlight',
  'alertAction',
  'notranslate',
  'Tooltip',
  'bbCodeBlock',
  'bbCodeQuote',
  'quoteContainer',
  'quote',
  'quoteExpand',
  'quoteAuthor',
  'ToggleTriggerAnchor',
  'bbCodeSpoilerContainer',
  'bbCodeSpoilerButton',
  'ToggleTrigger',
  'JsOnly',
  'SpoilerTitle',
  'arrowWidget',
  'SpoilerTarget',
  'bbCodeSpoilerText',
  'content--align--left',
  'content--align--center',
  'content--align--right',
  'button',
  'primary',
  'bbCodeCode',
  'bbCodePrice',
  'CensorSpoiler',
  'nr-spoiler-hidden',
  'bbCodePlain',
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
  'price',
  'Value',
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

const CLIENT_ALLOWED_CLASS_RE = /^(?:node\d+|category--[a-z0-9_-]+|Av\d+s|lztng-[a-z0-9-]+|fa[a-z0-9-]*|style\d+)$/i;

const CLIENT_ALLOWED_STYLE_PROPS = new Map([
  ['color', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i],
  ['-webkit-text-fill-color', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i],
  ['background', /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|(linear|radial)-gradient\([^<>{};]{1,300}\))$/i],
  ['background-image', /^((linear|radial)-gradient\([^<>{};]{1,300}\)|none)$/i],
  ['background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['-webkit-background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['text-shadow', /^[0-9a-z#.,%()\s-]{1,200}$/i],
  ['font-weight', /^(normal|bold|bolder|lighter|[1-9]00)$/i],
  ['white-space', /^(normal|nowrap|pre|pre-wrap)$/i],
  ['font-size', /^(?:9|10|12|15|18|22|26)px$/i],
  ['text-align', /^(?:left|center|right)$/i],
  ['text-decoration', /^(?:underline|line-through|none)$/i],
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
          .filter(
            (value) =>
              value === 'styleUserNickname' ||
              value === 'uniqUsernameIcon--custom' ||
              /^style\d+$/.test(value),
          );
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

/**
 * Remove Tiptap's editor-only trailing nodes. A sent message otherwise keeps
 * `<div class="ProseMirror-widget"></div><br><p></p>` after an unfurl card,
 * which adds an empty line box and makes the message look twice as tall.
 * This is intentionally a DOM normalizer, not a second HTML sanitizer.
 *
 * @param {string} html
 * @returns {string}
 */
function normalizeClientHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  // Dragging an already sent photo into Tiptap can wrap the image in an
  // anchor without href (the editor's link mark is still attached). The
  // server correctly drops that anchor, but sanitize-html drops its child
  // image too, so the message becomes empty. Keep the media and unwrap the
  // editor-only anchor. Same for Tiptap node-view wrappers if a future
  // editor version serializes them through getHTML().
  for (const anchor of [...template.content.querySelectorAll('a')]) {
    if (anchor.getAttribute('href')) continue;
    if (!anchor.querySelector('img, video')) continue;
    if ((anchor.textContent || '').trim()) continue;
    anchor.replaceWith(...anchor.childNodes);
  }
  for (const separator of [...template.content.querySelectorAll('.ProseMirror-separator, .ProseMirror-trailingBreak')]) {
    separator.remove();
  }
  for (const wrapper of [...template.content.querySelectorAll('[data-node-view-wrapper], .tiptap-media, .node-image')]) {
    if (!wrapper.querySelector('img, video')) continue;
    if ((wrapper.textContent || '').trim()) continue;
    wrapper.replaceWith(...wrapper.childNodes);
  }

  for (const widget of [...template.content.querySelectorAll('.ProseMirror-widget')]) {
    widget.remove();
  }

  const hasMeaningfulContent = (node) =>
    Boolean(node.querySelector('img, video, audio, iframe, hr, .unfurl-renderer, .unfurlContainer, .embed-link'));

  // Tiptap leaves an empty line after a node view. Drop only the trailing
  // whitespace/br/empty-p sequence; blank lines inside the message stay.
  for (;;) {
    const last = template.content.lastChild;
    if (!last) break;
    if (last.nodeType === Node.TEXT_NODE && !String(last.textContent || '').trim()) {
      last.remove();
      continue;
    }
    if (last.nodeType !== Node.ELEMENT_NODE) break;
    const element = /** @type {Element} */ (last);
    if (element.tagName === 'BR') {
      element.remove();
      continue;
    }
    if (element.tagName === 'P' && !String(element.textContent || '').trim() && !hasMeaningfulContent(element)) {
      element.remove();
      continue;
    }
    break;
  }

  return template.innerHTML;
}

function sanitizeClientHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = normalizeClientHtml(html);
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
      if (name.startsWith('on') || name === 'srcdoc' || name === 'data-tippy-content') {
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
        (name === 'href' ||
          name === 'src' ||
          name === 'poster' ||
          name === 'data-href' ||
          name === 'data-proxy-href' ||
          name === 'data-url' ||
          name === 'data-fallback-src') &&
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
    if (tag !== 'span' && USERNAME_ALLOWED_TAGS.has(tag)) {
      for (const attribute of [...element.attributes]) {
        const name = attribute.name;
        const lower = name.toLowerCase();
        if (
          lower.startsWith('on') ||
          lower === 'href' ||
          lower === 'xlink:href' ||
          lower === 'id' ||
          !USERNAME_ALLOWED_ATTRIBUTES.has(lower)
        ) {
          element.removeAttribute(name);
        }
      }
      if (tag === 'animate' || tag === 'animatetransform') {
        const attributeName = String(element.getAttribute('attributeName') || '').toLowerCase();
        if (
          !SAFE_ANIMATED_ATTRIBUTES.has(attributeName) ||
          ['values', 'from', 'to', 'by'].some((key) =>
            /url\s*\(|javascript:/i.test(element.getAttribute(key) || ''),
          )
        ) {
          element.remove();
        }
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
  if (!element) return null;
  const candidates = [];
  try { candidates.push(element.editor); } catch { /* Xray/expando */ }
  try { candidates.push(element.wrappedJSObject?.editor); } catch { /* Xray/expando */ }
  try {
    const pageDocument = PAGE_WINDOW?.document;
    const pageElement = pageDocument?.querySelector('.chat2-footer .tiptap');
    if (pageElement && pageElement !== element) candidates.push(pageElement.editor);
  } catch { /* ignore */ }
  return candidates.find((editor) => editor && typeof editor.getHTML === 'function') || null;
}

function placeCaretAtEnd(element) {
  if (!element) return;
  try { element.focus({ preventScroll: true }); } catch { /* ignore */ }
  try {
    const selection = PAGE_WINDOW?.getSelection?.() || window.getSelection?.();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // ProseMirror owns the selection; the editor API path handles this when
    // the page-context editor is available.
  }
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

// Count user-perceived characters as Unicode code points (not UTF-16 units),
// matching PHP/XenForo's mb_strlen-style limit. BBCode that is still text in
// the editor is counted as typed; rendered media only contributes its alt.
function messageCharacterCount(value) {
  return [...String(value ?? '')].length;
}

function editorLimitText() {
  const html = getEditorHtml();
  const fromHtml = extractTextFromHtml(html);
  const plain = getEditorText();
  return messageCharacterCount(fromHtml) >= messageCharacterCount(plain) ? fromHtml : plain;
}

function editorMessageLength() {
  return messageCharacterCount(editorLimitText());
}

function syncEditorLimitState() {
  state.lastEditorHtml = getEditorHtml();
  state.lastEditorLength = editorMessageLength();
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

function clearTiptapContent(editor) {
  if (typeof editor.commands.clearContent === 'function') {
    editor.commands.clearContent(true);
  } else {
    editor.commands.setContent('');
  }
}

function clearEditor() {
  const token = ++state.clearEditorToken;
  const wasRestoring = state.limitRestoring;
  state.limitRestoring = true;
  try {
    const editor = getTiptap();
    if (editor) {
      clearTiptapContent(editor);
      editor.commands.focus('end');
      // Tiptap can leave NodeView DOM wrappers behind after clearing several
      // media nodes. Clear once more on the next frame and drop any orphaned
      // wrappers while the editor is still empty. The token makes this a no-op
      // as soon as the user starts a new draft.
      const cleanupClearedEditor = () => {
        if (token !== state.clearEditorToken || !state.active) return;
        const current = getTiptap();
        const element = getEditorElement();
        if (!current || !element) return;
        if (current.getText().trim()) return;
        const leftovers = element.querySelectorAll(
          '.node-image, .node-smilie, .tiptap-media, .ProseMirror-gapcursor',
        );
        if (!leftovers.length) return;
        const restoreGuard = state.limitRestoring;
        state.limitRestoring = true;
        try {
          clearTiptapContent(current);
          for (const node of leftovers) {
            if (node.isConnected) node.remove();
          }
          current.commands.focus('end');
        } finally {
          state.limitRestoring = restoreGuard;
          syncEditorLimitState();
        }
      };
      requestAnimationFrame(cleanupClearedEditor);
      setTimeout(cleanupClearedEditor, 80);
      return;
    }
    const element = getEditorElement();
    if (!element) return;
    element.innerHTML = '<p></p>';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    placeCaretAtEnd(element);
  } finally {
    state.limitRestoring = wasRestoring;
    syncEditorLimitState();
  }
}

function setEditorHtml(html) {
  ++state.clearEditorToken;
  const wasRestoring = state.limitRestoring;
  state.limitRestoring = true;
  try {
    const editor = getTiptap();
    if (editor) {
      editor.commands.setContent(html || '');
      editor.commands.focus('end');
      muteEditorVideos();
      return;
    }
    const element = getEditorElement();
    if (!element) return;
    element.innerHTML = html || '<p></p>';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    muteEditorVideos();
    placeCaretAtEnd(element);
  } finally {
    state.limitRestoring = wasRestoring;
    syncEditorLimitState();
  }
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

const MENTION_CACHE = new Map();
const MENTION_TEXT_RE = /(^|[\s([{])@([\p{L}\p{N}_-]{1,64})/gu;
const DEFAULT_AVATAR_URL = 'https://lolz.team/styles/default/xenforo/avatars/avatar_s.png';

async function findForumUser(token) {
  const key = String(token || '').toLowerCase();
  if (!key) return null;
  if (MENTION_CACHE.has(key)) return MENTION_CACHE.get(key);
  const promise = (async () => {
    try {
      const csrf = getCsrfToken();
      if (!csrf) return null;
      const body = new URLSearchParams();
      body.append('q', token);
      body.append('_xfRequestUri', pagePath());
      body.append('_xfNoRedirect', '1');
      body.append('_xfToken', csrf);
      body.append('_xfResponseType', 'json');
      const origin = PAGE_WINDOW?.location?.origin || location.origin;
      const response = await pageFetch(new URL('/members/find', origin).href, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
        body,
      });
      if (!response.ok) return null;
      const json = await response.json();
      const entries = Object.values(json?.results || {}).filter(
        (entry) => entry && Number.isSafeInteger(Number(entry.user_id)),
      );
      const parse = (entry) => {
        const doc = new DOMParser().parseFromString(String(entry?.username || ''), 'text/html');
        const nick = doc.querySelector('.styleUserNickname');
        const icon = doc.querySelector('.uniqUsernameIcon--custom');
        const username = (nick?.textContent || '').trim();
        return {
          id: Number(entry.user_id),
          username,
          avatar: /^https:\/\//i.test(entry.avatar || '') ? entry.avatar : null,
          usernameHtml: sanitizeUsernameHtml(`${nick?.outerHTML || ''}${icon?.outerHTML || ''}`),
        };
      };
      const parsed = entries.map(parse).filter((entry) => entry.id && entry.username);
      return (
        parsed.find((entry) => entry.username === token) ||
        parsed.find((entry) => entry.username.toLowerCase() === key) ||
        null
      );
    } catch {
      return null;
    }
  })();
  MENTION_CACHE.set(key, promise);
  const value = await promise;
  MENTION_CACHE.set(key, value);
  if (!value) setTimeout(() => MENTION_CACHE.delete(key), 60_000).unref?.();
  return value;
}

function createMentionNode(user) {
  const anchor = document.createElement('a');
  anchor.className = `notranslate username mention${user.id === state.user?.id ? ' highlight' : ''}`;
  anchor.href = `/members/${user.id}/`;
  anchor.setAttribute('contenteditable', 'false');
  anchor.setAttribute('translate', 'no');
  anchor.style.whiteSpace = 'normal';
  anchor.dataset.user = `${user.id}, ${user.username}`;
  const avatar = document.createElement('img');
  avatar.className = 'avatar';
  avatar.alt = 'avatar';
  avatar.loading = 'lazy';
  avatar.src = user.avatar || DEFAULT_AVATAR_URL;
  avatar.addEventListener('error', () => {
    if (avatar.src !== DEFAULT_AVATAR_URL) avatar.src = DEFAULT_AVATAR_URL;
  });
  anchor.appendChild(avatar);
  const html = user.usernameHtml ||
    `<span class="styleUserNickname">${escapeHtml(user.username || 'unknown')}</span>`;
  anchor.insertAdjacentHTML('beforeend', html);
  return anchor;
}

async function hydrateMentionAnchor(anchor, { requireConnected = true } = {}) {
  if (!anchor || (requireConnected && !anchor.isConnected)) return false;
  if (anchor.dataset.nrHydrated === '1' || anchor.dataset.nrHydrated === 'pending') return false;
  const avatar = anchor.querySelector('img.avatar');
  if (avatar && avatar.src && avatar.src !== DEFAULT_AVATAR_URL) {
    anchor.dataset.nrHydrated = '1';
    return false;
  }
  const [rawId, ...nameParts] = String(anchor.dataset.user || '').split(',');
  const id = Number(rawId) || 0;
  const name = nameParts.join(',').trim();
  if (!id || !name) return false;
  anchor.dataset.nrHydrated = 'pending';
  const user = await findForumUser(name);
  if (!user || (requireConnected && !anchor.isConnected)) {
    anchor.dataset.nrHydrated = user ? '1' : 'failed';
    return false;
  }
  const replacement = createMentionNode({ ...user, id });
  replacement.dataset.nrHydrated = '1';
  anchor.replaceWith(replacement);
  return true;
}

async function hydrateMentionNodes(root, options = {}) {
  if (!root) return;
  const anchors = [...root.querySelectorAll('a.mention[data-user]')];
  if (!anchors.length) return;
  await Promise.all(anchors.map((anchor) => hydrateMentionAnchor(anchor, options)));
}

async function resolvePlainMentions(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  if (!template.innerHTML.includes('@') && !template.content.querySelector('a.mention')) {
    return template.innerHTML;
  }
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (
      node.parentElement?.closest(
        'a, code, pre, .mention, .unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .embed-link',
      )
    )
      continue;
    if (node.nodeValue?.includes('@')) nodes.push(node);
  }
  const mentionNodes = [...template.content.querySelectorAll('a.mention[data-user]')];
  if (!nodes.length && !mentionNodes.length) return template.innerHTML;

  const tokens = new Set();
  for (const node of nodes) {
    MENTION_TEXT_RE.lastIndex = 0;
    let match;
    while ((match = MENTION_TEXT_RE.exec(node.nodeValue || ''))) tokens.add(match[2]);
  }
  const resolved = new Map();
  await Promise.all(
    [...tokens].map(async (token) => {
      resolved.set(token, await findForumUser(token));
    }),
  );

  for (const node of nodes) {
    const text = node.nodeValue || '';
    MENTION_TEXT_RE.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = MENTION_TEXT_RE.exec(text))) {
      const before = text.slice(lastIndex, match.index);
      if (before) fragment.appendChild(document.createTextNode(before));
      const prefix = match[1] || '';
      if (prefix) fragment.appendChild(document.createTextNode(prefix));
      const user = resolved.get(match[2]);
      if (user) {
        fragment.appendChild(document.createTextNode(''));
        fragment.appendChild(createMentionNode(user));
      } else {
        fragment.appendChild(document.createTextNode(match[2] ? `@${match[2]}` : ''));
      }
      lastIndex = match.index + match[0].length;
    }
    if (!fragment.childNodes.length) continue;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  // [USER=id] already has a basic mention; fill in the real avatar/name style
  // from the forum when the nickname resolves. Failures keep the basic block.
  await Promise.all(mentionNodes.map((anchor) => hydrateMentionAnchor(anchor, { requireConnected: false })));
  return template.innerHTML;
}


const AUTO_URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
const AUTO_UNFURL_SKIP =
  'a, code, pre, .mention, .unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .unfurl-renderer, .embed-link, .Tooltip, .LbTrigger';
const UNFURL_LABELS = {
  youtube: 'Видео на Youtube',
  soundcloud: 'Трек на Soundcloud',
  tiktok: 'Видео на TikTok',
  spotify: 'Трек на Spotify',
  twitch: 'Трансляция на Twitch',
  vimeo: 'Видео на Vimeo',
  coub: 'Видео на Coub',
};
let forumApiToken = '';
let forumApiTokenExpiresAt = 0;
let forumApiTokenPromise = null;

function pageOrigin() {
  return PAGE_WINDOW?.location?.origin || location.origin;
}

function pagePath() {
  const pageLocation = PAGE_WINDOW?.location || location;
  return `${pageLocation.pathname || ''}${pageLocation.search || ''}`;
}

function createPageWebSocket(url) {
  const PageWebSocket = PAGE_WINDOW?.WebSocket;
  if (typeof PageWebSocket === 'function' && PageWebSocket !== WebSocket) {
    try {
      return new PageWebSocket(url);
    } catch {
      // fall through to the sandbox WebSocket
    }
  }
  return new WebSocket(url);
}

function pageFetch(input, init) {
  const fn = PAGE_WINDOW?.fetch;
  if (typeof fn === 'function' && fn !== fetch) {
    try {
      return fn.call(PAGE_WINDOW, input, init);
    } catch {
      // fall through to the sandbox fetch
    }
  }
  return fetch(input, init);
}

async function getForumApiToken() {
  if (forumApiToken && Date.now() < forumApiTokenExpiresAt - 60_000) return forumApiToken;
  if (forumApiTokenPromise) return forumApiTokenPromise;
  forumApiTokenPromise = (async () => {
    const csrf = getCsrfToken();
    if (!csrf) return '';
    const body = new URLSearchParams();
    body.append('scope[]', 'basic');
    body.append('scope[]', 'post');
    body.append('_xfRequestUri', pagePath());
    body.append('_xfNoRedirect', '1');
    body.append('_xfToken', csrf);
    body.append('_xfResponseType', 'json');
    try {
      const response = await pageFetch(
        `${pageOrigin()}/login/generate-temporary-token`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
          body,
        },
      );
      if (!response.ok) return '';
      const json = await response.json();
      if (!json?.token) return '';
      forumApiToken = String(json.token);
      forumApiTokenExpiresAt = Number(json.expires || 0) * 1000 || Date.now() + 50 * 60_000;
      return forumApiToken;
    } catch {
      return '';
    }
  })().finally(() => {
    forumApiTokenPromise = null;
  });
  return forumApiTokenPromise;
}

function unfurlIconHtml(extra) {
  const raw = String(extra?.active_icon_content || extra?.icon_content || extra?.icon || '&#xE000;');
  const template = document.createElement('template');
  template.innerHTML = raw;
  const allowed = new Set([
    'i',
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
  ]);
  for (const element of [...template.content.querySelectorAll('*')]) {
    const tag = element.tagName.toLowerCase();
    if (!allowed.has(tag)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        name === 'id' ||
        name === 'href' ||
        name === 'xlink:href' ||
        name === 'src' ||
        name === 'data-tippy-content'
      ) {
        element.removeAttribute(attribute.name);
      }
      if (
        (name === 'fill' || name === 'stroke') &&
        /url\s*\(|javascript:/i.test(attribute.value || '')
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return template.innerHTML.slice(0, 2_000) || '&#xE000;';
}


const MARKET_CATEGORY_LABELS = {
  steam: 'Steam',
  telegram: 'Telegram',
  discord: 'Discord',
  market: 'Market',
  vkontakte: 'ВКонтакте',
  vk: 'ВКонтакте',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter',
  github: 'GitHub',
  twitch: 'Twitch',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  apple: 'Apple',
  google: 'Google',
  minecraft: 'Minecraft',
  valorant: 'Valorant',
  fortnite: 'Fortnite',
  epicgames: 'Epic Games',
  riot: 'Riot Games',
};

function formatMarketPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  let formatted;
  try {
    formatted = new Intl.NumberFormat('ru-RU').format(number);
  } catch {
    formatted = String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  return `${formatted}\u00a0₽`;
}

function createMarketItemCard(url, data) {
  const extra = data?.extra && typeof data.extra === 'object' ? data.extra : {};
  const category = String(extra.category_name || '').trim().toLowerCase();
  const card = document.createElement('div');
  card.className = `unfurlContainer shorted marketItem${category ? ` category--${category}` : ''}`;
  const text = document.createElement('div');
  text.className = 'text';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'SvgIcon';
  const icon = document.createElement('span');
  icon.className = `categoryIcon ${category || 'market'} Tooltip`;
  icon.setAttribute('data-cachedtitle', MARKET_CATEGORY_LABELS[category] || category || 'Market');
  iconWrap.appendChild(icon);
  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = String(data?.title || 'Аккаунт');
  const priceValue = formatMarketPrice(extra.price);
  text.append(iconWrap, title);
  if (priceValue) {
    const price = document.createElement('div');
    price.className = 'price';
    const value = document.createElement('span');
    value.className = 'Value';
    value.setAttribute('data-value', String(extra.price));
    value.textContent = priceValue;
    price.appendChild(value);
    text.appendChild(price);
  }
  const link = document.createElement('a');
  link.className = 'LinkClicker';
  link.href = url;
  card.append(text, link);
  return card;
}

function updateMarketItemCard(card, data) {
  if (!card || !data) return;
  const extra = data.extra && typeof data.extra === 'object' ? data.extra : {};
  const category = String(extra.category_name || '').trim().toLowerCase();
  if (category) {
    card.classList.add(`category--${category}`);
    const icon = card.querySelector('.categoryIcon');
    if (icon) {
      icon.className = `categoryIcon ${category} Tooltip`;
      icon.setAttribute('data-cachedtitle', MARKET_CATEGORY_LABELS[category] || category);
    }
  }
  const title = card.querySelector('.title');
  if (title && data.title) title.textContent = String(data.title);
  let price = card.querySelector('.price');
  if (!price) {
    price = document.createElement('div');
    price.className = 'price';
    card.querySelector('.text')?.appendChild(price);
  }
  price.replaceChildren();
  const priceValue = formatMarketPrice(extra.price);
  if (priceValue) {
    const value = document.createElement('span');
    value.className = 'Value';
    value.setAttribute('data-value', String(extra.price));
    value.textContent = priceValue;
    price.appendChild(value);
  }
  delete card.dataset.nrMarketUrl;
}

function createMediaCard(url, data) {
  const site = String(data?.media?.siteId || data?.extra?.siteId || '').toLowerCase();
  if (!site) return null;
  const card = document.createElement('span');
  card.className = 'embed-link';
  card.dataset.url = url;
  card.dataset.mediaId = String(data?.media?.mediaId || data?.extra?.mediaId || url);
  card.dataset.siteId = site;
  const wrapper = document.createElement('span');
  wrapper.className = 'embed-link-wrapper';
  const icon = document.createElement('span');
  icon.className = `mini_unfurl_icon ${site} embed-icon`;
  const link = document.createElement('a');
  link.className = 'internal-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer nofollow';
  link.setAttribute('ignore-opener', 'true');
  link.setAttribute('data-ignore-popover', 'true');
  link.textContent = UNFURL_LABELS[site] || site;
  const visit = document.createElement('span');
  visit.className = 'visit-icon';
  wrapper.append(icon, link, visit);
  card.appendChild(wrapper);
  return card;
}

function createForumCardFromUnfurl(url, data) {
  if (data?.type === 'node') {
    const card = document.createElement('span');
    card.className = 'unfurl-renderer';
    card.dataset.title = String(data.title || '');
    card.dataset.type = 'node';
    card.dataset.extra = JSON.stringify(data.extra || {});
    const link = document.createElement('a');
    link.className = 'forum-wrapper';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    const icon = document.createElement('span');
    icon.className = 'forum-icon';
    icon.innerHTML = unfurlIconHtml(data.extra);
    const title = document.createElement('span');
    title.className = 'forum-title';
    title.textContent = String(data.title || '');
    link.append(icon, title);
    card.appendChild(link);
    return card;
  }
  if (data?.type === 'media') return createMediaCard(url, data);
  if (['market_item', 'market_feedback', 'market_search'].includes(String(data?.type))) {
    return createMarketItemCard(url, data);
  }
  if (data?.title && ['thread', 'post', 'post_comment'].includes(String(data.type))) {
    const card = document.createElement('span');
    card.className = 'unfurl-renderer';
    card.dataset.title = String(data.title);
    card.dataset.type = String(data.type);
    card.dataset.extra = JSON.stringify(data.extra || {});
    const link = document.createElement('a');
    link.className = 'unfurl-wrapper';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    const content = document.createElement('span');
    content.className = 'unfurl-content';
    const title = document.createElement('span');
    title.className = 'unfurlMarketTitle';
    title.textContent = String(data.title);
    content.appendChild(title);
    link.appendChild(content);
    card.appendChild(link);
    return card;
  }
  return null;
}

async function fetchForumUnfurl(url, token) {
  const csrf = getCsrfToken();
  if (!csrf || !token) return null;
  const body = new URLSearchParams();
  body.append('url', url);
  body.append('_xfRequestUri', pagePath());
  body.append('_xfNoRedirect', '1');
  body.append('_xfToken', csrf);
  body.append('_xfResponseType', 'json');
  try {
    const response = await pageFetch('https://api.lolz.team/editor/unfurl', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal:
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(6_000)
          : undefined,
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

function trimUrlPunctuation(raw) {
  const match = raw.match(/[.,;:!?)\]]+$/);
  if (!match) return { url: raw, trailing: '' };
  return { url: raw.slice(0, -match[0].length), trailing: match[0] };
}


const BBCODE_TAG_RE = /^\[(\/?)([a-z]+)(?:=("([^"]*)"|'([^']*)'|([^\]]*)))?\]/i;

function bbcodeAttr(match) {
  return match?.[4] ?? match?.[5] ?? match?.[6] ?? '';
}

function bbcodeCloseIndex(text, tag, from) {
  // Match the correct closing tag for nested equal tags instead of taking the
  // first one: [B]a[B]b[/B]c[/B] must keep the outer tag open.
  const token = new RegExp(`\\[\\/?${tag}(?:=[^\\]]*)?\\]`, 'gi');
  let depth = 1;
  let match;
  token.lastIndex = from;
  while ((match = token.exec(text))) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

function bbcodeImageSize(value) {
  const raw = String(value || '').trim();
  if (!raw) return {};
  const result = {};
  const set = (key, number) => {
    const parsed = Number(number);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    result[key] = clamp(parsed, 1, 5000);
  };
  for (const part of raw.split(';')) {
    const match = /^\s*(width|height)\s*=\s*(\d{1,6})\s*$/i.exec(part);
    if (match) set(match[1].toLowerCase(), match[2]);
  }
  // XenForo accepts [IMG=80x40] too, although its editor currently drops the
  // dimensions from that shorthand. Keep it useful for copied messages.
  const legacy = /^\s*(\d{1,6})\s*[x,]\s*(\d{1,6})\s*$/i.exec(raw);
  if (legacy && !result.width && !result.height) {
    set('width', legacy[1]);
    set('height', legacy[2]);
  }
  return result;
}

function bbcodeImageElement(url, sizeValue = '') {
  const src = String(url || '').trim();
  if (!/^https?:\/\//i.test(src)) return null;
  const link = document.createElement('a');
  link.className = 'LbTrigger';
  link.href = src;
  link.setAttribute('data-href', 'https://lolz.team/misc/lightbox');
  link.setAttribute('data-fancybox', 'gallery');
  const image = document.createElement('img');
  image.className = 'bbCodeImage LbImage';
  image.src = src;
  image.alt = '[IMG]';
  image.title = '[IMG]';
  image.loading = 'lazy';
  image.dataset.url = src;
  const size = bbcodeImageSize(sizeValue);
  if (size.width) image.setAttribute('width', String(size.width));
  if (size.height) image.setAttribute('height', String(size.height));
  link.appendChild(image);
  return link;
}

function bbcodeUserElement(inner, id) {
  const name = String(inner || '').replace(/^@/, '').trim() || 'unknown';
  const userId = Number(id) || 0;
  return createMentionNode({
    id: userId,
    username: name,
    usernameHtml: `<span class="styleUserNickname">${escapeHtml(name)}</span>`,
    avatar: null,
  });
}

function bbcodeColorValue(value) {
  const color = String(value || '').trim();
  if (!/^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i.test(color)) {
    return '';
  }
  return color;
}

function bbcodeSizeValue(value) {
  const raw = String(value || '').trim();
  const relative = raw.match(/^([+-])(\d+)$/);
  const level = relative
    ? Math.max(1, Math.min(7, 4 + (relative[1] === '+' ? 1 : -1) * Number(relative[2])))
    : Number(raw);
  const sizes = [9, 10, 12, 15, 18, 22, 26];
  return Number.isInteger(level) && level >= 1 && level <= 7 ? `${sizes[level - 1]}px` : '';
}

function bbcodeQuoteElement(inner, author) {
  const wrapper = document.createElement('div');
  wrapper.className = 'bbCodeBlock bbCodeQuote';
  const name = String(author || '').trim();
  if (name) wrapper.dataset.author = name;
  const aside = document.createElement('aside');
  const blockquote = document.createElement('blockquote');
  blockquote.className = 'quoteContainer';
  const quote = document.createElement('div');
  quote.className = 'quote';
  if (name) {
    const quoteAuthor = document.createElement('span');
    quoteAuthor.className = 'quoteAuthor';
    const username = document.createElement('span');
    username.className = 'username';
    const nickname = document.createElement('span');
    nickname.className = 'styleUserNickname';
    nickname.textContent = name;
    username.appendChild(nickname);
    quoteAuthor.appendChild(username);
    quote.appendChild(quoteAuthor);
  }
  quote.appendChild(parseBbcodeFragment(inner));
  const expand = document.createElement('div');
  expand.className = 'quoteExpand';
  expand.textContent = 'Нажмите, чтобы раскрыть...';
  blockquote.append(quote, expand);
  aside.appendChild(blockquote);
  wrapper.appendChild(aside);
  return wrapper;
}

function bbcodeSpoilerElement(inner, title) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ToggleTriggerAnchor bbCodeSpoilerContainer';
  wrapper.style.textAlign = 'left';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button bbCodeSpoilerButton ToggleTrigger Tooltip JsOnly';
  button.title = 'Раскрыть или скрыть спойлер';
  button.dataset.target = '> .SpoilerTarget';
  const label = document.createElement('span');
  const heading = String(title || '').trim();
  if (heading) {
    const titleNode = document.createElement('span');
    titleNode.className = 'SpoilerTitle';
    titleNode.textContent = heading;
    label.appendChild(titleNode);
  } else {
    label.appendChild(document.createTextNode('Спойлер'));
  }
  const arrow = document.createElement('span');
  arrow.className = 'arrowWidget';
  label.appendChild(arrow);
  button.appendChild(label);
  const target = document.createElement('div');
  target.className = 'SpoilerTarget bbCodeSpoilerText nr-spoiler-hidden';
  target.appendChild(parseBbcodeFragment(inner));
  wrapper.append(button, target);
  return wrapper;
}

function bbcodeAlignElement(inner, align) {
  const wrapper = document.createElement('div');
  wrapper.className = `content--align--${align}`;
  wrapper.style.textAlign = align;
  wrapper.appendChild(parseBbcodeFragment(inner));
  return wrapper;
}

function bbcodeListElement(inner, ordered) {
  const list = document.createElement(ordered ? 'ol' : 'ul');
  const parts = String(inner || '').split(/\[\*\]/i);
  const items = parts.length > 1 ? parts.slice(1) : [String(inner || '')];
  for (const part of items) {
    const content = part.replace(/\n$/,'');
    if (!content.trim() && items.length > 1) continue;
    const item = document.createElement('li');
    item.appendChild(parseBbcodeFragment(content));
    list.appendChild(item);
  }
  return list;
}

function bbcodeMediaUrl(value, inner) {
  const site = String(value || '').trim().toLowerCase();
  const raw = String(inner || value || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!site || !raw) return '';
  if (site === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(raw)}`;
  if (site === 'soundcloud') return `https://soundcloud.com/${raw.replace(/^\/+/, '')}`;
  return '';
}

const BBCODE_RENDER_TAGS = new Set(['img', 'media', 'unfurl', 'url', 'user', 'video']);

function bbcodeElement(tag, value, inner) {
  const name = String(tag || '').toLowerCase();
  // Everything outside this allowlist stays exactly as typed, brackets and
  // all. Only real message primitives are converted to DOM.
  if (!BBCODE_RENDER_TAGS.has(name)) return null;
  switch (name) {
    case 'b':
    case 'strong': {
      const el = document.createElement('strong');
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'i':
    case 'em': {
      const el = document.createElement('em');
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'u': {
      const el = document.createElement('u');
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 's':
    case 'del': {
      const el = document.createElement('s');
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'code':
    case 'pre':
    case 'php':
    case 'html':
    case 'src': {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (tag !== 'code' && tag !== 'pre') code.dataset.lang = tag.toUpperCase();
      code.textContent = String(inner || '').replace(/<br\s*\/?>/gi, '\n');
      pre.appendChild(code);
      return pre;
    }
    case 'quote':
    case 'blockquote': {
      return bbcodeQuoteElement(inner, value);
    }
    case 'spoiler': {
      return bbcodeSpoilerElement(inner, value);
    }
    case 'list': {
      return bbcodeListElement(inner, Boolean(String(value || '').trim()));
    }
    case 'center':
    case 'left':
    case 'right': {
      return bbcodeAlignElement(inner, tag);
    }
    case 'color': {
      const color = bbcodeColorValue(value);
      if (!color) return null;
      const el = document.createElement('span');
      el.style.color = color;
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'size': {
      const size = bbcodeSizeValue(value);
      if (!size) return null;
      const el = document.createElement('span');
      el.style.fontSize = size;
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'plain': {
      const el = document.createElement('span');
      el.className = 'bbCodePlain';
      el.textContent = inner;
      return el;
    }
    case 'price': {
      const amount = String(inner || '').trim().replace(',', '.');
      if (!/^\d+(?:\.\d+)?$/.test(amount)) return null;
      const currency = String(value || 'RUB').trim().toUpperCase().slice(0, 3);
      const el = document.createElement('span');
      el.className = 'bbCodePrice';
      el.dataset.priceCurrency = currency;
      el.dataset.priceAmount = amount;
      el.textContent = `${amount} ${currency === 'RUB' ? '₽' : currency}`;
      return el;
    }
    case 'censor': {
      const el = document.createElement('div');
      el.className = 'CensorSpoiler';
      el.appendChild(parseBbcodeFragment(inner));
      return el;
    }
    case 'hr': {
      return document.createElement('hr');
    }
    case 'img': {
      return bbcodeImageElement(inner || value, value);
    }
    case 'video': {
      const src = String(inner || value || '').trim();
      if (!/^https?:\/\//i.test(src)) return null;
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.setAttribute('controls', '');
      video.setAttribute('playsinline', '');
      video.preload = 'metadata';
      return video;
    }
    case 'media': {
      const mediaUrl = bbcodeMediaUrl(value, inner);
      if (!mediaUrl) return null;
      const site = String(value || mediaServiceForUrl(mediaUrl) || 'media').toLowerCase();
      return createMediaCard(mediaUrl, { media: { siteId: site, mediaId: mediaUrl } });
    }
    case 'unfurl': {
      const url = String(value || inner || '').trim();
      if (!/^https?:\/\//i.test(url)) return null;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = url;
      anchor.dataset.nrUnfurl = '1';
      return anchor;
    }
    case 'url': {
      const url = String(value || inner || '').trim();
      if (!/^https?:\/\//i.test(url)) return null;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = inner && !/^https?:\/\//i.test(inner) ? inner : url;
      return anchor;
    }
    case 'email': {
      const email = String(value || inner || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      const anchor = document.createElement('a');
      anchor.href = `mailto:${email}`;
      anchor.textContent = inner && inner !== email ? inner : email;
      return anchor;
    }
    case 'button': {
      const href = String(value || '').trim();
      if (!/^https?:\/\//i.test(href)) return null;
      const anchor = document.createElement('a');
      anchor.className = 'button primary';
      anchor.href = href;
      anchor.target = '_blank';
      anchor.rel = 'nofollow noopener';
      anchor.textContent = inner || href;
      return anchor;
    }
    case 'user': {
      return bbcodeUserElement(inner, value);
    }
    default:
      return null;
  }
}

function parseBbcodeFragment(text) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('[', cursor);
    if (open < 0) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      break;
    }
    if (open > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, open)));
    const match = BBCODE_TAG_RE.exec(text.slice(open));
    if (!match) {
      fragment.appendChild(document.createTextNode('['));
      cursor = open + 1;
      continue;
    }
    const closing = Boolean(match[1]);
    const tag = String(match[2] || '').toLowerCase();
    const tokenEnd = open + match[0].length;
    if (closing) {
      fragment.appendChild(document.createTextNode(match[0]));
      cursor = tokenEnd;
      continue;
    }
    if (tag === 'hr') {
      fragment.appendChild(bbcodeElement(tag, bbcodeAttr(match), ''));
      cursor = tokenEnd;
      continue;
    }
    const closeIndex = bbcodeCloseIndex(text, tag, tokenEnd);
    if (closeIndex < 0) {
      fragment.appendChild(document.createTextNode(match[0]));
      cursor = tokenEnd;
      continue;
    }
    const inner = text.slice(tokenEnd, closeIndex);
    const after = closeIndex + `[/${tag}]`.length;
    const element = bbcodeElement(tag, bbcodeAttr(match), inner);
    if (element) fragment.appendChild(element);
    else fragment.appendChild(document.createTextNode(text.slice(open, after)));
    cursor = after;
  }
  return fragment;
}

const BBCODE_BLOCK_TAG_RE = /\[(?:LIST|QUOTE|SPOILER|CODE|PHP|HTML|SRC|CENTER|LEFT|RIGHT|TABLE)(?:=[^\]]*)?\]/i;

function canFlattenBbcode(content) {
  for (const element of content.querySelectorAll('*')) {
    const tag = element.tagName;
    if (tag === 'BR' || tag === 'P' || tag === 'DIV') continue;
    if (tag === 'SPAN' && !element.className) continue;
    return false;
  }
  return true;
}

function bbcodePlainText(content) {
  const holder = document.createElement('div');
  holder.appendChild(content.cloneNode(true));
  for (const br of [...holder.querySelectorAll('br')]) br.replaceWith('\n');
  for (const block of [...holder.querySelectorAll('p, div, li')]) block.append('\n');
  return String(holder.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function resolveBbcode(html) {
  const source = String(html || '');
  if (!/\[[a-z]+(?:=[^\]]*)?\]/i.test(source)) return source;
  const template = document.createElement('template');
  template.innerHTML = source;

  // A plain-text message can be split by Tiptap into several <p>/<br> nodes.
  // For block BBCode it must be parsed as one string; otherwise [QUOTE] and
  // [LIST] would see only one line at a time.
  if (BBCODE_BLOCK_TAG_RE.test(source) && canFlattenBbcode(template.content)) {
    const parsed = parseBbcodeFragment(bbcodePlainText(template.content));
    template.content.replaceChildren(parsed);
    return normalizeClientHtml(template.innerHTML);
  }

  // Tiptap turns newlines into <br>; parse plain text blocks as one string so
  // [LIST], [QUOTE] and [SPOILER] can span several visual lines.
  for (const block of [...template.content.querySelectorAll('p, div, li')]) {
    if (block.closest('code, pre, textarea')) continue;
    if (block.querySelector('*:not(br)')) continue;
    const clone = block.cloneNode(true);
    for (const br of [...clone.querySelectorAll('br')]) br.replaceWith('\n');
    const text = clone.textContent || '';
    if (!/\[[a-z]+(?:=[^\]]*)?\]/i.test(text)) continue;
    const parsed = parseBbcodeFragment(text);
    const hasBlock = [...parsed.children].some((element) =>
      /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|HR|OL|P|PRE|SECTION|UL)$/.test(element.tagName),
    );
    if (hasBlock && block.tagName === 'P') block.replaceWith(parsed);
    else block.replaceChildren(parsed);
  }

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!/\[[a-z]+(?:=[^\]]*)?\]/i.test(node.nodeValue || '')) continue;
    if (node.parentElement?.closest('code, pre, textarea, .bbCodePlain')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    node.parentNode?.replaceChild(parseBbcodeFragment(node.nodeValue || ''), node);
  }
  return normalizeClientHtml(template.innerHTML);
}

async function resolvePlainUnfurls(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  if (!/https?:\/\//i.test(template.innerHTML)) return template.innerHTML;

  // Tiptap sometimes serializes an autolink mark as <a>text</a> without href.
  // Unwrap those so the normal URL pass can turn them into a native block.
  for (const anchor of [...template.content.querySelectorAll('a:not([href])')]) {
    if (anchor.closest('.mention, .unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .unfurl-renderer, .embed-link')) continue;
    const text = (anchor.textContent || '').trim();
    if (/^https?:\/\//i.test(text)) anchor.replaceWith(document.createTextNode(text));
  }

  const candidates = new Map();
  const anchorEntries = [];
  for (const anchor of [...template.content.querySelectorAll('a[href]')]) {
    if (anchor.closest('.mention, .unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .unfurl-renderer, .embed-link, .LbTrigger')) continue;
    const href = anchor.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) continue;
    const label = (anchor.textContent || '').trim();
    if (label && label !== href && !anchor.hasAttribute('data-href')) continue;
    candidates.set(href, href);
    anchorEntries.push({ anchor, href });
  }
  const textEntries = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest(AUTO_UNFURL_SKIP)) continue;
    const text = node.nodeValue || '';
    AUTO_URL_RE.lastIndex = 0;
    let match;
    const found = [];
    while ((match = AUTO_URL_RE.exec(text))) {
      const { url, trailing } = trimUrlPunctuation(match[0]);
      if (!/^https?:\/\//i.test(url)) continue;
      found.push({ raw: match[0], url, trailing, index: match.index });
      candidates.set(url, url);
    }
    if (found.length) textEntries.push({ node, found });
  }
  if (!candidates.size) return template.innerHTML;

  const token = await getForumApiToken();
  if (!token) return template.innerHTML;
  const urls = [...candidates.keys()].slice(0, 5);
  const resolved = new Map();
  await Promise.all(
    urls.map(async (url) => {
      const data = await fetchForumUnfurl(url, token);
      const card = data ? createForumCardFromUnfurl(url, data) : null;
      if (card) resolved.set(url, card);
    }),
  );
  if (!resolved.size) return template.innerHTML;

  for (const { anchor, href } of anchorEntries) {
    const card = resolved.get(href);
    if (!card) continue;
    const parent = anchor.parentElement;
    const clone = card.cloneNode(true);
    if (
      clone.tagName === 'DIV' &&
      parent?.tagName === 'P' &&
      parent.children.length === 1 &&
      parent.textContent.trim() === href
    ) {
      parent.replaceWith(clone);
    } else {
      anchor.replaceWith(clone);
    }
  }
  for (const { node, found } of textEntries) {
    const text = node.nodeValue || '';
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const parent = node.parentElement;
    if (
      found.length === 1 &&
      parent?.tagName === 'P' &&
      !parent.children.length &&
      !found[0].trailing &&
      parent.textContent.trim() === found[0].url &&
      resolved.get(found[0].url)?.tagName === 'DIV'
    ) {
      parent.replaceWith(resolved.get(found[0].url).cloneNode(true));
      continue;
    }
    for (const item of found) {
      if (item.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, item.index)));
      const card = resolved.get(item.url);
      if (card) {
        fragment.appendChild(card.cloneNode(true));
        if (item.trailing) fragment.appendChild(document.createTextNode(item.trailing));
      } else {
        fragment.appendChild(document.createTextNode(item.raw));
      }
      lastIndex = item.index + item.raw.length;
    }
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode?.replaceChild(fragment, node);
  }
  return template.innerHTML;
}

function getScrollElement() {
  const own = document.getElementById('no-rules-messages');
  if (own && getComputedStyle(own).overflowY === 'auto') return own;
  const candidates = [];
  const add = (element) => {
    if (element && !candidates.includes(element)) candidates.push(element);
  };
  const nativeMessages = getChatMessages() || els.nativeMessagesEl;
  add(nativeMessages?.parentElement?.classList.contains('scrollable-content')
    ? nativeMessages.parentElement
    : null);
  const ownHost = document.getElementById('no-rules-messages')?.closest('.scrollable-content');
  add(ownHost);
  for (const element of getChatRoot()?.querySelectorAll('.scrollable-content') || []) {
    add(element);
  }
  const visible = candidates.filter(
    (element) => element.isConnected && element.clientHeight > 100 && element.getClientRects().length,
  );
  if (ownHost && visible.includes(ownHost)) return ownHost;
  if (visible.length) {
    return visible.sort((a, b) => b.clientHeight - a.clientHeight)[0];
  }
  return candidates[0] || null;
}

function isNearBottom(threshold = 140) {
  const scroll = getScrollElement();
  if (!scroll) return true;
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < threshold;
}

function scrollToBottom(behavior = 'auto') {
  const scroll = getScrollElement();
  if (!scroll) return;
  state.bottomFollow = true;
  scroll.scrollTo({ top: scroll.scrollHeight, behavior });
}

function scheduleBottomFollow() {
  if (state.bottomFollowRaf) return;
  state.bottomFollowRaf = requestAnimationFrame(() => {
    state.bottomFollowRaf = null;
    if (!state.active || !state.bottomFollow) return;
    const scroll = getScrollElement();
    if (!scroll) return;
    const target = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    if (Math.abs(scroll.scrollTop - target) > 1) scroll.scrollTop = target;
  });
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
  let messages = sortedMessages().filter((message) => !message.deleted);
  if (state.viewingHistory && state.historyWindow) {
    messages = messages.filter(
      (message) =>
        Number(message.id) >= state.historyWindow.min &&
        Number(message.id) <= state.historyWindow.max,
    );
  }
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
    historyHasNewer: state.historyHasNewer,
    historyLoading: state.historyLoading,
    viewingHistory: state.viewingHistory,
    historyWindow: state.historyWindow,
    oldestId: state.oldestId,
    lastMessageId: state.lastMessageId,
    unread: state.unread,
    typing: state.typing.size,
    editing: state.editing?.id || null,
    replyTo: state.replyTo?.id || null,
    editorLength: editorMessageLength(),
    lastEditorLength: state.lastEditorLength,
    bottomFollow: state.bottomFollow,
    error: state.connectionError || '',
  };
}
