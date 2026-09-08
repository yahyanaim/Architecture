# Clean Architecture Starter

A clean, full-stack setup with React and Node. Built with Clean Architecture and DDD principles for apps that need to scale.

## What's inside

- **Strict Layers**: Domain, Infra, and API are completely isolated.
- **DDD**: Business rules live inside domain entities.
- **DI**: Dependency injection used throughout the backend.
- **Multi-tenant SaaS core**: Organizations, org-scoped data, invite flows.
- **Sessions done right**: short-lived access JWT + rotating hashed refresh tokens with theft detection.
- **Durable background jobs**: SQLite queue with retries for emails (verify/reset/invite).
- **Billing seam**: subscription-per-org + plan-gate middleware, Stripe-ready.
- **User CRUD**: A working demo from React to the DB.
- **Role-Based Access Control**: First user is admin, subsequent users are regular users. Admin-only endpoints protected.
- **Enhanced Security**: Helmet (CSP), CORS with allowlist, rate limiting, account lockout, JWT required at startup in prod.
- **Type-safe**: Zod for validation on both ends, strict TypeScript mode.
- **Modern UI**: React 19, Tailwind 4, Shadcn, and TanStack Query.
- **Tested**: 54 tests (services, middleware, SQLite adapters, job queue). Full map in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Enterprise Architecture Blueprint

This template was built specifically to answer the need for a strict, production-ready enterprise architecture. 

**👉 Please read [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete architectural blueprint, including:**
*   Complete folder tree for backend and frontend.
*   Sample code snippets per layer.
*   Clear explanation of responsibility of each folder.
*   Communication flow diagram.
*   Best practices, scalability, and microservices evolution.

## Key Patterns

*   **Dependency Injection**: Services receive repositories via constructor injection.
*   **Repository Pattern**: Decouples domain logic from data access.
*   **DTOs (Data Transfer Objects)**: Zod is used to validate incoming requests and define response shapes, preventing over-posting.
*   **Feature-Based Frontend**: React components, hooks, and API calls are grouped by feature (e.g., `src/features/users`).
*   **Shared Repository**: Single source of truth for data access (prevents data isolation bugs).
*   **Role-Based Access Control**: Hierarchical access control with admin/user roles.

## Security Features

- **JWT**: Secret is required in production (fail-closed at boot)
- **Sessions**: 15-min access token + rotating refresh tokens; reuse triggers chain revocation
- **Verify/Reset/Invite**: Single-use hashed email tokens; enumeration-safe responses
- **CORS**: Configurable allowlist via `CORS_ORIGIN` environment variable
- **CSP**: Content Security Policy enabled in production
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Helmet**: Security headers middleware
- **Role Protection**: Admin-only middleware protects sensitive endpoints

## API Documentation

Swagger UI is available at `/api/docs`.

## Database

SQLite via `better-sqlite3` (`data/app.db`), with idempotent SQL migrations in `server/infrastructure/db/migrations/` that run at boot. Swap in Postgres by implementing the domain ports (see `PostgresUserRepository` stub) — no service changes needed.

## Running Locally

To run this project on your local machine:

### Prerequisites
*   Node.js (v18 or higher)
*   npm (v9 or higher)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    ```bash
    cp .env.example .env
    ```
    A default `.env` file is included with development settings. For production, ensure `JWT_SECRET` is set to a strong random value.

4.  **Ensure port 40001 is available** (default; override with `PORT`).

### Running the Application

1.  **Start the Development Server**:
    This runs both the Backend (Express) and Frontend (Vite) concurrently.
    ```bash
    npm run dev
    ```

2.  **Access the App**:
    *   Frontend: `http://localhost:40001`
    *   API Docs: `http://localhost:40001/api/docs`

### Building for Production

1.  **Build the project**:
    ```bash
    npm run build
    ```

2.  **Start the production server**:
    ```bash
    npm start
    ```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Project Stats

- **54 tests passing** (services, middleware, SQLite adapters, job queue)
- **Strict TypeScript** with full type safety
- **Lint passing** with no errors
- **New here?** AI agents: read [SAAS_KICKOFF.md](./SAAS_KICKOFF.md) first. Humans: [SAAS_SCENARIO.md](./SAAS_SCENARIO.md) walks a full SaaS build on this base.

---

Architected by **Yahia Naim**.

- [Dev.to](https://dev.to/yahyanaim)
- [X (Twitter)](https://x.com/yahya_naim)
- [Instagram](https://www.instagram.com/yahia_naiiiim/)
- [Facebook](https://www.facebook.com/yaaahya.naim/)
