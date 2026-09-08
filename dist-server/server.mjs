// server.ts
import "dotenv/config";

// server/app.ts
import express from "express";
import path4 from "path";
import fs4 from "fs";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit2 from "express-rate-limit";

// server/domain/exceptions/AppError.ts
var AppError = class extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
};

// server/domain/exceptions/ValidationException.ts
var ValidationException = class extends AppError {
  constructor(message, errors) {
    super(message, 422);
    this.errors = errors;
  }
};

// server/api/middleware/errorHandler.ts
import { StatusCodes } from "http-status-codes";

// server/config/index.ts
var NODE_ENV = process.env.NODE_ENV ?? "development";
var IS_PROD = NODE_ENV === "production";
if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error("Missing required env var: JWT_SECRET (refusing to boot in production without it)");
}
var JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-12345678901234567890";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
var ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
var REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10);
var APP_URL = process.env.APP_URL || "http://localhost:40001";
var LOG_LEVEL = process.env.LOG_LEVEL || "info";
var ERROR_WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || "";
var CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:4000").split(",").map((s) => s.trim()).filter(Boolean);
var TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 40001;

// server/infrastructure/observability.ts
var ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
var MIN = ["debug", "info", "warn", "error"].includes(LOG_LEVEL) ? LOG_LEVEL : "info";
function emit(level, msg, fields = {}) {
  if (ORDER[level] < ORDER[MIN]) return;
  const line = JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), level, msg, pid: process.pid, ...fields });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}
var logger = {
  debug: (msg, fields) => emit("debug", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
  /** Logger bound to a request (propagates `x-request-id` into every line). */
  forRequest: (req) => ({
    debug: (msg, fields) => emit("debug", msg, { requestId: req.requestId, ...fields }),
    info: (msg, fields) => emit("info", msg, { requestId: req.requestId, ...fields }),
    warn: (msg, fields) => emit("warn", msg, { requestId: req.requestId, ...fields }),
    error: (msg, fields) => emit("error", msg, { requestId: req.requestId, ...fields })
  })
};
function reportError(err, ctx = {}) {
  logger.error(err.message, { ...ctx, stack: err.stack });
  if (!ERROR_WEBHOOK_URL) return;
  try {
    void fetch(ERROR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `5xx: ${err.message}`, ctx, at: (/* @__PURE__ */ new Date()).toISOString() })
    }).catch(() => void 0);
  } catch {
  }
}
var stats = /* @__PURE__ */ new Map();
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const route = `${req.method} ${req.route?.path ? req.baseUrl + req.route.path : req.baseUrl || req.path}`;
    const s = stats.get(route) ?? { count: 0, errors: 0, totalMs: 0 };
    s.count += 1;
    if (res.statusCode >= 500) s.errors += 1;
    s.totalMs += Date.now() - start;
    stats.set(route, s);
  });
  next();
}
function getMetricsSnapshot() {
  const out = {};
  for (const [route, s] of stats) {
    out[route] = { count: s.count, errors: s.errors, avgMs: s.count ? Math.round(s.totalMs / s.count) : 0 };
  }
  return out;
}

// server/api/middleware/errorHandler.ts
var errorHandler = (err, _req, res, _next) => {
  console.error("[Error]", err);
  if (err instanceof ValidationException) {
    res.status(err.statusCode).json({
      error: "Validation Error",
      message: err.message,
      details: err.errors
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message
    });
    return;
  }
  reportError(err, { url: _req.url, method: _req.method, requestId: _req.requestId });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  });
};

// server/api/middleware/requestId.ts
import crypto from "crypto";
var requestId = (req, res, next) => {
  const id = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};

// server/api/middleware/authenticate.ts
import jwt from "jsonwebtoken";
var authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.access ?? req.cookies?.token;
    let token;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (cookieToken) {
      token = cookieToken;
    }
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: "Unauthorized" });
    } else {
      next(error);
    }
  }
};

// server/api/middleware/requireActiveUser.ts
function createRequireActiveUser(userRepository2) {
  return async function requireActiveUser5(req, res, next) {
    try {
      const authReq = req;
      if (!authReq.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const user = await userRepository2.findById(authReq.user.userId);
      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ message: "Forbidden: Account is disabled" });
        return;
      }
      authReq.account = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// server/api/middleware/authorize.ts
var authorizeAdmin = (req, res, next) => {
  const authReq = req;
  if (!authReq.user || authReq.user.role !== "admin") {
    res.status(403).json({ message: "Forbidden: Admin access required" });
    return;
  }
  next();
};

// server/domain/entities/User.ts
import bcrypt from "bcryptjs";
import crypto2 from "crypto";
var User = class _User {
  // DOMAIN INVARIANTS:
  // - `password` is ALWAYS a bcrypt hash here; plaintext never touches the
  //   entity (hashing happens in `create()`/`hashPassword()` before storage).
  // - `failedLoginAttempts`/`lockedUntil` are the brute-force throttle state
  //   machine: N failures -> lock until T. `isLocked()` self-heals (clears an
  //   expired lock) so reads never leave stale lock state behind.
  // - `isActive=false` means administratively disabled: login refuses it and
  //   `requireActiveUser` rejects its tokens. The entity itself stays dumb —
  //   enforcement lives in services/middleware, not in field setters.
  // - TENANCY: `orgId` is the user's workspace. Identity (email) is global so
  //   login needs no tenant hint; authorization/data access is org-scoped.
  // - `emailVerifiedAt=null` means unverified. Verification is enforced
  //   opt-in via `requireVerified` (not on login) so legacy accounts and the
  //   invite flow never hard-lock during rollout.
  constructor(id, name, email, password, createdAt, isActive = true, role = "user", failedLoginAttempts = 0, lockedUntil = null, orgId = "default", emailVerifiedAt = null) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.createdAt = createdAt;
    this.isActive = isActive;
    this.role = role;
    this.failedLoginAttempts = failedLoginAttempts;
    this.lockedUntil = lockedUntil;
    this.orgId = orgId;
    this.emailVerifiedAt = emailVerifiedAt;
    if (role !== "admin" && role !== "user") {
      throw new Error(`Invalid role: ${role}. Must be 'admin' or 'user'`);
    }
  }
  static async create(name, email, password, role = "user") {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new _User(crypto2.randomUUID(), name, email, hashedPassword, /* @__PURE__ */ new Date(), true, role);
  }
  get isVerified() {
    return this.emailVerifiedAt !== null;
  }
  markVerified() {
    this.emailVerifiedAt = /* @__PURE__ */ new Date();
  }
  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }
  async comparePassword(password) {
    return bcrypt.compare(password, this.password);
  }
  changeName(newName) {
    if (newName.length < 3) {
      throw new Error("Name must be at least 3 characters long");
    }
    this.name = newName;
  }
  toggleActiveStatus() {
    this.isActive = !this.isActive;
  }
  isLocked() {
    if (!this.lockedUntil) return false;
    if (/* @__PURE__ */ new Date() > this.lockedUntil) {
      this.lockedUntil = null;
      this.failedLoginAttempts = 0;
      return false;
    }
    return true;
  }
  recordFailedAttempt() {
    this.failedLoginAttempts++;
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1e3);
    }
  }
  resetFailedAttempts() {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
  }
};

// server/infrastructure/database.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
function resolvePath() {
  if (process.env.NODE_ENV === "test") return ":memory:";
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  return path.resolve(process.cwd(), "data", "app.db");
}
var dbPath = resolvePath();
if (dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
var db = new Database(dbPath);
if (dbPath !== ":memory:") {
  db.pragma("journal_mode = WAL");
}
db.pragma("foreign_keys = ON");

// server/infrastructure/repositories/SqliteUserRepository.ts
function toEntity(r) {
  return new User(
    r.id,
    r.name,
    r.email,
    r.password,
    new Date(r.created_at),
    r.is_active === 1,
    r.role,
    r.failed_attempts ?? 0,
    r.locked_until ? new Date(r.locked_until) : null,
    r.org_id,
    r.email_verified_at ? new Date(r.email_verified_at) : null
  );
}
var SqliteUserRepository = class {
  async findById(id) {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? toEntity(row) : null;
  }
  async findByEmail(email) {
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    return row ? toEntity(row) : null;
  }
  async findByEmailAndOrg(email, orgId) {
    const row = db.prepare("SELECT * FROM users WHERE email = ? AND org_id = ?").get(email.toLowerCase(), orgId);
    return row ? toEntity(row) : null;
  }
  async findAllByOrg(orgId) {
    const rows = db.prepare("SELECT * FROM users WHERE org_id = ? ORDER BY created_at ASC").all(orgId);
    return rows.map(toEntity);
  }
  async save(user) {
    db.prepare(
      `INSERT INTO users (id, name, email, password, org_id, created_at, is_active, role, failed_attempts, locked_until, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, email=excluded.email, password=excluded.password, org_id=excluded.org_id,
         is_active=excluded.is_active, role=excluded.role, failed_attempts=excluded.failed_attempts,
         locked_until=excluded.locked_until, email_verified_at=excluded.email_verified_at`
    ).run(
      user.id,
      user.name,
      user.email.toLowerCase(),
      user.password,
      user.orgId,
      user.createdAt.toISOString(),
      user.isActive ? 1 : 0,
      user.role,
      user.failedLoginAttempts,
      user.lockedUntil?.toISOString() ?? null,
      user.emailVerifiedAt?.toISOString() ?? null
    );
  }
  async delete(id) {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
  async hasUsers() {
    const row = db.prepare("SELECT COUNT(*) AS n FROM users").get();
    return row.n > 0;
  }
};

// server/infrastructure/repositories/SqliteTokenStore.ts
import crypto3 from "crypto";
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function uid() {
  return crypto3.randomUUID();
}
var SqliteTokenStore = class {
  async createRefresh(input) {
    const id = uid();
    db.prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at, ip) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)"
    ).run(id, input.userId, input.tokenHash, input.expiresAt.toISOString(), now(), input.ip ?? null);
    return await this.findRefreshByHash(input.tokenHash);
  }
  async findRefreshByHash(tokenHash) {
    const r = db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(tokenHash);
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      replacedBy: r.replaced_by ?? null,
      createdAt: new Date(r.created_at)
    };
  }
  async revokeRefresh(id, replacedBy) {
    db.prepare("UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ? AND revoked_at IS NULL").run(now(), replacedBy ?? null, id);
  }
  async revokeAllForUser(userId) {
    const res = db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(now(), userId);
    return Number(res.changes);
  }
  async deleteExpiredRefresh(before = /* @__PURE__ */ new Date()) {
    const res = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(before.toISOString());
    return Number(res.changes);
  }
  async createAuthToken(input) {
    const id = uid();
    db.prepare(
      "INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at, meta) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)"
    ).run(id, input.userId, input.type, input.tokenHash, input.expiresAt.toISOString(), now(), JSON.stringify(input.meta ?? {}));
    return {
      id,
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: /* @__PURE__ */ new Date(),
      meta: input.meta ?? {}
    };
  }
  async consumeAuthToken(tokenHash, type) {
    const r = db.prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ?").get(tokenHash, type);
    if (!r) return null;
    if (r.used_at) return null;
    if (new Date(r.expires_at).getTime() < Date.now()) return null;
    const res = db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL").run(now(), r.id);
    if (res.changes === 0) return null;
    return {
      id: r.id,
      userId: r.user_id,
      type: r.type,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      usedAt: /* @__PURE__ */ new Date(),
      createdAt: new Date(r.created_at),
      meta: r.meta ? JSON.parse(r.meta) : {}
    };
  }
};

// server/domain/entities/Organization.ts
var Organization = class {
  constructor(id, name, slug, plan = "free", status = "active", createdAt = /* @__PURE__ */ new Date()) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.plan = plan;
    this.status = status;
    this.createdAt = createdAt;
  }
};

// server/domain/entities/Subscription.ts
var ACTIVE_SUBSCRIPTION = ["trialing", "active"];
var Subscription = class {
  constructor(orgId, plan = "free", status = "trialing", provider = "manual", providerRef = null, currentPeriodEnd = null, createdAt = /* @__PURE__ */ new Date(), updatedAt = /* @__PURE__ */ new Date()) {
    this.orgId = orgId;
    this.plan = plan;
    this.status = status;
    this.provider = provider;
    this.providerRef = providerRef;
    this.currentPeriodEnd = currentPeriodEnd;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  isActive() {
    return ACTIVE_SUBSCRIPTION.includes(this.status);
  }
};

// server/infrastructure/repositories/SqliteBillingRepository.ts
function now2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
var SqliteBillingRepository = class {
  // -- organizations --
  async findById(id) {
    const r = db.prepare("SELECT * FROM organizations WHERE id = ?").get(id);
    if (!r) return null;
    return new Organization(r.id, r.name, r.slug, r.plan, r.status, new Date(r.created_at));
  }
  async findBySlug(slug) {
    const r = db.prepare("SELECT * FROM organizations WHERE slug = ?").get(slug);
    if (!r) return null;
    return new Organization(r.id, r.name, r.slug, r.plan, r.status, new Date(r.created_at));
  }
  async save(entity) {
    if (entity instanceof Organization) {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, plan=excluded.plan, status=excluded.status`
      ).run(entity.id, entity.name, entity.slug, entity.plan, entity.status, entity.createdAt.toISOString());
      return;
    }
    db.prepare(
      `INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(org_id) DO UPDATE SET plan=excluded.plan, status=excluded.status, provider=excluded.provider,
         provider_ref=excluded.provider_ref, current_period_end=excluded.current_period_end, updated_at=excluded.updated_at`
    ).run(
      entity.orgId,
      entity.plan,
      entity.status,
      entity.provider,
      entity.providerRef,
      entity.currentPeriodEnd?.toISOString() ?? null,
      entity.createdAt.toISOString(),
      now2()
    );
  }
  // -- subscriptions (billing seam) --
  async findByOrgId(orgId) {
    const r = db.prepare("SELECT * FROM subscriptions WHERE org_id = ?").get(orgId);
    if (!r) return null;
    return new Subscription(
      r.org_id,
      r.plan,
      r.status,
      r.provider,
      r.provider_ref,
      r.current_period_end ? new Date(r.current_period_end) : null,
      new Date(r.created_at),
      new Date(r.updated_at)
    );
  }
  async updatePlan(orgId, plan, status) {
    const existing = await this.findByOrgId(orgId);
    const sub = existing ?? new Subscription(orgId);
    sub.plan = plan;
    sub.status = status;
    sub.updatedAt = /* @__PURE__ */ new Date();
    await this.save(sub);
    return sub;
  }
};

// server/infrastructure/mailer.ts
import fs2 from "fs";
import path2 from "path";
var LogMailer = class {
  async send(email) {
    const dir = path2.join(process.cwd(), "data", "outbox");
    fs2.mkdirSync(dir, { recursive: true });
    const file = path2.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.eml`);
    fs2.writeFileSync(
      file,
      `To: ${email.to}
Subject: ${email.subject}
Date: ${(/* @__PURE__ */ new Date()).toUTCString()}

${email.text}
`
    );
    logger.info("[mail] queued to outbox", { to: email.to, subject: email.subject, file });
  }
};

// server/infrastructure/queue.ts
function now3() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
var JobQueue = class {
  constructor(mailer2, handlers = {}) {
    this.mailer = mailer2;
    this.handlers = handlers;
    this.timer = null;
    this.running = false;
    this.handlers["email.send"] ??= async (p) => {
      await this.mailer.send(p);
    };
  }
  register(type, handler) {
    this.handlers[type] = handler;
  }
  async enqueue(type, payload, opts = {}) {
    const at = (opts.runAt ?? /* @__PURE__ */ new Date()).toISOString();
    const res = db.prepare(
      "INSERT INTO jobs (type, payload, status, run_at, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)"
    ).run(type, JSON.stringify(payload), "queued", at, opts.maxAttempts ?? 5, now3(), now3());
    logger.debug("[jobs] enqueued", { type, id: res.lastInsertRowid });
    return Number(res.lastInsertRowid);
  }
  /** Process all due jobs once. Public so tests/cron can drive it manually. */
  async processDue() {
    if (this.running) return 0;
    this.running = true;
    try {
      const due = db.prepare("SELECT * FROM jobs WHERE status = 'queued' AND run_at <= ? ORDER BY id ASC LIMIT 20").all(now3());
      let done = 0;
      for (const job of due) {
        const handler = this.handlers[job.type];
        if (!handler) {
          db.prepare("UPDATE jobs SET status = 'dead', last_error = ?, updated_at = ? WHERE id = ?").run(`no handler for type "${job.type}"`, now3(), job.id);
          continue;
        }
        db.prepare("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?").run(now3(), job.id);
        try {
          await handler(JSON.parse(job.payload));
          db.prepare("UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?").run(now3(), job.id);
          done += 1;
        } catch (err) {
          const attempts = job.attempts + 1;
          const backoffMin = Math.min(2 ** attempts, 60);
          const nextRun = new Date(Date.now() + backoffMin * 6e4).toISOString();
          if (attempts >= job.max_attempts) {
            db.prepare("UPDATE jobs SET status = 'dead', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?").run(attempts, err.message, now3(), job.id);
            logger.error("[jobs] dead", { id: job.id, type: job.type, error: err.message });
          } else {
            db.prepare("UPDATE jobs SET status = 'queued', attempts = ?, run_at = ?, last_error = ?, updated_at = ? WHERE id = ?").run(attempts, nextRun, err.message, now3(), job.id);
            logger.warn("[jobs] retry scheduled", { id: job.id, type: job.type, attempt: attempts });
          }
        }
      }
      db.prepare("DELETE FROM jobs WHERE status = 'done' AND updated_at < ?").run(new Date(Date.now() - 7 * 24 * 36e5).toISOString());
      return done;
    } finally {
      this.running = false;
    }
  }
  startWorker(intervalMs = 1e4) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.processDue().catch((e) => logger.error("[jobs] worker tick failed", { error: e.message }));
    }, intervalMs);
    this.timer.unref?.();
    logger.info("[jobs] worker started", { intervalMs });
  }
  stopWorker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  pendingCount() {
    const r = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','running')").get();
    return r.n;
  }
};

// server/infrastructure/repositories/SharedUserRepository.ts
var userRepository = new SqliteUserRepository();
var tokenStore = new SqliteTokenStore();
var billingRepository = new SqliteBillingRepository();
var orgRepository = billingRepository;
var mailer = new LogMailer();
var jobQueue = new JobQueue(mailer);

// server/config/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";
var options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Enterprise API",
      version: "1.0.0"
    },
    servers: [
      {
        url: "/api"
      }
    ],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" }
          }
        }
      }
    }
  },
  apis: ["./server/api/routes/*.ts", "./server/api/controllers/*.ts"]
};
var swaggerSpec = swaggerJsdoc(options);

// server/app.ts
import swaggerUi from "swagger-ui-express";

// server/api/routes/userRoutes.ts
import { Router } from "express";

// server/api/controllers/UserController.ts
import { z as z2 } from "zod";

// server/api/dtos/UserDTO.ts
import { z } from "zod";
var CreateUserSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email format")
});

// server/infrastructure/audit.ts
import fs3 from "fs";
import path3 from "path";
var AUDIT_LOG_PATH = path3.join(process.cwd(), "data", "audit.log");
function audit(event, actorId, details = {}) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event,
    actorId,
    ...details
  };
  const line = JSON.stringify(entry) + "\n";
  console.log("[AUDIT]", JSON.stringify(entry));
  try {
    const dir = path3.dirname(AUDIT_LOG_PATH);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    fs3.appendFileSync(AUDIT_LOG_PATH, line, "utf-8");
  } catch {
  }
}

// server/api/controllers/UserController.ts
var UuidParamSchema = z2.object({
  id: z2.string().uuid("Invalid user ID format")
});
var UserController = class {
  // `jobQueue` delivers invite emails off the request path (see createUser).
  constructor(userService2, jobQueue2) {
    this.userService = userService2;
    this.jobQueue = jobQueue2;
    // INVITE FLOW (tenant-scoped): validates input -> provisions an
    // login-disabled account in the CALLER's org (`req.tenant`, never client
    // input) -> enqueues the invite email with a single-use link -> 201.
    // Returns no secret: the plaintext invite token travels only via email.
    this.createUser = async (req, res, next) => {
      try {
        const tenantReq = req;
        if (!tenantReq.tenant) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const parseResult = CreateUserSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationException("Invalid input data", parseResult.error.format());
        }
        const dto = parseResult.data;
        const { user, inviteToken } = await this.userService.createUser(dto.name, dto.email, tenantReq.tenant.orgId);
        this.jobQueue.enqueue(
          "email.send",
          {
            to: user.email,
            subject: `You've been invited to join ${tenantReq.account?.name ?? "a workspace"}`,
            text: `Hi ${user.name}, you've been invited. Set your password (valid 7 days): ${APP_URL}/invite?token=${inviteToken}`,
            kind: "invite"
          }
        ).catch(() => void 0);
        audit("user.invited", tenantReq.account?.id ?? "unknown", { targetUserId: user.id, orgId: tenantReq.tenant.orgId });
        const response = {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          isActive: user.isActive,
          role: user.role
        };
        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    };
    this.getAllUsers = async (req, res, next) => {
      try {
        const tenantReq = req;
        if (!tenantReq.tenant) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const users = await this.userService.getAllUsers(tenantReq.tenant.orgId);
        const response = users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          isActive: user.isActive,
          role: user.role
        }));
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    };
    this.toggleStatus = async (req, res, next) => {
      try {
        const tenantReq = req;
        if (!tenantReq.tenant) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const parseResult = UuidParamSchema.safeParse(req.params);
        if (!parseResult.success) {
          throw new ValidationException("Invalid user ID", parseResult.error.format());
        }
        const { id } = parseResult.data;
        const user = await this.userService.toggleUserStatus(id, tenantReq.tenant.orgId);
        const response = {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          isActive: user.isActive,
          role: user.role
        };
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    };
    this.deleteUser = async (req, res, next) => {
      try {
        const authReq = req;
        if (!authReq.tenant) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const parseResult = UuidParamSchema.safeParse(req.params);
        if (!parseResult.success) {
          throw new ValidationException("Invalid user ID", parseResult.error.format());
        }
        const { id } = parseResult.data;
        await this.userService.deleteUser(id, authReq.tenant.orgId);
        audit("user.deleted", authReq.user?.userId ?? "unknown", { targetUserId: id });
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    };
  }
};

// server/domain/exceptions/BusinessException.ts
var BusinessException = class extends AppError {
  constructor(message) {
    super(message, 400);
  }
};

// server/domain/exceptions/NotFoundException.ts
var NotFoundException = class extends AppError {
  constructor(message) {
    super(message, 404);
  }
};

// server/domain/services/UserService.ts
import crypto4 from "crypto";
var UserService = class {
  constructor(userRepository2, tokenStore2) {
    this.userRepository = userRepository2;
    this.tokenStore = tokenStore2;
  }
  async createUser(name, email, orgId) {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException("User with this email already exists");
    }
    const user = await User.create(name, email, `unusable-${Date.now()}-${Math.random()}`, "user");
    user.orgId = orgId;
    await this.userRepository.save(user);
    const inviteToken = crypto4.randomBytes(32).toString("base64url");
    await this.tokenStore.createAuthToken({
      userId: user.id,
      type: "invite",
      tokenHash: crypto4.createHash("sha256").update(inviteToken).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 864e5),
      meta: { orgId, email }
    });
    return { user, inviteToken };
  }
  // ID-ORACLE GUARD (tenancy): mutations by :id MUST prove the target lives
  // in the caller's org. Missing OR foreign both answer 404 — a 403 would
  // confirm the account exists in another tenant (existence oracle). Without
  // this, an admin in org A could toggle/delete users in org B by UUID.
  async toggleUserStatus(id, orgId) {
    const user = await this.userRepository.findById(id);
    if (!user || user.orgId !== orgId) {
      throw new NotFoundException("User not found");
    }
    user.toggleActiveStatus();
    await this.userRepository.save(user);
    return user;
  }
  async deleteUser(id, orgId) {
    const user = await this.userRepository.findById(id);
    if (!user || user.orgId !== orgId) {
      throw new NotFoundException("User not found");
    }
    await this.userRepository.delete(id);
  }
  /** Tenant-scoped listing — admins see their OWN org, never the instance. */
  async getAllUsers(orgId) {
    return this.userRepository.findAllByOrg(orgId);
  }
};

// server/api/middleware/resolveTenant.ts
function resolveTenant(req, res, next) {
  const r = req;
  if (!r.account) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (r.user && r.user.orgId !== r.account.orgId) {
    res.status(401).json({ message: "Session tenant changed \u2014 please refresh" });
    return;
  }
  r.tenant = { orgId: r.account.orgId };
  next();
}

// server/api/routes/userRoutes.ts
var router = Router();
var userService = new UserService(userRepository, tokenStore);
var requireActiveUser = createRequireActiveUser(userRepository);
var userController = new UserController(userService, jobQueue);
router.post("/", authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.createUser);
router.get("/", authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.getAllUsers);
router.patch("/:id/status", authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.toggleStatus);
router.delete("/:id", authenticate, requireActiveUser, resolveTenant, authorizeAdmin, userController.deleteUser);

// server/api/routes/authRoutes.ts
import { Router as Router2 } from "express";
import rateLimit from "express-rate-limit";

// server/domain/services/AuthService.ts
import jwt2 from "jsonwebtoken";
import crypto5 from "crypto";
function sha256(s) {
  return crypto5.createHash("sha256").update(s).digest("hex");
}
function randomToken(bytes = 32) {
  return crypto5.randomBytes(bytes).toString("base64url");
}
function slugify(base) {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
  return `${clean}-${crypto5.randomBytes(3).toString("hex")}`;
}
function parseTtlMs(ttl, fallbackMs) {
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl.trim());
  if (!m || !m[1] || !m[2]) return fallbackMs;
  const n = parseInt(m[1], 10);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
  return n * unit;
}
var ACCESS_COOKIE_MAX_AGE_MS = parseTtlMs(ACCESS_TOKEN_TTL, 15 * 6e4);
var REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 864e5;
var AuthService = class {
  constructor(userRepository2, orgRepository2, subscriptionRepository, tokenStore2, jwtSecret) {
    this.userRepository = userRepository2;
    this.orgRepository = orgRepository2;
    this.subscriptionRepository = subscriptionRepository;
    this.tokenStore = tokenStore2;
    const secret = jwtSecret ?? JWT_SECRET;
    this.jwtSecret = secret;
  }
  // -- registration -------------------------------------------------------
  // REGISTRATION INVARIANT (security-critical): the very first account in an
  // empty store becomes instance 'admin' (bootstrap), every later one is
  // 'user'. No `role` input exists — accepting one would allow self-promotion.
  // SAAS: every registration ALSO bootstraps a personal Organization +
  // (free/trialing) Subscription row, so billing/enforcement always has a
  // row to read. Invited users skip this (they join the inviter's org).
  async register(name, email, password) {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException("User with this email already exists");
    }
    const hasUsers = await this.userRepository.hasUsers();
    const role = !hasUsers ? "admin" : "user";
    const org = new Organization(crypto5.randomUUID(), `${name}'s workspace`, slugify(name));
    await this.orgRepository.save(org);
    await this.subscriptionRepository.save(new Subscription(org.id, "free", "trialing"));
    const user = await User.create(name, email, password, role);
    user.orgId = org.id;
    await this.userRepository.save(user);
    const tokens = await this.issueSession(user.id, user);
    const verifyToken = await this.mintAuthToken(user.id, "verify", 24 * 36e5, {});
    return { user, org, tokens, verifyToken };
  }
  // -- login ---------------------------------------------------------------
  // LOGIN LIFECYCLE: active? -> locked? -> password? Failures persist via
  // `recordFailedAttempt()` (5 strikes = 15-min lock) — account-level throttle
  // on top of the IP + per-account rate limiters on the route. Success resets
  // the counter and mints a fresh session pair. Unverified users MAY log in
  // (verification is enforced opt-in via `requireVerified`, not here) so
  // rollout never hard-locks existing accounts.
  async login(email, password, ip) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BusinessException("Invalid email or password");
    }
    if (!user.isActive) {
      throw new BusinessException("Account is disabled");
    }
    if (user.isLocked()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 6e4);
      throw new BusinessException(`Account is locked. Try again in ${minutes} minutes`);
    }
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      user.recordFailedAttempt();
      await this.userRepository.save(user);
      throw new BusinessException("Invalid email or password");
    }
    user.resetFailedAttempts();
    await this.userRepository.save(user);
    const org = await this.ensureOrg(user);
    const tokens = await this.issueSession(user.id, user, ip);
    return { user, org, tokens };
  }
  // -- refresh rotation ----------------------------------------------------
  // REUSE DETECTION: each refresh use revokes the old row and links the
  // replacement. Presenting an already-revoked token means it was stolen
  // (the legitimate client moved on) -> revoke the WHOLE chain immediately.
  async refreshSession(refreshToken, ip) {
    const row = await this.tokenStore.findRefreshByHash(sha256(refreshToken));
    if (!row) throw new BusinessException("Invalid session");
    if (row.expiresAt.getTime() < Date.now()) throw new BusinessException("Session expired");
    if (row.revokedAt) {
      if (row.replacedBy) {
        await this.tokenStore.revokeAllForUser(row.userId);
        throw new BusinessException("Session compromised. All sessions revoked \u2014 please log in again.");
      }
      throw new BusinessException("Invalid session");
    }
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new BusinessException("Invalid session");
    if (!user.isActive) throw new BusinessException("Account is disabled");
    const tokens = await this.issueSession(user.id, user, ip);
    const next = await this.tokenStore.findRefreshByHash(sha256(tokens.refresh));
    await this.tokenStore.revokeRefresh(row.id, next?.id ?? null);
    const org = await this.ensureOrg(user);
    return { user, org, tokens };
  }
  /** Idempotent: revoking an unknown/absent token still succeeds. */
  async logout(refreshToken) {
    if (!refreshToken) return;
    const row = await this.tokenStore.findRefreshByHash(sha256(refreshToken));
    if (row && !row.revokedAt) await this.tokenStore.revokeRefresh(row.id);
  }
  /** Credential change / compromise response: kills every session at once. */
  async revokeAllSessions(userId) {
    return this.tokenStore.revokeAllForUser(userId);
  }
  // -- email verification ---------------------------------------------------
  // Enumeration-safe: returns null (controller still answers 200) when there
  // is nothing to do, so attackers can't probe which emails are registered.
  async requestEmailVerification(email) {
    const user = await this.userRepository.findByEmail(email);
    if (!user || user.isVerified) return null;
    return this.mintAuthToken(user.id, "verify", 24 * 36e5, {});
  }
  async verifyEmail(token) {
    const row = await this.tokenStore.consumeAuthToken(sha256(token), "verify");
    if (!row || !row.userId) throw new BusinessException("Invalid or expired verification link");
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException("User not found");
    user.markVerified();
    await this.userRepository.save(user);
    return user;
  }
  // -- password reset --------------------------------------------------------
  async requestPasswordReset(email) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null;
    return this.mintAuthToken(user.id, "reset", 36e5, {});
  }
  // CREDENTIAL CHANGE = session kill: all refresh tokens die with the old
  // password, and the lockout counter resets (owner proved email ownership).
  async resetPassword(token, newPassword) {
    const row = await this.tokenStore.consumeAuthToken(sha256(token), "reset");
    if (!row || !row.userId) throw new BusinessException("Invalid or expired reset link");
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException("User not found");
    user.password = await User.hashPassword(newPassword);
    user.resetFailedAttempts();
    await this.userRepository.save(user);
    await this.tokenStore.revokeAllForUser(user.id);
    return user;
  }
  // -- invites (admin adds user to THEIR org) --------------------------------
  // Creates a login-disabled account (random unusable password) + single-use
  // invite token. `acceptInvite` sets the real password and verifies the
  // email in one step. Email delivery is the API layer's job (job queue).
  async createInvite(name, email, orgId) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new BusinessException("User with this email already exists");
    const org = await this.orgRepository.findById(orgId);
    if (!org) throw new NotFoundException("Organization not found");
    const user = await User.create(name, email, randomToken(24), "user");
    user.orgId = orgId;
    await this.userRepository.save(user);
    const inviteToken = await this.mintAuthToken(user.id, "invite", 7 * 864e5, { orgId, email });
    return { user, inviteToken };
  }
  async acceptInvite(token, password, name) {
    const row = await this.tokenStore.consumeAuthToken(sha256(token), "invite");
    if (!row || !row.userId) throw new BusinessException("Invalid or expired invite link");
    const user = await this.userRepository.findById(row.userId);
    if (!user) throw new NotFoundException("User not found");
    if (name && name.trim().length >= 3) user.name = name.trim();
    user.password = await User.hashPassword(password);
    user.markVerified();
    user.resetFailedAttempts();
    await this.userRepository.save(user);
    const org = await this.ensureOrg(user);
    const tokens = await this.issueSession(user.id, user);
    return { user, org, tokens };
  }
  // -- session primitives -----------------------------------------------------
  async issueSession(userId, user, ip) {
    const account = user ?? await this.userRepository.findById(userId);
    if (!account) throw new NotFoundException("User not found");
    const payload = { userId: account.id, email: account.email, role: account.role, orgId: account.orgId };
    const access = jwt2.sign(payload, this.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
    const refresh = randomToken();
    await this.tokenStore.createRefresh({
      userId: account.id,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 864e5),
      ip
    });
    return { access, refresh };
  }
  /** Verifies a short-lived ACCESS token (used by middleware + tests). */
  verifyToken(token) {
    try {
      const payload = jwt2.verify(token, this.jwtSecret);
      return payload;
    } catch {
      throw new BusinessException("Invalid or expired token");
    }
  }
  async getUserById(id) {
    return this.userRepository.findById(id);
  }
  // -- internals ---------------------------------------------------------------
  async mintAuthToken(userId, type, ttlMs, meta) {
    const token = randomToken();
    await this.tokenStore.createAuthToken({
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
      meta
    });
    return token;
  }
  /** Self-heal: legacy/imported users predating orgs get a personal org. */
  async ensureOrg(user) {
    const existing = await this.orgRepository.findById(user.orgId);
    if (existing) return existing;
    const org = new Organization(crypto5.randomUUID(), `${user.name}'s workspace`, slugify(user.name));
    await this.orgRepository.save(org);
    await this.subscriptionRepository.save(new Subscription(org.id, "free", "trialing"));
    user.orgId = org.id;
    await this.userRepository.save(user);
    return org;
  }
};

// server/api/dtos/AuthDTO.ts
import { z as z3 } from "zod";
var passwordSchema = z3.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number");
var RegisterSchema = z3.object({
  name: z3.string().min(3, "Name must be at least 3 characters").transform((val) => val.trim()),
  email: z3.string().email("Invalid email format").transform((val) => val.toLowerCase().trim()),
  password: passwordSchema,
  confirmPassword: z3.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
var LoginSchema = z3.object({
  email: z3.string().email("Invalid email format").transform((val) => val.toLowerCase().trim()),
  password: z3.string().min(1, "Password is required")
});
var EmailRequestSchema = z3.object({
  email: z3.string().email("Invalid email format").transform((val) => val.toLowerCase().trim())
});
var ResetPasswordSchema = z3.object({
  token: z3.string().min(1, "Token is required"),
  newPassword: passwordSchema,
  confirmNewPassword: z3.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"]
});
var InviteAcceptSchema = z3.object({
  token: z3.string().min(1, "Token is required"),
  password: passwordSchema,
  confirmPassword: z3.string(),
  name: z3.string().min(3, "Name must be at least 3 characters").trim().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

// server/api/controllers/AuthController.ts
var ACCESS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  path: "/"
};
var REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  path: "/"
};
var CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/"
};
function toResponse(id, name, email, role, emailVerified, orgId) {
  return { id, name, email, role, emailVerified, orgId };
}
var AuthController = class {
  // `jobQueue` delivers verify/reset/invite emails asynchronously — HTTP
  // responses never wait on mail delivery (enqueue + return).
  constructor(authService3, jobQueue2) {
    this.authService = authService3;
    this.jobQueue = jobQueue2;
    this.register = async (req, res, next) => {
      try {
        const parseResult = RegisterSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationException("Invalid input data", parseResult.error.format());
        }
        const { name, email, password } = parseResult.data;
        const result = await this.authService.register(name, email, password);
        this.setSession(res, result.tokens);
        this.enqueueEmail(
          result.user.email,
          "Verify your email",
          `Welcome ${result.user.name}! Verify your email: ${APP_URL}/api/auth/verify?token=${result.verifyToken}`,
          "verify"
        );
        audit("user.registered", result.user.id, { email: result.user.email, role: result.user.role, orgId: result.org.id });
        res.status(201).json(toResponse(
          result.user.id,
          result.user.name,
          result.user.email,
          result.user.role,
          result.user.isVerified,
          result.org.id
        ));
      } catch (error) {
        next(error);
      }
    };
    this.login = async (req, res, next) => {
      try {
        const parseResult = LoginSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationException("Invalid input data", parseResult.error.format());
        }
        const { email, password } = parseResult.data;
        const result = await this.authService.login(email, password, req.ip);
        this.setSession(res, result.tokens);
        res.status(200).json(toResponse(
          result.user.id,
          result.user.name,
          result.user.email,
          result.user.role,
          result.user.isVerified,
          result.org.id
        ));
      } catch (error) {
        next(error);
      }
    };
    /** Rotates the session pair. Reuse of an old refresh token => 400 + chain revoked. */
    this.refresh = async (req, res, next) => {
      try {
        const presented = req.cookies?.refresh;
        if (!presented) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const result = await this.authService.refreshSession(presented, req.ip);
        this.setSession(res, result.tokens);
        res.status(200).json(toResponse(
          result.user.id,
          result.user.name,
          result.user.email,
          result.user.role,
          result.user.isVerified,
          result.org.id
        ));
      } catch (error) {
        next(error);
      }
    };
    this.logout = async (req, res, next) => {
      try {
        await this.authService.logout(req.cookies?.refresh);
        this.clearSession(res);
        res.json({ message: "Logged out successfully" });
      } catch (error) {
        next(error);
      }
    };
    this.me = async (req, res, next) => {
      try {
        const authReq = req;
        const fullUser = authReq.account ?? await this.authService.getUserById(authReq.user.userId);
        if (!fullUser) {
          res.status(404).json({ message: "User not found" });
          return;
        }
        res.json(toResponse(
          fullUser.id,
          fullUser.name,
          fullUser.email,
          fullUser.role,
          fullUser.isVerified,
          fullUser.orgId
        ));
      } catch (error) {
        next(error);
      }
    };
    this.requestVerification = async (req, res, next) => {
      try {
        const parsed = EmailRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationException("Invalid input data", parsed.error.format());
        const token = await this.authService.requestEmailVerification(parsed.data.email);
        if (token) {
          this.enqueueEmail(
            parsed.data.email,
            "Verify your email",
            `Verify your email: ${APP_URL}/api/auth/verify?token=${token}`,
            "verify"
          );
        }
        res.json({ message: "If an unverified account exists for this email, a link was sent" });
      } catch (error) {
        next(error);
      }
    };
    this.verify = async (req, res, next) => {
      try {
        const token = typeof req.query.token === "string" ? req.query.token : "";
        if (!token) {
          res.status(400).json({ message: "Verification token is required" });
          return;
        }
        const user = await this.authService.verifyEmail(token);
        audit("user.verified", user.id, { email: user.email });
        res.json({ message: "Email verified successfully", email: user.email });
      } catch (error) {
        next(error);
      }
    };
    this.requestPasswordReset = async (req, res, next) => {
      try {
        const parsed = EmailRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationException("Invalid input data", parsed.error.format());
        const token = await this.authService.requestPasswordReset(parsed.data.email);
        if (token) {
          this.enqueueEmail(
            parsed.data.email,
            "Reset your password",
            `Reset your password (valid 1 hour): ${APP_URL}/reset-password?token=${token}`,
            "reset"
          );
        }
        res.json({ message: "If an account exists for this email, a reset link was sent" });
      } catch (error) {
        next(error);
      }
    };
    this.resetPassword = async (req, res, next) => {
      try {
        const parsed = ResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationException("Invalid input data", parsed.error.format());
        const user = await this.authService.resetPassword(parsed.data.token, parsed.data.newPassword);
        audit("user.password_reset", user.id, {});
        res.json({ message: "Password changed successfully. All other sessions were revoked." });
      } catch (error) {
        next(error);
      }
    };
    this.acceptInvite = async (req, res, next) => {
      try {
        const parsed = InviteAcceptSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationException("Invalid input data", parsed.error.format());
        const result = await this.authService.acceptInvite(parsed.data.token, parsed.data.password, parsed.data.name);
        this.setSession(res, result.tokens);
        audit("user.invite_accepted", result.user.id, { email: result.user.email, orgId: result.org.id });
        res.status(200).json(toResponse(
          result.user.id,
          result.user.name,
          result.user.email,
          result.user.role,
          result.user.isVerified,
          result.org.id
        ));
      } catch (error) {
        next(error);
      }
    };
  }
  setSession(res, tokens) {
    res.cookie("access", tokens.access, ACCESS_COOKIE);
    res.cookie("refresh", tokens.refresh, REFRESH_COOKIE);
  }
  clearSession(res) {
    res.clearCookie("access", CLEAR_COOKIE_OPTIONS);
    res.clearCookie("refresh", CLEAR_COOKIE_OPTIONS);
    res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
  }
  enqueueEmail(to, subject, text, kind) {
    this.jobQueue.enqueue("email.send", { to, subject, text, kind }).catch(() => void 0);
  }
};

// server/api/middleware/loginAccountLimiter.ts
var WINDOW_MS = 15 * 6e4;
var MAX_ATTEMPTS = 10;
var hits = /* @__PURE__ */ new Map();
function keyFor(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
  if (!email) return null;
  return `login:${email}`;
}
function loginAccountLimiter(req, res, next) {
  const key = keyFor(req);
  if (!key) {
    next();
    return;
  }
  const cutoff = Date.now() - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_ATTEMPTS) {
    res.status(429).json({ message: "Too many login attempts for this account, please try again later" });
    return;
  }
  recent.push(Date.now());
  hits.set(key, recent);
  if (hits.size > 1e4) {
    for (const [k, v] of hits) {
      if (v.length === 0 || v[v.length - 1] < cutoff) hits.delete(k);
    }
  }
  next();
}

// server/api/routes/authRoutes.ts
var router2 = Router2();
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  message: "Too many auth attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false
});
var registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 3,
  message: "Too many accounts created from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});
var authService = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
var requireActiveUser2 = createRequireActiveUser(userRepository);
var authController = new AuthController(authService, jobQueue);
router2.post("/register", registerLimiter, authController.register);
router2.post("/login", authLimiter, loginAccountLimiter, authController.login);
router2.post("/refresh", authController.refresh);
router2.post("/logout", authController.logout);
router2.get("/me", authenticate, requireActiveUser2, authController.me);
router2.post("/verify-request", authLimiter, authController.requestVerification);
router2.get("/verify", authController.verify);
router2.post("/password-reset-request", authLimiter, authController.requestPasswordReset);
router2.post("/password-reset", authLimiter, authController.resetPassword);
router2.post("/invite-accept", authLimiter, authController.acceptInvite);

// server/api/routes/profileRoutes.ts
import { Router as Router3 } from "express";

// server/api/dtos/ProfileDTO.ts
import { z as z4 } from "zod";
var UpdateProfileSchema = z4.object({
  name: z4.string().min(3, "Name must be at least 3 characters").optional(),
  email: z4.string().email("Invalid email format").optional()
});
var ChangePasswordSchema = z4.object({
  currentPassword: z4.string().min(1, "Current password is required"),
  newPassword: z4.string().min(8, "New password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number")
});

// server/api/controllers/ProfileController.ts
var ProfileController = class {
  // `authService` is used ONLY to mint the caller's replacement session after
  // a password change revokes every session (including theirs). All profile
  // rules stay in `ProfileService`.
  constructor(profileService2, authService3) {
    this.profileService = profileService2;
    this.authService = authService3;
    this.getProfile = async (req, res, next) => {
      try {
        const authReq = req;
        if (!authReq.user) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const user = await this.profileService.getProfile(authReq.user.userId);
        const response = {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString()
        };
        res.json(response);
      } catch (error) {
        next(error);
      }
    };
    this.updateProfile = async (req, res, next) => {
      try {
        const authReq = req;
        if (!authReq.user) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const parseResult = UpdateProfileSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationException("Invalid input data", parseResult.error.format());
        }
        const user = await this.profileService.updateProfile(authReq.user.userId, parseResult.data);
        const response = {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt.toISOString()
        };
        res.json(response);
      } catch (error) {
        next(error);
      }
    };
    this.deleteAccount = async (req, res, next) => {
      try {
        const authReq = req;
        if (!authReq.user) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        await this.profileService.deleteAccount(authReq.user.userId);
        audit("user.account_deleted", authReq.user.userId);
        res.json({ message: "Account deleted successfully" });
      } catch (error) {
        next(error);
      }
    };
    this.changePassword = async (req, res, next) => {
      try {
        const authReq = req;
        if (!authReq.user) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        const parseResult = ChangePasswordSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationException("Invalid input", parseResult.error.format());
        }
        const { currentPassword, newPassword } = parseResult.data;
        await this.profileService.changePassword(authReq.user.userId, currentPassword, newPassword);
        const tokens = await this.authService.issueSession(authReq.user.userId, authReq.account ?? null, req.ip);
        const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
        res.cookie("access", tokens.access, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
        res.cookie("refresh", tokens.refresh, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE_MS });
        res.json({ message: "Password changed successfully" });
      } catch (error) {
        next(error);
      }
    };
  }
};

// server/domain/services/ProfileService.ts
var ProfileService = class {
  // `tokenStore` is optional for backward compatibility (tests construct with
  // repo only). In the app it is ALWAYS wired: a password change must kill
  // all other sessions (see changePassword).
  constructor(userRepository2, tokenStore2) {
    this.userRepository = userRepository2;
    this.tokenStore = tokenStore2;
  }
  async getProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
  async updateProfile(userId, updates) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        throw new BusinessException("Email already in use");
      }
      user.email = updates.email;
    }
    if (updates.name) {
      user.name = updates.name;
    }
    await this.userRepository.save(user);
    return user;
  }
  async deleteAccount(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    await this.userRepository.delete(userId);
  }
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new BusinessException("Current password is incorrect");
    }
    user.password = await User.hashPassword(newPassword);
    await this.userRepository.save(user);
    if (this.tokenStore) {
      await this.tokenStore.revokeAllForUser(userId);
    }
  }
};

// server/api/routes/profileRoutes.ts
var router3 = Router3();
var profileService = new ProfileService(userRepository, tokenStore);
var authService2 = new AuthService(userRepository, orgRepository, billingRepository, tokenStore);
var profileController = new ProfileController(profileService, authService2);
var requireActiveUser3 = createRequireActiveUser(userRepository);
router3.get("/", authenticate, requireActiveUser3, resolveTenant, profileController.getProfile);
router3.put("/", authenticate, requireActiveUser3, resolveTenant, profileController.updateProfile);
router3.put("/password", authenticate, requireActiveUser3, resolveTenant, profileController.changePassword);
router3.delete("/", authenticate, requireActiveUser3, resolveTenant, profileController.deleteAccount);

// server/api/routes/billingRoutes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
var requireActiveUser4 = createRequireActiveUser(userRepository);
router4.get("/subscription", authenticate, requireActiveUser4, resolveTenant, async (req, res, next) => {
  try {
    const r = req;
    const sub = await billingRepository.findByOrgId(r.tenant.orgId);
    if (!sub) {
      res.status(404).json({ message: "No subscription found for this workspace" });
      return;
    }
    res.json({
      orgId: sub.orgId,
      plan: sub.plan,
      status: sub.status,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null
    });
  } catch (error) {
    next(error);
  }
});

// server/app.ts
var app = express();
app.set("trust proxy", TRUST_PROXY === "0" ? 0 : 1);
var apiLimiter = rateLimit2({
  windowMs: 15 * 60 * 1e3,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});
app.use("/api", apiLimiter);
app.use(express.json());
app.use(cookieParser());
app.use(requestId);
app.use(metricsMiddleware);
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: IS_PROD
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
if (!IS_PROD) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
app.use("/api/auth", router2);
app.use("/api/users", router);
app.use("/api/profile", router3);
app.use("/api/billing", router4);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var requireActiveUserOps = createRequireActiveUser(userRepository);
app.get("/api/metrics", authenticate, requireActiveUserOps, authorizeAdmin, (_req, res) => {
  res.json({ metrics: getMetricsSnapshot(), at: (/* @__PURE__ */ new Date()).toISOString() });
});
if (IS_PROD) {
  const distDir = path4.resolve(process.cwd(), "dist");
  if (fs4.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path4.join(distDir, "index.html"));
    });
  }
}
app.use(errorHandler);

// server/infrastructure/db/migrate.ts
import fs5 from "fs";
import path5 from "path";
import crypto6 from "crypto";
import { fileURLToPath } from "url";
var MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path5.join(path5.dirname(fileURLToPath(import.meta.url)), "migrations");
function now4() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function uid2() {
  return crypto6.randomUUID();
}
function migrate(target = db) {
  target.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    target.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version)
  );
  const files = fs5.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = path5.basename(file, ".sql");
    if (applied.has(version)) continue;
    const sql = fs5.readFileSync(path5.join(MIGRATIONS_DIR, file), "utf-8");
    const txn = target.transaction(() => {
      target.exec(sql);
      target.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, now4());
    });
    txn();
    console.log(`[migrate] applied ${version}`);
  }
  importLegacyUsers(target);
}
function ensureDefaultOrg(target) {
  const existing = target.prepare("SELECT id FROM organizations WHERE slug = ?").get("default");
  if (existing) return existing.id;
  const id = uid2();
  target.prepare(
    "INSERT INTO organizations (id, name, slug, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, "Default workspace", "default", "free", "active", now4());
  target.prepare(
    `INSERT INTO subscriptions (org_id, plan, status, provider, provider_ref, current_period_end, created_at, updated_at)
       VALUES (?, 'free', 'active', 'manual', NULL, NULL, ?, ?)`
  ).run(id, now4(), now4());
  return id;
}
function importLegacyUsers(target) {
  const count = target.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count > 0) return;
  const legacyPath = path5.join(process.cwd(), "data", "users.json");
  if (!fs5.existsSync(legacyPath)) return;
  try {
    const raw = JSON.parse(fs5.readFileSync(legacyPath, "utf-8"));
    if (!Array.isArray(raw) || raw.length === 0) return;
    const orgId = ensureDefaultOrg(target);
    const insert = target.prepare(
      `INSERT OR IGNORE INTO users
       (id, name, email, password, org_id, created_at, is_active, role, failed_attempts, locked_until, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const txn = target.transaction(() => {
      for (const u of raw) {
        insert.run(
          u.id ?? uid2(),
          u.name ?? "Imported user",
          String(u.email ?? "").toLowerCase(),
          u.password ?? "",
          orgId,
          u.createdAt ?? now4(),
          u.isActive === false ? 0 : 1,
          u.role === "admin" ? "admin" : "user",
          u.failedLoginAttempts ?? 0,
          u.lockedUntil ?? null,
          now4()
          // grandfathered: accounts predate verification
        );
      }
    });
    txn();
    fs5.renameSync(legacyPath, legacyPath + ".migrated");
    console.log(`[migrate] imported ${raw.length} legacy user(s) into org "default"`);
  } catch (err) {
    console.error("[migrate] legacy import skipped:", err.message);
  }
}

// server.ts
async function startServer() {
  migrate();
  if (process.env.NODE_ENV !== "test") {
    jobQueue.startWorker();
  }
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { overlay: false } },
      appType: "spa"
    });
    app.use((req, res, next) => {
      if (!req.url.startsWith("/api")) {
        return vite.middlewares(req, res, next);
      }
      next();
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => logger.info(`up`, { port: PORT }));
  const shutdown = () => {
    jobQueue.stopWorker();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5e3).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
startServer();
