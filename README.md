# Clean Architecture Template (React + Node.js)

A production-ready, enterprise-grade full-stack template implementing Clean Architecture and Domain-Driven Design (DDD) principles.

## Features

*   **Strict Layered Architecture**: Domain, Infrastructure, and API layers are completely isolated.
*   **Domain-Driven Design (DDD)**: Rich domain entities encapsulating business rules.
*   **Inversion of Control (IoC)**: Dependency injection used throughout the backend.
*   **Full CRUD Demo**: A complete `Users` feature demonstrating the request lifecycle (Create, Read, Update Status, Delete).
*   **Security & Rate Limiting**: Configured with `helmet`, `cors`, and `express-rate-limit` (100 requests / 15 mins per IP).
*   **Validation**: Zod schemas for strict input validation (e.g., email formatting).
*   **Custom Exception Handling**: Centralized error handling for Business, Validation, and System errors.
*   **Modern Frontend**: React 19, Vite, Tailwind CSS 4, React Query, and Shadcn UI.
*   **Minimalist Theme**: Clean black, white, and gray UI design.

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
    *   Ensure port 3000 is available.

### Running the Application

1.  **Start the Development Server**:
    This runs both the Backend (Express) and Frontend (Vite) concurrently.
    ```bash
    npm run dev
    ```

2.  **Access the App**:
    *   Frontend: `http://localhost:3000`
    *   API Docs: `http://localhost:3000/api/docs`

### Building for Production

1.  **Build the project**:
    ```bash
    npm run build
    ```

2.  **Start the production server**:
    ```bash
    npm start
    ```

## Author

Architected by [Yahia Naim](https://www.linkedin.com/in/yahia-naim/).
*   [X (Twitter)](https://x.com/yahya_naim)
*   [Instagram](https://www.instagram.com/yahia_naiiiim/)
*   [Facebook](https://www.facebook.com/yaaahya.naim/)
