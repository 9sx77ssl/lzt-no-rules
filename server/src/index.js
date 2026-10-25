import { config as baseConfig } from './config.js';
import { pathToFileURL } from 'node:url';
import { createLogger } from './logger.js';
import { openDatabase } from './db.js';
import { createSanitizer } from './sanitize.js';
import { AuthService } from './auth.js';
import { createHttpServer } from './http.js';
import { createWsServer } from './ws.js';

export function createApplication(overrides = {}) {
  const config = { ...baseConfig, ...overrides };
  const logger = createLogger(config.logLevel);
  const db = openDatabase({ path: config.dbPath, logger });
  const sanitizer = createSanitizer({
    allowExternalImages: config.allowExternalImages,
    maxMessageHtml: config.maxMessageHtml,
    maxMessageText: config.maxMessageText,
    maxImagesPerMessage: config.maxImagesPerMessage,
    maxLinksPerMessage: config.maxLinksPerMessage,
    maxMentionsPerMessage: config.maxMentionsPerMessage,
    maxNewlinesPerMessage: config.maxNewlinesPerMessage,
  });
  const auth = new AuthService({ config, db, logger, sanitizer });
  const httpServer = createHttpServer({
    config,
    db,
    logger,
    getOnline: () => wsServer.onlineCount(),
  });
  const wsServer = createWsServer({
    server: httpServer,
    config,
    db,
    auth,
    sanitizer,
    logger,
  });

  let listening = false;
  let closed = false;

  async function listen() {
    if (listening) return httpServer.address();
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(config.port, config.host, () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
    listening = true;
    logger.info('server.listening', {
      host: config.host,
      port: config.port,
      publicUrl: config.publicUrl,
      env: config.env,
      allowedOrigins: config.allowedOrigins,
      allowedUsers: config.allowedUserIds.size > 0 ? config.allowedUserIds.size : 'all',
    });
    return httpServer.address();
  }

  async function close(reason = 'shutdown') {
    if (closed) return;
    closed = true;
    logger.info('server.closing', { reason });
    const force = setTimeout(() => {
      logger.warn('server.force_close');
      httpServer.closeAllConnections?.();
      process.exitCode = 1;
    }, 8_000);
    force.unref?.();

    try {
      await wsServer.close();
    } catch (error) {
      logger.warn('server.ws_close_failed', { error: error?.name || 'error' });
    }
    if (listening) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
        setTimeout(() => {
          httpServer.closeAllConnections?.();
          resolve();
        }, 2_000).unref?.();
      });
    }
    clearTimeout(force);
    try {
      db.close();
    } catch (error) {
      logger.warn('server.db_close_failed', { error: error?.name || 'error' });
    }
    logger.info('server.closed');
  }

  return {
    config,
    logger,
    db,
    sanitizer,
    auth,
    httpServer,
    wsServer,
    listen,
    close,
  };
}

async function main() {
  const app = createApplication();
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.logger.info('server.signal', { signal });
    try {
      await app.close(signal);
      process.exit(0);
    } catch (error) {
      app.logger.error('server.shutdown_failed', { error: error?.message || String(error) });
      process.exit(1);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    app.logger.error('process.unhandled_rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (error) => {
    app.logger.error('process.uncaught_exception', { error: error?.message || String(error) });
    shutdown('uncaughtException');
  });

  try {
    await app.listen();
  } catch (error) {
    app.logger.error('server.listen_failed', { error: error?.message || String(error) });
    await app.close('listen_failed');
    process.exit(1);
  }

  const authCleanup = setInterval(() => {
    try {
      app.auth.cleanup();
    } catch (error) {
      app.logger.warn('auth.cleanup_failed', { error: error?.name || 'error' });
    }
  }, 60 * 60 * 1000);
  authCleanup.unref?.();
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main();
}
