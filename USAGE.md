# Usage Guide

This guide explains how to use the Clean Architecture Template to bootstrap your own enterprise-grade applications.

## Getting Started

This template provides a clean slate with a robust architectural foundation. It includes a fully functional **User Management CRUD demo** to illustrate the architecture in action, allowing you to immediately see how the layers interact before building your own features.

### Development Workflow

1.  **Start the Development Server**:
    Run `npm run dev` to start both the Vite frontend and Express backend concurrently on port 4000.

2.  **Access the App**:
    Open your browser and navigate to `http://localhost:4000`. You will see the template's landing page detailing the architecture and the Live Demo tab.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:
- `JWT_SECRET`: Your JWT signing secret (required at startup)
- `CORS_ORIGIN`: Allowed CORS origins (default: `http://localhost:4000`)
- `NODE_ENV`: Environment (development, production, test)
- `DB_PATH`: Optional database file path

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
Navigate to `/api/docs` (e.g., `http://localhost:4000/api/docs`).

### Available Endpoints
The template includes the following endpoints out of the box:

**Auth:**
- `POST /api/auth/register`: Register a new user (first user becomes admin)
- `POST /api/auth/login`: Login and get JWT token
- `GET /api/auth/me`: Get current user (requires auth)

**Users:**
- `GET /api/users`: Retrieves all users (excludes current user)
- `POST /api/users`: Creates a new user (requires admin role)
- `PATCH /api/users/:id/status`: Toggles a user's active status.
- `DELETE /api/users/:id`: Deletes a user.

**System:**
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

The application currently uses an **In-Memory** database (`InMemoryUserRepository`) for the live demo to ensure zero-config local development.
- Data is stored in memory and will reset across server restarts.
- For production, you can easily swap this out for PostgreSQL, SQLite, or another database by:
  1. Implementing a new repository in the Infrastructure layer
  2. Updating `sharedRepository.ts` to use your new repository

## Security

### JWT Authentication
- Tokens are required for protected routes
- The JWT secret must be set in environment variables (fails at startup if missing)
- Tokens expire after 30 days
- Tokens include user role for client-side display

### CORS
- Configure allowed origins via `CORS_ORIGIN` environment variable

### Rate Limiting
- 100 requests per 15 minutes per IP

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
- **Domain Services**: Fully tested with unit tests including role assignment logic
- **Backend API**: Health check endpoint tested
- **Frontend**: Component rendering tests

### Writing Tests
```typescript
// Example: Testing a Domain Service
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    userService = new UserService(userRepository);
  });

  it('creates a user with a secure password', async () => {
    const user = await userService.createUser('John', 'john@example.com');
    expect(user.name).toBe('John');
    expect(user.password).toBeDefined();
  });
});
```

## Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Express + Vite) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run TypeScript type checking |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
