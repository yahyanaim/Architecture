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
import { CORS_ORIGINS, TRUST_PROXY, IS_PROD } from './config/index';

import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { userRoutes } from './api/routes/userRoutes';
import { authRoutes } from './api/routes/authRoutes';
import { profileRoutes } from './api/routes/profileRoutes';
import { billingRoutes } from './api/routes/billingRoutes';

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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

app.use('/api', apiLimiter);

app.use(express.json());
app.use(cookieParser());
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
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/billing', billingRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ops metrics (per-process counters). Admin-only: route shapes + traffic
// volumes are internal. Multi-instance prod should scrape a shared backend
// (Prometheus/StatsD) instead — see `observability.ts`.
const requireActiveUserOps = createRequireActiveUser(userRepository);
app.get('/api/metrics', authenticate, requireActiveUserOps, authorizeAdmin, (_req, res) => {
  res.json({ metrics: getMetricsSnapshot(), at: new Date().toISOString() });
});

// PRODUCTION LIFECYCLE: `npm run build` emits the Vite SPA into `dist/`.
// Serve it here (with SPA fallback) so one process hosts API + frontend.
// Development skips this — `server.ts` mounts Vite middleware instead.
if (IS_PROD) {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

app.use(errorHandler);

export { app };
