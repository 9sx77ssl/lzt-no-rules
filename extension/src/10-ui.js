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
