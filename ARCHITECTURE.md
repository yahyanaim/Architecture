# Architecture Document

**Project:** Clean Architecture Starter  
**Tech Stack:** React 19, Express 5, TypeScript, Vite, Tailwind CSS v4, Shadcn UI, TanStack Query, Zod, Vitest  
**Architecture Pattern:** Clean Architecture + Hexagonal (Ports and Adapters)

---

## Directory Structure

```
project-root/
├── server/
│   ├── app.ts                     # Express app configuration (middleware, error handler)
│   ├── api/
│   │   ├── controllers/           # HTTP request handlers
│   │   ├── dtos/                  # Zod-based DTOs / validation schemas
│   │   ├── middleware/            # Express middleware
│   │   └── routes/               # Route definitions
│   ├── domain/
│   │   ├── entities/             # Domain entities
│   │   ├── exceptions/           # Custom exceptions
│   │   └── services/            # Business logic
│   ├── infrastructure/
│   │   └── repositories/        # Repository implementations
│   └── tests/                   # Backend tests
├── src/
│   ├── components/              # Shared UI components
│   ├── features/               # Feature modules
│   │   ├── auth/               # Authentication (context, API, pages, components)
│   │   ├── users/              # User management (admin)
│   │   └── profile/            # Profile settings
│   ├── lib/                    # Utilities, helpers
│   └── main.tsx                # React entry point
├── data/                       # Runtime data storage
├── CODE_REVIEW.md              # Code review findings
└── ARCHITECTURE.md             # This file
```

---

## Layer Architecture

```
┌─────────────────────────────────────────────────┐
│                   React                         │
│  (Vite + TanStack Query + Axios + Shadcn UI)   │
│  Auth: httpOnly cookie via withCredentials      │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (JSON)
                   ▼
┌─────────────────────────────────────────────────┐
│              Express API Layer                   │
│  Controllers → DTOs (Zod validation)            │
│  Middleware: helmet, cors, cookieParser,         │
│  rateLimit, morgan, requestId, errorHandler     │
│  Auth: authenticate, authorizeAdmin             │
└──────────────────┬──────────────────────────────┘
                   │ Calls
                   ▼
┌─────────────────────────────────────────────────┐
│           Domain Service Layer                   │
│  Business logic, validation, auth rules         │
│  AuthService, UserService, ProfileService       │
└──────────────────┬──────────────────────────────┘
                   │ Uses
                   ▼
┌─────────────────────────────────────────────────┐
│         Repository Interface (Port)              │
│  IUserRepository (abstract class)               │
└──────────────────┬──────────────────────────────┘
                   │ Implemented by
                   ▼
┌─────────────────────────────────────────────────┐
│      Infrastructure (Adapter)                    │
│  FileUserRepository (JSON file)                  │
│  PostgresUserRepository (stub / future)          │
│  AuditLogger (data/audit.log + console)          │
└─────────────────────────────────────────────────┘
```

---

## Data Flow

### Authentication

```
1. POST /auth/register with password + confirmPassword
2. AuthController.validate(RegisterSchema)
3. AuthService.register()
   - First user → role: "admin"
   - Subsequent users → role: "user"
4. bcryptjs.hash(password, 12)
5. UserRepository.save(user)
6. Audit log: user.registered
7. jwt.sign({ userId, role }) → httpOnly cookie
8. Response: { user } (no token in body)
```

### Login

```
1. POST /auth/login → rate-limited (5 req / 15 min)
2. AuthController.validate(LoginSchema)
3. AuthService.login()
   - Checks isActive flag
   - Checks isLocked() (5 failed attempts = 15 min lock)
   - bcryptjs.compare(password, user.password)
   - Success: resetFailedAttempts(), generate JWT → httpOnly cookie
   - Failure: recordFailedAttempt(), throw if locked
4. Response: { user }
```

### Authenticated Request

```
1. Axios sends request with withCredentials: true
2. server reads cookie → authenticate middleware verifies JWT
3. req.user set with { userId, role }
4. Controller uses req.user for authorization
```

### Admin Operations

```
1. authenticate middleware verifies JWT from cookie (or Authorization header)
2. authorizeAdmin checks req.user.role === 'admin'
3. Controller performs action (toggleStatus, deleteUser)
4. Audit log: user.deleted
```

### Profile Operations

```
1. GET /profile — returns current user from req.user.userId
2. PUT /profile — validates UpdateProfileSchema, updates name/email
3. PUT /profile/password — validates ChangePasswordSchema, verifies current password
4. DELETE /profile — deletes account, audit log: user.account_deleted
```

---

## Request Lifecycle

```
Request
  │
  ├── 1. helmet (security headers)
  ├── 2. cors (configured origin)
  ├── 3. cookieParser (parse cookies)
  ├── 4. express.json (body parsing)
  ├── 5. rateLimit (auth routes only — 5 req / 15 min)
  ├── 6. morgan (HTTP logging)
  ├── 7. requestId (x-request-id header)
  ├── 8. Route matched
  │     ├── authenticate (verify JWT)
  │     ├── authorizeAdmin (check role — user routes)
  │     └── Controller → Service → Repository
  └── 9. Error handler (if next(error))
```

---

## Route Design

### Auth Routes (`/auth`)
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /register | No | Yes | Register new user |
| POST | /login | No | Yes | Login |
| POST | /logout | No | No | Clear auth cookie |
| GET | /me | Yes | No | Get current user |

### User Routes (`/users`) — Admin Only
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Yes | List all users |
| POST | / | Admin | Create user |
| PATCH | /:id/status | Admin | Toggle active status |
| DELETE | /:id | Admin | Delete user |
| PUT | /:id | Admin | Update user |

### Profile Routes (`/profile`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Yes | Get own profile |
| PUT | / | Yes | Update name/email |
| PUT | /password | Yes | Change password |
| DELETE | / | Yes | Delete own account |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | No | Health check |

---

## Entity Design

### User Entity

```typescript
class User {
  id: string;           // UUID v4
  name: string;         // Display name
  email: string;        // Unique, lowercase
  password: string;     // bcrypt hash
  role: 'admin' | 'user';
  isActive: boolean;    // For soft deactivation
  createdAt: Date;
  updatedAt: Date;

  // Security fields (added in review cycle 2)
  failedLoginAttempts: number;  // Incremented on failed login
  lockedUntil: Date | null;     // Set on 5th failure, 15 min lockout

  // Methods
  isLocked(): boolean;                   // Returns true if lockedUntil > now
  recordFailedAttempt(): void;           // Increments + locks at 5
  resetFailedAttempts(): void;           // Resets on successful login
}
```

### Audit Event

```typescript
interface AuditEvent {
  timestamp: string;    // ISO 8601
  event: string;        // e.g. "user.registered", "user.deleted", "user.account_deleted"
  userId: string;
  metadata?: Record<string, unknown>;
}
```

---

## DTO / Validation Design

### AuthDTO

```typescript
// RegisterSchema — validates POST /auth/register
{
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string()
}.refine(data => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

// LoginSchema — validates POST /auth/login
{
  email: z.string().email(),
  password: z.string().min(1),
}

// ChangePasswordSchema — validates PUT /profile/password
{
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
}
```

---

## Security Design

| Measure | Implementation | Status |
|---------|---------------|--------|
| Password hashing | bcryptjs, salt rounds: 12 | ✅ |
| Auth rate limiting | `express-rate-limit`, 5 req / 15 min on login/register | ✅ |
| JWT httpOnly cookie | `cookie-parser`, `secure: true` in prod, `sameSite: 'lax'` | ✅ |
| Account lockout | 5 failed attempts = 15 min lock (`failedLoginAttempts`, `lockedUntil`) | ✅ |
| Password complexity | Zod: min 8 + uppercase + lowercase + number | ✅ |
| Password confirmation | Zod `.refine()` on register | ✅ |
| Role-based access | `authorizeAdmin` middleware for user management | ✅ |
| Request validation | Zod schemas on all endpoints | ✅ |
| Security headers | `helmet` middleware | ✅ |
| CORS | Configured origin, credentials: true | ✅ |
| Swagger UI | Development only (disabled in production) | ✅ |
| Audit logging | JSON events to file and console | ✅ |
| Request ID | `x-request-id` header on every response | ✅ |

---

## Testing

```
Test Files  5 passed (5)
Tests      34 passed (34)
```

| File | Tests | Notes |
|------|-------|-------|
| `server/domain/services/AuthService.test.ts` | 11 | Register (first user admin), login, token verification, role, active/inactive, lockout |
| `server/domain/services/UserService.test.ts` | 9 | CRUD, status toggle |
| `server/domain/services/ProfileService.test.ts` | 11 | getProfile, updateProfile, deleteAccount, changePassword |
| `server/tests/api.test.ts` | 1 | Health endpoint |
| `src/App.test.tsx` | 2 | Component rendering |

---

## Tech Stack

### Backend
- **Express 5** — Web framework
- **TypeScript** — Language
- **Zod** — Runtime validation
- **jsonwebtoken** — JWT auth
- **bcryptjs** — Password hashing
- **cookie-parser** — Cookie parsing for httpOnly JWT
- **express-rate-limit** — Rate limiting
- **helmet** — Security headers
- **cors** — Cross-origin support
- **morgan** — HTTP logging
- **swagger-jsdoc + swagger-ui-express** — API docs (dev only)
- **better-sqlite3** — Installed, not yet used
- **tsx** — TypeScript execution

### Frontend
- **React 19** — UI library
- **TypeScript** — Language
- **Vite 6** — Build tool / dev server
- **Tailwind CSS v4** — Utility CSS
- **Shadcn UI** — Component library
- **TanStack Query (React Query)** — Server state
- **Axios** — HTTP client (withCredentials for cookie auth)
- **react-hook-form** — Form management
- **next-themes** — Theme (dark/light)
- **sonner** — Toast notifications
- **lucide-react** — Icons
- **vitest + jsdom** — Frontend testing
- **react-router** — Routing (imported, limited use)

### Testing
- **Vitest** — Test runner
- **supertest** — HTTP testing (available but no tests written yet)
