[QUOTE]
[SIZE=5][B]No Rules пятая комната в Chatbox[/B][/SIZE]
[SIZE=4]Вытрахал форум чата дипсиком, наслопил свой [tooltip=962]сокет[/tooltip] и тадам, тот же [tooltip=977]интерфейс[/tooltip], но свой сервер и свои сообщения - без правил общего чата.[/SIZE]
[/QUOTE]
[CENTER][IMG=align=left;alt=%5BIMG%5D]https://nztcdn.com/files/cdbdaf88-5b3f-4546-bda2-cab4fb0d4c4d.webp[/IMG][IMG=align=left;alt=%5BIMG%5D]https://nztcdn.com/files/b5bf1aaf-f6b4-450e-9e34-2f0a1468b28d.webp[/IMG][/CENTER]

[CENTER][SIZE=6][button=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js] УСТАНОВИТЬ [/button][/SIZE]
[SIZE=2][COLOR=#aaaaaa]Chrome / Edge / Firefox · Tampermonkey или Violentmonkey · 1.3.7[/COLOR][/SIZE][/CENTER]

[SIZE=4][B]Что внутри[/B][/SIZE]
[LIST]
[*]Reply с полным HTML, редактирование, удаление
[*]Фото через fancybox форумный, видео через XenForo-плеер, смайлы как на форуме
[*]Карточки форума, YouTube, SoundCloud, TikTok, Spotify и [UNFURL='https://lzt.market']lzt.market[/UNFURL]
[*]BBCode и копирование сообщений в него; смайлы копируются как `:shortcode:`
[*]Лимит 512 символов в поле и на сервере, автоскролл к низу после медиа
[*]История, онлайн текущей румы, typing, unread, мобильный вид и виджет
[*]Весь джс был переебан и перенесен, свой [tooltip=962]сокет[/tooltip] БЕЗ ЛАГОВ!!!
[*]Сурсы все на гите, заходим смотрим и хейтим слоп, усилий было приложено мало  :rooster_talk:
[*]Багов дохуя, все репортим пишем в тему спасибо заебись
[/LIST]

[SIZE=4][B]Как это работает???[/B][/SIZE]

[SIZE=4][B]Даем голос deepseek v4.1 flash:[/B][/SIZE]
[SIZE=4]Внешний вид взят из живого Chatbox: Svelte-классы, CSS, Tiptap, меню, reply/edit-бары. Сервер отдельный: Bun, [tooltip=962]WebSocket[/tooltip], SQLite - на нём сообщения, сессии, онлайн, typing и история; форумный [tooltip=962]сокет[/tooltip] не участвует. Если интернет пропал, отправленное лежит в очереди, переживает F5 и уходит, когда связь вернулась; повтор не создаёт дубль. Пропущенное клиент добирает после reconnect.[/SIZE]

[SIZE=4][B]Что куда уходит[/B][/SIZE]
[SIZE=4]На wss://lztws.d9v.uk/ws уходит только то, что нужно комнате: временный read-токен форума, своя сессия, access key, версия клиента, текст и HTML сообщений, clientId, replyTo, id и HTML правок, id удалений, typing, онлайн, heartbeat и жалобы. Недосланное сначала лежит в localStorage.[/SIZE]
[SIZE=4]Не уходит: пароль, cookies форума, _xfToken, CSRF, xf_user, xf_session и платёжные данные. basic post-токен для unfurl остаётся в браузере. Фото и видео грузятся с форумного CDN, а не через наш сервер. Токен только read: сервер не может писать на форуме, банить или переводить.[/SIZE]
[SIZE=4]В SQLite лежат сообщения, публичный профиль (id, ник, аватар, цвет, ссылка), сессии в виде SHA-256 и репорты. Сам forum-токен не хранится и не логируется. IP сервер видит через nginx/Cloudflare как любой сайт, в базу он не пишется. Сообщения не E2E: владелец сервера может их прочитать.[/SIZE]

[SIZE=4][B]Установка[/B][/SIZE]
[SIZE=4]1. Поставь Tampermonkey или Violentmonkey.[/SIZE]
[SIZE=4]2. Нажми УСТАНОВИТЬ.[/SIZE]
[SIZE=4]3. Обнови [UNFURL='https://lolz.team']lolz.team[/UNFURL] и открой No Rules в боковом меню.[/SIZE]

[SIZE=4][tooltip=583]Баги[/tooltip] и идеи - в [URL='https://github.com/9sx77ssl/lzt-no-rules/issues']issues[/URL].[/SIZE]

[CENTER][URL='https://github.com/9sx77ssl/lzt-no-rules']GitHub[/URL] · [URL='https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js']Raw[/URL] · [URL='https://lztws.d9v.uk/health']Health[/URL][/CENTER]
