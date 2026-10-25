# Протокол No Rules

Версия протокола: **1** (клиент 1.1.16, сервер 1.1.16). Транспорт — WebSocket, текстовые кадры JSON.
Сервер: `wss://lztws.d9v.uk/ws`.

## 1. Подключение

1. Клиент открывает WebSocket.
2. Сервер присылает `hello`:
   ```json
   {"type":"hello","protocol":1,"version":"1.1.16","roomTitle":"No Rules","serverTime":1792946496011}
   ```
3. Клиент отправляет `auth` (первый вход) или `resume` (есть сессия).

### auth

```json
{
  "type": "auth",
  "token": "<временный токен форума>",
  "accessKey": "<общий ключ расширения>",
  "clientVersion": "1.1.16"
}
```

Сервер проверяет токен через `https://api.lolz.team/users/:id`, сверяет
`ACCESS_KEY`, при необходимости `ALLOWED_USER_IDS`, создаёт/обновляет
пользователя и возвращает:

```json
{
  "type": "auth.ok",
  "protocol": 1,
  "user": {"id":9252369,"username":"yolo","usernameHtml":"...","avatar":"...","color":"#949494","profileUrl":"..."},
  "session": "<opaque session token>",
  "expiresAt": 1795538496011,
  "online": 1,
  "users": [{"id":9252369,"username":"yolo","usernameHtml":"...","avatar":"...","color":"#949494","profileUrl":"..."}],
  "serverTime": 1792946496011
}
```

`session` сохраняется в `localStorage` под ключом
`lzt.no-rules.session.v1`. На сервере лежит только SHA-256 от него.

### resume

```json
{"type":"resume","session":"<session token>","accessKey":"...","clientVersion":"1.1.16"}
```

Ответ такой же `auth.ok`; поле `resumed` есть только в логах сервера.
Просроченная/неизвестная сессия → `auth.error` с кодом `invalid_session` или
`session_expired`; клиент стирает сессию и получает новый временный токен.

### Ошибки авторизации

```json
{"type":"auth.error","code":"forbidden","message":"...","retryAfterMs":0}
```

Коды: `bad_request`, `invalid_token`, `token_expired`, `invalid_session`,
`session_expired`, `forbidden`, `not_allowed`, `banned`, `rate_limited`,
`forum_unavailable`, `auth_failed`.

## 2. История

Запрос:

```json
{"type":"history","limit":60}
{"type":"history","before":123,"limit":50}
{"type":"history","after":456,"limit":100}
{"type":"history","after":0,"limit":100}   // пустая комната / первый sync
```

Ответ:

```json
{
  "type": "history",
  "messages": [/* message */],
  "hasMore": true,
  "before": null,
  "after": null,
  "limit": 60,
  "requestId": null,
  "serverTime": 1792946496011
}
```

- Без `before`/`after` — последние `limit` сообщений.
- `before` — более старые, `after` — более новые (для догона после
  переподключения).
- `limit` ограничен `MAX_HISTORY_PAGE_SIZE` (по умолчанию 100). Клиент
  грузит по 60 при старте и по 50 при скролле вверх.

## 3. Отправка

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
`duplicate: true` и не создаёт новое.

Ответ автору:

```json
{"type":"message.new","message":{...},"clientId":"...","ack":true,"serverTime":...}
```

Остальным — `message.new` без `clientId/ack`.

Ограничения: HTML ≤ 12 000, текст ≤ 2 000, кадр ≤ 64 KiB, изображений ≤ 4,
ссылок ≤ 5, упоминаний ≤ 8, переводов строк ≤ 30. Внешние картинки
по умолчанию запрещены (`ALLOW_EXTERNAL_IMAGES=0`), разрешены только
`nztcdn.com`/`lolz`-хосты из белого списка санитайзера.

## 4. Редактирование и удаление

```json
{"type":"message.edit","id":123,"html":"<p>Новый текст</p>"}
{"type":"message.delete","id":123}
```

Сервер проверяет автора или `ADMIN_USER_IDS`. Ответ — broadcast:

```json
{"type":"message.edit","message":{...},"serverTime":...}
{"type":"message.delete","id":123,"message":{...},"serverTime":...}
```

Удаление мягкое: сообщение остаётся в БД с `deletedAt/deletedBy`, клиент
показывает «Сообщение удалено». Редактировать удалённое нельзя.

## 5. Прочие кадры

| Клиент | Сервер | Назначение |
|---|---|---|
| `{"type":"typing"}` | `{"type":"typing","user":{"id","username"}}` | индикатор набора |
| `{"type":"presence"}` | `{"type":"presence","online":N,"users":[...]}` | запрос/рассылка онлайна |
| `{"type":"message.report","id":123,"reason":"..."}` | `{"type":"report.ok","id":123}` | жалоба |
| `{"type":"ping","t":...}` | `{"type":"pong","t":...}` | heartbeat |
| — | `{"type":"system","message":"..."}` | системное сообщение |

Сервер также присылает `error`:

```json
{"type":"error","code":"rate_limited","message":"...","retryAfterMs":1234,"clientId":"...","messageId":123}
```

`clientId`/`messageId` позволяют клиенту снять optimistic-состояние и
показать ошибку у конкретного сообщения.

## 6. Модель сообщения

```json
{
  "id": 42,
  "user": {
    "id": 9252369,
    "username": "yolo",
    "usernameHtml": "<span class=\"styleUserNickname\" style=\"color:#949494\">yolo</span>",
    "avatar": "https://nztcdn.com/avatar/s/.../9252369.webp",
    "color": "#949494",
    "profileUrl": "https://lolz.team/members/9252369/"
  },
  "html": "<p>Текст</p>",
  "text": "Текст",
  "deleted": false,
  "createdAt": 1792946496011,
  "editedAt": null,
  "clientId": "u_...",
  "reply": {
    "id": 41,
    "user": {"id":9252369,"username":"yolo","usernameHtml":"...","color":"#949494"},
    "text": "Цитата",
    "html": ""
  },
  "meta": {"images":0,"links":0,"mentions":0}
}
```

`html` уже прошёл серверный санитайзер. Клиент дополнительно прогоняет его
через свой sanitizer перед вставкой в DOM.

## 7. Переподключение

- Heartbeat: клиент шлёт `ping` каждые 25 с; если 75 с нет `pong`, закрывает
  сокет.
- После `close` клиент делает exponential backoff (1–30 с), затем `resume`.
- Если `resume` отклонён, клиент получает новый временный токен и делает
  `auth`.
- После `auth.ok` клиент догоняет историю через `history` с `after`;
  `after=0` допустим и означает «с начала сохранённого потока».
- Если соединение пропало, `message.send` кладётся в outbox, переживает
  F5 (`localStorage`) и отправляется после `auth.ok`; дедупликация по
  `clientId` защищает от повторов. Сервер проверяет `clientId` до
  rate-limit, чтобы replay не расходовал токены и не терялся при retry.
- `rate_limited` для `message.send` содержит `clientId` и `retryAfterMs`;
  клиент оставляет сообщение в outbox и повторяет его автоматически.

## 8. Онлайн-модалка

`presence` и `auth.ok` содержат `users` — уникальные авторизованные
подключения (по `user.id`), а не количество сокетов. Клиент хранит этот
список и по клику на «Онлайн: N» открывает нативную XenForo-модалку с
участниками No Rules. Данные пользователя: `id`, `username`,
`usernameHtml`, `avatar`, `color`, `profileUrl`, `stats` (`likes`,
`likes2`, `messages`, `trophies`, `contests`). Токены и cookies в список
не попадают.

## 9. Health/version

```bash
curl https://lztws.d9v.uk/health
curl https://lztws.d9v.uk/version
```

`/health` отдаёт `ok`, `version`, `protocol`, `uptime`, `online`, `messages`,
`time`. `/version` — `name`, `version`, `protocol`, `publicUrl`.
