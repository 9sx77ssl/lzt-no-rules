[QUOTE]
[SIZE=5][B]No Rules — отдельная комната внутри Chatbox Lolzteam[/B][/SIZE]
[SIZE=3][B][COLOR=rgb(145, 109, 109)]Нативный чат, но без правил. И без «Получатель → Детали → Итог».[/COLOR][/B][/SIZE]

[SIZE=4]Пятая комната в боковом меню Chatbox: тот же Svelte-интерфейс, тот же Tiptap, те же reply/edit-бары, контекстное меню и мобильные жесты. Только это отдельная комната со своим WebSocket-сервером и своими сообщениями.[/SIZE]
[/QUOTE]

[CENTER][SIZE=5]Автор темы и расширения: [URL=https://lolz.team/gay1234/]gay1234[/URL][/SIZE]

[SIZE=5]No Rules — это не замена приватных чатов и не E2E-шифрование. Это отдельная комната для тех, у кого установлен userscript.[/SIZE]

[SIZE=3][COLOR=#aaaaaa]Сервер: wss://lztws.d9v.uk/ws · Health: https://lztws.d9v.uk/health · Версия: 1.1.19[/COLOR][/SIZE][/CENTER]

[CENTER][SIZE=6][button=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js] УСТАНОВИТЬ [/button][/SIZE]
[SIZE=2][COLOR=#aaaaaa]Chrome / Edge / Firefox · Tampermonkey или Violentmonkey · один общий userscript[/COLOR][/SIZE]

[SIZE=3][B]Важно: удали все старые копии No Rules в Tampermonkey.[/B] Версии 1.0.1 и 1.1.8 конфликтуют с новой и могут ломать авторизацию.[/SIZE][/CENTER]

[SIZE=4][B]Что умеет[/B][/SIZE]
[LIST]
[*][B]Отдельная комната No Rules[/B] в нативном боковом меню Chatbox. Работает в полноэкранном /chatbox/ и в плавающем виджете на любой странице.
[*][B]Полностью нативный интерфейс:[/B] группы сообщений, аватары, цвета/градиенты ников, разделители дней, контекстное меню, reply и edit.
[*][B]Отправка, редактирование, удаление, ответы и упоминания.[/B] Reply сохраняет полный HTML оригинала: фото, видео, embeds, unfurl-карточки и mention-блоки.
[*][B]Живой @ник[/B] после отправки превращается в нативный mention с аватаркой, цветом и SVG-значком. Несуществующий ник остаётся обычным текстом.
[*][B]Стрелка вверх[/B] в пустом поле ввода открывает редактирование последнего своего сообщения — как в нативном Chatbox.
[*][B]Одинаковые сообщения разрешены.[/B] Можно отправить два одинаковых текста подряд — оба останутся.
[*][B]Нативный просмотр фотографий:[/B] клик по картинке открывает форумный fancybox, а не новую вкладку.
[*][B]Нативный видеоплеер XenForo:[/B] play/pause, прогресс, громкость, fullscreen, poster. В редакторе видео играет без звука, в reply-баре есть HTML5-кнопки.
[*][B]Смайлы как на форуме:[/B] один смайл в сообщении увеличивается до 96×96, несколько смайлов остаются обычного размера.
[*][B]Карточки форума, YouTube, SoundCloud, TikTok, Spotify и market/аккаунтов lzt.market[/B] — с иконкой категории, названием и ценой.
[*][B]BBCode:[/B] B, I, U, S, CODE, QUOTE, URL, IMG, MEDIA, UNFURL, USER — можно вставлять готовые форумные блоки, они отрендерятся.
[*][B]Копирование в BBCode:[/B] фото, медиа, аккаунты, ссылки, упоминания и форматирование копируются как IMG, MEDIA, UNFURL и т.д.
[*][B]История с подгрузкой,[/B] сохранение позиции скролла, счётчик непрочитанных, кнопка «новые сообщения».
[*][B]Presence, typing, системные сообщения и жалобы.[/B] В «Онлайн: N» показываются участники именно No Rules.
[*][B]Никаких собственных тостов.[/B] В нативном Chatbox их нет — диагностика только в console.debug.
[/LIST]

[CENTER][SIZE=4][B]Почему это выглядит нативно[/B][/SIZE][/CENTER]

[SIZE=4]Расширение не рисует «свой чат сбоку». Оно клонирует живые классы Svelte Chatbox: [B]chat2-message-group[/B], [B]chat2-message-block[/B], [B]message-actions[/B], [B]chat2-replying[/B], [B]chat2-message-editing[/B]. Недостающие CSS ленивых чанков (меню, spinner, online-модалка, video player, unfurl) скопированы с теми же хешами.[/SIZE]

[SIZE=4]Фото открываются через нативный [B]LbTrigger[/B] и fancybox, видео — через [B]XenForo.VideoPlayer[/B] и [B][data-lzt-video-player][/B], смайлы — через нативный [B]mceSmilieLarge[/B].[/SIZE]

[QUOTE]
[SIZE=4][B]Техническая часть[/B][/SIZE]
[SIZE=3]Userscript + отдельный backend на Bun, WebSocket и SQLite. Авторизация через временный токен форума: на сервер уходит только read-JWT, пароль и cookies форума — нет. Сессия хранится как SHA-256, сам JWT не пишется в БД и логи. Для unfurl используется отдельный basic/post-токен только локально в браузере — на backend он не отправляется.[/SIZE]
[/QUOTE]

[SIZE=4][B]Установка[/B][/SIZE]
[LIST=1]
[*]Поставь [B]Tampermonkey[/B] (Chrome / Edge / Firefox) или [B]Violentmonkey[/B] (Firefox / Chrome).
[*]Нажми кнопку [B]УСТАНОВИТЬ[/B] выше.
[*]Удали старые копии No Rules, если они есть, и оставь одну версию [B]1.1.19[/B].
[*]Открой [URL=https://lolz.team/chatbox/]lolz.team/chatbox/[/URL], боковое меню → [B]No Rules[/B].
[*]При первом входе форум выдаст короткоживущий токен. Пароль и cookies никуда не отправляются.
[/LIST]

[SIZE=4][B]Если Firefox пишет «Онлайн: 0»[/B][/SIZE]
[SIZE=4]Обнови userscript до [B]1.1.19[/B]. В этой версии исправлен Firefox/Tampermonkey: WebSocket с [B]Origin: null[/B] больше не отбивается сервером, а клиент использует page fetch/socket. Старые копии 1.0.1/1.1.8 нужно удалить.[/SIZE]

[CENTER][SIZE=4][B]Ссылки[/B][/SIZE]
[URL=https://github.com/9sx77ssl/lzt-no-rules]GitHub: 9sx77ssl/lzt-no-rules[/URL]
[URL=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js]Raw userscript[/URL]
[URL=https://lztws.d9v.uk/health]Health сервера[/URL]
[/CENTER]

[SIZE=2][COLOR=#aaaaaa]Не E2E: сообщения хранятся в SQLite на сервере и доступны администратору. Не отправляй туда то, что не должен видеть владелец сервера. Комната работает только у тех, у кого установлен userscript.[/COLOR][/SIZE]
