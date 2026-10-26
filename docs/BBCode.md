# BBCode

В чате поддерживается только то, что реально работает в сообщениях:

| BBCode | Результат |
|---|---|
| `[URL]...[/URL]` | ссылка |
| `[URL=...]текст[/URL]` | ссылка с текстом |
| `[IMG]https://...[/IMG]` | фото + fancybox |
| `[IMG=width=800;height=450]https://...[/IMG]` | фото с размером; значения режутся до 5000 px |
| `[MEDIA=youtube]...[/MEDIA]` | media-карточка |
| `[VIDEO]https://...[/VIDEO]` | HTML5 video |
| `[UNFURL="..."]...[/UNFURL]` | market/forum карточка |
| `[USER=id]@ник[/USER]` | нативный mention с аватаром |

Всё остальное (`B`, `I`, `U`, `S`, `COLOR`, `SIZE`, `CENTER`, `LEFT`,
`RIGHT`, `QUOTE`, `LIST`, `EMAIL`, `SPOILER`, `CODE`, `PHP`, `HTML`, `SRC`,
`PLAIN`, `PRICE`, `BUTTON`, `HR`, а также `CLUB`, `DAYS`, `EXCEPTIDS`,
`LANG`, `LIKES`, `LIKES2`, `USERIDS`, `API`, `TOOLTIP`, `VISITOR`, `CENSOR`)
в чате **не форматируется и не вырезается**. Сообщение приходит ровно как
набрано, со скобками и тегами. Например, `[COLOR=#aaa]текст[/COLOR]`
останется `[COLOR=#aaa]текст[/COLOR]`.

## Где это применяется

1. Перед отправкой: `resolveBbcode(normalizeClientHtml(getEditorHtml()))`.
2. При рендере старых сообщений и после F5: `enhanceUnfurls()`.

Tiptap может разбивать ввод на несколько `<p>`/`<br>`; plain-блок
собирается в одну строку перед разбором. После разбора убираются trailing
`<br>`/пустые `<p>`, чтобы сообщение не получало лишнюю строку.

## Почему не `/editor/to-html`

Роуты форума проверены:

- `POST /editor/to-html` с полем `bbCode` разбирает BBCode, но отдаёт
  editor HTML без нативных классов и **возвращает скрытый текст** для
  `CLUB`/`LIKES`; `API`, `PRICE`, `BUTTON`, `MEDIA`, `HR` оставляет
  literal-тегами.
- `POST /editor/to-bb-code` с полем `html` возвращает `bbCode`; это можно
  использовать как fallback для копирования, но обычный `htmlToBbcode`
  уже работает локально без лишнего запроса.

Поэтому парсер локальный и намеренно ограничен рабочими тегами; остальное не
трогается.

## Карточки

- Market-раздел: `.unfurlContainer.shorted.marketItem`, высота 24 px.
- Tiptap `market_search` при рендере приводится к этой же legacy-карточке.
- Форумный раздел: `.forum-wrapper`.
- Фото: `.LbTrigger` + fancybox.
- Media: `.embed-link`; metadata market — через `/editor/unfurl`.

## Копирование

`htmlToBbcode` сохраняет `[UNFURL]`, `[MEDIA]`, `[IMG]`, `[URL]`, `[USER]`,
`[VIDEO]` и пользовательское форматирование, если оно уже есть в HTML.
Новые сообщения с неподдерживаемым BBCode остаются plain-текстом.
