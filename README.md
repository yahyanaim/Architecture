# Clean Architecture Starter

A clean, full-stack setup with React and Node. Built with Clean Architecture and DDD principles for apps that need to scale.

## What's inside

- **Strict Layers**: Domain, Infra, and API are completely isolated.
- **DDD**: Business rules live inside domain entities.
- **DI**: Dependency injection used throughout the backend.
- **User CRUD**: A working demo from React to the DB.
- **Standard Security**: Helmet, CORS, and rate limiting baked in.
- **Type-safe**: Zod for validation on both ends.
- **Modern UI**: React 19, Tailwind 4, Shadcn, and TanStack Query.

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

## API Documentation

Swagger UI is available at `/api/docs`.

## Database

Currently using `InMemoryUserRepository` for the demo. The architecture allows swapping this for PostgreSQL by simply creating a `PostgresRepository` implementation and updating the dependency injection.

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
    *   Copy `.env.example` to `.env` (optional, as defaults work for dev).
    *   Ensure port 4000 is available.

### Running the Application

1.  **Start the Development Server**:
    This runs both the Backend (Express) and Frontend (Vite) concurrently.
    ```bash
    npm run dev
    ```

2.  **Access the App**:
    *   Frontend: `http://localhost:4000`
    *   API Docs: `http://localhost:4000/api/docs`

### Building for Production

1.  **Build the project**:
    ```bash
    npm run build
    ```

2.  **Start the production server**:
    ```bash
    npm start
    ```

Architected by **Yahia Naim**.

- [Dev.to](https://dev.to/yahyanaim)
- [X (Twitter)](https://x.com/yahya_naim)
- [Instagram](https://www.instagram.com/yahia_naiiiim/)
- [Facebook](https://www.facebook.com/yaaahya.naim/)
