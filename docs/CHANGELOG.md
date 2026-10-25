# Changelog

## 1.1.17

- Backend auth принимает только read/chatbox JWT и отклоняет scope `post`;
  `basic post`-токен для `/editor/unfurl` остаётся client-side и на backend
  не отправляется.

## 1.1.16

- Нативный fancybox для фотографий: «голые» `<img>` оборачиваются в
  `a.LbTrigger` с `data-fancybox="gallery"`; аватары, смайлы и картинки
  внутри карточек не трогаются.
- Нативное поведение одиночного смайла: ровно один `.mceSmilie` в сообщении
  получает `mceSmilieLarge` 96×96; несколько смайлов или смайл с текстом —
  без изменений.
- Документация: полный README, EXTENSION, BACKEND, NATIVE-CHATBOX, BBCode,
  CHANGELOG.

## 1.1.15

- Legacy-карточка аккаунта `lzt.market`: `unfurlContainer.marketItem`,
  `categoryIcon <category>`, `title`, `price`, `Value`, `LinkClicker`.
- Plain URL и `[UNFURL="..."]...[/UNFURL]` для market/accounts.
- BBCode parser: `[IMG]`, `[MEDIA]`, `[UNFURL]`, `[URL]`, `[B/I/U/S]`,
  `[CODE]`, `[QUOTE]`, `[VIDEO]`, `[USER]`.
- BBCode copy: `[UNFURL]`, `[MEDIA]`, `[IMG]`, `[URL]`, `[USER]`.
- `price`/`Value` добавлены в серверный и клиентский allowlist.
- Старые «голые» market-ссылки hydrate-ятся через `/editor/unfurl`.

## 1.1.14

- `ArrowUp` в пустом редакторе открывает редактирование последнего своего
  сообщения в активной комнате.
- Инкрементальный рендер сообщений: unchanged DOM-узлы переиспользуются по
  `messageRenderKey`.
- Видео-плеер больше не пересоздаётся при каждом новом сообщении: нет
  спиннера/перезагрузки/сброса `currentTime`.

## 1.1.13

- Poster для видео в нативном плеере (`.webp` для nztcdn).
- `XenForo.activate` для новых видео-сообщений после F5.

## 1.1.12

- Нативный XenForo video player: `.aspect.lztng-tn70wf`,
  `[data-lzt-video-player]`, controls/playbar/fullscreen.
- Видео в редакторе — muted autoplay.
- Reply bar/зелёный reply — HTML5 controls + poster.
- Fixed video layout jitter (`:has(video)` column + fixed preview size).

## 1.1.11

- Нативный `.chat2-error` вместо кастомного connection banner.
- Абсолютные строковые URL для `/login/generate-temporary-token` и
  `/members/find` — Firefox/Tampermonkey sandbox.
- Fallback `#no-rules-messages` после retry, если Svelte удалил native
  messages.
- `@namespace` возвращён на `https://lolz.team/no-rules` для обновлений.

## 1.1.10

- Первый Firefox-auth fix: absolute page fetches.
- Native connection error UI.
- Документация про удаление старых копий.

## 1.1.9

- Native `.chat2-error`.
- Absolute URL string fix (не URL-объект, иначе форумный `fetch` падает).

## 1.1.8

- Reply HTML полностью сохраняется (`reply_html`, schema 5).
- Mention/unfurl/media preserving in replies.
- Server version 1.1.8.

## 1.1.0–1.1.7

- Нативные шаблоны Svelte Chatbox, контекстное меню, reply/edit bars,
  typing, online modal, floating widget.
- Mentions, media cards, unfurl cards, BBCode copy.
- Bun WebSocket backend, SQLite, auth via forum token, sessions, rate limits,
  sanitizer, antibot.
- Systemd/nginx production, no Docker.
