import 'dotenv/config';
import { app } from "./server/app";
import { PORT, IS_PROD, DATABASE_URL, REDIS_URL } from "./server/config/index";
import { migrate } from "./server/infrastructure/db/migrate";
import { migratePg } from "./server/infrastructure/db/migratePg";
import { closePgPool } from "./server/infrastructure/pg";
import { closeRedis } from "./server/infrastructure/redis";
import { closeDb } from "./server/infrastructure/database";
import { jobQueue, outboxRelay } from "./server/infrastructure/repositories/SharedUserRepository";
import { logger, closeSentry } from "./server/infrastructure/observability";

// Process entry point (dev vs prod lifecycle):
// - development: mount Vite middleware so the same port serves the API and
//   the hot-reloading SPA (`/api/*` bypasses Vite and hits Express).
// - production: `server/app.ts` already serves the built `dist/` SPA
//   statically, so just listen. Start with `npm start`.
async function startServer() {
  // BOOT ORDER (data before traffic): migrations first so every adapter sees
  // the full schema; legacy `users.json` import happens here, once.
  if (DATABASE_URL) {
    logger.info('[boot] running PostgreSQL migrations');
    await migratePg();
  } else {
    migrate();
  }

  // Background worker (emails, receipts). Skipped under test so suites exit
  // cleanly; the timer is `unref`'d so it never holds the process open alone.
  if (process.env.NODE_ENV !== 'test') {
    jobQueue.startWorker();
    outboxRelay.start();
  }

  if (!IS_PROD) {
    // Lazy import: vite is a dev-only dependency. A static import would make
    // the production bundle (and pruned image) require it at boot and crash.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { overlay: false } },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (!req.url.startsWith('/api')) {
        return vite.middlewares(req, res, next);
      }
      next();
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => logger.info(`up`, { port: PORT }));

  // Graceful shutdown: stop timers so in-flight jobs finish draining.
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`[shutdown] ${signal} received, starting graceful teardown`);

    const forceExitTimer = setTimeout(() => {
      logger.error('[shutdown] graceful teardown timed out, forcing exit');
      process.exit(1);
    }, 5000);
    forceExitTimer.unref();

    try {
      // 1. Stop background workers
      jobQueue.stopWorker();
      outboxRelay.stop();
      logger.info('[shutdown] background workers stopped');

      // 2. Close HTTP server to stop accepting new requests
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) logger.warn('[shutdown] HTTP server close error', { error: err.message });
          else logger.info('[shutdown] HTTP server closed');
          resolve();
        });
      });

      // 3. Drain and close database handles
      if (DATABASE_URL) {
        await closePgPool().catch((e) => logger.error('[shutdown] error closing pg pool', { error: (e as Error).message }));
        logger.info('[shutdown] PostgreSQL pool drained');
      } else {
        closeDb();
        logger.info('[shutdown] SQLite database closed');
      }

      // 4. Close Redis connection
      if (REDIS_URL) {
        await closeRedis().catch((e) => logger.error('[shutdown] error closing redis', { error: (e as Error).message }));
        logger.info('[shutdown] Redis disconnected');
      }

      // 5. Flush and close Sentry
      await closeSentry(2000).catch(() => {});

      logger.info('[shutdown] graceful teardown complete');
      process.exit(0);
    } catch (err) {
      logger.error('[shutdown] error during teardown', { error: (err as Error).message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();