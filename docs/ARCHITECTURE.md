# Архитектура

Полная документация разделена на несколько файлов:

- [EXTENSION.md](EXTENSION.md) — userscript: модули, state, рендер, видео,
  lightbox, смайлы, BBCode;
- [BACKEND.md](BACKEND.md) — Bun/Node server, БД, auth, rate limits;
- [NATIVE-CHATBOX.md](NATIVE-CHATBOX.md) — реверс форума;
- [BBCode.md](BBCode.md) — BBCode и copy.

## 1. Модули

Сборка `scripts/build-extension.mjs` просто склеивает файлы в один userscript,
поэтому порядок модулей фиксирован:

| Модуль | Ответственность |
|---|---|
| `00-core.js` | состояние, `localStorage`, санитайзер HTML, работа с корнем Chatbox, скролл, форматирование дат |
| `10-ui.js` | нативные классы/шаблоны, CSS, боковое меню, socket-индикатор, контекстное меню, online-модалка, жесты |
| `20-messages.js` | группировка сообщений, история, optimistic send, reply/edit/delete, typing |
| `30-ws.js` | auth/resume, WebSocket, heartbeat, reconnect, outbox, presence |
| `40-main.js` | boot, активация комнаты, hash/URL, глобальные слушатели, debug API |

Все модули работают в одном page-context. `@grant none` + `@run-at
document-start`; в Firefox используется `unsafeWindow` fallback.

## 2. Корень Chatbox

Один и тот же Svelte-компонент используется в двух местах:

- `/chatbox/` → `.chat2.chat2-full-inner`;
- плавающее окно на любой странице → `.chat2.chat2-widget-inner` внутри
  `.chat2-floating`.

`getChatRoot()` возвращает `.chat2[aria-label="chatbox"]`, поэтому все
селекторы, скролл, composer, reply/edit-бары и online-модалка работают
одинаково в full chat и widget.

`init()` не привязан к `/chatbox/`. Он ждёт появления корня через
`MutationObserver`, поэтому script подхватывает и кнопку чата справа снизу.

## 3. Активация комнаты

1. `ensureRoomLink()` клонирует нативную ссылку комнаты и добавляет
   `data-no-rules`.
2. `activateRoom()`:
   - сохраняет нативный черновик;
   - создаёт `#no-rules-messages` с нативным классом `chat2-messages`;
   - скрывает нативный `.chat2-messages`;
   - поднимает WebSocket/историю;
   - на full chat ставит URL `/chatbox/#no-rules`;
   - пишет `lzt.no-rules.active.v1=1`.
3. `deactivateRoom()` удаляет свой контейнер из DOM, возвращает нативный,
   снимает hash и флаг активной комнаты.

Поэтому F5 на `/chatbox/#no-rules` остаётся в комнате, а плавающее окно не
меняет URL страницы.

## 4. Нативное состояние и сообщения

`state.templates` собирается из живого нативного DOM: группы, аватары,
заголовки, `chat2-message-block`, `chat2-message-text`, reply-разметка,
socket-индикатор. При рендере используются **те же классы**, поэтому CSS
Svelte применяется без копирования стилей.

Исключения — ленивые Svelte-чанки, которые не загружаются, пока нативный
компонент не открыт:

- `message-actions` (контекстное меню);
- `lztui-spinner` (три точки typing);
- `top-users` (online-модалка).

Их CSS скопирован в `NR_CSS` с теми же хешами (`lztng-36rp8q`,
`lztng-1f69oee`, `lztng-yzgsen`). Поэтому вид одинаков и в full chat, и в
widget, где соответствующий чанк ещё не загружен.

## 5. Меню, reply, edit

- Меню: `div.message-actions > ul.menu > li.action > span.Svg-Icon + текст`,
  ширина 230 px, нативные иконки, hover/active из Svelte CSS.
- Reply-бар: `div.chat2-replying`, `svg-icon-reply`, author «Ответ <ник>»,
  текст в `<p>`, нативный `chat2-cancel-reply`.
- Edit-бар: `div.chat2-message-editing` + `chat2-cancel-editing`, вставляется
  перед `.chat2-inputBox`.
- Удаление: без подтверждения и без tombstone; сообщение удаляется из Map и
  DOM. В истории серверные `deleted` отбрасываются, а reply на удалённое
  показывает «Сообщение удалено», как нативный чат.

## 5.0. Mentions и reply

При отправке plain `@ник` клиент вызывает `POST /members/find`, берёт точное
совпадение и собирает нативный блок:
`a.notranslate.username.mention[data-user="id, nick"]` + `img.avatar` +
`span.styleUserNickname.styleN` + `uniqUsernameIcon--custom`. Для своего id
добавляется `highlight` (зелёный фон). Если ника нет — текст остаётся как есть.

Reply хранит `reply_html` (полный санитайзенный HTML цели) в БД. В сообщении
он рендерится внутри `span.chat2-reply-text` с нативными классами, поэтому
изображения, embeds, unfurl и mentions сохраняются. Reply-бар при вводе также
показывает rich HTML (с ограничением высоты/скроллом).

## 5.1. Embeds, market и BBCode

Tiptap при вставке ссылки создаёт нативные Svelte-ноды `.unfurl-renderer`
(Telegram/Steam/Market, форум) или `.embed-link` (SoundCloud/YouTube/TikTok).
Серверный и клиентский санитайзеры сохраняют их классы и `data-*`; CSS форума
рисует карточки 1:1. Для обычного текста с URL клиент делает linkify, чтобы
ссылка была кликабельной даже в старых сообщениях.

Если Tiptap не успел собрать карточку, `resolvePlainUnfurls` вызывает
`POST https://api.lolz.team/editor/unfurl` с Bearer-токеном `basic post`:

- `type=node` → `.unfurl-renderer` + `.forum-wrapper`;
- `type=media` → `.embed-link`;
- `type=market_item` → legacy `.unfurlContainer.marketItem` с
  `categoryIcon`, `.title`, `.price > .Value`, `.LinkClicker`.

BBCode в чате ограничен рабочими тегами: `[UNFURL]`, `[IMG]`, `[MEDIA]`,
`[URL]`, `[VIDEO]`, `[USER]`. Остальные теги остаются текстом как есть. Копирование
`htmlToBbcode()` возвращает BBCode, включая market-аккаунт.

## 5.2. Фото, смайлы, видео

- `prepareLightboxImages` оборачивает bare `<img>` в `a.LbTrigger` с
  `data-fancybox=gallery`; клик открывает нативный fancybox.
- `applySingleSmilie` повторяет нативную проверку: ровно один `.mceSmilie` и
  нет другого значимого содержимого → `mceSmilieLarge` 96×96.
- `activateNativeContent` вызывает `XenForo.activate` только для ещё не
  смонтированных `<video>`; нативный плеер живёт в `.aspect.lztng-tn70wf`.
- `renderMessages` переиспользует DOM сообщений по `messageRenderKey`, чтобы
  видео не перезагружалось и не появлялся спиннер при новых сообщениях.
- `normalizeClientHtml` удаляет Tiptap-хвосты (`ProseMirror-widget`,
  лишний `<br>`, пустой `<p>`), из-за которых карточка растягивала
  сообщение на вторую строку.
- `normalizeUnfurlCards` превращает Tiptap `market_search` в legacy
  `.unfurlContainer.marketItem` высотой 24 px, как в нативном Chatbox.
- В редакторе видео muted autoplay; в reply-баре — HTML5 controls.

## 6. Typing

В конце `#no-rules-messages` всегда живёт `chat2-typingDetails` высотой
23 px + `margin-top: 8px`. Это резервирует те же 31 px, что и нативный чат,
поэтому сообщения не прилипают к полю ввода. Внутри — точная разметка
`lztui-spinner` с тремя `lztui-spinner-bounce` и текст:

- `user печатает`;
- `user1 и user2 печатают`;
- `user1 и еще N печатают`.

## 7. Online-модалка

Сервер в `presence`/`auth.ok` отдаёт `users` (id, username, usernameHtml,
avatar, color, profileUrl). Клиент хранит `state.onlineUsers` и по клику на
`.roomOnline` открывает XenForo-подобный `modal > xenOverlay` с нативными
классами `top-users-container`, `top-user-item lztng-yzgsen`,
`user-abour-container`, `user-stats-block`. Показываются только участники
No Rules; нативная комната не затрагивается.

## 8. WebSocket

- `auth` — временный токен форума + `ACCESS_KEY`;
- `resume` — opaque session token (на сервере только SHA-256);
- heartbeat 25 с, reconnect с exponential backoff;
- outbox для `message.send` хранится до `message.new`, переживает F5
  (`localStorage`), ограничен 100 записями и привязан к `ownerId`;
- `clientId` дедуплицирует повторные отправки; сервер проверяет его до
  rate-limit, поэтому replay после потери ack не создаёт дубль;
- `rate_limited` с `clientId` возвращает `retryAfterMs`, клиент повторяет
  очередь автоматически;
- история грузится по 60/50; после reconnect догоняется через `after`,
  включая `after=0` для пустой комнаты; позиция скролла сохраняется.
- Индикатор `#no-rules-socket` использует нативный `chat2-socket-state`;
  клик открывает `Отладка сокета` с WebSocket/auth/history/outbox/pong.
- При выходе из комнаты удаляется только UI No Rules и очищаются typing
  timers; WebSocket/сессия остаются, а `ensureRoomLink` возвращает пункт
  меню после перерисовки нативной комнаты.

## 9. Тесты

Playwright-сценарии запускаются против production WSS и тестового
storageState. Проверяются full chat, widget, mobile, Firefox,
hash/reload, offline outbox, история > 60, меню, reply/edit/delete,
online-модалка, видео (плеер/F5/новые сообщения), lightbox, smilie,
BBCode/market/accounts, ArrowUp edit last и copy. Полный чек-лист —
[TESTING.md](TESTING.md).
