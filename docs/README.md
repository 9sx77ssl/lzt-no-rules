# Документация No Rules

Единый индекс. Если не знаешь, с чего начать — сначала `README.md` в корне.

| Документ | О чём |
|---|---|
| [../README.md](../README.md) | обзор проекта, установка, возможности, структура |
| [ARCHITECTURE.md](ARCHITECTURE.md) | архитектура extension и backend, поток данных |
| [EXTENSION.md](EXTENSION.md) | модули userscript, state, рендер, видео, lightbox, смайлы, BBCode, отладка |
| [BACKEND.md](BACKEND.md) | Bun/Node server, HTTP/WS, БД, auth, rate limits, sanitizer, deploy |
| [NATIVE-CHATBOX.md](NATIVE-CHATBOX.md) | reverse engineering нативного Chatbox Lolzteam |
| [BBCode.md](BBCode.md) | поддержка форумного BBCode и правила copy |
| [PROTOCOL.md](PROTOCOL.md) | WebSocket JSON protocol |
| [SECURITY.md](SECURITY.md) | модель угроз, токены, санитайзинг, rate limit |
| [DEPLOYMENT.md](DEPLOYMENT.md) | production: systemd, nginx, Cloudflare, certbot |
| [TESTING.md](TESTING.md) | статические, unit, Playwright, Firefox, mobile, native checks |
| [CHANGELOG.md](CHANGELOG.md) | история версий |

## Быстрые ссылки

- Userscript:
  `https://raw.githubusercontent.com/9sx77ssl/lzt-no-rules/main/extension/dist/no-rules.user.js`
- Health: `https://lztws.d9v.uk/health`
- Version: `https://lztws.d9v.uk/version`
- WS: `wss://lztws.d9v.uk/ws`

## Что считать источником истины

1. `extension/src/*.js` — код, который реально собирается.
2. `server/src/*.js` — backend.
3. `docs/NATIVE-CHATBOX.md` — наблюдения о форуме; если форум изменился,
   сначала обновить этот документ и тесты, потом код.
4. `docs/PROTOCOL.md` — wire format.
