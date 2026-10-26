# Changelog

## 1.3.10

- Вернул закругление модалок как в оригинальном XenForo: `.sectionMain`
  12px, `.heading` `12px 12px 0 0`; убран двойной радиус 8px + 12px.
- Сервер и extension: `1.3.10`.

## 1.3.9

- Онлайн-модалка и модалка сокета: убран `border-radius` у heading и
  `.sectionMain`, чтобы нативный 12px top-radius темы не ломал углы.
- Сервер и extension: `1.3.9`.

## 1.3.8

- Firefox/Tampermonkey: добавлен `@sandbox raw`; editor-команды доступны
  через `wrappedJSObject`, но callback-и в ProseMirror не передаются.
- Это чинит оставшийся смайл и возвращает очистку редактора в Firefox.
- Сервер и extension: `1.3.8`.

## 1.3.7

- Исправлен срочный Firefox-регресс: sandbox-функция больше не передаётся в
  `editor.on('update')`, из-за чего ProseMirror падал с
  `Permission denied to access property "apply"`.
- `@inject-into page`; editor-команды и DOM-fallback обёрнуты в безопасные
  try/catch. Отправка и очистка снова работают.
- Сервер и extension: `1.3.7`.

## 1.3.6

- Firefox/Tampermonkey: добавлен `@unwrap`, поиск Tiptap через
  `element.wrappedJSObject.editor` и page-window fallback.
- Если Tiptap API недоступен из sandbox, DOM-fallback ставит каретку в конец;
  это исправляет курсор слева от текста и остатки NodeView в Firefox.
- Сервер и extension: `1.3.6`.

## 1.3.5

- После очистки composer-а удаляются осиротевшие Tiptap NodeView-обёртки
  `.node-image`/`.node-smilie`; это закрывает накопительный баг, когда после
  отправки N смайлов в поле оставалось N-1.
- Сервер и extension: `1.3.5`.

## 1.3.4

- Смайлы в редакторе (SVG/WebP и image-node) теперь всегда 32×32 px, как
  нативные `smilie-image-tiptap`.
- После отправки используется `clearContent()` + проверка на следующем
  кадре, чтобы запоздавший NodeView не оставлял первый смайл в поле.
- При edit курсор ставится в конец сообщения (`focus('end')`), а не в начало.
- Сервер и extension: `1.3.4`.

## 1.3.3

- Исправлена подсветка сообщения из reply: horizontal-only margin/padding
  больше не сбрасывает нативный `margin-bottom: 5px`, из-за которого целевое
  сообщение прилипало к следующему на время серой анимации.
- Сервер и extension: `1.3.3`.

## 1.3.2

- Убрано особое `prefers-reduced-motion: reduce`-правило, которое отключало
  transition только у онлайн-модалки. Теперь открытие/закрытие и backdrop
  анимируются так же, как у модалки отладки сокета.
- Сервер и extension: `1.3.2`.

## 1.3.1

- Убран лишний 16 px `padding-bottom` у собственного scroll-контейнера:
  последнее сообщение снова отделяется от composer-а нативным
  `chat2-typingDetails` (23 px + 8 px), без искусственной дыры.
- Сервер и extension: `1.3.1`.

## 1.3.0

- Жёсткий лимит **512 Unicode code points** для composer-а, `message.send` и
  `message.edit`; вставка, IME и drag-drop не обходят ограничение. Сервер
  дополнительно clamp-ит `MAX_MESSAGE_TEXT` сверху.
- Автоскролл удерживает низ после поздней загрузки фото/видео/unfurl и
  изменения typing; нижний отступ 16 px от composer-а. Ручной скролл
  отключает follow.
- Соло-смайлы (webp/svg/`alt=:shortcode:`) больше не оборачиваются в
  lightbox, получают нативный `mceSmilieLarge` 96×96 и копируются как
  `:shortcode:`; обычные фото по-прежнему копируются как `[IMG]...`.
- Добавлен unit-тест на 512 code points, включая emoji и clamp env.
- Сервер и extension: `1.3.0`.

## 1.2.9

- Контекстное меню ПКМ теперь реально анимируется как нативная `rise`:
  fade + `translateY(10px)` → `0` за 100 мс; transition остаётся на элементе
  при переключении enter/leave, поэтому нет мгновенного скачка.
- Онлайн-модалка и модалка сокета используют один typed-хелпер
  `mountNativeModal`: backdrop, блокировка body, in/out, X, клик вне,
  Escape, фокус и очистка probes/таймеров.
- Документация сжата до `README.md` + `docs/PROJECT.md` +
  `docs/OPERATIONS.md`; `CHANGELOG.md` оставлен архивом. Тестовые фикстуры
  обезличены, production IP/реальные ID не хранятся в репозитории.
- Сервер и extension: `1.2.9`.

## 1.2.8

- Окно «Сейчас сидят в чате» сделано как нативная модалка: плавное появление
  и закрытие, затемняющий backdrop, блокировка страницы (body scroll lock),
  закрытие по клику вне окна, крестику и Escape. Список обновляется при
  изменении presence, пока окно открыто.
- Сервер и extension: `1.2.8`.

## 1.2.7

- Socket hot path: auth presence list считается один раз, отправка сообщения
  больше не делает лишний `SELECT` пользователя на каждый кадр.
- Сервер и extension: `1.2.7`.

## 1.2.6

- Security hardening: временный JWT без `read`/`chatbox` scope и токены с
  `post` отклоняются; auth-rate-limit расходуется даже на неверный `ACCESS_KEY`.
- `message.report` получил отдельный rate limit, `history.limit` нормализуется
  до целого; `is_banned` теперь хранится в `users` и проверяется при resume.
- Санитайзер вырезает `data-href`/`data-url`/`data-proxy-href`/
  `data-fallback-src` с не-http(s) URL, внешний `poster`, `url(...)` в inline
  CSS, `data-tippy-content`, SVG-анимации в сообщениях и небезопасные
  spoiler `data-target`.
- Клиентский sanitizer и иконки unfurl больше не принимают event handlers/
  внешние SVG-анимации.
- CORS preflight разрешён только для `ALLOWED_ORIGINS`.
- Добавлен `tsconfig.json` с `allowJs` + `checkJs`, `bun-sqlite.d.ts` и
  `npm run typecheck` / `bun run typecheck`; серверные тесты расширены.
- Сервер и extension: `1.2.6`.

## 1.2.5

- Аватарки групп больше не пересоздаются на каждый optimistic send: готовый
  `<img>` переиспользуется между рендерами. Это убирает перезагрузку,
  передекодирование и визуальное «дёргание»/размытие аватарки при отправке.
- Сервер и extension: `1.2.5`.

## 1.2.4

- Анимация сообщений как в нативном Chatbox: `fly`-вход 400 мс,
  сдвиг `translateX(-20px)` и прозрачность; pending тоже входит этой
  анимацией, после ack реальное сообщение появляется уже с ней.
- Контекстное меню: `rise`-анимация 100 мс (fade + 10 px снизу), плавное
  закрытие по клику вне/ Escape/скроллу, без резкого удаления.
- Reply из аватара, контекстного меню и других точек сразу фокусирует
  композер (с повтором после pointer gesture).
- Typing: точные нативные фразы, 3 секунды жизни, порядок «последний
  печатавший первым», без дублей; 1 / 2 / 10 человек проверены.
- Сервер и extension: `1.2.4`.

## 1.2.3

- Убран искусственный 0.9-секундный показ pending: сообщение с часами живёт
  ровно до `message.new`/ack. На нормальном сокете это десятки миллисекунд,
  а не «секунда на подумать».
- No Rules переведён на собственный стабильный скроллер внутри `.chat2`:
  нативный Svelte-скролл больше не сбрасывает позицию, поэтому переход к
  reply реально центрирует сообщение и не даёт «съехать вниз и вернуться».
- Нативный скролл-хост скрывается на время комнаты и восстанавливается при
  возврате; full chat и widget проверены.
- Сервер и extension: `1.2.3`.

## 1.2.2

- При ошибке отправки reply-бар восстанавливается вместе с текстом в редакторе,
  как в нативном composer. Черновик сохраняется в `localStorage`.
- Сервер и extension: `1.2.2`.

## 1.2.1

- Переход к истории не проваливается обратно в низ из-за программного
  `scrollIntoView`: догрузка более новых сообщений включается только после
  короткой паузы и реального скролла. Кнопка «Вернуться к последним
  сообщениям» работает и через capture-обработчик.
- Мелкая чистка: убраны остатки retry-кнопки и `nr-failed`, размеры картинок
  читаются и из `style` при копировании в BBCode.
- Сервер и extension: `1.2.1`.

## 1.2.0

- Исправлена повторная отправка уже опубликованной фотографии перетаскиванием
  из сообщения в редактор: Tiptap оставлял `<a>` без `href`, сервер выбрасывал
  вместе с ним `<img>`, и сообщение становилось пустым. Теперь editor-only
  обёртки разворачиваются, а сервер сохраняет изображение даже из старых
  клиентов.
- `[IMG=width=...;height=...]` и `[IMG=800x450]` поддерживают размеры, как
  XenForo; значения ограничены 5000 px. Копирование возвращает размерный тег.
- Pending-сообщение теперь как в нативном Chatbox: полупрозрачное, без времени,
  с серыми часами; после ack живёт ещё ~0.9 с и заменяется реальным. Ошибка
  больше не оставляет красную обводку и «Повторить»: bubble плавно исчезает,
  текст возвращается в редактор, а ошибка показывается нативным `.chat2-error`
  над композером на 3 секунды. Пустой Enter даёт «Пожалуйста, введите
  корректное сообщение.».
- Переход к reply использует нативную подсветку `.message-highlight` вместо
  зелёной обводки. Если сообщение далеко, клиент запрашивает компактное окно
  `history near` (30 сообщений вокруг цели), а не всю историю; сверху/снизу
  можно догружать страницы, есть возврат к последним.
- Сервер и extension: `1.2.0`.

## 1.1.29

- Старые сообщения с `[USER=id]` гидрируются и после F5: если у mention
  стандартная аватарка, клиент запрашивает пользователя и заменяет блок на
  настоящий аватар/цвет/значок.
- Hydration работает и для сообщений, которые создаются вне DOM (очередь
  рендера), поэтому не зависит от порядка вставки сообщения.
- Сервер и extension: `1.1.29`.

## 1.1.28

- `[USER=id]@ник[/USER]` гидрируется через `/members/find`: настоящий аватар,
  цвет/значок ника и ссылка на профиль, как у нативного mention.
- Сервер и extension: `1.1.28`.

## 1.1.27

- `[USER=id]@ник[/USER]` снова форматируется в нативный mention с
  аватаром и профилем.
- Сервер и extension: `1.1.27`.

## 1.1.26

- В чате форматируются только `URL`, `IMG`, `MEDIA`, `VIDEO`, `UNFURL`.
  Остальные BBCode-теги, включая permission-only, остаются текстом как
  набраны: скобки и атрибуты не вырезаются и не заменяются заглушкой.
- Сервер и extension: `1.1.26`.

## 1.1.25

- Чат намеренно оставлен на BBCode, который реально работает: `URL`, `IMG`,
  `MEDIA`, `VIDEO`, `UNFURL`. Остальные теги снимаются в plain-текст, чтобы
  не показывать квадратные скобки и не ломать реальные сообщения.
- Permission-only BBCode остаётся безопасной muted-заглушкой.
- Сервер и extension: `1.1.25`.

## 1.1.24

- Socket modal now closes on Escape even when focus escapes the dialog; close
  animation and backdrop behaviour are unchanged.
- Сервер и extension: `1.1.24`.

## 1.1.23

- Permission-only BBCode (`CLUB`, `DAYS`, `LIKES`, `LIKES2`, `USERIDS`, `API`,
  `TOOLTIP`, `VISITOR`, `LANG`, `EXCEPTIDS`) no longer leaks raw tags or hidden
  content: rendered as a muted unavailable block.
- Removed trailing whitespace left by the block parser, so BBCode lists and
  quotes do not add an empty line under a message.
- Сервер и extension: `1.1.23`.

## 1.1.22

- Socket debug modal: native backdrop, fade/slide animation, body scroll lock,
  close by X/outside/Escape, extra test WebSocket connection.
- BBCode blocks now parse across Tiptap paragraphs/`<br>`; `SIZE`, `CENTER`,
  `QUOTE`, `LIST`, `EMAIL`, `SPOILER`, `PRICE` and `BUTTON` work after send/F5.
- Quote class survives server sanitizer; spoiler/list/quote markup is kept in
  both client and server allowlists.
- Server and extension: `1.1.22`.

## 1.1.21

- Tiptap-хвосты (`ProseMirror-widget`, лишние `<br>` и пустые `<p>`) больше
  не растягивают сообщения; карточки market-разделов приводятся к нативной
  legacy-карточке высотой 24 px, как в живом Chatbox.
- Полнее BBCode: `COLOR`, `SIZE`, `EMAIL`, `LIST`/`[*]`, `LEFT`/`CENTER`/
  `RIGHT`, `QUOTE=author`, `SPOILER=title`, `CODE`/`PHP`/`HTML`/`SRC`,
  `PLAIN`, `PRICE`, `HR`, `BUTTON`, вложенные одинаковые теги.
- Клиент и сервер сохраняют нативные block-классы/стили для quote, spoiler и
  выравнивания; копирование возвращает соответствующий BBCode.
- Индикатор сокета No Rules теперь виден рядом с названием комнаты и по
  клику открывает нативную отладочную модалку с WebSocket/auth/history/outbox.
- Возврат в No Rules больше не теряет пункт бокового меню после переключения
  на нативную комнату; состояние скролла комнаты сохраняется.
- Сервер и extension: `1.1.21`.

## 1.1.20

- Надёжное восстановление после обрыва: `message.send` хранится в outbox
  до подтверждения `message.new`, переживает F5 и переподключение.
- Идемпотентный replay по `clientId`: сервер возвращает уже созданное
  сообщение до списания rate-limit токена.
- Автоматический retry при `rate_limited` с `retryAfterMs`; пачка
  сообщений после offline разбирается без ручного «Повторить».
- `history after=0` для пустой комнаты: после reconnect не теряются
  входящие сообщения, если `lastMessageId` ещё `0`.
- Сброс локального history-cache при `invalid_session`/`token_expired`
  после пересоздания БД; сброс зависшего `historyLoading` при обрыве и
  ошибках history.
- Курсор истории двигается и по удалённым сообщениям, поэтому страница
  из одних deleted-строк не запрашивается повторно.
- `broadcast` больше не отправляет сообщения неавторизованным сокетам.
- Сервер и extension: `1.1.20`.

## 1.1.19

- Firefox/Tampermonkey: `fetch`/WebSocket через page-context, абсолютные URL.
- `ALLOW_MISSING_ORIGIN`: `Origin: null` от content-script принимается как
  missing origin, auth по-прежнему требует read-JWT и `ACCESS_KEY`.

## 1.1.17

- Backend auth принимает только read/chatbox JWT и отклоняет scope `post`;
  `basic post`-токен для `/editor/unfurl` остаётся client-side и на backend
  не отправляется.

## 1.1.16

- Нативный fancybox для фотографий: «голые» `<img>` оборачиваются в
  `a.LbTrigger` с `data-fancybox="gallery"`; аватары, смайлы и картинки
  внутри карточек не трогаются.
- Нативное поведение одиночного смайла: ровно один `.mceSmilie` в сообщении
  получает `mceSmilieLarge` 96×96; несколько смайлов или смайл с текстом —
  без изменений.
- Документация: полный README, EXTENSION, BACKEND, NATIVE-CHATBOX, BBCode,
  CHANGELOG.

## 1.1.15

- Legacy-карточка аккаунта `lzt.market`: `unfurlContainer.marketItem`,
  `categoryIcon <category>`, `title`, `price`, `Value`, `LinkClicker`.
- Plain URL и `[UNFURL="..."]...[/UNFURL]` для market/accounts.
- BBCode parser: `[IMG]`, `[MEDIA]`, `[UNFURL]`, `[URL]`, `[B/I/U/S]`,
  `[CODE]`, `[QUOTE]`, `[VIDEO]`, `[USER]`.
- BBCode copy: `[UNFURL]`, `[MEDIA]`, `[IMG]`, `[URL]`, `[USER]`.
- `price`/`Value` добавлены в серверный и клиентский allowlist.
- Старые «голые» market-ссылки hydrate-ятся через `/editor/unfurl`.

## 1.1.14

- `ArrowUp` в пустом редакторе открывает редактирование последнего своего
  сообщения в активной комнате.
- Инкрементальный рендер сообщений: unchanged DOM-узлы переиспользуются по
  `messageRenderKey`.
- Видео-плеер больше не пересоздаётся при каждом новом сообщении: нет
  спиннера/перезагрузки/сброса `currentTime`.

## 1.1.13

- Poster для видео в нативном плеере (`.webp` для nztcdn).
- `XenForo.activate` для новых видео-сообщений после F5.

## 1.1.12

- Нативный XenForo video player: `.aspect.lztng-tn70wf`,
  `[data-lzt-video-player]`, controls/playbar/fullscreen.
- Видео в редакторе — muted autoplay.
- Reply bar/зелёный reply — HTML5 controls + poster.
- Fixed video layout jitter (`:has(video)` column + fixed preview size).

## 1.1.11

- Нативный `.chat2-error` вместо кастомного connection banner.
- Абсолютные строковые URL для `/login/generate-temporary-token` и
  `/members/find` — Firefox/Tampermonkey sandbox.
- Fallback `#no-rules-messages` после retry, если Svelte удалил native
  messages.
- `@namespace` возвращён на `https://lolz.team/no-rules` для обновлений.

## 1.1.10

- Первый Firefox-auth fix: absolute page fetches.
- Native connection error UI.
- Документация про удаление старых копий.

## 1.1.9

- Native `.chat2-error`.
- Absolute URL string fix (не URL-объект, иначе форумный `fetch` падает).

## 1.1.8

- Reply HTML полностью сохраняется (`reply_html`, schema 5).
- Mention/unfurl/media preserving in replies.
- Server version 1.1.8.

## 1.1.0–1.1.7

- Нативные шаблоны Svelte Chatbox, контекстное меню, reply/edit bars,
  typing, online modal, floating widget.
- Mentions, media cards, unfurl cards, BBCode copy.
- Bun WebSocket backend, SQLite, auth via forum token, sessions, rate limits,
  sanitizer, antibot.
- Systemd/nginx production, no Docker.
