# Research: нативные JS-чанки Chatbox

Здесь лежат **сохранённые JavaScript-чанки** Lolzteam Chatbox, которые
использовались для reverse engineering No Rules. Это не исходный код проекта
и не библиотека: файлы принадлежат форуму и оставлены только как справочный
материал.

- `chatbox/javascript/` — минифицированные production-чанки (Svelte Chatbox,
  Tiptap, XenForo, video player, smilies, unfurl).
- Сетевые дампы, DOM-снимки и antibot-скрипты намеренно не коммитятся: в
  заголовках/ответах могут быть пользовательские токены и cookies.

Полезные точки входа:

| Файл | Что искать |
|---|---|
| `chat2.js` | Svelte Chatbox, сообщения, composer, reply, online, smilies |
| `core.js` | `XenForo.VideoPlayer`, `LbTrigger`, активация |
| `tiptap-vendor-D_wJkECX.js` | Tiptap-ноды и CSS unfurl/media/video/image |
| `api-DvhrAPCR.js` | `xenApiFetch`, Bearer-токены |
| `StatusInput-*.js` | status/input |
| `script*.js` | XenForo legacy, lightbox/fancybox |

Подробный разбор — [../docs/NATIVE-CHATBOX.md](../docs/NATIVE-CHATBOX.md).

Не используйте эти файлы как источник готового кода: версии чанков меняются
вместе с форумом, имена/hash-классы (`lztng-*`) не являются стабильным API.
