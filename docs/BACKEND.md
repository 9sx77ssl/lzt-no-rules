# Backend

Сервер — отдельный процесс Bun/Node без Docker. Прод: systemd
`no-rules.service`, nginx TLS proxy, SQLite в WAL.

## 1. Стек

- Bun 1.4.x (production) / Node 20+ (fallback/tests);
- `ws` — WebSocket;
- `bun:sqlite` (Bun) или `better-sqlite3` (Node);
- `sanitize-html` + `cheerio` — HTML;
- `dotenv`;
- nginx + Let's Encrypt;
- systemd.

## 2. Модули

| Файл | Ответственность |
|---|---|
| `src/index.js` | загрузка config/logger/db/auth/ws/http |
| `src/config.js` | env, лимиты, origins, rate |
| `src/http.js` | `/health`, `/version`, TLS/HTTP сервер |
| `src/ws.js` | WS handshake, auth/resume, message/history/edit/delete/typing/presence/report |
| `src/auth.js` | проверка forum JWT через `api.lolz.team/users/:id`, сессии |
| `src/db.js` | схема, миграции, prepared statements |
| `src/sanitize.js` | серверный allowlist HTML/стилей/username SVG |
| `src/ratelimit.js` | `TokenBucket`, `RateLimiter` |
| `src/antibot.js` | защита auth от автоматических клиентов |
| `src/protocol.js` | JSON frame parsing и лимиты |
| `src/logger.js` | JSON-логи |

## 3. HTTP

```text
GET /health
{
  "ok": true,
  "name": "no-rules-chat",
  "version": "1.2.7",
  "protocol": 1,
  "uptime": 123,
  "online": 2,
  "messages": 240,
  "time": 1792960000000
}

GET /version
{
  "name": "no-rules-chat",
  "version": "1.2.7",
  "protocol": 1,
  "publicUrl": "wss://lztws.d9v.uk/ws"
}
```

WebSocket: `/ws` (и `/`), handshake проверяет `Origin`, при `TRUST_PROXY=1`
берёт реальный IP из `X-Forwarded-For`/Cloudflare.

## 4. База

SQLite (`DB_PATH`, WAL). Схема создаётся/мигрирует автоматически.

### users

```sql
user_id INTEGER PRIMARY KEY,
username TEXT NOT NULL,
username_html TEXT,
avatar_url TEXT,
color TEXT,
stats TEXT,
stats_updated_at INTEGER,
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL,
last_seen_at INTEGER
```

`stats` — JSON `{likes, likes2, messages, trophies, contests}`.

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

Индексы:

- `(user_id, client_id)` unique — идемпотентность отправки;
- `created_at`;
- `reply_to`.

`reply_html` хранит **полный HTML** исходного сообщения (версия схемы 5),
поэтому reply не теряет картинки/видео/unfurl/mentions.

### reports

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
message_id INTEGER REFERENCES messages(id),
reporter_user_id INTEGER REFERENCES users(user_id),
reason TEXT NOT NULL,
created_at INTEGER NOT NULL
```

## 5. Auth

1. Клиент получает CSRF из формы/мета.
2. `POST https://lolz.team/login/generate-temporary-token` (cookies) с
   `scope[]=read` для сервера; отдельно `scope[]=basic&scope[]=post` для
   `/editor/unfurl`.
3. Клиент отправляет read-token в WS `auth`.
4. Сервер декодирует JWT (без доверия к клиентскому username), проверяет
   `iss`, `sub`, `exp`, scope (read/chatbox/basic), затем `GET
   https://api.lolz.team/users/:id` с `Authorization: Bearer`.
5. Создаёт/обновляет `users`, выдаёт session token (только hash в БД).
6. `ALLOWED_USER_IDS`, ban/staff проверки.

Сервер **не** хранит cookies форума и не действует от имени пользователя.

## 6. WebSocket lifecycle

```text
connect
  ← hello {protocol,version,roomTitle,serverTime}
  → auth {token,accessKey,clientVersion}
  ← auth.ok {user,session,expiresAt,online,users}
  или
  → resume {session,accessKey,clientVersion}
  ← auth.ok

→ history {limit|before|after}
← history {messages,hasMore?}

→ message.send {clientId,html,replyTo}
← message.new {message}

→ message.edit {id,html}
← message.edited

→ message.delete {id}
← message.deleted

→ typing
→ presence
→ report {id,reason}
→ ping
← pong
```

Heartbeat: сервер шлёт ping/ждёт pong; клиент также проверяет `lastPongAt`.
При обрыве — exponential backoff, outbox для `message.send`.

`clientId` (8–64 `[A-Za-z0-9_-]`) предотвращает повторную вставку одного и
того же сообщения; два **разных** сообщения с одинаковым текстом разрешены.
Проверка `getMessageByClient()` выполняется **до** rate-limit: повторный
replay после потери ack возвращает существующую строку и не съедает токен.
Rate-limit error для отправки содержит `clientId`, чтобы клиент мог
оставить конкретный payload в outbox и повторить после `retryAfterMs`.

## 7. Rate limits

`TokenBucket` per user/IP:

| Bucket | Default |
|---|---|
| auth | 12 burst, 1/60s |
| message | 8 burst, 1/1.5s |
| typing | 1 burst, 1/3s |
| history | 20 burst, 1/3s |
| edit | 6 burst, 1/2s |
| delete | 6 burst, 1/2s |

`DuplicateGuard` остаётся утилитой в `ratelimit.js`, но **не применяется к
тексту сообщений**: иначе второе одинаковое сообщение удалялось бы.

## 8. Санитайзер

`createSanitizer`:

- теги: p, br, strong, em, u, s, code, pre, blockquote, ul/ol/li, hr,
  sub/sup, a, img, span, div, abbr, video/source, username SVG;
- атрибуты: href/src/alt/title/class/style и разрешённые `data-*`;
- схемы: http/https/mailto; img/video/source только https;
- классы: allowlist + regex `node\d+`, `category--*`, `Av\d+s`,
  `lztng-*`, `style\d+`;
- стили: цвет/градиент/тень/фон/white-space с regex;
- username SVG: allowlist тегов/атрибутов, animate только для безопасных
  атрибутов;
- лимиты: 12 000 HTML, 2 000 текста, 4 img, 5 ссылок, 8 упоминаний,
  30 переводов строк;
- медиа: nztcdn.com + форумные хосты (или `ALLOW_EXTERNAL_IMAGES=1`).

Важные классы для native-блоков: `unfurlContainer`, `marketItem`,
`category--*`, `price`, `Value`, `SvgIcon`, `categoryIcon`, `LbTrigger`,
`bbCodeImage`, `LbImage`, `embed-link`, `forum-wrapper`,
`unfurl-renderer`.

## 9. Конфиг

См. `.env.example`. Основное:

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
PUBLIC_URL=wss://lztws.d9v.uk/ws
DB_PATH=/opt/no-rules/data/no-rules.db
ACCESS_KEY=...
ALLOWED_USER_IDS=
ADMIN_USER_IDS=
ALLOWED_ORIGINS=https://lolz.team,...
TRUST_PROXY=1
SESSION_TTL_DAYS=30
MAX_MESSAGE_HTML=12000
MAX_MESSAGE_TEXT=2000
ALLOW_EXTERNAL_IMAGES=0
```

## 10. Production

```bash
/opt/no-rules/update.sh
```

`update.sh` делает `git pull`, `bun install --production`, `systemctl
restart no-rules`, polling `/health`, rollback на предыдущий commit при
ошибке.

- systemd: `deploy/no-rules.service`;
- nginx: `deploy/nginx-lztws.d9v.uk.conf`;
- TLS: certbot, `lztws.d9v.uk`;
- origin `127.0.0.1:8787`, наружу только nginx.

## 11. Миграции

`openDatabase` читает `PRAGMA user_version`; миграции идемпотентны.
Не сбрасывать production DB. `reply_html` появился в версии 5; старые
сообщения backfill-ятся из `reply_text`/HTML, если возможно.

## 12. Тесты

```bash
cd server
npm test        # 22 unit tests
```

Тесты: `auth`, `antibot`, `db`, `ratelimit`, `sanitize`. Playwright-тесты
запускаются отдельно против production WSS (см. `TESTING.md`).
