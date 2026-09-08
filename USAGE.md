# Usage Guide

This guide explains how to use the Clean Architecture Template to bootstrap your own enterprise-grade applications.

## Getting Started

This template provides a clean slate with a robust architectural foundation. It includes a fully functional **User Management CRUD demo** to illustrate the architecture in action, allowing you to immediately see how the layers interact before building your own features.

### Development Workflow

1.  **Start the Development Server**:
    Run `npm run dev` to start both the Vite frontend and Express backend concurrently on port 40001 (override with `PORT`).

2.  **Access the App**:
    Open your browser and navigate to `http://localhost:40001`. You will see the template's landing page detailing the architecture and the Live Demo tab.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:
- `JWT_SECRET`: Your JWT signing secret (fail-closed in production, dev default otherwise)
- `CORS_ORIGIN`: Allowed CORS origins, comma-separated (default: `http://localhost:4000`)
- `NODE_ENV`: Environment (development, production, test)
- `DB_PATH`: SQLite file path (default: `./data/app.db`)
- `APP_URL`: Public base URL for email links (verify / reset / invite)
- `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS`: Session lifetimes (defaults: `15m` / `30`)
- `LOG_LEVEL`, `ERROR_WEBHOOK_URL`: Observability knobs
- See `.env.example` for mail (`LogMailer` outbox by default) and future Stripe keys.

## Building Your Own Features

When adding new features, follow the established Clean Architecture layers (as demonstrated in the `Users` feature):

### 1. Domain Layer (`/server/domain`)
*   Define your core business entities (e.g., `Product`, `Order`).
*   Create repository interfaces (e.g., `IProductRepository`).
*   Implement application services that orchestrate the business logic.

### 2. Infrastructure Layer (`/server/infrastructure`)
*   Implement the repository interfaces using your chosen database (e.g., `PostgresProductRepository`).
*   Register these implementations in `sharedRepository.ts`.

### 3. API Layer (`/server/api`)
*   Create Express controllers to handle incoming HTTP requests.
*   Use Zod DTOs for input validation.
*   Define routes and connect them to your controllers.

### 4. Frontend (`/src/features`)
*   Create a new folder for your feature (e.g., `/src/features/products`).
*   Implement React components, custom hooks, and API integration using React Query.
*   For enhanced UX, consider making user names clickable with hover effects and cursor pointers as demonstrated in the Header component.

## API Documentation (Backend)

The backend provides a RESTful API documented with Swagger/OpenAPI.

### Accessing Swagger UI
Navigate to `/api/docs` (e.g., `http://localhost:40001/api/docs`).

### Available Endpoints
The template includes the following endpoints out of the box:

**Auth (sessions: 15-min access JWT + rotating refresh cookie):**
- `POST /api/auth/register`: Register a new user (first user becomes admin; bootstraps personal org + free subscription; enqueues verify email)
- `POST /api/auth/login`: Login, sets session cookies (lockout + per-account throttling)
- `POST /api/auth/refresh`: Rotate the session pair (reuse = theft → chain revoked)
- `POST /api/auth/logout`: Revoke refresh session, clear cookies
- `GET /api/auth/me`: Get current user, liveness-checked (requires auth)
- `POST /api/auth/verify-request` + `GET /api/auth/verify?token=`: Email verification (always-200 request)
- `POST /api/auth/password-reset-request` + `POST /api/auth/password-reset`: Reset flow (kills all sessions)
- `POST /api/auth/invite-accept`: Accept org invite (sets password, verifies, auto-login)

**Users (all admin-only, tenant-scoped to caller's org):**
- `GET /api/users`: List org users
- `POST /api/users`: Invite a user (emails 7-day single-use link)
- `PATCH /api/users/:id/status`: Toggles a user's active status (sessions die on next request).
- `DELETE /api/users/:id`: Deletes a user.

**Profile (auth, own account):**
- `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/password` (revokes other sessions), `DELETE /api/profile`

**Billing / System:**
- `GET /api/billing/subscription`: Current org's plan/status
- `GET /api/metrics`: Request metrics (admin-only)
- `GET /api/health`: Returns the server status and timestamp.

As you add new routes to your API layer, update the Swagger configuration to automatically generate documentation for them.

## Role-Based Access Control

This template implements a simple role-based access control system:

- **Admin Role**: Automatically assigned to the first registered user
- **User Role**: Assigned to all subsequent users
- **Protected Endpoints**: Admin-only middleware protects sensitive endpoints (e.g., user creation)
- **UI Filtering**: Current user is hidden from the user list
- **Role Display**: Roles are shown in the header and user details

## Database

SQLite via `better-sqlite3` (`data/app.db`), created and migrated automatically at boot (`server/infrastructure/db/migrations/`, ledgered and idempotent). New schema change = new `NNN_name.sql` file, never edit applied ones.
- Tenancy: users belong to an org; listings are org-scoped.
- Tests use an isolated in-memory DB (`NODE_ENV=test`).
- For Postgres later: implement the domain ports against your driver (see `PostgresUserRepository` stub) and swap the singletons in `SharedUserRepository.ts` — migrations are portable SQL.

## Security

### JWT Authentication
- Sessions live in httpOnly cookies: short access JWT (`ACCESS_TOKEN_TTL`, default `15m`) + rotating opaque refresh token (default 30d, stored hashed)
- Refresh reuse triggers chain revocation (theft response)
- The JWT secret is fail-closed in production (refuses to boot without `JWT_SECRET`)
- Password reset / change revokes all refresh sessions
- Single-use email tokens: verify 24h, reset 1h, invite 7d (hashed, atomic consume)

### CORS
- Configure allowed origins via `CORS_ORIGIN` environment variable

### Rate Limiting
- 100 requests per 15 minutes per IP (global `/api`)
- 5 auth attempts per 15 min per IP + 10 logins per 15 min per account
- 3 registrations per hour per IP (workspace creation is expensive — signup-abuse throttle)

### Role Protection
- Admin-only endpoints protected by middleware
- Prevents unauthorized access to sensitive operations

## Testing

The template is configured with Vitest and React Testing Library.

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage
- **Domain Services**: Fully tested (register/login/roles/rotation-theft/verify/reset/invite, tenant-scoped users, profile)
- **Middleware**: `requireActiveUser`, `requirePlan` unit tests
- **Adapters + queue**: SQLite ports and job lifecycle against isolated in-memory DB
- **Backend API**: Health check endpoint tested
- **Frontend**: Component rendering tests

### Writing Tests
```typescript
// Example: Testing a Domain Service (ports get in-file doubles)
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';

const fakeTokens = { createAuthToken: async (i: any) => ({ id: 't1', ...i }) } as any;
const ORG = 'org-test';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    userService = new UserService(userRepository, fakeTokens);
  });

  it('creates an invite (login-disabled account + single-use token)', async () => {
    const { user, inviteToken } = await userService.createUser('John', 'john@example.com', ORG);
    expect(user.name).toBe('John');
    expect(inviteToken).toBeDefined();
  });
});
```

## Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite, migrations auto-run) |
| `npm start` | Start production server (serves API + built `dist/` SPA) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run TypeScript type checking |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
