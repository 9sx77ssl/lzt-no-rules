# No Rules: extension и нативный Chatbox

Этот документ — основной справочник по userscript-у, нативному DOM Chatbox и
визуальному поведению комнаты. Backend, протокол, безопасность и деплой —
в [`OPERATIONS.md`](OPERATIONS.md). История версий — в
[`CHANGELOG.md`](CHANGELOG.md).

Источник истины:

1. `extension/src/*.js` — код, который реально собирается.
2. `server/src/*.js` — backend.
3. `research/chatbox/javascript/*` — сохранённые чанки форума.
4. Этот документ — наблюдения и контракты, которые нельзя ломать.

## 1. Структура и сборка

```text
extension/src/
  00-core.js       state, localStorage, sanitizers, BBCode, mentions, scroll
  10-ui.js         native templates/CSS, menu, modals, bars, copy, media
  20-messages.js   history, groups, send/edit/delete/reply, typing, render
  30-ws.js         auth/resume, WebSocket, heartbeat, outbox, presence
  40-main.js       boot, room activation, URL/hash, listeners, debug API
extension/dist/
  no-rules.user.js собранный userscript
scripts/
  build-extension.mjs
```

Сборка склеивает модули в один IIFE в фиксированном порядке:

```bash
NR_VERSION=1.3.4 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
node scripts/build-extension.mjs
```

`build-extension.mjs` подставляет `__VERSION__`, `__WS_URL__`,
`__ACCESS_KEY__` в `extension/src/header.txt` и пишет
`extension/dist/no-rules.user.js`. Порядок модулей важен: константы
(`NR_CSS`, allowlist-ы, `state`) инициализируются сверху вниз.

Метаданные userscript:

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

`@namespace` стабилен: Tampermonkey определяет обновление по name+namespace.
Две копии с разными namespace конфликтуют, поэтому старые версии нужно
удалять.

## 2. Chatbox: два режима, один DOM

Один и тот же Svelte-компонент используется:

- на `/chatbox/` → `.chat2.chat2-full-inner`;
- в плавающем окне → `.chat2.chat2-widget-inner` внутри `.chat2-floating`.

Корень ищется так:

```js
document.querySelector('.chat2[aria-label="chatbox"]')
  || document.querySelector('.chat2-full-inner, .chat2-widget-inner');
```

Нативные сообщения — `.chat2-messages`, скролл — `.scrollable >
.scrollable-content`. No Rules создаёт свой `#no-rules-messages` с нативным
классом `chat2-messages` и скрывает нативный список только на время активной
комнаты.

`init()` не привязан к `/chatbox/`: он ждёт появления корня через
`MutationObserver`, поэтому подхватывает и кнопку чата на любой странице.

### Основные нативные классы

```text
.chat2-message-group
  .chat2-group-avatar
  .chat2-message-group-content
    .chat2-day-separator
    .chat2-message
      .chat2-message-block
        .chat2-message-header
        .chat2-message-username > a.username.poster
        .reply-message
        .chat2-message-text
          .chat2-message-text-inner
          .chat2-message-date
```

Ленивые чанки, CSS которых может отсутствовать в widget:

| Компонент | CSS-хеш | Где используется |
|---|---|---|
| message actions | `lztng-36rp8q` | контекстное меню |
| typing spinner | `lztng-1f69oee` | три точки |
| online users | `lztng-yzgsen` | модалка «Онлайн» |
| video player | `lztng-tn70wf` | видео |
| unfurl renderer | `lztng-1wjql9y` | Tiptap-карточки |
| image popover | `lztng-djtfwo` | editor image popover |

`NR_CSS` добавляет только недостающие правила. Нативные классы не
переименовываются.

## 3. State и жизненный цикл

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
}
```

`messages` — подтверждённые сервером сообщения, `pending` — оптимистичные.
`allVisibleMessages()` склеивает их по времени/ID.

`outbox` — только unacknowledged `message.send`, а не «всё, пока нет сокета».
Запись лежит в `localStorage['lzt.no-rules.outbox.v1']` (до 100 штук, с
`ownerId`) и удаляется после `message.new`/`history` с тем же `clientId`.
Поэтому F5, обрыв и повторный `flushOutbox()` не теряют сообщение, а сервер
идемпотентно возвращает уже созданную строку.

Активация комнаты:

1. `ensureRoomLink()` клонирует нативную ссылку комнаты и добавляет
   `data-no-rules`.
2. `activateRoom()` сохраняет нативный черновик, создаёт
   `#no-rules-messages`, скрывает нативный `.chat2-messages`, поднимает
   WebSocket/историю, на full chat ставит `/chatbox/#no-rules` и пишет
   `lzt.no-rules.active.v1=1`.
3. `deactivateRoom()` удаляет свой контейнер, возвращает нативный, снимает
   hash/флаг, очищает typing/reply/edit/menu; WebSocket и сессия остаются.

F5 на `/chatbox/#no-rules` остаётся в комнате; плавающее окно не меняет URL
страницы. `MutationObserver`, `hashchange` и `popstate` перезапускают
`ensureMessagesContainer`/`enforceActiveUI` после перерисовок Svelte.

## 4. Рендер сообщений

`state.templates` собирается из живого нативного DOM: группы, аватары,
заголовки, `chat2-message-block`, `chat2-message-text`, reply-разметка,
socket-индикатор. При рендере используются те же классы, поэтому CSS Svelte
применяется без копирования.

`renderMessages` не пересоздаёт всё:

1. Собирает существующие `[data-nr-message]` по `data-message-id`.
2. Считает `messageRenderKey`:
   `id/html/text/createdAt/editedAt/deleted/pending/failed/queued/
   showHeader/user/reply/mentions`.
3. Если ключ совпал — **переиспользует старый DOM-узел**.
4. Перестраивает только группы/разделители и вставляет узлы обратно.
5. Вызывает `prepareMessageVideos`, `activateNativeContent`,
   `renderTypingInto`.

Это критично для видео: Svelte-плеер остаётся смонтированным,
`currentTime` не сбрасывается, спиннер не появляется.

Аватары групп также переиспользуют один и тот же `<img>`, чтобы не было
мерцания и повторного декодирования при optimistic send.

## 5. Меню, reply, edit, delete, mentions

- Меню: `div.message-actions > ul.menu > li.action > span.Svg-Icon + текст`,
  ширина 230 px, нативные иконки и hover/active.
- Reply-бар: `div.chat2-replying`, `svg-icon-reply`, автор «Ответ <ник>»,
  текст в `<p>`, нативный `chat2-cancel-reply`.
- Edit-бар: `div.chat2-message-editing` + `chat2-cancel-editing` перед
  `.chat2-inputBox`.
- Удаление: без подтверждения и tombstone; сообщение удаляется из Map/DOM.
  Серверное мягкое удаление клиент отбрасывает, reply на удалённое показывает
  «Сообщение удалено».
- `ArrowUp` в пустом composer запускает `editLastOwnMessage()`.

Reply хранит `reply_html` — полный санитайзенный HTML цели. В сообщении он
рендерится внутри `span.chat2-reply-text` с нативными классами, поэтому
изображения, embeds, unfurl и mentions сохраняются. Reply-бар показывает rich
HTML с ограничением высоты и скроллом.

Plain `@ник` не является Tiptap-нодой. При отправке клиент вызывает
`POST /members/find`, берёт точное совпадение и собирает:

```html
<a class="notranslate username mention" data-user="id, nick">
  <img class="avatar">
  <span class="styleUserNickname styleN">@ник</span>
  <span class="uniqUsernameIcon--custom">...</span>
</a>
```

Для своего id добавляется `highlight` (зелёный фон). Если ника нет — текст
остаётся как есть. `[USER=id]@ник[/USER]` гидрируется тем же способом и при
отправке, и при рендере старых сообщений/F5.

## 6. BBCode и карточки

Поддерживаются только реально работающие теги:

| BBCode | Результат |
|---|---|
| `[URL]...[/URL]` | ссылка |
| `[URL=...]текст[/URL]` | ссылка с текстом |
| `[IMG]https://...[/IMG]` | фото + fancybox |
| `[IMG=width=800;height=450]https://...[/IMG]` | фото с размером; clamp 5000 px |
| `[IMG=80x40]https://...[/IMG]` | короткая форма размера |
| `[MEDIA=youtube]...[/MEDIA]` | media-карточка |
| `[VIDEO]https://...[/VIDEO]` | HTML5 video |
| `[UNFURL="..."]...[/UNFURL]` | market/forum карточка |
| `[USER=id]@ник[/USER]` | нативный mention |

Всё остальное (`B`, `I`, `U`, `S`, `COLOR`, `SIZE`, `CENTER`, `LEFT`,
`RIGHT`, `QUOTE`, `LIST`, `EMAIL`, `SPOILER`, `CODE`, `PHP`, `HTML`, `SRC`,
`PLAIN`, `PRICE`, `BUTTON`, `HR`, `CLUB`, `DAYS`, `EXCEPTIDS`, `LANG`, `LIKES`,
`LIKES2`, `USERIDS`, `API`, `TOOLTIP`, `VISITOR`, `CENSOR`) **не
форматируется и не вырезается**. Сообщение приходит ровно как набрано, со
скобками и тегами.

Где применяется:

1. Перед отправкой: `resolveBbcode(normalizeClientHtml(getEditorHtml()))`.
2. При рендере старых сообщений и после F5: `enhanceUnfurls()`.

Tiptap может разбивать ввод на несколько `<p>`/`<br>`; plain-блок
собирается в одну строку перед разбором. После разбора убираются trailing
`<br>`/пустые `<p>`.

Почему не `/editor/to-html`: этот роут отдаёт editor HTML без нативных
классов и раскрывает скрытый текст `CLUB`/`LIKES`; `API`, `PRICE`, `BUTTON`,
`MEDIA`, `HR` оставляет literal-тегами. `/editor/to-bb-code` можно
использовать как fallback для копирования, но локальный `htmlToBbcode` уже
работает без лишнего запроса. Парсер намеренно ограничен рабочими тегами.

Карточки:

- market-раздел: `.unfurlContainer.shorted.marketItem`, высота 24 px;
- Tiptap `market_search` приводится к той же legacy-карточке;
- форумный раздел: `.forum-wrapper`;
- фото: `.LbTrigger` + fancybox;
- media: `.embed-link`; metadata market — через `/editor/unfurl`.

Копирование `htmlToBbcode` сохраняет `[UNFURL]`, `[MEDIA]`, `[IMG]`, `[URL]`,
`[USER]`, `[VIDEO]` и пользовательское форматирование, если оно уже есть в
HTML. Новые сообщения с неподдерживаемым BBCode остаются plain-текстом.

## 7. Видео, фото, смайлы

### Видео

Нативный `XenForo.VideoPlayer` монтирует Svelte-плеер в
`.aspect.lztng-tn70wf` и заменяет `<video>`. Простого HTML недостаточно:
после вставки нужно вызвать `XenForo.activate(container)`, иначе останется
пустой первый кадр без controls. Повторный вызов на уже смонтированном
плеере перезагружает его.

Правила No Rules:

- `prepareMessageVideos`: `playsinline`, `preload=metadata`, poster `.webp`
  для `nztcdn.com/files/*.mp4`;
- `activateNativeContent`: активирует только `<video>` без
  `[data-lzt-video-player]`;
- `muteEditorVideos`: `muted` + `defaultMuted` для preview в Tiptap;
- `prepareReplyVideos`: обычный `<video controls playsinline
  preload=metadata poster>` в reply-баре и зелёном reply-блоке;
- DOM сообщений переиспользуется, поэтому воспроизведение не сбрасывается.

### Фото

`prepareLightboxImages` оборачивает «голый» `<img>` в:

```html
<a class="LbTrigger" href="..." data-href="https://lolz.team/misc/lightbox"
   data-fancybox="gallery"><img ...></a>
```

Клик открывает нативный fancybox (`.fancybox__container`), а не новую
вкладку. Не трогаются аватары, смайлы, `.mention`, `.unfurlContainer`,
`.embed-link`, `[data-lzt-video-player]`.

### Смайлы

`applySingleSmilie` повторяет нативную проверку: ровно один смайл,
ровно один значимый child (рекурсия через `<p>`/`.svelte-renderer`), тогда
добавляется `mceSmilieLarge` 96×96. Смайл определяется по `.mceSmilie` или
по `alt/title` вида `:shortcode:` с `nztcdn.com`; он не оборачивается в
lightbox. Два смайла или смайл с текстом остаются обычными. При копировании
смайл даёт `:shortcode:`, а обычное фото — `[IMG]...`.
В редакторе Tiptap смайлы-картинки принудительно приводятся к нативным
32×32 px (SVG/WebP/разные intrinsic sizes не влияют). После отправки
`clearContent()` очищает все NodeView, а запоздавший кадр Tiptap
перепроверяется без стирания нового пользовательского ввода. Редактирование
ставит курсор в конец сообщения (`focus('end')`).

## 8. Unfurl, market и `/editor/unfurl`

Tiptap-ссылка может сама создать `.unfurl-renderer`/`.embed-link`. Если
карточка не собралась, `resolvePlainUnfurls` вызывает:

```http
POST https://api.lolz.team/editor/unfurl
Authorization: Bearer <JWT basic post>
Content-Type: application/x-www-form-urlencoded

url=<encoded-url>
&_xfRequestUri=%2Fchatbox%2F
&_xfNoRedirect=1
&_xfToken=<csrf>
&_xfResponseType=json
```

Типы ответа:

- `node` → `.unfurl-renderer` + `.forum-wrapper`;
- `media` → `.embed-link`;
- `market_item` → legacy `.unfurlContainer.marketItem` с `categoryIcon`,
  `.title`, `.price > .Value`, `.LinkClicker`.

`basic post` токен живёт около часа, кешируется в памяти и **не отправляется
на наш сервер**.

Legacy market-карточка:

```html
<div class="unfurlContainer shorted marketItem category--steam">
  <div class="text">
    <span class="SvgIcon">
      <span class="categoryIcon steam Tooltip" data-cachedtitle="Steam"></span>
    </span>
    <span class="title">Steam • ...</span>
    <div class="price"><span class="Value" data-value="7932">7 932 ₽</span></div>
  </div>
  <a class="LinkClicker" href="https://lzt.market/..."></a>
</div>
```

`normalizeClientHtml` удаляет Tiptap-хвосты (`ProseMirror-widget`, лишний
`<br>`, пустой `<p>`), иначе карточка добавляет вторую строку.
`normalizeUnfurlCards` превращает `market_search` в legacy-карточку 24 px.

## 9. Нативное поведение и анимации

### Лимит 512 символов

Поле ввода и сервер используют общий жёсткий лимит **512 символов**.
Считаются Unicode code points, как `mb_strlen` на форуме; literal BBCode,
который ещё находится в редакторе, считается как набранный текст, а
отрендеренное медиа даёт только `alt`. Сервер дополнительно ограничивает
значение через `MAX_MESSAGE_TEXT` (не выше 512) и применяет лимит и к
`message.send`, и к `message.edit`. Вставка из буфера, drag-drop и IME не
обходят проверку; при превышении показывается нативный `.chat2-error`
«Максимум 512 символов.».

### Автоскролл

Если пользователь находится внизу, новые сообщения и рост уже
отрисованного контента (фото, видео, unfurl, typing) удерживают скролл на
самом низу. `ResizeObserver` следит за высотой групп, `img.load` — за
поздней загрузкой картинок; `scrollToBottom()` вызывается после layout.
Ручной wheel/touch/pointer/PageUp сразу отключает follow-режим, чтобы не
выдёргивать пользователя из истории. Дополнительного нижнего padding нет:
последнее сообщение отделяется нативным `chat2-typingDetails` (23 px + 8 px),
как в оригинальном Chatbox (`padding-bottom: 0` у `.chat2-messages`).

### Pending и ошибки

- Pending показывает нативную полупрозрачную иконку часов, без времени.
- Ack приходит сразу (~30–90 мс), без искусственной задержки; после ack
  pending заменяется реальным сообщением с временем.
- При ошибке отправки нет красной обводки и кнопки «Повторить»: bubble
  плавно исчезает, текст и reply восстанавливаются в редакторе, сверху
  появляется нативный `.chat2-error`.
- Пустой Enter показывает нативный `.chat2-error` «Пожалуйста, введите
  корректное сообщение.» с выездом снизу и автоскрытием.

### Reply jump

Переход к reply использует только нативную `.message-highlight`, без зелёной
обводки. Подсветка расширяется только по горизонтали и сохраняет нативный
`margin-bottom: 5px`, поэтому сообщение не липнет к следующему во время
анимации. Скролл центрируется и не дёргается. Если сообщение старое, сервер
отдаёт компактное окно `history near` (~30 сообщений вокруг цели), а не всю
историю. Кнопка возврата к последним сообщениям появляется при уходе вниз.

### `fly` и `rise`

- Новое сообщение: Svelte `fly`, 400 мс, `translateX(-20px)` + opacity 0 → 1.
  No Rules повторяет это CSS-анимацией `nr-message-in`; pending и реальное
  сообщение входят одинаково.
- Контекстное меню: нативная `rise`, 100 мс, opacity 0 → 1 и
  `translateY(10px)` → 0. Классы `nr-menu-enter`/`nr-menu-in`/
  `nr-menu-leave`; transition висит на `.nr-menu-in` и `.nr-menu-leave`,
  иначе при смене класса анимация мгновенно ломается.
- Закрытие по клику вне, Escape и скроллу тоже анимируется.

### Модалки

Онлайн-список и отладка сокета используют один typed-хелпер
`mountNativeModal` (JSDoc `NativeModalController`):

```js
mountNativeModal({
  id, modal, backdrop, bodyClass,
  closeDelay = 220,
  focus = null,
  onClose = null,
});
```

Он делает одинаково:

- backdrop с затемнением;
- `opacity + translateY(-8px)` при открытии и плавное закрытие;
- блокировку `body` (`overflow: hidden`);
- закрытие по `.OverlayCloser`, клику вне модалки и Escape;
- фокус на крестик/модалку;
- очистку probe/таймеров/listeners через `onClose`;
- безопасное снятие body-lock, если открыта другая модалка.

Обе модалки используют одинаковые `opacity`/`translateY` transition и
backdrop-анимацию; отдельного `prefers-reduced-motion`-исключения только для
онлайн-модалки больше нет, поэтому открытие/закрытие не отличаются от
`Отладки сокета`.

Онлайн-модалка — XenForo `modal > xenOverlay` с нативными
`top-users-container`, `top-user-item lztng-yzgsen`, `user-abour-container`,
`user-stats-block`. Показываются только участники No Rules.

### Typing

В конце `#no-rules-messages` всегда живёт `chat2-typingDetails` высотой 23 px
+ `margin-top: 8px` (те же 31 px, что в нативном чате). Внутри — точная
разметка `lztui-spinner` с тремя `lztui-spinner-bounce` и текст:

- один: `user печатает`;
- два: `user1 и user2 печатают`;
- больше: `user1 и еще N печатают`.

Пользователь живёт в typing 3000 мс; каждое новое событие переставляет его
в конец. Дубликатов нет, обновление realtime.

### Онлайн и socket

Сервер в `presence`/`auth.ok` отдаёт `users`: id, username, usernameHtml,
avatar, color, profileUrl, stats. Клиент хранит `state.onlineUsers` и
открывает модалку по клику на `.roomOnline`.

`#no-rules-socket` использует нативный `chat2-socket-state`; клик открывает
`Отладка сокета` с WebSocket/auth/history/outbox/pong и отдельным тестовым
подключением.

## 10. WebSocket-клиент

- `auth` — временный токен форума + `ACCESS_KEY`;
- `resume` — opaque session token (на сервере только SHA-256);
- heartbeat 25 с, reconnect с exponential backoff;
- outbox для `message.send` до `message.new`, переживает F5;
- `clientId` дедуплицирует повторные отправки; сервер проверяет его до
  rate-limit, поэтому replay после потери ack не создаёт дубль;
- `rate_limited` с `clientId` возвращает `retryAfterMs`, клиент повторяет
  очередь автоматически;
- история грузится по 60/50; после reconnect догоняется через `after`,
  включая `after=0` для пустой комнаты; позиция скролла сохраняется.

При выходе из комнаты удаляется только UI No Rules и очищаются typing timers;
WebSocket/сессия остаются, а `ensureRoomLink` возвращает пункт меню после
перерисовки нативной комнаты.

## 11. Firefox и Tampermonkey

- `PAGE_WINDOW` = `unsafeWindow` с fallback на `window`;
- auth/fetch URL — абсолютная строка;
- не передавать `URL` в форумный `fetch` (патч форума ждёт строку);
- `@grant none`; для `XenForo.activate` нужен page-context;
- Firefox content-script WebSocket может прислать `Origin: null`; сервер
  принимает его только при `ALLOW_MISSING_ORIGIN` и всё равно требует
  read-JWT;
- `@run-at document-start`, но DOM инициализируется только после появления
  `document.head`/`document.body`;
- удалить старые копии скрипта перед установкой новой версии.

## 12. Debug API

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

## 13. Research: нативные чанки

`research/chatbox/javascript/` закоммичены для реверса; сетевые дампы, DOM,
antibot и скриншоты остаются локально, потому что могут содержать токены и
cookies.

| Файл | Что внутри |
|---|---|
| `chat2.js` | Svelte Chatbox: комнаты, сообщения, composer, reply, меню, online |
| `core.js` | XenForo-обвязка, video player, регистрация обработчиков |
| `tiptap-vendor-*.js` | Tiptap, mention/unfurl/media/video-ноды, CSS |
| `api-*.js` | `xenApiFetch`, Bearer-токены |
| `StatusInput-*.js` | status/input, snapshot-логика |

Полезно:

```bash
rg -n 'unfurl-renderer|LbTrigger|mceSmilieLarge' research/chatbox/javascript
```

## 14. Что проверять при изменениях

1. Full chat и widget.
2. F5 на `#no-rules`.
3. Отправку с видео и новым сообщением во время воспроизведения.
4. Одиночный и двойной smilie.
5. Клик по загруженному изображению и по `[IMG]`.
6. Plain market URL и `[UNFURL]`.
7. Firefox/Tampermonkey.
8. Копирование в BBCode.
9. Онлайн-модалку и socket-модалку (X, backdrop, Escape, body scroll).
10. Контекстное меню: `rise` 100 мс, закрытие плавное.
11. Отсутствие `pageerror`, тостов и горизонтального скролла на mobile.

Полный чек-лист — в [`OPERATIONS.md`](OPERATIONS.md#9-тестирование).
