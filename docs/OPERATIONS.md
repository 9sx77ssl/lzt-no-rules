# No Rules: backend, protocol, security, deploy

Этот документ — основной справочник по серверу, WebSocket-протоколу, базе,
безопасности, деплою и тестам. Extension и нативный DOM —
в [`PROJECT.md`](PROJECT.md). История версий — в
[`CHANGELOG.md`](CHANGELOG.md).

## 1. Стек и структура

Сервер — отдельный процесс Bun/Node без Docker. Production: systemd
`no-rules.service`, nginx TLS proxy, SQLite в WAL. Origin слушает только
`127.0.0.1:8787`; наружу — nginx 443.

- Bun 1.4.x (production) / Node 20+ (fallback/tests);
- `ws` — WebSocket;
- `bun:sqlite` (Bun) или `better-sqlite3` (Node);
- `sanitize-html` + `cheerio` — HTML;
- `dotenv`;
- nginx + Let's Encrypt;
- systemd.

```text
server/src/
  index.js       загрузка config/logger/db/auth/ws/http
  config.js      env, лимиты, origins, rate
  http.js        /health, /version, TLS/HTTP server
  ws.js          handshake, auth/resume, все кадры
  auth.js        forum JWT, sessions, access key
  db.js          схема, миграции, prepared statements
  sanitize.js    HTML/style/username SVG allowlist
  ratelimit.js   TokenBucket, RateLimiter
  antibot.js     защита auth от автоматических клиентов
  protocol.js    JSON frame parsing и лимиты
  logger.js      JSON-логи
server/tests/    unit-тесты (26)
```

## 2. HTTP

```text
GET /health
{
  "ok": true,
  "name": "no-rules-chat",
  "version": "1.3.4",
  "protocol": 1,
  "uptime": 123,
  "online": 2,
  "messages": 240,
  "time": 1792960000000
}

GET /version
{
  "name": "no-rules-chat",
  "version": "1.3.4",
  "protocol": 1,
  "publicUrl": "wss://lztws.d9v.uk/ws"
}
```

WebSocket: `/ws` (и `/`). Handshake проверяет `Origin` по
`ALLOWED_ORIGINS`; при `TRUST_PROXY=1` берёт реальный IP из
`X-Forwarded-For`/Cloudflare и валидирует заголовок. CORS preflight разрешён
только для allowlist-хостов.

## 3. Протокол

Версия протокола: **1**. Клиент и сервер: **1.3.4**. Транспорт — WebSocket,
текстовые кадры JSON.

### Подключение

1. Клиент открывает WebSocket.
2. Сервер присылает `hello`:

```json
{"type":"hello","protocol":1,"version":"1.3.4","roomTitle":"No Rules","serverTime":1792946496011}
```

3. Клиент отправляет `auth` (первый вход) или `resume` (есть сессия).

### auth

```json
{
  "type": "auth",
  "token": "<temporary forum JWT>",
  "accessKey": "<shared extension key>",
  "clientVersion": "1.3.4"
}
```

Сервер проверяет токен через `https://api.lolz.team/users/:id`, сверяет
`ACCESS_KEY`, при необходимости `ALLOWED_USER_IDS`, создаёт/обновляет
пользователя и возвращает:

```json
{
  "type": "auth.ok",
  "protocol": 1,
  "user": {
    "id": 424242,
    "username": "test_user",
    "usernameHtml": "<span class=\"styleUserNickname\">test_user</span>",
    "avatar": "https://nztcdn.com/avatar/s/...",
    "color": "#949494",
    "profileUrl": "https://lolz.team/members/424242/"
  },
  "session": "<opaque session token>",
  "expiresAt": 1795538496011,
  "online": 1,
  "users": [],
  "serverTime": 1792946496011
}
```

`session` сохраняется в `localStorage` под ключом
`lzt.no-rules.session.v1`. На сервере лежит только SHA-256 от него.

### resume

```json
{"type":"resume","session":"<session token>","accessKey":"...","clientVersion":"1.3.4"}
```

Ответ такой же `auth.ok`; поле `resumed` есть только в логах сервера.
Просроченная/неизвестная сессия → `auth.error` с `invalid_session` или
`session_expired`; клиент стирает сессию и получает новый временный токен.
`is_banned` проверяется и при resume.

### Ошибки авторизации

```json
{"type":"auth.error","code":"forbidden","message":"...","retryAfterMs":0}
```

Коды: `bad_request`, `invalid_token`, `token_expired`, `invalid_session`,
`session_expired`, `forbidden`, `not_allowed`, `banned`, `rate_limited`,
`forum_unavailable`, `auth_failed`.

### История

```json
{"type":"history","limit":60}
{"type":"history","before":123,"limit":50}
{"type":"history","after":456,"limit":100}
{"type":"history","after":0,"limit":100}
{"type":"history","near":123,"limit":60}
```

Ответ:

```json
{
  "type": "history",
  "messages": [],
  "hasMore": true,
  "hasMoreBefore": null,
  "hasMoreAfter": null,
  "before": null,
  "after": null,
  "near": null,
  "limit": 60,
  "requestId": null,
  "serverTime": 1792946496011
}
```

- Без `before`/`after`/`near` — последние `limit` сообщений.
- `before` — старые, `after` — новые (догон после reconnect). `after=0`
  означает начало сохранённого потока и нужен для пустой комнаты.
- `near` — компактное окно вокруг сообщения для перехода из reply;
  `hasMoreBefore`/`hasMoreAfter` говорят, можно ли догружать.
- `limit` ограничен `MAX_HISTORY_PAGE_SIZE` (100). Клиент грузит по 60 при
  старте и по 50 при скролле вверх.

### Отправка

```json
{
  "type": "message.send",
  "clientId": "u_1729_ab12cd34",
  "html": "<p>Привет</p>",
  "replyTo": 123
}
```

`clientId` — 8–64 символа `[A-Za-z0-9_-]`. Сервер дедуплицирует по паре
`(user_id, clientId)`: повторный кадр возвращает то же сообщение с
`duplicate: true` и не создаёт новое. Два разных сообщения с одинаковым
текстом разрешены.

Ответ автору:

```json
{"type":"message.new","message":{},"clientId":"...","ack":true,"serverTime":1792946496011}
```

Остальным — `message.new` без `clientId/ack`.

Ограничения: HTML ≤ 12 000, текст ≤ **512 code points** (жёсткий лимит,
`MAX_MESSAGE_TEXT` можно только уменьшить), кадр ≤ 64 KiB, изображений ≤ 4,
ссылок ≤ 5, упоминаний ≤ 8, переводов строк ≤ 30. Внешние картинки по
умолчанию запрещены (`ALLOW_EXTERNAL_IMAGES=0`), разрешены `nztcdn.com` и
форумные хосты из allowlist. `too_long` возвращается и для `message.send`,
и для `message.edit`; клиент показывает нативный `.chat2-error`
«Максимум 512 символов.».

### Редактирование и удаление

```json
{"type":"message.edit","id":123,"html":"<p>Новый текст</p>"}
{"type":"message.delete","id":123}
```

Сервер проверяет автора или `ADMIN_USER_IDS`. Ответ — broadcast:

```json
{"type":"message.edit","message":{},"serverTime":1792946496011}
{"type":"message.delete","id":123,"message":{},"serverTime":1792946496011}
```

Удаление мягкое: сообщение остаётся в БД с `deleted_at/deleted_by`, клиент
показывает «Сообщение удалено». Редактировать удалённое нельзя.

### Прочие кадры

| Клиент | Сервер | Назначение |
|---|---|---|
| `{"type":"typing"}` | `{"type":"typing","user":{"id","username"}}` | индикатор набора |
| `{"type":"presence"}` | `{"type":"presence","online":N,"users":[]}` | запрос/рассылка онлайна |
| `{"type":"message.report","id":123,"reason":"..."}` | `{"type":"report.ok","id":123}` | жалоба |
| `{"type":"ping","t":...}` | `{"type":"pong","t":...}` | heartbeat |
| — | `{"type":"system","message":"..."}` | системное сообщение |

Ошибка:

```json
{"type":"error","code":"rate_limited","message":"...","retryAfterMs":1234,"clientId":"...","messageId":123}
```

`clientId`/`messageId` позволяют клиенту снять optimistic-состояние и
показать ошибку у конкретного сообщения.

### Модель сообщения

```json
{
  "id": 42,
  "user": {
    "id": 424242,
    "username": "test_user",
    "usernameHtml": "<span class=\"styleUserNickname\">test_user</span>",
    "avatar": "https://nztcdn.com/avatar/s/...",
    "color": "#949494",
    "profileUrl": "https://lolz.team/members/424242/"
  },
  "html": "<p>Текст</p>",
  "text": "Текст",
  "deleted": false,
  "createdAt": 1792946496011,
  "editedAt": null,
  "clientId": "u_...",
  "reply": {
    "id": 41,
    "user": {"id":424242,"username":"test_user","usernameHtml":"...","color":"#949494"},
    "text": "Цитата",
    "html": ""
  },
  "meta": {"images":0,"links":0,"mentions":0}
}
```

`html` уже прошёл серверный санитайзер; клиент дополнительно прогоняет его
через свой sanitizer перед вставкой в DOM.

### Переподключение

- Heartbeat: клиент шлёт `ping` каждые 25 с; если 75 с нет `pong`, закрывает
  сокет.
- После `close` — exponential backoff (1–30 с), затем `resume`.
- Если `resume` отклонён, клиент получает новый временный токен и делает
  `auth`.
- После `auth.ok` история догоняется через `history` с `after`; `after=0`
  допустим.
- Если соединение пропало, `message.send` кладётся в outbox, переживает F5
  (`localStorage`) и отправляется после `auth.ok`; дедупликация по
  `clientId` защищает от повторов. Сервер проверяет `clientId` до
  rate-limit, чтобы replay не расходовал токены.
- `rate_limited` для `message.send` содержит `clientId` и `retryAfterMs`;
  клиент оставляет сообщение в outbox и повторяет автоматически.

### Онлайн

`presence` и `auth.ok` содержат `users` — уникальные авторизованные
подключения (по `user.id`), а не количество сокетов. Поля: `id`,
`username`, `usernameHtml`, `avatar`, `color`, `profileUrl`, `stats`
(`likes`, `likes2`, `messages`, `trophies`, `contests`). Токены и cookies
в список не попадают.

## 4. База

SQLite (`DB_PATH`, WAL). Схема создаётся/мигрирует автоматически.
`PRAGMA user_version = 6`.

### users

```sql
user_id INTEGER PRIMARY KEY,
username TEXT NOT NULL,
username_html TEXT,
avatar_url TEXT,
color TEXT,
is_banned INTEGER NOT NULL DEFAULT 0,
stats TEXT,
stats_updated_at INTEGER,
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL,
last_seen_at INTEGER
```

`stats` — JSON `{likes, likes2, messages, trophies, contests}`. `is_banned`
проверяется при resume, чтобы забаненный не жил на старой сессии.

### sessions

```sql
token_hash TEXT PRIMARY KEY,
user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
created_at INTEGER NOT NULL,
expires_at INTEGER NOT NULL,
last_used_at INTEGER NOT NULL
```

Хранится только SHA-256 opaque session token. TTL — `SESSION_TTL_DAYS`
(30 по умолчанию), лимит на пользователя — `MAX_SESSIONS_PER_USER`.

### messages

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id, username, username_html, avatar_url, color,
html TEXT NOT NULL DEFAULT '',
text TEXT NOT NULL DEFAULT '',
reply_to INTEGER,
reply_user_id, reply_username, reply_username_html, reply_color,
reply_text, reply_html,
client_id TEXT,
created_at INTEGER NOT NULL,
edited_at INTEGER,
deleted_at INTEGER,
deleted_by INTEGER,
meta TEXT
```

Индексы: `(user_id, client_id)` unique, `created_at`, `reply_to`.
`reply_html` хранит полный HTML исходного сообщения (схема 5), поэтому reply
не теряет картинки/видео/unfurl/mentions.

### reports

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
message_id INTEGER REFERENCES messages(id),
reporter_user_id INTEGER REFERENCES users(user_id),
reason TEXT NOT NULL,
created_at INTEGER NOT NULL
```

### Миграции

`openDatabase` читает `PRAGMA user_version`; миграции идемпотентны.
Не сбрасывать production DB. `reply_html` появился в версии 5; старые
сообщения backfill-ятся из `reply_text`/HTML, если возможно. Версия 6
добавила `users.is_banned`. Перед миграцией делать backup через
`sqlite3 .backup`.

## 5. Auth и безопасность

### Что уходит на сервер

Userscript отправляет на `wss://lztws.d9v.uk/ws` только:

- временный токен форума (`POST /login/generate-temporary-token`, scope
  `read`/`chatbox`);
- отдельный короткоживущий `basic post` токен используется **только**
  локально для `/editor/unfurl` и на сервер не отправляется;
- собственный session token сервера;
- общий `ACCESS_KEY` расширения;
- текст/HTML сообщений, `clientId`, `replyTo`, id edit/delete;
- версию клиента, heartbeat, typing, presence, report.

**Не отправляются:** пароль, cookies форума, `_xfToken`, `xf_session`,
`xf_user`, CSRF-токены (кроме локального запроса к форуму), IP-адрес
клиента (сервер видит его сам через Cloudflare/nginx), данные платежей.

Временный токен живёт ограниченное время и проверяется через
`https://api.lolz.team/users/:id`. Сервер не может выдать себя за
пользователя: у него нет cookies и он не вызывает действия от имени
аккаунта. Локально userscript хранит session token, черновик и outbox в
`localStorage` (`lzt.no-rules.*`). Это не E2E: содержимое сообщений всё
равно сохраняется на сервере.

### Проверка личности

1. Клиент получает CSRF из нативной формы/мета.
2. `POST /login/generate-temporary-token` с cookies (`credentials: include`)
   и `scope[]=read`.
3. Сервер декодирует JWT (без доверия клиентскому username), проверяет
   `iss`, `sub`, `exp`, scope (`read`/`chatbox`), затем `GET
   https://api.lolz.team/users/:id` с `Authorization: Bearer`.
4. Создаёт/обновляет `users`, выдаёт session token (только hash в БД).
5. `ALLOWED_USER_IDS`, ban/staff проверки.
6. Все последующие кадры привязаны к `ws.user`, а не к данным клиента.

Токен нигде не логируется. В логах — только `userId`, IP, код ошибки,
задержка.

### Модель угроз

| Угроза | Защита |
|---|---|
| Подделка имени/аватара в DOM | identity из проверенного токена, не из клиентских полей |
| Токен без read/chatbox scope | JWT должен явно содержать `read` или `chatbox`; `post`/пустой scope отклоняются |
| Трекеры через `data-*`/SVG/стили | URL-атрибуты только http(s), SVG-анимации удалены, `url(...)` в inline-style вырезается |
| Забаненный с готовой сессией | `users.is_banned` проверяется при resume |
| Чужой Origin на HTTP | preflight только для `ALLOWED_ORIGINS` |
| Кража session token | в БД только SHA-256, opaque, TTL 30 дней, отзыв удалением сессии |
| Перебор/спам | `ACCESS_KEY`, rate limit по user id/IP, auth timeout, dedupe по clientId |
| XSS в сообщениях | серверный `sanitize-html` + клиентский sanitizer, allowlist тегов/атрибутов/классов/стилей |
| Подмена картинок/трекеров | только `nztcdn.com` и форумные хосты, внешние картинки по умолчанию выключены |
| Огромные сообщения/флуд | лимиты HTML/текста/байтов, `maxPayload`, rate limit |
| Чужие правки/удаления | `message.user.id === ws.user.id` или `ADMIN_USER_IDS` |
| Подделка Origin | `ALLOWED_ORIGINS`; Firefox `Origin: null` трактуется как missing origin, но auth всё равно требует read-JWT |
| Утечка секретов в git | `.gitignore`, `.env` только на сервере, в репозитории `.env.example` |

`ACCESS_KEY` **не является** границей безопасности: он встроен в публичный
userscript и может быть извлечён. Его задача — отсечь случайные/чужие
WebSocket-клиенты и уменьшить шум. Настоящая авторизация — форумный токен.

Список online (`presence.users`) содержит только публичные поля профиля.
Токены, cookies и `_xfToken` в него не попадают.

### Санитайзинг

`server/src/sanitize.js`:

- allowlist тегов: p, br, strong/b, em/i, u, s, code, pre, blockquote,
  ul/ol/li, hr, sub/sup, a, img, span, div, abbr, video/source, username SVG;
- атрибуты: `href`, `src`, `alt`, `title`, `class`, `style` и только нужные
  `data-*`;
- схемы: `http`, `https`, `mailto`; для `img`/`video`/`source` — только
  `https`;
- классы: allowlist + regex `node\d+`, `category--*`, `Av\d+s`, `lztng-*`,
  `style\d+`;
- стили: цвет/градиент/тень/фон/`white-space` с regex; `url(...)`
  вырезается;
- username SVG: отдельный allowlist тегов/атрибутов; `script/style/
  foreignObject/use/image` удаляются; `animate` только для безопасных
  атрибутов;
- удаляются `script`, `style`, `iframe`, `object`, `embed`, обработчики
  событий, `javascript:`/`data:` URL, лишние tooltip-атрибуты;
- лимиты: 12 000 HTML, 512 текста (жёстко), 4 img, 5 ссылок, 8 упоминаний,
  30 переводов строк;
- медиа: `nztcdn.com` + форумные хосты (или `ALLOW_EXTERNAL_IMAGES=1`);
- poster — только разрешённые URL; spoiler `data-target` ограничен.

Важные классы для native-блоков: `unfurlContainer`, `marketItem`,
`category--*`, `price`, `Value`, `SvgIcon`, `categoryIcon`, `LbTrigger`,
`bbCodeImage`, `LbImage`, `embed-link`, `forum-wrapper`,
`unfurl-renderer`.

BBCode разбирается в DOM, а не через `innerHTML` пользовательской строки:
`[IMG]`/`[MEDIA]`/`[URL]` создают безопасные элементы, затем HTML всё равно
проходит `sanitizeClientHtml` и серверный sanitize. Market-карточка содержит
только текст/класс/`data-*`. Fancybox — нативный; мы добавляем только
`a.LbTrigger` с проверенными `https` URL. Видео/аудио источники проходят
allowlist.

### Rate limit и антиспам

Token bucket на пользователя:

| Bucket | Default |
|---|---|
| auth | 12 burst, 1/60s |
| message | 8 burst, 1/1.5s |
| typing | 1 burst, 1/3s |
| history | 20 burst, 1/3s |
| edit | 6 burst, 1/2s |
| delete | 6 burst, 1/2s |
| report | 5 burst, 1/10s |

Дополнительно: auth timeout 10 с на соединение, `limit_conn
no_rules_conn 20` на IP в nginx, Cloudflare перед origin. `DuplicateGuard`
не применяется к тексту сообщений: два одинаковых сообщения подряд
разрешены. Лимиты настраиваются через `RATE_*` в `.env`.

### Заголовки и сеть

nginx отдаёт HSTS (2 года, includeSubDomains), `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` без
geolocation/microphone/camera. Origin слушает только `127.0.0.1:8787`.
TLS — Let's Encrypt, Cloudflare Full (strict).

### Логи и данные

- JSON-логи в journald: `journalctl -u no-rules`.
- Сообщения — SQLite (`messages`), удалённые — мягко (`deleted_at`),
  жалобы — `reports`.
- Секреты (`ACCESS_KEY`, TLS-ключи, `.env`) не коммитятся.
- Для полного удаления сообщения нужно чистить БД вручную; админ-интерфейса
  нет.
- IP не пишется в БД; nginx/Cloudflare видят его как любой сайт.

### Ограничения

- Нет E2E-шифрования: сервер видит текст.
- Нет независимого аудита.
- `ADMIN_USER_IDS` — единственная модель модерации.
- Userscript можно модифицировать; сервер валидирует контент, но не может
  гарантировать, что клиент не отправит что-то иное в пределах лимитов.
- Комната не является официальным сервисом Lolzteam.

## 6. Конфиг

См. `.env.example`. Основное:

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
PUBLIC_URL=wss://lztws.d9v.uk/ws
ROOM_TITLE=No Rules
DB_PATH=/opt/no-rules/data/no-rules.db

ACCESS_KEY=<at least 16 random chars>
ALLOWED_USER_IDS=
ADMIN_USER_IDS=

ALLOWED_ORIGINS=https://lolz.team,https://lolz.live,https://lolz.guru,https://zelenka.guru
TRUST_PROXY=1
ALLOW_MISSING_ORIGIN=1

SESSION_TTL_DAYS=30
MAX_SESSIONS_PER_USER=20
MAX_MESSAGE_HTML=12000
MAX_MESSAGE_TEXT=512
MAX_MESSAGE_BYTES=65536
ALLOW_EXTERNAL_IMAGES=0
HISTORY_PAGE_SIZE=50
MAX_HISTORY_PAGE_SIZE=100
```

`ACCESS_KEY` — первый фильтр, не аутентификация. Неверный ключ расходует
тот же auth-rate-limit, что и остальные попытки. `ALLOWED_USER_IDS` пустой =
любой форумный аккаунт; для приватной комнаты заполнить. `ADMIN_USER_IDS` —
только для модерации (удаление чужих сообщений).

## 7. TypeScript-проверка

Сервер проверяется через `server/tsconfig.json` (`allowJs` + `checkJs`) и
`npm run typecheck` / `bun run typecheck`. Отдельный
`server/src/bun-sqlite.d.ts` описывает `bun:sqlite`. Это страховка перед
постепенным переносом файлов на `.ts`, без одномоментного переименования.

## 8. Production и деплой

Production-хост задаётся в вашей инфраструктуре; в документации он не
хранится. Домен — `lztws.d9v.uk` за Cloudflare, TLS — Let's Encrypt,
origin — `127.0.0.1:8787`.

### Предварительно

- DNS A/AAAA `lztws.d9v.uk` → IP сервера, Cloudflare proxied.
- Cloudflare SSL/TLS mode: **Full (strict)**.
- Открыты 80/443; 8787 наружу не публикуется.
- Установлены `bun`, `nginx`, `certbot`, `git`, `curl`, `sqlite3`.
- Отдельный системный пользователь `no-rules`.

```bash
useradd --system --home /opt/no-rules --shell /usr/sbin/nologin no-rules
mkdir -p /opt/no-rules/data /var/www/certbot
chown -R no-rules:no-rules /opt/no-rules
```

### Код и зависимости

```bash
git clone https://github.com/9sx77ssl/lzt-no-rules.git /opt/no-rules/app
cd /opt/no-rules/app/server
bun install --production --no-progress
chown -R root:root /opt/no-rules/app
```

Репозиторий публичный, clone/pull не требуют deploy-key.

### Конфиг

```bash
cp /opt/no-rules/app/.env.example /opt/no-rules/.env
chmod 600 /opt/no-rules/.env
chown no-rules:no-rules /opt/no-rules/.env
```

Заполнить:

- `ACCESS_KEY` — 48+ случайных символов; тот же, что при сборке userscript;
- `ADMIN_USER_IDS` — id модераторов (в git не коммитить);
- `DB_PATH=/opt/no-rules/data/no-rules.db`;
- `PUBLIC_URL=wss://lztws.d9v.uk/ws`;
- `TRUST_PROXY=1`.

Сгенерировать ключ:

```bash
openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_'
```

### systemd

`deploy/no-rules.service`: `User=no-rules`, `EnvironmentFile`, `ExecStart=
/usr/local/bin/bun src/index.js`, `Restart=always`, `NoNewPrivileges`,
`ProtectSystem=full`, `ProtectHome=true`, `ReadWritePaths=/opt/no-rules/data`.

```bash
install -m 644 /opt/no-rules/app/deploy/no-rules.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now no-rules
systemctl status no-rules --no-pager
curl -s http://127.0.0.1:8787/health
```

### nginx

`deploy/nginx-lztws.d9v.uk.conf`:

- upstream `no_rules_ws` с keepalive;
- `limit_conn_zone` на IP;
- `map $http_cf_connecting_ip $no_rules_client_ip` — реальный IP из
  Cloudflare;
- HTTP/2 + TLS 1.2/1.3;
- `/ws` — `Upgrade`/`Connection`, `proxy_read_timeout 3600s`,
  `proxy_buffering off`, `proxy_socket_keepalive on`;
- `/health`, `/version`, `/`;
- HSTS и security headers.

```bash
ln -sf /opt/no-rules/app/deploy/nginx-lztws.d9v.uk.conf /etc/nginx/sites-available/lztws.d9v.uk
ln -sf /etc/nginx/sites-available/lztws.d9v.uk /etc/nginx/sites-enabled/lztws.d9v.uk
nginx -t && systemctl reload nginx
```

> В nginx 1.31 нельзя дублировать `ssl_protocols`, `ssl_session_timeout`,
> `ssl_session_cache` рядом с `include options-ssl-nginx.conf` — они уже
> внутри include. Иначе `nginx -t` падает с `duplicate directive`.

### TLS

Сначала HTTP-only block с `/.well-known/acme-challenge/`, затем:

```bash
certbot certonly --webroot -w /var/www/certbot -d lztws.d9v.uk \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring
```

Полный конфиг: `listen 443 ssl; http2 on;`, пути
`/etc/letsencrypt/live/lztws.d9v.uk/{fullchain,privkey}.pem`.

```bash
certbot certificates
curl -sI https://lztws.d9v.uk/health
curl --resolve lztws.d9v.uk:443:<production-ip> -sI https://lztws.d9v.uk/health
```

Certbot renewal timer включён; deploy-hook перезагружает nginx.

### Обновление

```bash
/opt/no-rules/update.sh
```

`deploy/update.sh`:

1. `git fetch --prune origin && git pull --ff-only origin main`;
2. `bun install --production` в `app/server`;
3. `systemctl restart no-rules`;
4. health-check 20 раз; при ошибке — `git reset --hard` на предыдущий commit,
   повторный install и restart.

Ручной вариант:

```bash
cd /opt/no-rules/app
git pull --ff-only origin main
cd server && bun install --production
systemctl restart no-rules
journalctl -u no-rules -n 50 --no-pager
```

Userscript обновляется отдельно: пересобрать локально, закоммитить
`extension/dist/no-rules.user.js`; Tampermonkey подхватит `@updateURL`.

### Бэкапы

```bash
mkdir -p /opt/no-rules/backups
sqlite3 /opt/no-rules/data/no-rules.db \
  ".backup '/opt/no-rules/backups/no-rules-$(date +%F).db'"
```

- WAL: не копировать `no-rules.db` через `cp` во время работы; только
  `.backup` или остановка сервиса.
- Логи: `journalctl -u no-rules -f`, nginx — `/var/log/nginx/no-rules-*.log`.
- Health: `curl -fsS https://lztws.d9v.uk/health`.
- Порт 8787 не должен слушать `0.0.0.0`: `ss -ltnp | grep 8787`.

## 9. Тестирование

### Статические проверки

```bash
cd /home/rsz/Desktop/lztext/no-rules
node --check extension/dist/no-rules.user.js
cd server
npm test
npm run typecheck
```

`npm test` — **27/27**: auth, antibot, db, rate limit, sanitize.
Playwright-сценарии лежат вне репозитория из-за `storageState`.

### Сборка

```bash
NR_VERSION=1.3.4 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
node scripts/build-extension.mjs
sha256sum extension/dist/no-rules.user.js
```

Проверить `@updateURL`/`@downloadURL` и совпадение версии с
`server/package.json`.

### Health и WebSocket

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

### Playwright: desktop Chromium

1. Инициализация и ссылка `No Rules` в боковом меню.
2. Переход в комнату, auth, заголовок, socket-индикатор.
3. Send, context menu, reply, edit, delete.
4. Переключение на нативную комнату: `state.active === false`, наш контейнер
   удалён, нативная комната работает.
5. Возврат: контейнер снова виден, нативные сообщения скрыты.
6. Нет `pageerror`.

Ключевые ожидания:

```js
state.active === true
state.wsAuthenticated === true
state.messages >= 1
document.querySelector('#no-rules-messages')
document.querySelector('.chat2-full-inner .chat2-messages:not(#no-rules-messages)').style.display === 'none'
```

После переключения на нативную комнату `#no-rules-messages` отсутствует by
design. Не вызывайте `getComputedStyle` на нём в этот момент.

### Playwright: mobile

Viewport 390×844, `isMobile: true`, `hasTouch: true`, Android UA.

- `document.documentElement.scrollWidth <= window.innerWidth`;
- composer и сообщения не вылезают за `clientWidth`;
- long-press/меню открывается и содержит «Выделить текст»;
- после переключения на нативную комнату `scrollWidth` не растёт.

### Playwright: Firefox

Тот же сценарий, что desktop Chromium, через
`firefox.launch({ executablePath: '.../firefox' })`. `@grant none` работает в
page context; для Tampermonkey-сборки допустим `@unwrap` + `unsafeWindow`
fallback. Ожидаемо: только нативный шум push-notification, ошибок
`pageerror` нет.

### Widget

На любой странице форума нажать `.chat2-button` справа снизу. Скрипт
инициализируется после открытия виджета. Проверить: `state.chatRoot ===
'widget'`, ссылку No Rules, send/меню/reply, закрытие/повторное открытие с
восстановлением комнаты, URL страницы не меняется.

### Модалки

Онлайн: XenForo-модалка «Сейчас сидят в чате» с `top-user-item
lztng-yzgsen`, аватарами 48×48, только участники No Rules. Проверить X,
backdrop, Escape, плавное открытие/закрытие, `body { overflow: hidden }`.

Socket: клик по индикатору, `Отладка сокета`, проверки WebSocket/auth/
history/outbox/pong, закрытие X/backdrop/Escape, очистка probe.

### Typing

`window.__noRulesChat.simulateTyping('user')` — внизу
`#no-rules-messages` появляется `chat2-typingDetails` с тремя
`lztui-spinner-bounce` (6×6, `sk-bouncedelay`) и текстом «user печатает».
Высота 23 px + `margin-top: 8px`.

### Embeds, links, copy, no toasts

- Ссылки `lzt.market`, SoundCloud, YouTube, форум → нативные карточки
  (`unfurl-renderer`, `embed-link`, `forum-wrapper`).
- ПКМ → «Скопировать текст»: `[UNFURL]`/`[MEDIA]`/`[IMG]`/`[URL]`/`[USER]`
  как `messageRaw`.
- ПКМ по обычному тексту не показывает «Открыть медиа»/«Скопировать медиа».
- После copy/ошибок нет `.nr-toast`; только `console.debug`.

### Mentions и reply

- `@ник` → `a.mention` 24 px, аватар 16×16, цвет `styleN`, SVG-значок;
  несуществующий ник остаётся текстом.
- Свой ник → `highlight`, зелёный фон.
- Reply на изображение/YouTube/SoundCloud/форумный блок: reply-бар и зелёный
  блок содержат полный HTML, не `[изображение]`.
- Copy reply — `[USER=id]@ник[/USER]`, `[MEDIA=...]`, `[UNFURL]`.

### Lifecycle: hash, refresh, reconnect, offline

1. Открыть `https://lolz.team/chatbox/#no-rules` с чистым контекстом.
2. Дождаться `initialized`, `active`, `wsAuthenticated`,
   `historyLoading === false`.
3. Проверить `localStorage['lzt.no-rules.session.v1']`.
4. `page.reload()` — комната снова открывается, история загружается, сессия
   сохраняется.
5. `window.__noRulesChat.reconnect()` — новый temporary token,
   `wsAuthenticated === true`.
6. `context.setOffline(true)` → `wsState !== 'connected'` →
   `send('offline ...')`. Ожидается `pending: 1`, `outbox: 1`.
7. Проверить `localStorage['lzt.no-rules.outbox.v1']`; reload → outbox
   восстанавливается, после `auth.ok` уходит в 0.
8. `setOffline(false)` → `reconnect()` → `outbox: 0`, `pending: 0`, ровно
   одно сообщение с текстом.
9. 10 сообщений offline, затем online: первые 8 проходят сразу, остальные
   повторяются после `rate_limited`; итог — ровно 10 уникальных ID.
10. Пустая комната: `lastMessageId === 0`, другое подключение отправляет
    сообщение, первый reconnect → получает его через `history after=0`.

### История > 60

1. Посеять 130 сообщений в БД (только локально/на тестовой БД).
2. Открыть: `messages === 60`, `historyHasMore === true`.
3. `scrollTop = 0` → `messages === 110`, `hasMore === true`.
4. Ещё вверх → `messages === 143`, `hasMore === false`, `oldestId === 1`,
   дублей нет.

Seed SQL (не коммитить и не запускать на production):

```sql
INSERT INTO messages
  (user_id, username, username_html, avatar_url, color, html, text, client_id, created_at)
VALUES
  (424242, 'test_user', '<span class="styleUserNickname">test_user</span>',
   NULL, NULL, '<p>history seed 001</p>', 'history seed 001',
   'seed-history-001', 1792946000000);

DELETE FROM messages WHERE client_id LIKE 'seed-history-%';
```

### Чек-лист перед релизом

- [ ] `npm test` — 27/27.
- [ ] `npm run typecheck`.
- [ ] `node --check extension/dist/no-rules.user.js`.
- [ ] Desktop Chromium: все пункты выше.
- [ ] Mobile: нет горизонтального скролла, меню работает.
- [ ] Firefox: комната, отправка, переключение.
- [ ] Прямой `#no-rules`, reload, reconnect, offline outbox.
- [ ] История > 60, позиция скролла, нет дублей.
- [ ] Market-карточка 24 px, без лишнего `<br>`/`ProseMirror-widget`.
- [ ] BBCode: шесть тегов форматируются, остальные — текст со скобками.
- [ ] Online/socket modals: X, backdrop, Escape, body lock, плавность.
- [ ] Context menu: `rise` 100 мс, закрытие плавное.
- [ ] Native room → No Rules: пункт меню возвращается, скролл сохраняется.
- [ ] `/health` и `/version`.
- [ ] Нет секретов в `git status`/`git diff`.
- [ ] Raw userscript SHA-256 совпадает с локальным.

## 10. Git и чувствительные данные

В репозиторий **не коммитятся**:

- `.env`, `.env.*` (кроме `.env.example`), `data/`, `*.db`, `*.sqlite`,
  `server/data/`;
- сетевые дампы (`research/chatbox/network`, `websocket`), DOM-снимки,
  antibot, скриншоты, `storageState`, `market.json`;
- `.playwright-mcp/`, `test-results/`, `playwright-report/`, `screenshots/`,
  `shots/`, `*.log`;
- реальные ID/никоны из личных запросов, cookies, токены, `_xfToken`,
  production IP, `ADMIN_USER_IDS`.

Из research коммитятся только `research/README.md` и
`research/chatbox/javascript/**` — нативные JS-чанки для реверса. В тестах и
документации используются фиктивные `424242`/`434343`/`test_user`/
`mention_user`, а не реальные профили.

Проверка перед пушем:

```bash
git status --short
git diff --stat
git grep -nE 'accessKey|Bearer |_xfToken|storageState|ADMIN_USER_IDS|[0-9]{6,}'
```

Понимать, что `accessKey` в собранном userscript — публичное значение, но
production `.env` и реальные ID всё равно не должны попадать в git.

## 11. История версий

Полный архив — [`CHANGELOG.md`](CHANGELOG.md). Ключевые вехи:

- **1.3.4** — редактор: нативные 32×32 превью смайлов, курсор в конце при
  edit, надёжная очистка нескольких NodeView после отправки.
- **1.3.3** — подсветка reply больше не сбрасывает нативный
  `margin-bottom: 5px`, поэтому сообщение не липнет к следующему во время
  анимации.
- **1.3.2** — онлайн-модалка снова анимируется при
  `prefers-reduced-motion: reduce`, как модалка сокета.
- **1.3.1** — убран лишний нижний padding: отступ последнего сообщения
  снова нативный (typing 23 px + 8 px), без дыры до composer-а.
- **1.3.0** — жёсткий лимит 512 символов, follow-bottom после загрузки
  медиа, нативная классификация и копирование смайлов, 27 unit-тестов.
- **1.2.9** — typed `mountNativeModal`, плавные online/socket-модалки,
  исправлена `rise`-анимация ПКМ.
- **1.2.8** — нативная онлайн-модалка с backdrop/body-lock.
- **1.2.7** — auth/presence без лишнего чтения БД на каждое сообщение.
- **1.2.6** — pending/error UX, reply jump `history near`, `fly`-анимации.
- **1.2.0** — нативные карточки, видео, BBCode, mentions, outbox.
- **1.1.x** — стабилизация Firefox, reconnect, истории и sanitizer.
