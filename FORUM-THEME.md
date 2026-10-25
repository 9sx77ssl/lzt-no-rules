[QUOTE]
[SIZE=5][B]No Rules — отдельная комната внутри Chatbox Lolzteam[/B][/SIZE]
[SIZE=3][B][COLOR=rgb(145, 109, 109)]Нативный чат, но без правил. И без «Получатель → Детали → Итог».[/COLOR][/B][/SIZE]

[SIZE=4]Пятая комната в боковом меню Chatbox: тот же Svelte-интерфейс, тот же Tiptap, те же reply/edit-бары, контекстное меню и мобильные жесты. Только это отдельная комната со своим WebSocket-сервером и своими сообщениями.[/SIZE]
[/QUOTE]

[CENTER][SIZE=5]Автор темы и расширения: [URL=https://lolz.team/gay1234/]gay1234[/URL][/SIZE]

[SIZE=5]No Rules — это не замена приватных чатов и не E2E-шифрование. Это отдельная комната для тех, у кого установлен userscript.[/SIZE]

[SIZE=3][COLOR=#aaaaaa]Сервер: wss://lztws.d9v.uk/ws · Health: https://lztws.d9v.uk/health · Версия: 1.1.20[/COLOR][/SIZE][/CENTER]

[CENTER][SIZE=6][button=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js] УСТАНОВИТЬ [/button][/SIZE]
[SIZE=2][COLOR=#aaaaaa]Chrome / Edge / Firefox · Tampermonkey или Violentmonkey · один общий userscript[/COLOR][/SIZE]

[SIZE=3][B]Важно: удали все старые копии No Rules в Tampermonkey.[/B] Версии 1.0.1 и 1.1.8 конфликтуют с новой и могут ломать авторизацию.[/SIZE][/CENTER]

[CENTER][SIZE=4][B]Как это работает по-человечески[/B][/SIZE][/CENTER]

[SIZE=4][B]No Rules — это не отдельный сайт и не ещё один iframe.[/B] Userscript находит живой Chatbox прямо на Lolzteam, добавляет в боковое меню пятый пункт и подменяет список сообщений на свой. Внешне это тот же чат: те же группы, аватарки, плашки, reply, редактирование, меню по правому клику и мобильные свайпы.[/SIZE]

[SIZE=4][B]Собственный сокет написан с нуля.[/B] Нативный Chatbox ходит на сервер форума, а No Rules — на отдельный WebSocket-backend на Bun. Он хранит сообщения в SQLite, выдаёт сессии, считает онлайн, принимает typing, отдаёт историю и переподключается, если интернет моргнул. Поэтому это реально отдельная комната, а не имитация нативной.[/SIZE]

[SIZE=4][B]Перенесли не чат, а его поведение.[/B] Из нативного Chatbox взяты Svelte-классы и CSS, composer на Tiptap, контекстное меню, reply/edit-бары, mention-блоки, карточки ссылок, видео-плеер, fancybox для фото и увеличение одиночного смайла. Серверную часть, авторизацию, историю, presence и переподключение написали заново под свой backend.[/SIZE]

[LIST]
[*][B]Визуал:[/B] нативные chat2-message-group, chat2-message-block, message-actions, chat2-replying, chat2-message-editing и те же CSS-переменные темы.
[*][B]Контент:[/B] текст, фото, видео, YouTube/SoundCloud/TikTok, форумные unfurl-карточки, market/аккаунты, упоминания и BBCode.
[*][B]Поведение:[/B] reply с полным HTML, edit, delete, ArrowUp → edit last, две одинаковые сообщения подряд, unread, история, скролл и мобильные жесты.
[*][B]Своё:[/B] WebSocket-сервер, SQLite, auth через временный токен форума, rate limit, санитайзер, outbox при обрыве и Firefox-фиксы.
[/LIST]

[SIZE=4][B]Чат без правил — но не без границ.[/B] Комната называется No Rules, потому что это отдельное пространство без нативных правил и модерации форума. Но доступ только у тех, у кого стоит userscript, плюс есть серверные лимиты на спам и sanitize HTML. Пароль и cookies форума на наш backend не отправляются.[/SIZE]

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
[*][B]Сообщения не теряются при обрыве.[/B] Отправленное в офлайне лежит в outbox, переживает F5, отправляется после reconnect и не дублируется благодаря clientId. Если сервер ответил rate limit, клиент сам повторяет пачку после паузы.
[*][B]Presence, typing, системные сообщения и жалобы.[/B] В «Онлайн: N» показываются участники именно No Rules.
[*][B]Никаких собственных тостов.[/B] В нативном Chatbox их нет — диагностика только в console.debug.
[/LIST]

[CENTER][SIZE=4][B]Почему это выглядит нативно[/B][/SIZE][/CENTER]

[SIZE=4]Расширение не рисует «свой чат сбоку». Оно клонирует живые классы Svelte Chatbox: [B]chat2-message-group[/B], [B]chat2-message-block[/B], [B]message-actions[/B], [B]chat2-replying[/B], [B]chat2-message-editing[/B]. Недостающие CSS ленивых чанков (меню, spinner, online-модалка, video player, unfurl) скопированы с теми же хешами.[/SIZE]

[SIZE=4]Фото открываются через нативный [B]LbTrigger[/B] и fancybox, видео — через [B]XenForo.VideoPlayer[/B] и [B]data-lzt-video-player[/B], смайлы — через нативный [B]mceSmilieLarge[/B].[/SIZE]

[QUOTE]
[SIZE=4][B]Техническая часть без мата[/B][/SIZE]
[SIZE=3]Userscript находит элемент .chat2 с aria-label chatbox, получает нативные шаблоны из живого DOM и рисует свою комнату поверх. Сообщения идут по WebSocket на wss://lztws.d9v.uk/ws; backend на Bun принимает их, проверяет временный read-JWT форума и кладёт в SQLite. В БД хранится только SHA-256 от нашей сессии, сам forum-JWT не сохраняется и не логируется. Отдельный basic post-токен нужен только браузеру для /editor/unfurl — на backend он не уходит.[/SIZE]
[/QUOTE]

[SIZE=4][B]Установка[/B][/SIZE]
[LIST=1]
[*]Поставь [B]Tampermonkey[/B] (Chrome / Edge / Firefox) или [B]Violentmonkey[/B] (Firefox / Chrome).
[*]Нажми кнопку [B]УСТАНОВИТЬ[/B] выше.
[*]Удали старые копии No Rules, если они есть, и оставь одну версию [B]1.1.20[/B].
[*]Открой [URL=https://lolz.team/chatbox/]lolz.team/chatbox/[/URL], боковое меню → [B]No Rules[/B].
[*]При первом входе форум выдаст короткоживущий токен. Пароль и cookies никуда не отправляются.
[/LIST]

[SIZE=4][B]Если Firefox пишет «Онлайн: 0»[/B][/SIZE]
[SIZE=4]Обнови userscript до [B]1.1.20[/B]. Начиная с 1.1.19 исправлен Firefox/Tampermonkey: WebSocket с [B]Origin: null[/B] больше не отбивается сервером, а клиент использует page fetch/socket. Старые копии 1.0.1/1.1.8 нужно удалить.[/SIZE]

[CENTER][SIZE=4][B]Ссылки[/B][/SIZE]
[URL=https://github.com/9sx77ssl/lzt-no-rules]GitHub: 9sx77ssl/lzt-no-rules[/URL]
[URL=https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js]Raw userscript[/URL]
[URL=https://lztws.d9v.uk/health]Health сервера[/URL]
[/CENTER]

[SIZE=2][COLOR=#aaaaaa]Не E2E: сообщения хранятся в SQLite на сервере и доступны администратору. Не отправляй туда то, что не должен видеть владелец сервера. Комната работает только у тех, у кого установлен userscript.[/COLOR][/SIZE]
