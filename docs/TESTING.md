# Тестирование

## 1. Статические проверки

```bash
cd /home/rsz/Desktop/lztext/no-rules
node --check extension/dist/no-rules.user.js
cd server
npm test
```

`npm test` запускает 22 unit-теста: auth, antibot, db, rate limit,
sanitize. Playwright-сценарии лежат вне репозитория из-за storageState.

## 2. Сборка

```bash
NR_VERSION=1.1.21 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
bun scripts/build-extension.mjs
sha256sum extension/dist/no-rules.user.js
```

Проверить, что в header есть `@updateURL`/`@downloadURL`, а версия совпадает
с `package.json` сервера.

## 3. Health и WebSocket

```bash
curl -fsS https://lztws.d9v.uk/health
curl -fsS https://lztws.d9v.uk/version
```

Простой клиент:

```js
const WebSocket = require('ws');
const ws = new WebSocket('wss://lztws.d9v.uk/ws', {
  headers: { Origin: 'https://lolz.team' },
});
ws.on('message', (raw) => {
  const frame = JSON.parse(String(raw));
  console.log(frame.type, frame.protocol || '');
  if (frame.type === 'hello') ws.close();
});
```

Ожидается `hello` с `protocol: 1`, `roomTitle: "No Rules"`.

## 4. Playwright: desktop Chromium

Проверяет:

1. инициализацию и появление ссылки `No Rules` в боковом меню;
2. переход в комнату, авторизацию, заголовок и socket-индикатор;
3. отправку сообщения, контекстное меню, reply, edit, delete;
4. переключение на нативную комнату: `state.active === false`, наш контейнер
   удалён из DOM, нативная комната работает;
5. возврат в `No Rules`: контейнер снова виден, нативные сообщения скрыты;
6. отсутствие `pageerror`.

Ключевые ожидания:

```js
state.active === true
state.wsAuthenticated === true
state.messages >= 1
document.querySelector('#no-rules-messages')
document.querySelector('.chat2-full-inner .chat2-messages:not(#no-rules-messages)').style.display === 'none'
```

После переключения на нативную комнату `#no-rules-messages` должен
отсутствовать (мы не держим его в DOM, пока комната неактивна). Не пытайтесь
делать `getComputedStyle(document.getElementById('no-rules-messages'))` в
этот момент — элемента нет by design.

## 5. Playwright: mobile

Viewport 390×844, `isMobile: true`, `hasTouch: true`, Android UA.

Проверить:

- нет горизонтального скролла:
  `document.documentElement.scrollWidth <= window.innerWidth`;
- composer и сообщения не вылезают за `clientWidth`;
- long-press/контекстное меню открывается и содержит «Выделить текст»;
- после переключения на нативную комнату `scrollWidth` не растёт.

## 6. Playwright: Firefox

Тот же сценарий, что desktop Chromium, но через
`firefox.launch({ executablePath: '.../firefox' })`. Userscript с `@grant none`
работает в page context; для Tampermonkey-сборки допустим `@unwrap` +
`unsafeWindow` fallback.

Ожидаемо: только нативный шум push-notification в console, ошибок
`pageerror` нет.

## 6.1. Плавающее окно (widget)

На любой странице форума нажать `.chat2-button` справа снизу. Скрипт должен
инициализироваться уже после открытия виджета (а не только на `/chatbox/`).
Проверить: `state.chatRoot === 'widget'`, ссылка No Rules в боковом меню,
отправка/меню/reply, закрытие и повторное открытие с восстановлением
активной комнаты, URL страницы не меняется.

## 6.2. Онлайн-модалка

Активировать No Rules, кликнуть «Онлайн: N». Ожидается XenForo-модалка
«Сейчас сидят в чате» с `top-user-item lztng-yzgsen`, аватарами 48×48 и
никами только участников No Rules. Проверить закрытие по X, backdrop и
Escape.

## 6.3. Typing

`window.__noRulesChat.simulateTyping('user')` — внизу `#no-rules-messages`
должен появиться `chat2-typingDetails` с тремя `lztui-spinner-bounce`
(6×6, `animation-name: sk-bouncedelay`) и текстом «user печатает».
Высота блока 23 px + `margin-top: 8px`; сообщения не должны прилипать к
полю ввода.

## 6.4. Embeds, links, copy и никаких тостов

- Вставить в нативный Tiptap ссылку и отправить:
  `https://lzt.market/telegram/`, `https://soundcloud.com/...`,
  `https://youtube.com/watch?v=...`, `https://lolz.team/forums/contests/`.
  Должны появиться нативные карточки (`unfurl-renderer`, `embed-link`,
  `forum-wrapper`) с иконкой/заголовком.
- ПКМ → «Скопировать текст»: в буфере `[unfurl="..."]`, `[MEDIA=soundcloud]`,
  `[MEDIA=youtube]`, `[MEDIA=tiktok]`, `[UNFURL="..."]` — как `messageRaw`.
- ПКМ по обычному тексту не должен показывать «Открыть медиа» /
  «Скопировать медиа»; они появляются только при клике по `img`/`video`.
- После copy/ошибок не должно появляться `.nr-toast`; только `console.debug`.

## 6.5. Mentions и reply

- В composer набрать `@жди`, закрыть popup (Escape), отправить. Должен
  появиться `a.mention` 24 px с аватаром 16×16, цветом `styleN` и SVG-значком;
  несуществующий `@zzz...` остаётся текстом.
- `@yolo` (свой id) — на блоке `highlight`, зелёный фон.
- Reply на сообщение с изображением/YouTube/SoundCloud/форумным блоком:
  reply-бар и зелёный reply-блок должны содержать полный HTML, а не
  `[изображение]`/plain text.
- Copy такого reply — `[USER=id]@ник[/USER]`, `[MEDIA=...]`, `[unfurl]`.

## 7. Lifecycle: hash, refresh, reconnect, offline

1. Открыть `https://lolz.team/chatbox/#no-rules` с чистым контекстом.
2. Дождаться `initialized`, `active`, `wsAuthenticated`, `historyLoading === false`.
3. Проверить `localStorage['lzt.no-rules.session.v1']`.
4. `page.reload()` — комната должна снова открыться, история загрузиться,
   сессия не потеряться.
5. `window.__noRulesChat.reconnect()` — принудительный reconnect с новым
   временным токеном; `wsAuthenticated` снова `true`.
6. `context.setOffline(true)` → дождаться `wsState !== 'connected'` →
   `window.__noRulesChat.send('offline ...')`.
   Ожидается `pending: 1`, `outbox: 1`, toast про очередь.
7. Проверить `localStorage['lzt.no-rules.outbox.v1']`; закрыть страницу и
   открыть её снова (или `page.reload()`): outbox должен восстановиться,
   после `auth.ok` — уйти в 0.
8. `context.setOffline(false)` → `reconnect()`.
   Ожидается `outbox: 0`, `pending: 0`, ровно одно сообщение с текстом
   (дедупликация по `clientId`).
9. Отправить 10 сообщений offline, затем online: первые 8 проходят сразу,
   остальные автоматически повторяются после `rate_limited`; итог —
   ровно 10 уникальных ID, `outbox: 0`.
10. Пустая комната: `lastMessageId === 0`, другое подключение отправляет
    сообщение, затем первый клиент reconnect → должен получить его через
    `history after=0`.

## 8. История > 60 сообщений

1. Посеять 130 сообщений в БД (только для теста) или отправить их через
   несколько аккаунтов.
2. Открыть комнату: `messages === 60`, `historyHasMore === true`,
   `oldestId` указывает на 60-е с конца.
3. `scroll.scrollTop = 0` + `scroll` event → `messages === 110`,
   `historyHasMore === true`, `scrollTop > 0`, `scrollHeight` вырос.
4. Ещё раз вверх → `messages === 143`, `historyHasMore === false`,
   `oldestId === 1`, первое сообщение присутствует, дублей id нет.

Скрипт для посева (не коммитить):

```sql
INSERT INTO messages
  (user_id, username, username_html, avatar_url, color, html, text, client_id, created_at)
VALUES
  (9252369, 'yolo', '<span class="styleUserNickname">yolo</span>',
   NULL, NULL, '<p>history seed 001</p>', 'history seed 001',
   'seed-history-001', 1792946000000);
```

После теста удалить:

```sql
DELETE FROM messages WHERE client_id LIKE 'seed-history-%';
```

## 9. Чек-лист перед релизом

- [ ] `npm test` — 22/22.
- [ ] `node --check extension/dist/no-rules.user.js`.
- [ ] Desktop Chromium: все пункты раздела 4.
- [ ] Mobile: нет горизонтального скролла, меню работает.
- [ ] Firefox: комната, отправка, нативное переключение.
- [ ] Прямой `#no-rules`, reload, reconnect, offline outbox.
- [ ] История > 60, позиция скролла, отсутствие дублей.
- [ ] `https://lztws.d9v.uk/health` и `/version`.
- [ ] Нет секретов в `git status`/`git diff`.
- [ ] Raw userscript на GitHub совпадает по SHA-256 с локальным.

## 12. Feature checklist (2026-10)

### Room / lifecycle

- [ ] Прямой `#no-rules`, F5, возврат в native room.
- [ ] Full chat и floating widget.
- [ ] History > page size, scroll position, unread/paused.
- [ ] Offline outbox и reconnect.

### Messages

- [ ] Send / edit / delete / reply.
- [ ] Два одинаковых сообщения подряд оба остаются.
- [ ] Plain `@nick` → native mention; unknown nick остаётся текстом.
- [ ] `ArrowUp` в пустом composer → edit последнего своего сообщения.
- [ ] Reply сохраняет HTML (image/video/embed/unfurl/mention) после F5.

### Native integrations

- [ ] Bare photo upload → `a.LbTrigger` → click opens native fancybox.
- [ ] `[IMG]...[/IMG]` → image + fancybox.
- [ ] Single `.mceSmilie` → `mceSmilieLarge` 96×96; two smilies remain small.
- [ ] Video upload → native player; play/pause/fullscreen; F5.
- [ ] Send text messages while video is playing: player node same,
      `currentTime` continues, no spinner, x/width stable.
- [ ] Reply to video: reply bar has `<video controls poster>`.
- [ ] Plain YouTube/SoundCloud link → `.embed-link`.
- [ ] Plain forum link → native unfurl.
- [ ] `https://lzt.market/266223421/` → account block with icon/title/price.
- [ ] `[UNFURL="..."]...[/UNFURL]` → same block.
- [ ] `[MEDIA=youtube]...[/MEDIA]` → correct embed (not malformed link).
- [ ] `[B]/[I]/[URL=...]` render and copy as BBCode.

### Safety / polish

- [ ] No `pageerror`.
- [ ] No horizontal scroll on mobile.
- [ ] No duplicate `#no-rules-messages`, no duplicate No Rules links/scripts.
- [ ] `#no-rules-messages` hidden/removed when native room active.
- [ ] `XenForo.activate` not called on already mounted video player.

### Cleanup after manual test

- [ ] Delete test messages in No Rules.
- [ ] Delete test messages in native English chat.
- [ ] Clear draft video/image in composer.
- [ ] Verify production DB has no active test markers.
