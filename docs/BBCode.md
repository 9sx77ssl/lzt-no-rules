# BBCode

BBCode разбирается дважды:

1. перед отправкой — `resolveBbcode(normalizeClientHtml(getEditorHtml()))`;
2. при рендере — `enhanceUnfurls()` для старых сообщений и после F5.

Теги регистронезависимы. Неизвестные теги остаются текстом.

## Что поддерживается

| BBCode | Результат |
|---|---|
| `[B]`, `[I]`, `[U]`, `[S]` | нативное форматирование |
| `[COLOR=red]`, `[COLOR=#ff0000]` | цвет |
| `[SIZE=1..7]`, `[SIZE=+1]` | размер XenForo: 9–26 px |
| `[URL]`, `[URL=...]`, `[EMAIL]`, `[EMAIL=...]` | ссылка / `mailto:` |
| `[USER=id]ник[/USER]` | mention-блок |
| `[IMG]...[/IMG]` | `a.LbTrigger > img.bbCodeImage.LbImage` |
| `[MEDIA=youtube|soundcloud]...[/MEDIA]` | `.embed-link` карточка |
| `[VIDEO]...[/VIDEO]` | HTML5 video |
| `[UNFURL="url"]url[/UNFURL]` | market/forum unfurl |
| `[LIST]` / `[LIST=1]` + `[*]` | `ul` / `ol` |
| `[LEFT]`, `[CENTER]`, `[RIGHT]` | `div.content--align--*` |
| `[QUOTE]`, `[QUOTE=author]` | `div.bbCodeBlock.bbCodeQuote` |
| `[SPOILER]`, `[SPOILER=title]` | нативная кнопка + `.SpoilerTarget` |
| `[CODE]`, `[PHP]`, `[HTML]`, `[SRC]` | `pre > code` |
| `[PLAIN]` | текст без разбора BBCode |
| `[PRICE]`, `[PRICE=USD]` | `.bbCodePrice` |
| `[BUTTON=url]текст[/BUTTON]` | `a.button.primary` |
| `[HR]` | горизонтальная линия |

Вложенные одинаковые теги, `br` внутри блоков, кавычки и атрибуты без
кавычек поддерживаются. Списки и блоки, набранные через переносы строк,
разбираются как один текстовый блок.

## Почему не оригинальный JS-парсер

В сохранённых чанках `chat2.js`, `xenforo-*.js` и `tiptap-vendor-*.js` нет
клиентского XenForo BBCode-парсера: форум рендерит BBCode на PHP и отдаёт
уже готовый HTML. Публичного `/editor/convert` нет — проверка дала 404.
Поэтому здесь повторён формат HTML, который отдаёт форум, а не подключён
несуществующий клиентский парсер. `[CLUB]`, `[DAYS]`, `[LIKES]` и подобные
теги всё равно нельзя честно вычислить без серверных прав.

## Где parser не равен PHP-парсеру форума

XenForo рендерит BBCode на сервере. Клиентский userscript не может честно
повторить теги, которые зависят от прав пользователя:

`[CLUB]`, `[DAYS]`, `[EXCEPTIDS]`, `[LANG]`, `[LIKES]`, `[LIKES2]`,
`[USERIDS]`, `[API]`.

Они остаются текстом, а не раскрывают скрытый контент и не делают запросы
от имени пользователя. `[CENSOR]` отображается как `div.CensorSpoiler`.

## Нативные карточки

- Market/раздел: `.unfurlContainer.shorted.marketItem` с `categoryIcon`,
  `.title`, `.price` и `.LinkClicker`; высота 24 px, как в живом Chatbox.
- Tiptap-карточка `market_search` при рендере приводится к этой же
  legacy-карточке.
- Форумный раздел: `.unfurl-renderer` + `.forum-wrapper`; заголовок
  подтягивается через `/forums/<slug>/`.
- Медиа: `.embed-link`; market/account metadata — через
  `POST https://api.lolz.team/editor/unfurl` с `basic post`-токеном.

## Copy

`htmlToBbcode()` сохраняет:

| DOM | BBCode |
|---|---|
| market/account card | `[UNFURL="href"]href[/UNFURL]` |
| `.embed-link` | `[MEDIA=site]url[/MEDIA]` |
| `a.LbTrigger img` | `[IMG]src[/IMG]` |
| `a.mention` | `[USER=id]@nick[/USER]` |
| `a.button.primary` | `[BUTTON=href]text[/BUTTON]` |
| `[B]/[I]/[U]/[S]`, quote, spoiler, list, color/size | исходные теги |

Копирование использует `message.raw`, если он есть, иначе —
`htmlToBbcode(message.html)`. Тостов нет.
