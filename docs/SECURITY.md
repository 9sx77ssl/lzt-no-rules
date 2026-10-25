# Безопасность

## 1. Что уходит на сервер

Userscript отправляет на `wss://lztws.d9v.uk/ws` только:

- временный токен, выданный форумом через
  `POST /login/generate-temporary-token` (scope `read` для нашего сервера);
- отдельный короткоживущий токен scope `basic post` используется **только**
  локально для `/editor/unfurl` и на сервер не отправляется;
- собственный session token сервера;
- общий `ACCESS_KEY` расширения;
- текст/HTML сообщений, `clientId`, `replyTo`, id редактируемого/удаляемого
  сообщения;
- технические поля: версия клиента, heartbeat.

**Не отправляются:** пароль, cookies форума, `_xfToken`, `xf_session`,
`xf_user`, CSRF-токены (кроме использования локально в запросе к форуму),
IP-адрес клиента (сервер видит его сам через Cloudflare/nginx), данные
платежей.

Временный токен живёт ограниченное время и проверяется сервером через
`https://api.lolz.team/users/:id`. Сервер не может выдать себя за пользователя
на форуме: у него нет cookies и он не вызывает действия от имени аккаунта.

Локально userscript хранит session token, черновик и outbox недоставленных
сообщений в `localStorage` (`lzt.no-rules.*`). Outbox содержит только
`clientId`, HTML и `replyTo` и удаляется после подтверждения сервера; при
выходе из аккаунта/очистке сессии его можно удалить вместе с остальными
ключами. Это не E2E: содержимое сообщений всё равно сохраняется на сервере.

## 2. Модель угроз

| Угроза | Защита |
|---|---|
| Подделка имени/аватара в DOM | сервер берёт identity из проверенного токена, а не из клиентских полей |
| Кража session token | в БД только SHA-256, токен opaque, TTL 30 дней, отзыв через удаление сессии |
| Перебор/спам | `ACCESS_KEY`, rate limit по user id и IP, auth timeout, дедупликация по clientId |
| XSS в сообщениях | серверный `sanitize-html` + клиентский sanitizer, белый список тегов/атрибутов/классов/стилей |
| Подмена картинок/трекеров | разрешены только `nztcdn.com` и форумные хосты, внешние картинки по умолчанию выключены |
| Огромные сообщения/флуд кадрами | лимиты HTML/текста/байтов, `maxPayload` у WS, rate limit |
| Чужие правки/удаления | проверка `message.user.id === ws.user.id` или `ADMIN_USER_IDS` |
| Подделка Origin | `ALLOWED_ORIGINS`, проверка при handshake; Firefox content-script `Origin: null` трактуется как missing origin, но auth всё равно требует read-JWT |
| Утечка секретов в git | `.gitignore`, `.env` только на сервере, в репозитории `.env.example` |

`ACCESS_KEY` **не является** границей безопасности: он встроен в публичный
userscript и может быть извлечён. Его задача — отсечь случайные/чужие
WebSocket-клиенты и уменьшить шум. Настоящая авторизация — форумный токен.

Список онлайн-участников (`presence.users`) содержит только публичные поля
профиля: id, ник, avatar, цвет/usernameHtml и ссылку на профиль. Токены,
cookies и `_xfToken` в него не попадают.

## 3. Проверка личности

1. Клиент получает CSRF-токен из нативной формы/мета-тега.
2. `POST /login/generate-temporary-token` с cookies (same-origin, `credentials:
   include`) и `scope[]=read`.
3. Сервер: `GET https://api.lolz.team/users/:id` с `Authorization: Bearer
   <temporary token>`.
4. Проверяет, что id/username не пустые, применяет `ALLOWED_USER_IDS`.
5. Создаёт пользователя/сессию, возвращает `auth.ok`.
6. Все последующие кадры привязаны к `ws.user`, а не к данным клиента.

Токен нигде не логируется. В логах — только `userId`, IP, код ошибки,
задержка.

## 4. Санитайзинг

`server/src/sanitize.js`:

- белый список тегов: абзацы, br, strong/b, em/i, u, s, code, pre, blockquote,
  списки, ссылки, img, span с ограниченными классами, упоминания;
- атрибуты: `href`, `src`, `alt`, `title`, `class`, `data-*` только нужные;
- схемы: `http`, `https`, `mailto`; для `img` — только `https`;
- стили: только безопасные `color`, `background`, `background-color`,
  `font-weight`, `font-style`, `text-decoration`, `text-shadow` с лимитами;
- удаляются `script`, `style`, `iframe`, `object`, `embed`, обработчики
  событий, `javascript:`/`data:` URL;
- стили ников: сохраняются градиенты и `text-shadow`; username SVG
  (`uniqUsernameIcon--custom`) проходит отдельный allowlist тегов/атрибутов,
  `script/style/foreignObject/use/image` удаляются;
- лимиты: 4 изображения, 5 ссылок, 8 упоминаний, 30 переводов строк.

Клиент повторно санитайзит HTML перед вставкой, чтобы не доверять даже
собственному серверу при компрометации.

### 4.1. BBCode, market и медиа

- BBCode разбирается в DOM, а не через `innerHTML` пользовательской строки:
  `[IMG]`/`[MEDIA]`/`[URL]` создают безопасные элементы, затем HTML всё равно
  проходит `sanitizeClientHtml` и серверный sanitize.
- Market-карточка (`unfurlContainer`, `marketItem`, `categoryIcon`,
  `price`, `Value`) содержит только текст/класс/`data-*`; никаких
  inline-скриптов.
- Метаданные `/editor/unfurl` получаются клиентом с форумным Bearer
  `basic post`; этот токен не отправляется на наш сервер.
- Fancybox/lightbox — нативный XenForo, мы только добавляем `a.LbTrigger`
  с `data-href`/`data-fancybox`; URL проверяется как https.
- Видео/аудио источники проходят `isAllowedMediaUrl` (https + allowlist).

## 5. Rate limit и антиспам

Token bucket на пользователя:

- auth: 12 burst, 1 токен/60 с;
- message: 8 burst, 1 токен/1.5 с;
- typing: 1 burst, 1 токен/3 с;
- history: 20 burst, 1 токен/3 с;
- edit/delete: 6 burst, 1 токен/2 с.

Дополнительно:

- `duplicate` — одинаковый текст подряд от одного пользователя;
- auth timeout 10 с на соединение;
- nginx `limit_conn no_rules_conn 20` на IP;
- Cloudflare перед origin.

Лимиты настраиваются через `RATE_*` в `.env`.

## 6. Заголовки и сеть

nginx отдаёт:

- HSTS (2 года, includeSubDomains);
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy` без geolocation/microphone/camera.

Origin слушает только `127.0.0.1:8787`; наружу — nginx 443. TLS-сертификат
Let's Encrypt, автопродление certbot. Cloudflare в режиме Full (strict).

## 7. Логи и данные

- Логи — JSON в journald (`journalctl -u no-rules`).
- Сообщения хранятся в SQLite (`messages`), удалённые — мягко
  (`deleted_at`), жалобы — в `reports`.
- Бэкап: `sqlite3 /opt/no-rules/data/no-rules.db ".backup /backup/no-rules-$(date +%F).db"`.
- Секреты (`ACCESS_KEY`, TLS-ключи, `.env`) не коммитятся.
- Для полного удаления сообщения нужно чистить БД вручную; интерфейс
  администратора не предусмотрен.

## 8. Ограничения

- Нет E2E-шифрования: сервер видит текст.
- Нет независимого аудита.
- `ADMIN_USER_IDS` — единственная модель модерации.
- Userscript можно модифицировать; сервер валидирует контент, но не может
  гарантировать, что клиент не отправит что-то иное в пределах лимитов.
- Комната не является официальным сервисом Lolzteam.
