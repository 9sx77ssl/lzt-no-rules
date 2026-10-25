# BBCode

No Rules принимает форумный BBCode двумя путями:

1. **Перед отправкой** — `resolveBbcode(getEditorHtml())` в
   `sendCurrentMessage`/`saveEdit`.
2. **При рендере** — `enhanceUnfurls()` вызывает `resolveBbcode` для старых
   сообщений, которые уже лежат в БД как текст.

Поэтому BBCode из буфера обмена не нужно вставлять вручную в HTML.

## Поддерживаемые теги

| BBCode | Результат |
|---|---|
| `[B]текст[/B]` | `<strong>текст</strong>` |
| `[I]текст[/I]` | `<em>текст</em>` |
| `[U]текст[/U]` | `<u>текст</u>` |
| `[S]текст[/S]` | `<s>текст</s>` |
| `[CODE]текст[/CODE]` | `<code>текст</code>` |
| `[QUOTE]текст[/QUOTE]` | `<blockquote>текст</blockquote>` |
| `[URL=https://...]текст[/URL]` | ссылка |
| `[IMG]https://...[/IMG]` | `a.LbTrigger > img.bbCodeImage.LbImage` |
| `[MEDIA=youtube]https://...[/MEDIA]` | `.embed-link` карточка |
| `[VIDEO]https://...[/VIDEO]` | `<video controls>` |
| `[UNFURL="https://..."]https://...[/UNFURL]` | market/forum unfurl |
| `[USER=123]@nick[/USER]` | mention-блок |

Теги регистронезависимы. Неизвестные теги остаются текстом.

## Примеры

### Аккаунт

```bbcode
[UNFURL="https://lzt.market/266223421/"]https://lzt.market/266223421/[/UNFURL]
```

Становится legacy-карточкой:

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

Перед сборкой карточки клиент запрашивает
`POST https://api.lolz.team/editor/unfurl` с Bearer-токеном `basic post`,
поэтому цена/категория/название берутся с форума, а не выдумываются.

### Фото

```bbcode
[img]https://nztcdn.com/files/....webp[/img]
```

Становится:

```html
<a class="LbTrigger" href="..." data-href="https://lolz.team/misc/lightbox"
   data-fancybox="gallery">
  <img class="bbCodeImage LbImage" src="..." alt="[IMG]" loading="lazy">
</a>
```

Клик открывает нативный fancybox, а не новую вкладку.

### YouTube

```bbcode
[MEDIA=youtube]https://www.youtube.com/watch?v=az7_Zxmdgd0[/MEDIA]
```

Становится `.embed-link[data-site-id=youtube]` с подписью «Видео на Youtube».

### Ссылка

```bbcode
[URL=https://lolz.team/forums/contests]Розыгрыши[/URL]
```

Если у ссылки есть кастомный текст, auto-unfurl её **не** заменяет на
карточку; она остаётся обычной ссылкой.

### Упоминание

```bbcode
[USER=9252369]@yolo[/USER]
```

Создаёт `a.username.mention[data-user="9252369, yolo"]` с
`span.styleUserNickname`. Нативный аватар/иконка не подтягиваются, потому
что BBCode-тег не содержит rendered HTML; можно отдельно вызвать
`/members/find`.

## Копирование

`htmlToBbcode` при копировании сообщения:

| DOM | BBCode |
|---|---|
| `.unfurlContainer.marketItem` | `[UNFURL="href"]href[/UNFURL]` |
| `.unfurl-renderer .forum-wrapper` | `[UNFURL="href"]href[/UNFURL]` |
| `.embed-link` | `[MEDIA=site]url[/MEDIA]` |
| `a.LbTrigger img` | `[IMG]src[/IMG]` |
| `a.mention` | `[USER=id]@nick[/USER]` |
| `<a href>text</a>` | `[URL=href]text[/URL]` |
| `<b>/<i>/<u>/<s>` | `[B]/[I]/[U]/[S]` |
| `video[src]` | `[VIDEO]src[/VIDEO]` |

Копирование использует `message.raw`, если он есть, иначе —
`htmlToBbcode(message.html)`. Никаких toast-уведомлений.

## Ограничения

- Парсер рассчитан на плоские/умеренно вложенные BBCode-теги; он не является
  полным XenForo BBCode-парсером.
- `[QUOTE]` не сохраняет автора/ссылку на оригинал.
- Неизвестные атрибуты тегов отбрасываются.
- Внутри `<code>`/`<pre>` BBCode не парсится.
- Ссылки в `[URL]` проходят через клиентский/серверный allowlist URL.
- Если `/editor/unfurl` недоступен, `[UNFURL]` остаётся кликабельной ссылкой,
  а не ломает отправку.
- Для аккаунтов без цены (`extra.price` нет) блок показывается без плашки
  цены.

## Проверка

```js
// после отправки BBCode
document.querySelector('#no-rules-messages .unfurlContainer.marketItem .price')
document.querySelector('#no-rules-messages a.LbTrigger img')
document.querySelector('#no-rules-messages .embed-link[data-site-id="youtube"]')
```

Скопировать текст: правый клик → «Скопировать текст»; ожидается исходный
BBCode, например `[IMG]...[/IMG]` или `[UNFURL="..."]...[/UNFURL]`.
