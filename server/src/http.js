import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

export function createHttpServer({ config, db, logger, getOnline }) {
  const startedAt = Date.now();

  const handler = (req, res) => {
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      sendJson(res, 400, { ok: false, error: 'bad_request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      const allowed = config.allowedOrigins.includes(origin);
      res.writeHead(allowed ? 204 : 403, {
        ...(allowed ? { 'access-control-allow-origin': origin } : {}),
        'access-control-allow-methods': 'GET, HEAD, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin',
      });
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }

    if (url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        name: 'no-rules-chat',
        version: config.version,
        protocol: 1,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        online: getOnline(),
        messages: db.countMessages(),
        time: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname === '/version') {
      sendJson(res, 200, {
        name: 'no-rules-chat',
        version: config.version,
        protocol: 1,
        publicUrl: config.publicUrl,
      });
      return;
    }

    if (url.pathname === '/') {
      sendJson(res, 200, {
        ok: true,
        name: 'no-rules-chat',
        version: config.version,
        protocol: 1,
        websocket: '/ws',
        health: '/health',
      });
      return;
    }

    logger.debug('http.not_found', { path: url.pathname, ip: req.socket.remoteAddress });
    sendJson(res, 404, { ok: false, error: 'not_found' });
  };

  const server =
    config.tlsKeyPath && config.tlsCertPath
      ? https.createServer(
          {
            key: readFileSync(config.tlsKeyPath),
            cert: readFileSync(config.tlsCertPath),
          },
          handler,
        )
      : http.createServer(handler);

  server.on('clientError', (error, socket) => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : 'client_error';
    logger.debug('http.client_error', { error: code });
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n');
  });

  return server;
}
