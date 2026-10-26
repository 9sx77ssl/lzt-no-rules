# Extension / userscript

Расширение — один userscript, собираемый из нескольких исходников. Оно
работает в page-context, не требует сборщика в браузере и не использует
внешние библиотеки.

## 1. Сборка

```bash
cd server
bun install
cd ..

NR_VERSION=1.2.4 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
bun scripts/build-extension.mjs
```

`scripts/build-extension.mjs`:

1. Читает `extension/src/header.txt`.
2. Заменяет `__VERSION__`, `__WS_URL__`, `__ACCESS_KEY__`.
3. Склеивает `00-core.js`, `10-ui.js`, `20-messages.js`, `30-ws.js`,
   `40-main.js` в один IIFE.
4. Пишет `extension/dist/no-rules.user.js`.

Порядок файлов важен: все функции находятся в одном scope, но константы
(`NR_CSS`, `CLIENT_ALLOWED_*`, `state`) инициализируются сверху вниз.

## 2. Метаданные userscript

```text
@name         Lolzteam Chatbox — No Rules
@namespace    https://lolz.team/no-rules
@match        https://lolz.team/*
@match        https://lolz.live/*
@match        https://lolz.guru/*
@match        https://zelenka.guru/*
@run-at       document-start
@grant        none
@noframes
@updateURL    .../extension/dist/no-rules.user.js
@downloadURL  .../extension/dist/no-rules.user.js
```

`@namespace` должен оставаться стабильным: Tampermonkey определяет
обновление скрипта по name+namespace. Если его поменять, старая копия
останется и будет конфликтовать.

## 3. Модули

### `00-core.js`

- `state` и `BUILD`;
- `localStorage` (`lzt.no-rules.*`);
- `getChatRoot`, `getChatMessages`, `getScrollElement`;
- клиентский санитайзер `sanitizeClientHtml`:
  - теги, классы, атрибуты, стили;
  - username SVG;
- `linkifyHtml`, `extractTextFromHtml`;
- Tiptap helpers: `getEditorHtml`, `setEditorHtml`, `clearEditor`;
- `findForumUser` (`POST /members/find`);
- `resolvePlainMentions`;
- `resolveBbcode`, `parseBbcodeFragment`, `bbcodeElement`;
- `resolvePlainUnfurls`, `fetchForumUnfurl`, `getForumApiToken`;
- `createMediaCard`, `createMarketItemCard`, `updateMarketItemCard`,
  `createForumCardFromUnfurl`;
- `allVisibleMessages`, `sortedMessages`, `messageMentionsMe`.

### `10-ui.js`

- `NR_CSS` — недостающие CSS-правила нативных ленивых чанков;
- `captureTemplates` — копирование классов живого DOM;
- `ensureMessagesContainer`, `ensureRoomLink`, `hideNativeForRoom`;
- socket indicator, header, online modal;
- контекстное меню (нативные `message-actions/menu/action`);
- `createMessageElement`, `createGroup`;
- reply/edit bars;
- `htmlToBbcode`, `copyText`;
- video:
  - `prepareMessageVideos`, `activateNativeContent`;
  - `prepareReplyVideos`, `muteEditorVideos`;
- images/smilies:
  - `prepareLightboxImages`, `applySingleSmilie`;
- market:
  - `marketCardFor`, `hydrateForumTitles`, `hydrateMarketCards`;
- native video player activation via `XenForo.activate`.

### `20-messages.js`

- history и grouping;
- optimistic send, outbox, retry, pending;
- reply/edit/delete;
- ArrowUp → `editLastOwnMessage`;
- `renderMessages`:
  - incremental reuse by `data-message-id` + `messageRenderKey`;
  - no full `replaceChildren` of unchanged messages;
- typing;
- scroll preserving;
- notifications;
- `resolvePlainUnfurls`/`resolvePlanMentions` перед отправкой.

### `30-ws.js`

- `fetchTemporaryToken` (`POST /login/generate-temporary-token`);
- auth/resume;
- WebSocket lifecycle, heartbeat;
- history/sync;
- presence/typing;
- outbox flush;
- CSRF helper.

### `40-main.js`

- boot after DOM Chatbox appears;
- activation/deactivation;
- URL/hash and `localStorage` preference;
- global click/keydown/input listeners;
- `ArrowUp` editing;
- debug API on `PAGE_WINDOW.__noRulesChat`.

## 4. State

Основные поля:

```js
state = {
  active, initialized, chatRoot,
  user, session, sessionExpiresAt,
  ws, wsAuthenticated, wsState,
  messages: Map<id, message>,
  pending: Map<clientId, pending>,
  outbox: [], outboxTimer,
  typing: Map<userId, entry>,
  replyTo, editing,
  historyLoading, historyHasMore, historyRetryTimer,
  online, onlineUsers,
  templates, hiddenNative,
  replyTo, editing,
}
```

`state.messages` — серверные сообщения; `state.pending` — оптимистичные.
`allVisibleMessages()` склеивает их по времени/ID.

`state.outbox` — это unacknowledged `message.send`, а не просто очередь
«пока нет сокета». Запись хранится в
`localStorage['lzt.no-rules.outbox.v1']` (до 100 сообщений, с `ownerId`),
удаляется только после `message.new`/`history` с тем же `clientId`.
Поэтому F5, обрыв и повторный `flushOutbox()` не теряют сообщение; сервер
идемпотентно возвращает уже созданную строку. При `rate_limited` клиент
оставляет запись в outbox и повторяет её после `retryAfterMs`.

## 5. Жизненный цикл

```text
document-start
  → init() ждёт .chat2 ... .tiptap
  → injectStyles()
  → captureTemplates()
  → ensureRoomLink()
  → observeDom()
  → activateRoom() по hash/флагу
      → ensureMessagesContainer()
      → hideNativeForRoom()
      → connectNoRules()
      → history/auth
      → renderMessages()
```

`MutationObserver` на `document.body` перезапускает
`ensureMessagesContainer`/`enforceActiveUI` после Svelte-перерисовок.
`hashchange`/`popstate` синхронизируют комнату.

## 6. Рендер сообщений

`renderMessages` не создаёт всё заново:

1. Собирает существующие `[data-nr-message]` по `data-message-id`.
2. Для каждого сообщения считает `messageRenderKey`:
   `id/html/text/createdAt/editedAt/deleted/pending/failed/queued/
   showHeader/user/reply/mentions`.
3. Если ключ совпадает — **переиспользует старый DOM-узел**.
4. Перестраивает только группы/разделители, вставляет узлы обратно.
5. Вызывает `prepareMessageVideos`, `activateNativeContent`,
   `renderTypingInto`.

Это критично для видео: Svelte-плеер остаётся смонтированным, `currentTime`
не сбрасывается, спиннер не появляется.

## 7. Санитайзер клиента

`CLIENT_ALLOWED_TAGS`, `CLIENT_ALLOWED_CLASSES`,
`CLIENT_ALLOWED_STYLE_PROPS` в `00-core.js`. Серверный allowlist должен
содержать те же классы, иначе блок потеряет оформление после перезагрузки.

Особые случаи:

- `price` / `Value` — legacy market-карточки;
- `LbTrigger`, `LbImage`, `bbCodeImage` — фото;
- `mceSmilie`, `mceSmilieLarge` — смайлы;
- `unfurlContainer`, `unfurl-renderer`, `embed-link`, `forum-wrapper`,
  `categoryIcon`, `marketItem`;
- `data-*` для media/unfurl;
- SVG только внутри username icon.

## 8. Native video

`prepareMessageVideos`:

- ставит `playsinline`;
- `preload=metadata`;
- генерирует poster `.webp` для `nztcdn.com/files/*.mp4`.

`activateNativeContent`:

- ищет `<video>` без `[data-lzt-video-player]`;
- вызывает `XenForo.activate(container)`;
- после монтирования повторно не вызывает — иначе плеер перезагружается.

`muteEditorVideos`:

- `muted`, `defaultMuted`, `muted` attr;
- вызывается после `setEditorHtml` и в `enforceActiveUI`.

`prepareReplyVideos`:

- `controls`, `playsinline`, `preload=metadata`, poster;
- reply bar/зелёный reply-блок не используют тяжёлый плеер.

## 9. Lightbox

`prepareLightboxImages` оборачивает «голый» `img` в:

```html
<a class="LbTrigger" href="..." data-href="https://lolz.team/misc/lightbox"
   data-fancybox="gallery"><img ...></a>
```

Не трогает `a`, `.mention`, `.avatar`, `.mceSmilie`, `.unfurlContainer`,
`.embed-link`, `[data-lzt-video-player]`.

## 10. Smileys

`applySingleSmilie` — прямой порт нативной проверки:

- ровно один `.mceSmilie`;
- ровно один значимый child, рекурсия только через `<p>`;
- добавить `mceSmilieLarge` (96×96 по нативному CSS).

## 11. Market / BBCode

`resolvePlainUnfurls`:

- находит anchors и plain URL;
- получает `basic post` token;
- `POST https://api.lolz.team/editor/unfurl`;
- для `node` строит `.unfurl-renderer` + `.forum-wrapper`;
- для `media` — `.embed-link`;
- для `market_item` — legacy `.unfurlContainer.marketItem` с ценой;
- не трогает custom-label anchors.

`resolveBbcode`:

- парсит plain-text блоки Tiptap целиком, включая переносы `<br>`;
- оставляет рабочими только `[URL]`, `[IMG]`, `[MEDIA]`, `[VIDEO]`,
  `[USER]` и `[UNFURL]`;
- остальные теги не трогает: они остаются текстом как набраны, включая
  permission-only теги;
- вызывается при отправке и при рендере старых сообщений.

`normalizeClientHtml` убирает Tiptap-хвосты (`ProseMirror-widget`, лишний
`<br>`, пустой `<p>`) до санитайзера. Без этого карточка получала лишнюю
строку и сообщение становилось вдвое выше.

`normalizeUnfurlCards` приводит `market_search`-ноды Tiptap к нативной
legacy-карточке `.unfurlContainer.shorted.marketItem` (24 px), а не оставляет
высокий inline-block `.unfurl-renderer`.

## 11.1. Индикатор сокета и переключение комнат

`ensureSocketIndicator()` создаёт `#no-rules-socket` в `.room-title` с нативным
`chat2-socket-state`/`socket-connected`. Клик или Enter открывает модалку
`Отладка сокета` с проверками WebSocket, auth, history, outbox, pong,
reconnect и отдельным тестовым WebSocket-подключением. Используется
`.modal.fade`/`.xenOverlay`: затемнение, fade/slide, закрытие по X, клику
снаружи и Escape. Нативный socket скрывается только на время активной
комнаты.

При выходе из No Rules:
- сохраняются `roomScrollTop`/`roomAtBottom`;
- очищаются typing timers, reply/edit, меню и online-модалка;
- удаляется `#no-rules-messages`, нативные сообщения и socket возвращаются;
- WebSocket/сессия не теряются, поэтому возврат в комнату быстрый;
- `ensureRoomLink` повторно добавляет пункт бокового меню после Svelte
  перерисовки нативной комнаты.

## 12. Копирование

`htmlToBbcode` повторяет `messageRaw` нативного чата:

- `[UNFURL="..."]...[/UNFURL]` — market/forum;
- `[MEDIA=site]...[/MEDIA]`;
- `[IMG]...[/IMG]`;
- `[URL=...]...[/URL]`;
- `[USER=id]@nick[/USER]`;
- plain text — как есть.
- Форматирование вроде `[B]`, `[COLOR]`, `[QUOTE]`, `[LIST]` в новых
  сообщениях остаётся текстом со скобками; старые HTML-сообщения не
  переписываются.

Копирование не показывает toast; ошибки только `console.debug`.

## 13. Debug API

В page-context:

```js
window.__noRulesChat.version
window.__noRulesChat.state()
window.__noRulesChat.send('text')
window.__noRulesChat.send('<p>html</p>', { html: true })
window.__noRulesChat.reply(id)
window.__noRulesChat.edit(id)
window.__noRulesChat.delete(id)
window.__noRulesChat.reconnect()
window.__noRulesChat.requestHistory()
window.__noRulesChat.openMenu(id)
window.__noRulesChat.clearSession()
```

В Firefox Tampermonkey page-context может быть недоступен из-за sandbox;
тогда используйте DOM/UI и `console.debug`.

## 14. Firefox / Tampermonkey

- `PAGE_WINDOW` = `unsafeWindow` с fallback на `window`;
- auth/fetch URL — абсолютная строка;
- не передавать `URL` в форумный `fetch` (патч форума ждёт строку);
- `@grant none` + `@inject-into` не нужны, но Tampermonkey должен дать
  `unsafeWindow` для `XenForo.activate`;
- удалить старые копии скрипта перед установкой новой версии.

## 15. Отладка

```js
// размеры/наличие плеера
document.querySelector('#no-rules-messages [data-lzt-video-player]')
// fancybox
document.querySelector('.fancybox__container')
// смайл
document.querySelector('.mceSmilie.mceSmilieLarge')
// market
document.querySelector('.unfurlContainer.marketItem .price')
```

Сетевые запросы:

- `/login/generate-temporary-token` (read и basic/post);
- `/members/find`;
- `api.lolz.team/editor/unfurl`;
- `wss://lztws.d9v.uk/ws`.
