# No Rules — комната внутри Chatbox Lolzteam

Полноценная приватная комната **No Rules** внутри нативного Chatbox
Lolzteam + собственный WebSocket-бэкенд. Userscript не заменяет нативные
комнаты, а добавляет пятый пункт в боковое меню и использует те же Svelte-
классы, Tiptap, reply/edit-бары, контекстное меню, скролл, мобильные жесты,
fancybox и XenForo video player.

- Публичный сервер: `wss://lztws.d9v.uk/ws`
- Health: <https://lztws.d9v.uk/health>
- Version: <https://lztws.d9v.uk/version>
- Userscript:
  <https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js>
- Репозиторий: <https://github.com/9sx77ssl/lzt-no-rules>
- Текущая версия: **1.1.17**

> No Rules — не замена приватных чатов и не E2E-шифрование. Сообщения
> лежат в SQLite на сервере и доступны администратору сервера. Пароль,
> cookies и платёжные данные на сервер **не отправляются**.

## Содержание

- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Структура репозитория](#структура-репозитория)
- [Установка userscript](#установка-userscript)
- [Локальный backend](#локальный-backend)
- [Сборка и релиз](#сборка-и-релиз)
- [Нативные интеграции](#нативные-интеграции)
- [BBCode](#bbcode)
- [Документация](#документация)
- [Тесты](#тесты)
- [Troubleshooting](#troubleshooting)

## Возможности

### Комната и UI

- Пункт **No Rules** в нативном боковом меню Chatbox.
- Прямой переход `https://lolz.team/chatbox/#no-rules` и восстановление
  комнаты после F5.
- Работа в full chat `/chatbox/` и в плавающем виджете на любой странице
  (`lolz.team`, `lolz.live`, `lolz.guru`, `zelenka.guru`).
- Нативные `chat2-message-group`, `chat2-message`, `chat2-message-block`,
  разделители дней, аватары, цвета/градиенты ников.
- Контекстное меню: `message-actions` / `menu` / `action`, правый клик,
  long-press, свайп.
- Reply-бар `chat2-replying`, edit-бар `chat2-message-editing`.
- Удаление без подтверждения и без tombstone, как в нативном чате.
- Индикатор typing с нативной анимацией, резерв 31 px.
- Online-модалка с участниками No Rules и нативными счётчиками:
  симпатии, симпатии 2, сообщения, трофеи, конкурсы.
- Нативный `chat2-socket-state` и retry.

### Сообщения

- Отправка, edit, delete, reply, mention, история, unread, кнопка «новые
  сообщения».
- **ArrowUp** в composer открывает редактирование последнего своего
  сообщения в текущей комнате (как в нативном Chatbox).
- Reply сохраняет **100% HTML**: изображения, видео, embeds, unfurl,
  mentions.
- Plain `@ник` резолвится через `POST /members/find` в нативный mention с
  аватаркой и SVG-иконкой; свой ник получает `highlight`.
- Optimistic send, outbox при обрыве, повторная отправка, `clientId`.
- **Одинаковые сообщения разрешены**: два одинаковых текста подряд дают два
  сообщения; дедупликация только по `clientId`.

### Нативные карточки

- Форумные разделы и темы: `.unfurl-renderer` / `.forum-wrapper`.
- YouTube, SoundCloud, TikTok, Spotify, Twitch и т.д.: `.embed-link`.
- Market/аккаунты: legacy `.unfurlContainer.marketItem` с иконкой категории,
  названием и ценой.
- `[UNFURL]`, `[IMG]`, `[MEDIA]`, `[URL]`, `[B/I/U/S]`, `[CODE]`,
  `[QUOTE]`, `[VIDEO]`, `[USER]`.
- Автоматический unfurl голых ссылок через `POST /editor/unfurl`, если
  Tiptap не успел собрать карточку.
- Нативный fancybox при клике на фото.
- Нативный XenForo-плеер для видео; в редакторе — muted autoplay; в
  reply-баре — HTML5 `controls`.
- Одиночный смайл в сообщении — 96×96 (`mceSmilieLarge`), несколько
  смайлов или смайл с текстом — обычный размер.

### Копирование

Правый клик → «Скопировать текст» отдаёт BBCode:

```bbcode
[UNFURL="https://lzt.market/266223421/"]https://lzt.market/266223421/[/UNFURL]
[IMG]https://nztcdn.com/files/....webp[/IMG]
[MEDIA=youtube]https://www.youtube.com/watch?v=...[/MEDIA]
[URL=https://lolz.team/forums/contests]Розыгрыши[/URL]
[USER=9252369]@yolo[/USER]
[B]жирный[/B] [I]курсив[/I]
```

### Безопасность и сеть

- Auth через временный токен форума (`/login/generate-temporary-token`).
- Opaque session token; в БД только SHA-256.
- Rate limit, antibot, Origin allowlist, WS payload limit.
- Серверный и клиентский HTML-санитайзеры.
- Все медиа — только `https` и разрешённые хосты.
- **Никаких собственных toast-уведомлений** — только `console.debug`.

## Архитектура

```text
Браузер (lolz.team)
  userscript (page context)
    ├─ нативный Chatbox DOM / Svelte CSS / Tiptap
    ├─ temporary forum token  ──► /login/generate-temporary-token
    ├─ mention lookup         ──► /members/find
    ├─ unfurl metadata        ──► api.lolz.team/editor/unfurl
    └─ WebSocket              ──► wss://lztws.d9v.uk/ws
                                      │
                                 nginx (TLS, Cloudflare real IP)
                                      │
                                 Bun + ws + SQLite
                                      │
                                 systemd no-rules.service
```

- Userscript не доверяет имени из DOM: identity подтверждается токеном на
  сервере.
- Сервер не хранит cookies форума и не действует от имени аккаунта.
- Backend: Bun 1.4 (Node 20 fallback), `ws`, `bun:sqlite`/
  `better-sqlite3`, `sanitize-html`, `cheerio`.
- Production: nginx + Let's Encrypt + systemd, без Docker.

Подробно: [ARCHITECTURE.md](docs/ARCHITECTURE.md),
[BACKEND.md](docs/BACKEND.md), [EXTENSION.md](docs/EXTENSION.md).

## Структура репозитория

```text
.
├── README.md
├── .env.example
├── .gitignore
├── docs/
│   ├── README.md              индекс документации
│   ├── ARCHITECTURE.md        общая архитектура
│   ├── EXTENSION.md           userscript internals
│   ├── BACKEND.md             Bun/Node server, DB, protocol
│   ├── NATIVE-CHATBOX.md      результаты реверса форума
│   ├── BBCode.md              BBCode и copy
│   ├── PROTOCOL.md            WebSocket wire format
│   ├── SECURITY.md            модель угроз
│   ├── DEPLOYMENT.md          production
│   ├── TESTING.md             тесты и чек-листы
│   └── CHANGELOG.md
├── extension/
│   ├── src/
│   │   ├── 00-core.js         state, DOM, sanitizer, market/BBCode
│   │   ├── 10-ui.js           шаблоны, CSS, меню, видео, lightbox, смайлы
│   │   ├── 20-messages.js     рендер, send/reply/edit/delete, ArrowUp
│   │   ├── 30-ws.js           auth/resume, WS, heartbeat, history
│   │   ├── 40-main.js         boot, активация, listeners
│   │   └── header.txt         metadata userscript
│   └── dist/no-rules.user.js  собранный production userscript
├── scripts/
│   └── build-extension.mjs    сборка одного файла
├── server/
│   ├── src/                   backend
│   ├── tests/                 20 unit tests
│   ├── package.json
│   └── bun.lock
└── deploy/
    ├── no-rules.service
    ├── nginx-lztws.d9v.uk.conf
    └── update.sh
```

`research/chatbox/javascript/` содержит сохранённые third-party JS-чанки
Chatbox, которые использовались для реверса. Сетевые дампы, DOM-снимки и
antibot-файлы не коммитятся: в них могут быть токены/cookies. Все выводы
перенесены в [NATIVE-CHATBOX.md](docs/NATIVE-CHATBOX.md), а сами чанки лежат
в [research/README.md](research/README.md).

## Установка userscript

1. Установите Tampermonkey (Chrome/Chromium/Edge/Firefox) или Violentmonkey
   (Firefox/Chrome).
2. Откройте raw-ссылку:
   <https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js>
3. Подтвердите установку.
4. Откройте `https://lolz.team/chatbox/`, боковое меню → **No Rules**.
5. При первом входе форум выдаст короткоживущий токен.

### Важно для Firefox/Tampermonkey

- В Tampermonkey должна быть **одна** копия No Rules. Старые версии
  (`1.0.1`, `1.1.8`, копии с другим `@namespace`) нужно удалить: они
  конфликтуют, рисуют старый баннер и мешают auth.
- После установки проверьте `@version` в Dashboard — текущая **1.1.17**.
- Если raw ещё кешируется, обновите страницу/подождите несколько минут;
  `@updateURL`/`@downloadURL` указывают на `main`.
- Userscript использует абсолютные URL и строковый `fetch`: форумный
  `window.fetch` в Firefox не принимает `URL`-объекты.

## Локальный backend

Нужен Bun 1.2+ (рекомендуется 1.4):

```bash
git clone https://github.com/9sx77ssl/lzt-no-rules.git
cd lzt-no-rules
cp .env.example ../.env
# отредактировать ACCESS_KEY, ALLOWED_USER_IDS, DB_PATH
cd server
bun install
bun run start
```

Проверка:

```bash
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8787/version
```

`ACCESS_KEY` должен совпадать с ключом, встроенным в userscript при сборке.
`ALLOWED_USER_IDS` пустой = доступ всем, у кого есть ключ и валидный токен.

## Сборка и релиз

```bash
cd server && bun install && cd ..
NR_VERSION=1.1.17 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
bun scripts/build-extension.mjs

node --check extension/dist/no-rules.user.js
cd server && bun test
```

Публикация:

```bash
git add -A
git commit -m "..."
git push origin main
ssh new-server '/opt/no-rules/update.sh'
```

`update.sh` делает `git pull`, `bun install --production`, restart systemd,
проверяет `/health` и откатывается на предыдущий commit при ошибке.

Проверка raw после пуша:

```bash
curl -fsSL \
  'https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js' \
  -o /tmp/raw.user.js
sha256sum extension/dist/no-rules.user.js /tmp/raw.user.js
grep -n '@version' /tmp/raw.user.js
```

## Нативные интеграции

### Фото

`prepareLightboxImages` оборачивает обычный `<img>` в нативный
`a.LbTrigger[data-fancybox=gallery]`; клик открывает fancybox, а не новую
вкладку. Аватары, смайлы, картинки внутри unfurl/embed и video poster не
трогаются.

### Видео

`XenForo.activate(container)` монтирует нативный плеер
`[data-lzt-video-player]` внутри `.aspect.lztng-tn70wf`: play/pause,
прогресс, громкость, fullscreen, poster.

- После F5 плеер монтируется заново.
- При новых сообщениях DOM видео переиспользуется, поэтому плеер не
  перезагружается и не показывает спиннер.
- В редакторе preview autoplay + muted.
- В reply-баре — обычный HTML5 `<video controls poster>`.

### Смайлы

Если в сообщении ровно один `.mceSmilie` и нет другого значимого контента,
добавляется `mceSmilieLarge` (96×96). Если смайлов два/несколько или есть
текст — ничего не меняется.

### Market/аккаунты

Plain `https://lzt.market/266223421/` или
`[UNFURL="..."]...[/UNFURL]` превращается в legacy-карточку:

- `categoryIcon` нужной категории;
- title;
- price (`7 932 ₽`);
- `a.LinkClicker`.

Метаданные берутся из `api.lolz.team/editor/unfurl` с Bearer-токеном
`basic post`, который выдаёт форум.

## BBCode

Полный разбор: [docs/BBCode.md](docs/BBCode.md). Поддерживаются:

- `[B]`, `[I]`, `[U]`, `[S]`, `[CODE]`, `[QUOTE]`;
- `[URL=...]...[/URL]`;
- `[IMG]...[/IMG]`;
- `[MEDIA=youtube|soundcloud|...]...[/MEDIA]`;
- `[VIDEO]...[/VIDEO]`;
- `[UNFURL="..."]...[/UNFURL]`;
- `[USER=id]@nick[/USER]`.

BBCode обрабатывается перед отправкой и при рендере старых сообщений.
Копирование возвращает BBCode, а не plain text.

## Документация

- [docs/README.md](docs/README.md) — индекс.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура.
- [docs/EXTENSION.md](docs/EXTENSION.md) — userscript.
- [docs/BACKEND.md](docs/BACKEND.md) — server/db/protocol.
- [docs/NATIVE-CHATBOX.md](docs/NATIVE-CHATBOX.md) — reverse engineering.
- [docs/BBCode.md](docs/BBCode.md) — BBCode.
- [docs/PROTOCOL.md](docs/PROTOCOL.md) — WebSocket.
- [docs/SECURITY.md](docs/SECURITY.md) — безопасность.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production.
- [docs/TESTING.md](docs/TESTING.md) — тесты.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — версии.

## Тесты

```bash
# статические
for f in extension/src/*.js; do node --check "$f"; done
node --check extension/dist/no-rules.user.js

# backend
cd server
bun test        # 20 tests
npm test        # Node fallback

# production health
curl -fsS https://lztws.d9v.uk/health
curl -fsS https://lztws.d9v.uk/version
```

Playwright-сценарии (полный список — [docs/TESTING.md](docs/TESTING.md)):

- Chromium desktop/mobile;
- Firefox;
- full chat + floating widget;
- F5, hash, history, offline outbox;
- send/edit/delete/reply/mention;
- видео (плеер, F5, новые сообщения, reply);
- lightbox и smilie;
- BBCode/market/account cards;
- ArrowUp edit last;
- copy to BBCode;
- отсутствие `pageerror`.

## Troubleshooting

### Не появляется No Rules

- Проверьте, что скрипт включён и матчится на текущий домен.
- Удалите старые копии No Rules в Tampermonkey.
- Обновите страницу с `Ctrl+Shift+R`.
- В Firefox проверьте консоль на CSP/sandbox ошибки.

### «Нет связи с форумом»

- Проверьте `/health` и вход на форум.
- В Firefox обновите userscript до 1.1.16+ (абсолютные fetch URL).
- Нажмите на нативный `.chat2-error` — он повторяет auth.

### Видео показывает только первый кадр

- Обновите до 1.1.16: плеер монтируется через `XenForo.activate`.
- Не должно быть двух копий userscript.
- Откройте консоль: `XenForo` должен быть объектом, `.video` — внутри
  `#no-rules-messages`.

### Фото не открывается

- Обновите до 1.1.16: bare `<img>` оборачивается в `LbTrigger`.
- Проверьте, что fancybox не блокируется другим расширением.

### Смайл не увеличивается

- Должен быть **ровно один** `.mceSmilie` и никакого другого текста.
- Несколько смайлов специально не увеличиваются.

### Аккаунт без цены/иконки

- `/editor/unfurl` мог не ответить; блок останется ссылкой/карточкой без
  метаданных.
- Проверьте, что форум выдал `basic post` token.

## Ограничения

- Нет E2E-шифрования.
- Нет push-уведомлений о сообщениях No Rules (только native browser
  notification при разрешении).
- Нет полноценного XenForo BBCode-парсера (только перечисленные теги).
- Нет Docker: production на systemd.
- Сетевые дампы/DOM-снимки и Playwright storage state не коммитятся; JS-чанки для реверса — в `research/chatbox/javascript/`.

## Автор

gay1234 / [9sx77ssl](https://github.com/9sx77ssl)
