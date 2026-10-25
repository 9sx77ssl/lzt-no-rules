# Deployment

Production: `146.103.50.217`, домен `lztws.d9v.uk` за Cloudflare, Ubuntu
24.04, nginx 1.31, Bun 1.4, systemd. TLS — Let's Encrypt, автопродление
certbot. Origin слушает только `127.0.0.1:8787`.

## 1. Предварительно

- DNS A/AAAA `lztws.d9v.uk` → IP сервера, Cloudflare proxied (оранжевая
  тучка).
- Cloudflare SSL/TLS mode: **Full (strict)**.
- Открыты 80/443; 8787 наружу не публикуется.
- Установлены `bun`, `nginx`, `certbot`, `git`, `curl`, `sqlite3`.
- Отдельный системный пользователь `no-rules`.

```bash
useradd --system --home /opt/no-rules --shell /usr/sbin/nologin no-rules
mkdir -p /opt/no-rules/data /var/www/certbot
chown -R no-rules:no-rules /opt/no-rules
```

## 2. Код и зависимости

```bash
git clone https://github.com/9sx77ssl/lzt-no-rules.git /opt/no-rules/app
cd /opt/no-rules/app/server
bun install --production --no-progress
chown -R root:root /opt/no-rules/app
```

Репозиторий публичный, поэтому clone/pull не требуют deploy-key.

## 3. Конфиг

```bash
cp /opt/no-rules/app/.env.example /opt/no-rules/.env
chmod 600 /opt/no-rules/.env
chown no-rules:no-rules /opt/no-rules/.env
```

Заполнить:

- `ACCESS_KEY` — 48+ случайных символов; тот же, что при сборке userscript;
- `ADMIN_USER_IDS` — id администраторов (например, `9252369`);
- `DB_PATH=/opt/no-rules/data/no-rules.db`;
- `PUBLIC_URL=wss://lztws.d9v.uk/ws`;
- `TRUST_PROXY=1`.

Сгенерировать ключ:

```bash
openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_'
```

## 4. systemd

`deploy/no-rules.service`:

```ini
[Unit]
Description=No Rules Chatbox WebSocket server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=no-rules
Group=no-rules
WorkingDirectory=/opt/no-rules/app/server
EnvironmentFile=/opt/no-rules/.env
ExecStart=/usr/local/bin/bun src/index.js
Restart=always
RestartSec=2
...
ReadWritePaths=/opt/no-rules/data
```

Установка:

```bash
install -m 644 /opt/no-rules/app/deploy/no-rules.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now no-rules
systemctl status no-rules --no-pager
curl -s http://127.0.0.1:8787/health
```

## 5. nginx

`deploy/nginx-lztws.d9v.uk.conf`:

- отдельный upstream `no_rules_ws` с keepalive;
- `limit_conn_zone` на IP;
- `map $http_cf_connecting_ip $no_rules_client_ip` — реальный IP из
  Cloudflare;
- HTTP/2 (`http2 on`) + TLS 1.2/1.3;
- `/ws` — `Upgrade`/`Connection`, `proxy_read_timeout 3600s`,
  `proxy_buffering off`, `proxy_socket_keepalive on`;
- `/health`, `/version`, `/`;
- HSTS и security headers.

Установка:

```bash
ln -sf /opt/no-rules/app/deploy/nginx-lztws.d9v.uk.conf /etc/nginx/sites-available/lztws.d9v.uk
ln -sf /etc/nginx/sites-available/lztws.d9v.uk /etc/nginx/sites-enabled/lztws.d9v.uk
nginx -t && systemctl reload nginx
```

> В nginx 1.31 нельзя дублировать `ssl_protocols`, `ssl_session_timeout`,
> `ssl_session_cache` рядом с `include options-ssl-nginx.conf` — они уже
> внутри include. Иначе `nginx -t` падает с `duplicate directive`.

## 6. TLS

Сначала HTTP-only server block с `/.well-known/acme-challenge/` →

```bash
certbot certonly --webroot -w /var/www/certbot -d lztws.d9v.uk \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring
```

Затем полный конфиг с `listen 443 ssl; http2 on;` и путями
`/etc/letsencrypt/live/lztws.d9v.uk/{fullchain,privkey}.pem`.

Проверка:

```bash
certbot certificates
curl -sI https://lztws.d9v.uk/health
curl --resolve lztws.d9v.uk:443:146.103.50.217 -sI https://lztws.d9v.uk/health
```

Certbot renewal timer включён (`systemctl list-timers | grep certbot`).
После продления nginx перезагружается deploy-hook'ом.

## 7. Обновление через git pull

```bash
/opt/no-rules/update.sh
```

Скрипт (`deploy/update.sh`):

1. `git fetch && git pull --ff-only origin main`;
2. `bun install --production` в `app/server`;
3. `systemctl restart no-rules`;
4. health-check; при ошибке — `git reset --hard` на предыдущий commit и
   повторный restart.

Ручной вариант:

```bash
cd /opt/no-rules/app
git pull --ff-only origin main
cd server && bun install --production
systemctl restart no-rules
journalctl -u no-rules -n 50 --no-pager
```

Userscript обновляется отдельно: пересобрать локально, закоммитить
`extension/dist/no-rules.user.js`; Tampermonkey подхватит `@updateURL`.

## 8. Бэкапы и обслуживание

```bash
mkdir -p /opt/no-rules/backups
sqlite3 /opt/no-rules/data/no-rules.db \
  ".backup '/opt/no-rules/backups/no-rules-$(date +%F).db'"
```

- WAL: не копировать `no-rules.db` во время работы `cp`; использовать
  `.backup` или остановить сервис.
- Логи: `journalctl -u no-rules -f`, nginx —
  `/var/log/nginx/no-rules-*.log`.
- Health: `curl -fsS https://lztws.d9v.uk/health`.
- Перезапуск: `systemctl restart no-rules`.
- Проверить, что порт 8787 не слушает `0.0.0.0`:
  `ss -ltnp | grep 8787`.

## 9. Чек-лист после деплоя

- [ ] `systemctl is-active no-rules` → `active`.
- [ ] `curl https://lztws.d9v.uk/health` → `ok:true`.
- [ ] `wss://lztws.d9v.uk/ws` открывается, приходит `hello`.
- [ ] Реальная авторизация форумным токеном и отправка сообщения.
- [ ] `journalctl` без ошибок/секретов.
- [ ] `git -C /opt/no-rules/app status` чистый.
- [ ] `.env` не в git (`git check-ignore -v /opt/no-rules/.env`).
