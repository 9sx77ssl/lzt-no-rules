# No Rules — комната внутри Chatbox Lolzteam

Userscript добавляет в нативный Chatbox отдельную комнату **No Rules** и свой
WebSocket-бэкенд к ней. Комната выглядит и ведёт себя как штатная: тот же
заголовок, список комнат, composer на Tiptap, контекстное меню, reply/edit
бары, скролл, уведомления и мобильные жесты. Нативные комнаты не заменяются и
не патчатся, пока No Rules не активна.

- Публичный сервер: `wss://lztws.d9v.uk/ws`
- Health: <https://lztws.d9v.uk/health>
- Готовый userscript:
  <https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js>
- Репозиторий: <https://github.com/9sx77ssl/lzt-no-rules>

> Комната доступна только тем, у кого установлен userscript. Это не замена
> приватных чатов форума и не E2E-шифрование: сообщения хранятся на сервере
> в SQLite и видны администратору сервера.

## Что умеет

- Комната `No Rules` в боковом меню Chatbox, прямой переход
  `https://lolz.team/chatbox/#no-rules`, сохранение активной комнаты после
  перезагрузки.
- Работает и в полноэкранном `/chatbox/`, и в плавающем окне чата на любой
  странице (кнопка справа снизу). В плавающем окне URL не меняется, а
  активная комната восстанавливается из `localStorage`.
- Отправка, ответы/цитаты, упоминания, редактирование и удаление сообщений.
- Форматирование, ссылки, изображения, эмодзи и стикеры — в пределах
  нативного Tiptap-редактора.
- История с подгрузкой старых сообщений, сохранение позиции скролла,
  счётчик непрочитанных, кнопка «новые сообщения».
- Аватары, цвета/градиенты ников, группы сообщений и разделители дней в
  нативном стиле.
- Контекстное меню по правому клику, long-press и свайп на мобильных —
  точная нативная разметка `message-actions/menu/action` и иконки Svelte.
- Reply-бар и edit-бар в нативных классах `chat2-replying` /
  `chat2-message-editing`; удаление без подтверждения и без tombstone, как в
  нативном чате.
- Индикатор набора с нативной анимацией трёх точек, всегда занимает те же
  31 px снизу, что и оригинальный Chatbox, поэтому сообщения не прилипают к
  полю ввода.
- Клик по «Онлайн: N» показывает участников именно No Rules в нативной
  XenForo-модалке (`top-users-container`, `top-user-item`).
- Индикатор соединения, состояния `connecting/connected/disconnected`,
  ошибки и повторное подключение.
- Очередь исходящих сообщений: если связь пропала, сообщение отправится
  после восстановления сессии.
- Presence, typing, системные сообщения, жалобы на сообщения.
- Серверная авторизация через временный токен форума, сессии, rate limit,
  антиспам, санитайзинг HTML и дедупликация по `clientId`.

## Установка

1. Установите Tampermonkey (Chrome/Chromium/Edge) или Violentmonkey
   (Firefox).
2. Откройте raw-ссылку на userscript и подтвердите установку.
3. Зайдите на `https://lolz.team/chatbox/`, откройте боковое меню и выберите
   **No Rules**.
4. При первом входе расширение попросит форум выдать короткоживущий токен.
   Пароль и cookies форума на сервер **не отправляются**.

Обновление — обычное обновление userscript в Tampermonkey (метаданные
`@updateURL`/`@downloadURL` уже указывают на `main`).

## Как это устроено

```
Браузер (lolz.team)
  userscript
    ├─ нативный DOM/CSS/Tiptap Chatbox
    ├─ короткоживущий forum token
    └─ WebSocket ── wss://lztws.d9v.uk/ws
                         │
                    nginx (TLS, Cloudflare real IP)
                         │
                    Bun + ws + SQLite
```

- Userscript не доверяет имени пользователя из DOM. Он получает временный
  токен через `/login/generate-temporary-token` и передаёт его серверу.
- Прод запущен через **systemd** (`no-rules.service`, Bun).
- Сервер проверяет токен через `https://api.lolz.team/users/:id`, после чего
  выдаёт собственный opaque session token. В БД хранится только SHA-256 от
  него.
- `ACCESS_KEY` в userscript — общий барьер от случайных клиентов, а не
  замена авторизации.
- Сервер санитайзит HTML и стили ников, ограничивает длину, число картинок,
  ссылок и упоминаний, применяет token-bucket rate limit на пользователя и IP.
- История и сообщения — SQLite в WAL-режиме. Схема мигрирует автоматически
  до версии 2.

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/PROTOCOL.md](docs/PROTOCOL.md),
[docs/SECURITY.md](docs/SECURITY.md),
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md),
[docs/TESTING.md](docs/TESTING.md).

## Локальный запуск

Нужен [Bun](https://bun.sh) 1.2+.

```bash
cd server
bun install
cp ../.env.example ../.env       # заполните ACCESS_KEY
bun run start                    # http://127.0.0.1:8787
```

Проверка:

```bash
curl -s http://127.0.0.1:8787/health
cd server && bun test            # 20 unit-тестов, bun:sqlite
```

Сборка userscript:

```bash
NR_VERSION=1.0.1 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<тот же ACCESS_KEY>' \
bun scripts/build-extension.mjs
```

Готовый файл: `extension/dist/no-rules.user.js`. Он коммитится в репозиторий,
потому что оттуда его ставят пользователи.

## Обновление production

Сервер развёрнут в `/opt/no-rules/app` (git-клон), systemd-сервис
`no-rules.service`, база — `/opt/no-rules/data/no-rules.db`, конфиг —
`/opt/no-rules/.env`.

```bash
ssh new-server
/opt/no-rules/update.sh
```

Скрипт делает `git pull --ff-only`, `bun install --production` в
`app/server` и `systemctl restart no-rules`. Если в обновлении изменился
userscript, пересоберите его локально и закоммитьте `extension/dist/`.

Подробная первоначальная установка, nginx, TLS и бэкапы —
в [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Структура

```
extension/src/        исходники userscript (00-core … 40-main)
extension/dist/       собранный no-rules.user.js
server/src/           Bun HTTP/WS сервер, SQLite, auth, sanitize
server/tests/         unit-тесты (node:test)
deploy/               systemd, nginx, update.sh
docs/                 протокол, безопасность, деплой, тесты
scripts/              сборка userscript
```

## Ограничения

- Комната не появляется у пользователей без userscript.
- Нет E2E-шифрования; администратор сервера и БД видит сообщения.
- Модерация ограничена: автор может редактировать/удалять свои сообщения,
  `ADMIN_USER_IDS` — любые. Отдельной панели модератора нет.
- Сервер не является официальным сервисом Lolzteam. Используйте на свой риск
  и не отправляйте туда пароли, cookies и платёжные данные.
