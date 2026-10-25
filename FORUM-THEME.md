[QUOTE]
[SIZE=5][B]No Rules — пятая комната в Chatbox[/B][/SIZE]
[SIZE=4]Сделал отдельную комнату внутри форумного чата. Тот же интерфейс, но свой сервер и свои сообщения — без правил общего чата.[/SIZE]
[/QUOTE]

[SIZE=4]No Rules открывается из бокового меню на /chatbox/ или в плавающем виджете. Внутри — reply, редактирование, удаление, упоминания, фото, видео, смайлы, карточки и BBCode. Можно отправить два одинаковых сообщения подряд — оба останутся.[/SIZE]

[CENTER][SIZE=6][button=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js] УСТАНОВИТЬ [/button][/SIZE]
[SIZE=2][COLOR=#aaaaaa]Chrome / Edge / Firefox · Tampermonkey или Violentmonkey · 1.1.20[/COLOR][/SIZE][/CENTER]

[SIZE=4][B]Что внутри[/B][/SIZE]
[LIST]
[*]Reply с полным HTML, редактирование, удаление, ArrowUp
[*]Фото через fancybox, видео через XenForo-плеер, смайлы как на форуме
[*]Карточки форума, YouTube, SoundCloud, TikTok, Spotify и lzt.market
[*]BBCode и копирование сообщений в него
[*]История, онлайн, typing, unread, мобильный вид и виджет
[/LIST]

[SIZE=4][B]Как это работает[/B][/SIZE]
[SIZE=4]Внешний вид взят из живого Chatbox: Svelte-классы, CSS, Tiptap, меню, reply/edit-бары. Сервер написан отдельно на Bun, WebSocket и SQLite. Если интернет пропал, сообщение лежит в очереди, переживает F5 и уходит после реконнекта; повтор не создаёт дубль. После реконнекта клиент догоняет пропущенную историю.[/SIZE]

[SIZE=4][B]Установка[/B][/SIZE]
[SIZE=4]1. Поставь Tampermonkey или Violentmonkey.
2. Нажми УСТАНОВИТЬ.
3. Обнови lolz.team и открой No Rules в боковом меню.[/SIZE]

[SIZE=3][B]Сначала удали старые копии No Rules.[/B] Версии 1.0.1 и 1.1.8 конфликтуют с 1.1.20.[/SIZE]

[SIZE=4][B]Если Firefox пишет «Онлайн: 0»[/B][/SIZE]
[SIZE=4]Обнови до 1.1.20. В 1.1.19 починен Firefox: сокет с Origin: null больше не отбивается, запросы идут через page-context.[/SIZE]

[SIZE=4]Баги и идеи — в [URL=https://github.com/9sx77ssl/lzt-no-rules/issues]issues[/URL].[/SIZE]

[CENTER][URL=https://github.com/9sx77ssl/lzt-no-rules]GitHub[/URL] · [URL=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js]Raw[/URL] · [URL=https://lztws.d9v.uk/health]Health[/URL]
[SIZE=2][COLOR=#aaaaaa]Автор: [URL=https://lolz.team/gay1234/]gay1234[/URL] · Пароль и cookies форума на сервер не уходят. Сообщения хранятся в SQLite у владельца сервера — это не E2E.[/COLOR][/SIZE][/CENTER]
