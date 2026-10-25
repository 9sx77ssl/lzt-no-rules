# Тестирование

## 1. Статические проверки

```bash
cd /home/rsz/Desktop/lztext/no-rules
node --check extension/dist/no-rules.user.js
cd server
bun test
```

`bun test` запускает 20 unit-тестов: auth, antibot, db, rate limit,
sanitize.

## 2. Сборка

```bash
NR_VERSION=1.0.1 \
NR_WS_URL=wss://lztws.d9v.uk/ws \
NR_ACCESS_KEY='<production key>' \
bun scripts/build-extension.mjs
sha256sum extension/dist/no-rules.user.js
```

Проверить, что в header есть `@updateURL`/`@downloadURL`, а версия совпадает
с `package.json` сервера.

## 3. Health и WebSocket

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

## 4. Playwright: desktop Chromium

Проверяет:

1. инициализацию и появление ссылки `No Rules` в боковом меню;
2. переход в комнату, авторизацию, заголовок и socket-индикатор;
3. отправку сообщения, контекстное меню, reply, edit, delete;
4. переключение на нативную комнату: `state.active === false`, наш контейнер
   удалён из DOM, нативная комната работает;
5. возврат в `No Rules`: контейнер снова виден, нативные сообщения скрыты;
6. отсутствие `pageerror`.

Ключевые ожидания:

```js
state.active === true
state.wsAuthenticated === true
state.messages >= 1
document.querySelector('#no-rules-messages')
document.querySelector('.chat2-full-inner .chat2-messages:not(#no-rules-messages)').style.display === 'none'
```

После переключения на нативную комнату `#no-rules-messages` должен
отсутствовать (мы не держим его в DOM, пока комната неактивна). Не пытайтесь
делать `getComputedStyle(document.getElementById('no-rules-messages'))` в
этот момент — элемента нет by design.

## 5. Playwright: mobile

Viewport 390×844, `isMobile: true`, `hasTouch: true`, Android UA.

Проверить:

- нет горизонтального скролла:
  `document.documentElement.scrollWidth <= window.innerWidth`;
- composer и сообщения не вылезают за `clientWidth`;
- long-press/контекстное меню открывается и содержит «Выделить текст»;
- после переключения на нативную комнату `scrollWidth` не растёт.

## 6. Playwright: Firefox

Тот же сценарий, что desktop Chromium, но через
`firefox.launch({ executablePath: '.../firefox' })`. Userscript с `@grant none`
работает в page context; для Tampermonkey-сборки допустим `@unwrap` +
`unsafeWindow` fallback.

Ожидаемо: только нативный шум push-notification в console, ошибок
`pageerror` нет.

## 7. Lifecycle: hash, refresh, reconnect, offline

1. Открыть `https://lolz.team/chatbox/#no-rules` с чистым контекстом.
2. Дождаться `initialized`, `active`, `wsAuthenticated`, `historyLoading === false`.
3. Проверить `localStorage['lzt.no-rules.session.v1']`.
4. `page.reload()` — комната должна снова открыться, история загрузиться,
   сессия не потеряться.
5. `window.__noRulesChat.reconnect()` — принудительный reconnect с новым
   временным токеном; `wsAuthenticated` снова `true`.
6. `context.setOffline(true)` → дождаться `wsState !== 'connected'` →
   `window.__noRulesChat.send('offline ...')`.
   Ожидается `pending: 1`, `outbox: 1`, toast про очередь.
7. `context.setOffline(false)` → `reconnect()`.
   Ожидается `outbox: 0`, `pending: 0`, ровно одно сообщение с текстом
   (дедупликация по `clientId`).

## 8. История > 60 сообщений

1. Посеять 130 сообщений в БД (только для теста) или отправить их через
   несколько аккаунтов.
2. Открыть комнату: `messages === 60`, `historyHasMore === true`,
   `oldestId` указывает на 60-е с конца.
3. `scroll.scrollTop = 0` + `scroll` event → `messages === 110`,
   `historyHasMore === true`, `scrollTop > 0`, `scrollHeight` вырос.
4. Ещё раз вверх → `messages === 143`, `historyHasMore === false`,
   `oldestId === 1`, первое сообщение присутствует, дублей id нет.

Скрипт для посева (не коммитить):

```sql
INSERT INTO messages
  (user_id, username, username_html, avatar_url, color, html, text, client_id, created_at)
VALUES
  (9252369, 'yolo', '<span class="styleUserNickname">yolo</span>',
   NULL, NULL, '<p>history seed 001</p>', 'history seed 001',
   'seed-history-001', 1792946000000);
```

После теста удалить:

```sql
DELETE FROM messages WHERE client_id LIKE 'seed-history-%';
```

## 9. Чек-лист перед релизом

- [ ] `bun test` — 20/20.
- [ ] `node --check extension/dist/no-rules.user.js`.
- [ ] Desktop Chromium: все пункты раздела 4.
- [ ] Mobile: нет горизонтального скролла, меню работает.
- [ ] Firefox: комната, отправка, нативное переключение.
- [ ] Прямой `#no-rules`, reload, reconnect, offline outbox.
- [ ] История > 60, позиция скролла, отсутствие дублей.
- [ ] `https://lztws.d9v.uk/health` и `/version`.
- [ ] Нет секретов в `git status`/`git diff`.
- [ ] Raw userscript на GitHub совпадает по SHA-256 с локальным.
