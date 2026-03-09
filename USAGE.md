# Usage Guide

This guide explains how to use the Clean Architecture Template to bootstrap your own enterprise-grade applications.

## Getting Started

This template provides a clean slate with a robust architectural foundation. It includes a fully functional **User Management CRUD demo** to illustrate the architecture in action, allowing you to immediately see how the layers interact before building your own features.

### Development Workflow

1.  **Start the Development Server**:
    Run `npm run dev` to start both the Vite frontend and Express backend concurrently on port 3000.
2.  **Access the App**:
    Open your browser and navigate to `http://localhost:3000`. You will see the template's landing page detailing the architecture and the Live Demo tab.

## Building Your Own Features

When adding new features, follow the established Clean Architecture layers (as demonstrated in the `Users` feature):

### 1. Domain Layer (`/server/domain`)
*   Define your core business entities (e.g., `Product`, `Order`).
*   Create repository interfaces (e.g., `IProductRepository`).
*   Implement application services that orchestrate the business logic.

### 2. Infrastructure Layer (`/server/infrastructure`)
*   Implement the repository interfaces using your chosen database (e.g., `PostgresProductRepository`).
*   Register these implementations in your dependency injection setup (`app.ts`).

### 3. API Layer (`/server/api`)
*   Create Express controllers to handle incoming HTTP requests.
*   Use Zod for input validation.
*   Define routes and connect them to your controllers.

### 4. Frontend (`/src/features`)
*   Create a new folder for your feature (e.g., `/src/features/products`).
*   Implement React components, custom hooks, and API integration using React Query.

## API Documentation (Backend)

The backend provides a RESTful API documented with Swagger/OpenAPI.

### Accessing Swagger UI
Navigate to `/api/docs` (e.g., `http://localhost:3000/api/docs`).

### Available Endpoints
The template includes the following endpoints out of the box:
*   `GET /api/health`: Returns the server status and timestamp.
*   `GET /api/users`: Retrieves all users.
*   `POST /api/users`: Creates a new user.
*   `PATCH /api/users/:id/status`: Toggles a user's active status.
*   `DELETE /api/users/:id`: Deletes a user.

As you add new routes to your API layer, update the Swagger configuration to automatically generate documentation for them.

## Database

The application currently uses an **In-Memory** database (`InMemoryUserRepository`) for the live demo to ensure zero-config local development.
*   Data is stored in memory and will reset across server restarts.
*   For production, you can easily swap this out for PostgreSQL, SQLite, or another database by implementing a new repository in the Infrastructure layer and updating the dependency injection in `app.ts`.

## Testing

The template is configured with Vitest and React Testing Library.
*   Run `npm run test` to execute the test suite.
*   Run `npm run test:coverage` to generate a coverage report.
*   Write unit tests for your Domain layer and integration tests for your API and Frontend features.
