import 'dotenv/config';
import { app } from "./server/app";
import { PORT, IS_PROD } from "./server/config/index";
import { migrate } from "./server/infrastructure/db/migrate";
import { jobQueue } from "./server/infrastructure/repositories/SharedUserRepository";
import { logger } from "./server/infrastructure/observability";

// Process entry point (dev vs prod lifecycle):
// - development: mount Vite middleware so the same port serves the API and
//   the hot-reloading SPA (`/api/*` bypasses Vite and hits Express).
// - production: `server/app.ts` already serves the built `dist/` SPA
//   statically, so just listen. Start with `npm start`.
async function startServer() {
  // BOOT ORDER (data before traffic): migrations first so every adapter sees
  // the full schema; legacy `users.json` import happens here, once.
  migrate();

  // Background worker (emails, receipts). Skipped under test so suites exit
  // cleanly; the timer is `unref`'d so it never holds the process open alone.
  if (process.env.NODE_ENV !== 'test') {
    jobQueue.startWorker();
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
  const shutdown = () => {
    jobQueue.stopWorker();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();