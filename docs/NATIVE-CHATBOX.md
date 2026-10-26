# Нативный Chatbox Lolzteam: reverse engineering

Этот документ фиксирует всё, что удалось выяснить о Svelte-чатбоксе Lolzteam
и что используется в No Rules. Это не догадки: DOM, CSS и сетевые вызовы
проверялись в живом `/chatbox/` и в плавающем виджете.

## 1. Где искать исходники

Страница подключает чанки с `nztcdn.com`. Сохранённые JS-чанки лежат в
`research/chatbox/javascript/` и закоммичены в репозиторий. Сетевые дампы,
DOM-снимки и antibot-скрипты остаются локально: в них могут быть токены и
cookies.

| Файл | Что внутри |
|---|---|
| `javascript/chat2.js` | Svelte Chatbox: комнаты, сообщения, composer, reply, меню, online |
| `javascript/core.js` | XenForo-обвязка, video player, регистрация обработчиков |
| `javascript/tiptap-vendor-D_wJkECX.js` | Tiptap, mention/unfurl/media/video-ноды, их CSS |
| `javascript/api-DvhrAPCR.js` | `xenApiFetch`, Bearer-токены |
| `javascript/StatusInput-*.js` | status/input, snapshot-логика |
| `network/*.json` | запросы `/chatbox`, `/editor/unfurl`, `/members/find` |

Полезные команды:

```bash
# найти все места с классом/строкой
rg -n 'unfurl-renderer|LbTrigger|mceSmilieLarge' research/chatbox/javascript
```

## 2. Два режима Chatbox

Один и тот же Svelte-компонент используется в двух местах:

- `/chatbox/` → `.chat2.chat2-full-inner`;
- виджет на любой странице → `.chat2.chat2-widget-inner` внутри
  `.chat2-floating`.

Поэтому все селекторы No Rules строятся от:

```js
document.querySelector('.chat2[aria-label="chatbox"]')
  || document.querySelector('.chat2-full-inner, .chat2-widget-inner');
```

Нативные сообщения находятся в `.chat2-messages` (не `#no-rules-messages`),
scroll — `.scrollable > .scrollable-content`.

## 3. Основные нативные классы

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

Нативные lazy-чанки, CSS которых может отсутствовать в виджете:

| Компонент | CSS-хеш | Где используется |
|---|---|---|
| message actions | `lztng-36rp8q` | контекстное меню |
| typing spinner | `lztng-1f69oee` | три точки |
| online users | `lztng-yzgsen` | модалка «Онлайн» |
| video player | `lztng-tn70wf` и дочерние | видео |
| unfurl renderer | `lztng-1wjql9y` | Tiptap-карточки |
| image popover | `lztng-djtfwo` | editor image popover |

No Rules копирует только те CSS-правила, которые реально не приходят в
виджете; нативные классы не переименовываются.

## 4. Tiptap и сообщения

`message` в JSON Chatbox — это HTML, а `messageJson` — Tiptap JSON. Нативные
ноды:

- `mention` → `a.notranslate.username.mention` с `data-user="id, nick"`,
  `img.avatar`, `span.styleUserNickname`, `uniqUsernameIcon--custom`;
- `unfurl` → `.unfurl-renderer` (forum/market/thread);
- `media` → `.embed-link` (YouTube/SoundCloud/TikTok/Spotify и т.д.);
- `video` → `<video class="video-preview">` в редакторе и `<video>` в
  сообщении;
- `image` → `img.bbCodeImage` / `.LbImage` и `a.LbTrigger`;
- smilie → `img.mceSmilie` с `alt=":name:"`.

Ответ сервера `/chatbox/messages` приходит уже HTML-ом; сервер форума
дополнительно превращает некоторые Tiptap-ноды в legacy-разметку
(`.unfurlContainer`).

## 5. Видео

### 5.1. Как форум монтирует плеер

В `core.js` зарегистрирован обработчик:

```js
XenForo.VideoPlayer = function (video) {
  if (video.closest('[data-lzt-video-player]').length) return;
  // проверяет, что video внутри .chat2-message / .message-block / blockquote
  const fragment = document.createDocumentFragment();
  mount(VideoPlayerComponent, {
    target: fragment,
    props: {
      poster: video.attr('poster'),
      source: [video.attr('src')],
      controlsOnPause: true,
      timeDisplay: true,
    },
  });
  video.replaceWith(fragment);
};
register('video', 'XenForo.VideoPlayer');
```

Итоговая разметка сообщения:

```html
<div class="aspect lztng-tn70wf" style="... aspect-ratio: 16 / 9; ...">
  <div class="aspect-fill lztng-tn70wf"
       data-lzt-video-player="1" role="region">
    <video playsinline class="lztng-tn70wf" preload="none">...</video>
    <img class="poster ..." src="...webp">
    <div class="overlay ...">
      <div class="controls ...">... playbar, volume, time, fullscreen ...</div>
      <div class="center-icons ...">... play ...</div>
    </div>
  </div>
</div>
```

### 5.2. Editor

В composer Tiptap показывает не полный плеер, а preview:

```html
<span class="tiptap-media media-wrapper">
  <video class="video-preview lztng-7gv8zu"
         autoplay loop playsinline preload="metadata"
         src="...mp4" style="max-height: 5vh;"></video>
</span>
```

По умолчанию у него нет `muted`; No Rules принудительно ставит `muted`,
`defaultMuted` и `muted`-атрибут, чтобы autoplay был без звука.

### 5.3. Reply field

Reply-бар форума — не кастомный плеер, а обычный HTML5 `<video controls>` с
poster. Поэтому No Rules делает то же: `controls`, `playsinline`,
`preload=metadata`, poster (для `nztcdn.com/files/*` — `.webp`).

### 5.4. Главная ловушка

Нативный плеер монтируется XenForo-активацией, а не самим фактом вставки
HTML. Если сообщение с видео появляется после первичного сканирования DOM,
оно остаётся с пустым `<video>` (первый кадр, нет controls). Решение No
Rules:

```js
XenForo.activate(messageContainer);
```

после рендера, но только если в контейнере есть ещё не смонтированный
`video` (иначе плеер будет перезагружаться и показывать спиннер).

### 5.5. F5 и пересборка

Полный `replaceChildren()` уничтожает Svelte-компонент плеера. Поэтому
No Rules переиспользует DOM-узлы сообщений по `data-message-id` и
`messageRenderKey`; видео-узел остаётся тем же, `currentTime` не сбрасывается.

## 6. Фотографии и fancybox

Нативная картинка оборачивается в:

```html
<a class="LbTrigger"
   href="https://nztcdn.com/files/....webp"
   data-href="https://lolz.team/misc/lightbox"
   data-fancybox="gallery">
  <img class="bbCodeImage LbImage" src="..." alt="[IMG]" loading="lazy">
</a>
```

Клик по `.LbTrigger` открывает **fancybox**, а не новую вкладку:

```text
.fancybox__container
  .fancybox__backdrop
  .fancybox__toolbar
  .fancybox__slide.is-selected
```

Проверено: `location.hash` становится `#gallery-N`, в body появляется
`.fancybox__container`.

No Rules оборачивает «голые» `<img>` в такой же `.LbTrigger`, не трогая
аватары, смайлы и картинки внутри unfurl/media-карточек. Поэтому загруженные
через Tiptap фото и `[IMG]...[/IMG]` открываются в том же просмотрщике.

## 7. Смайлы

Нативная логика (функция `pe` в `chat2.js`):

1. Найти все `.mceSmilie` в `.chat2-message-text-inner`.
2. Если их не ровно один — ничего не делать.
3. Проверить, что у контейнера ровно один **значимый** дочерний узел:
   комментарии и whitespace-текст игнорируются.
4. Разрешить рекурсию только через `<p>`.
5. Если это единственный смайл — добавить `mceSmilieLarge`.

CSS форума:

```css
.chat2-message-text .mceSmilie.mceSmilieLarge {
  width: 96px !important;
  height: 96px !important;
  max-width: 96px !important;
  max-height: 96px !important;
}
```

Поэтому `:genius:` в соло — 96×96, а два смайла или смайл с текстом
остаются обычного размера. No Rules повторяет эту проверку после каждого
рендера.

## 8. Unfurl и `/editor/unfurl`

Tiptap-ссылка при вставке вызывает:

```http
POST https://api.lolz.team/editor/unfurl
Authorization: Bearer <JWT basic post>
Content-Type: application/x-www-form-urlencoded

url=https%3A%2F%2Flzt.market%2F266223421%2F
&_xfRequestUri=%2Fchatbox%2F
&_xfNoRedirect=1
&_xfToken=<csrf>
&_xfResponseType=json
```

Пример ответа для аккаунта:

```json
{
  "type": "market_item",
  "title": "Steam • cs2prime • 2 медали• личный аккаунт • nolimit • 10 lvl фейсита",
  "url": "https://lzt.market/266223421/",
  "extra": {
    "category_name": "steam",
    "price": 7932
  }
}
```

Ответ для форума:

```json
{
  "type": "node",
  "title": "Розыгрыши",
  "url": "https://lolz.team/forums/contests",
  "extra": {"icon_content": "&#xE006;", "active_icon_content": ""}
}
```

Ответ для YouTube:

```json
{
  "type": "media",
  "url": "https://www.youtube.com/watch?v=...",
  "media": {"siteId": "youtube", "mediaId": "..."}
}
```

Токен `basic post` можно получить тем же
`/login/generate-temporary-token` с `scope[]=basic&scope[]=post`; он живёт
около часа. No Rules кеширует его в памяти и не отправляет на свой сервер.

### Legacy market card

Сервер нативного чата после отправки превращает market-блок в legacy HTML:

```html
<div class="unfurlContainer shorted marketItem category--steam">
  <div class="text">
    <span class="SvgIcon">
      <span class="categoryIcon steam Tooltip" data-cachedtitle="Steam"></span>
    </span>
    <span class="title">Steam • ...</span>
    <div class="price">
      <span class="Value" data-value="7932">7 932 ₽</span>
    </div>
  </div>
  <a class="LinkClicker" href="https://lzt.market/266223421/"></a>
</div>
```

Цена форматируется `ru-RU` + `₽`; иконка — `categoryIcon <category>`.
No Rules строит этот HTML сама, поэтому блок одинаково выглядит до и после
F5 и в reply.

## 9. BBCode

Сервер нативного чата принимает BBCode и превращает его в HTML. Наблюдения:

- `[UNFURL="url"]url[/UNFURL]` → `.unfurlContainer` market/forum;
- `[IMG]https://nztcdn.com/files/....webp[/IMG]` → `a.LbTrigger` + `img.bbCodeImage`;
- `[MEDIA=youtube]...[/MEDIA]` в нативном сервере имеет неприятный баг:
  ссылка получается `https://youtube.com/watch?v=<urlencoded-url>`; No Rules
  строит корректную `.embed-link` карточку.

No Rules оставляет в чате только реально работающие теги: `[URL]`, `[IMG]`,
`[MEDIA]`, `[VIDEO]`, `[UNFURL]`, `[USER]`. Остальные остаются текстом как есть; это
сделано осознанно после проверки реальных сообщений. Подробнее —
[BBCode.md](BBCode.md).

## 10. Mentions

Plain `@nick` не является Tiptap-нодой. При отправке No Rules вызывает
`POST /members/find` с `_xfToken` и строит нативный `a.mention` с аватаром,
`styleUserNickname` и SVG-значком. Точное совпадение ника приоритетнее
регистронезависимого.

## 11. Firefox и Tampermonkey

- Userscript должен использовать абсолютные URL для auth/fetch:
  в Firefox sandbox относительный URL может уйти в `moz-extension://`.
- Форумный `window.fetch` патчен и падает на `URL`-объекте
  (`url.startsWith`), поэтому передаётся **строка**.
- `XenForo.activate` берётся через `PAGE_WINDOW`/`unsafeWindow`.
- Firefox/Tampermonkey content-script WebSocket может прислать
  `Origin: null`. Сервер с 1.1.19+ (сейчас 1.2.6) трактует его как missing origin
  (`ALLOW_MISSING_ORIGIN`), иначе handshake падал с 403 и в UI было
  «Онлайн: 0».
- В Tampermonkey не должно быть двух копий No Rules: старые
  `@namespace`/версии конфликтуют.
- `@run-at document-start`, но DOM инициализируется только после появления
  `document.head`/`document.body`.

## 11.1. Карточки и socket

- В готовых сообщениях нативного Chatbox market-раздел приходит legacy-
  разметкой `.unfurlContainer.shorted.marketItem`: высота карточки 24 px,
  внешний line-box 28 px, сообщение с одной карточкой — 44 px.
- Tiptap в редакторе может оставить `.unfurl-renderer` и хвост
  `ProseMirror-widget + <br> + пустой <p>`; после отправки его нужно
  нормализовать, иначе сообщение получает вторую пустую строку.
- `market_search`-ноду Tiptap безопасно приводить к legacy-карточке с
  `categoryIcon`, `.title`, `.price`, `.LinkClicker`.
- Клик по `.chat2-socket-state` в нативном заголовке открывает модалку
  `Отладка сокета: Соединение установлено` с проверками WebSocket, Socket,
  SharedWorker. В No Rules используется тот же `chat2-socket-state`, но
  проверки показывают auth, history, outbox и pong.

## 12. Что ещё проверять при изменениях

1. Full chat и widget.
2. F5 на `#no-rules`.
3. Отправку с видео и новым сообщением во время воспроизведения.
4. Одиночный и двойной smilie.
5. Клик по загруженному изображению и по `[IMG]`.
6. Plain market URL и `[UNFURL]`.
7. Firefox/Tampermonkey.
8. Копирование текста в BBCode.
9. Отсутствие `pageerror`.

## 13. Анимации и typing

- Новое сообщение в нативном Chatbox входит Svelte `fly` с `x: -20`:
  400 мс, `cubicOut`, прозрачность 0 → 1. No Rules повторяет это CSS-
  анимацией `nr-message-in`; pending и реальное сообщение входят одинаково.
- Контекстное меню нативного чата использует `rise` с `duration: 100`:
  прозрачность 0 → 1 и `translateY(10px)` → 0. No Rules применяет
  `nr-menu-enter` / `nr-menu-in` / `nr-menu-leave`; закрытие по клику вне,
  Escape и скроллу тоже анимируется.
- Typing-фразы берутся из `XenForo.phrases`:
  - один: `{{user}} печатает`;
  - два: `{{user1}} и {{user2}} печатают`;
  - больше: `{{user1}} и еще {{count}} печатают`.
  Пользователь живёт в typing 3000 мс; каждое новое событие переставляет его
  в конец, как нативный `Ie` + `tt` в `chat2.js`.
