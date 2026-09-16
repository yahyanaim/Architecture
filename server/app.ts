import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './api/middleware/errorHandler';
import { requestId } from './api/middleware/requestId';
import { metricsMiddleware, getMetricsSnapshot } from './infrastructure/observability';
import { authenticate } from './api/middleware/authenticate';
import { createRequireActiveUser } from './api/middleware/requireActiveUser';
import { authorizeAdmin } from './api/middleware/authorize';
import { userRepository } from './infrastructure/repositories/SharedUserRepository';
import { CORS_ORIGINS, TRUST_PROXY, IS_PROD, DATABASE_URL } from './config/index';

import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from './infrastructure/redis';
import { userRoutes } from './api/routes/userRoutes';
import { authRoutes } from './api/routes/authRoutes';
import { profileRoutes } from './api/routes/profileRoutes';
import { billingRoutes, billingWebhook } from './api/routes/billingRoutes';
import workspaceRoutes from './api/routes/workspaceRoutes';
import { apiKeyRoutes } from './api/routes/apiKeyRoutes';
import { auditLogRoutes } from './api/routes/auditLogRoutes';
import { webhookRoutes } from './api/routes/webhookRoutes';
import { meRoutes } from './api/routes/meRoutes';
import { idempotency } from './api/middleware/idempotency';
import { csrfProtection } from './api/middleware/csrf';
import { db } from './infrastructure/database';

// ============================================================================
// Express composition root. Middleware ORDER is the request lifecycle — each
// stage runs top-to-bottom before the route handler, then `errorHandler`
// catches anything passed to `next(err)`:
//   1. trust proxy  -> correct `req.ip` behind a reverse proxy (rate limits)
//   2. rate limit   -> cheap rejection of abusive traffic before parsing cost
//   3. json/cookies -> parse the request into usable data
//   4. requestId    -> trace id for logs/audit across layers
//   5. cors/helmet  -> cross-origin policy + security headers
//   6. logging      -> morgan access log (after security, before routes)
//   7. routes       -> authenticate -> requireActiveUser -> authorize -> handler
//   8. errorHandler -> single funnel for all domain exceptions
// ============================================================================

const app = express();

// Behind a PaaS/reverse proxy, `req.ip` comes from `X-Forwarded-For` and must
// be explicitly trusted — otherwise per-IP rate limits key on the proxy IP.
// Configurable via `TRUST_PROXY` ('1' = one proxy, '0' = direct).
app.set('trust proxy', TRUST_PROXY === '0' ? 0 : 1);

const redisClient = getRedisClient();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: redisClient
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.call(args[0] || '', ...args.slice(1)) as any,
        prefix: 'rl:api:',
      })
    : undefined,
});

app.use('/api', apiLimiter);

// Stripe webhook FIRST: signature verification needs the RAW body bytes, so
// this route mounts `express.raw()` BEFORE the global `express.json()` below
// (a parsed body would break the HMAC). See billingRoutes for the handler.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhook);
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), billingWebhook);

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);
app.use(requestId);
// Request metrics (counts/latency per route) feed GET /api/metrics below.
app.use(metricsMiddleware);

// `CORS_ORIGINS` is a parsed array (see `server/config`), so multi-origin
// deployments from `CORS_ORIGIN=a.com,b.com` actually match each entry.
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));

app.use(helmet({
  contentSecurityPolicy: IS_PROD,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

if (!IS_PROD) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ----------------------------------------------------------------------------
// V1 Router composition: Standardized API root with Idempotency middleware
// ----------------------------------------------------------------------------
const v1Router = express.Router();
v1Router.use(idempotency);

v1Router.use('/auth', authRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/profile', profileRoutes);
v1Router.use('/me', meRoutes);
v1Router.use('/billing', billingRoutes);
v1Router.use('/workspaces', workspaceRoutes);
v1Router.use('/api-keys', apiKeyRoutes);
v1Router.use('/admin/audit-logs', auditLogRoutes);
v1Router.use('/webhooks', webhookRoutes);

// Cloud Health Probes (Kubernetes / ECS / Cloud Run)
const liveHealthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

const readyHealthHandler = async (_req: express.Request, res: express.Response) => {
  try {
    const start = Date.now();
    if (DATABASE_URL) {
      const { getPgPool } = await import('./infrastructure/pg');
      await getPgPool().query('SELECT 1');
    } else {
      if (!db.open) {
        throw new Error('Database connection is closed');
      }
      db.prepare('SELECT 1').get();
    }
    const dbLatencyMs = Date.now() - start;

    const memory = process.memoryUsage();
    res.status(200).json({
      status: 'ready',
      uptime: process.uptime(),
      checks: {
        database: 'healthy',
        dbLatencyMs,
        memory: {
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
          rssMb: Math.round(memory.rss / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};

const okHealthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

v1Router.get('/health/live', liveHealthHandler);
v1Router.get('/health/ready', readyHealthHandler);
v1Router.get('/health', okHealthHandler);

// Ops metrics (per-process counters). Admin-only: route shapes + traffic
// volumes are internal. Multi-instance prod should scrape a shared backend
// (Prometheus/StatsD) instead — see `observability.ts`.
const requireActiveUserOps = createRequireActiveUser(userRepository);
v1Router.get('/metrics', authenticate, requireActiveUserOps, authorizeAdmin, async (_req, res) => {
  const metrics = await getMetricsSnapshot();
  res.json({ metrics, at: new Date().toISOString() });
});

// Primary mount: /api/v1
app.use('/api/v1', v1Router);

// Legacy shim: Keep /api with Deprecation header for 1 release
const legacyApiShim: express.RequestHandler = (_req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', '299 - "This API endpoint is deprecated. Please migrate to /api/v1."');
  next();
};

app.use('/api', legacyApiShim, v1Router);

// Local uploads static serving (for LocalStorage in dev/test)
const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// PRODUCTION LIFECYCLE: `npm run build` emits the Vite SPA into `dist/`.
// Serve it here (with SPA fallback) so one process hosts API + frontend.
// Development skips this — `server.ts` mounts Vite middleware instead.
if (IS_PROD) {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    // SPA fallback: serve index.html for non-API paths only. API routes
    // that don't match any handler must fall through to errorHandler (404),
    // not silently return the SPA shell with status 200.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

app.use(errorHandler);

export { app };
