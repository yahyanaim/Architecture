# Architecture Blueprint

This document provides a comprehensive architectural blueprint for a production-ready, enterprise-grade full-stack application using Node.js and React, adhering to Clean Architecture and Domain-Driven Design (DDD) principles.

## 1. High-Level Architecture Overview

We use a Hexagonal Architecture (Ports and Adapters) approach. The core principle is that dependencies point inwards. The Domain layer knows nothing about the database or the HTTP framework.

### Communication Flow
`Client (React)` → `HTTP Layer (Express)` → `Controller` → `Service (Domain)` → `Repository Interface` → `Repository Implementation (Infra)` → `Database`

---

## 2. Backend Architecture (Node.js + TypeScript)

This structure enforces strict separation of concerns.

### Folder Tree
```text
server/
├── api/                        # Application Layer (HTTP Entry Point)
│   ├── controllers/            # HTTP Request/Response handling
│   ├── dtos/                   # Data Transfer Objects (Zod schemas)
│   ├── middlewares/            # Express middlewares (Auth, Error handling)
│   └── routes/                 # Express route definitions
├── domain/                     # Business Layer (Pure Logic)
│   ├── entities/               # Rich domain models with behavior
│   ├── exceptions/             # Custom domain exceptions
│   ├── interfaces/             # Ports (Repository interfaces)
│   └── services/               # Application services orchestrating logic
├── infrastructure/             # Infrastructure Layer (Adapters)
│   ├── database/               # Database connection/ORM config
│   ├── jobs/                   # Scheduled tasks/cron jobs
│   ├── messaging/              # Event bus/message queue implementations
│   └── repositories/           # DAO layer (implements domain interfaces)
├── config/                     # Global configuration (Swagger, env)
└── app.ts                      # Express app setup and IoC wiring
```

### Layer Responsibilities & Code Examples

#### A. Domain Layer (Pure Business Logic)
**Responsibility:** Contains the core business rules. It has **zero dependencies** on Express, Postgres, or any other external library.

*Entity Example (`server/domain/entities/User.ts`):*
```typescript
export class User {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public readonly createdAt: Date
  ) {}

  // Domain logic encapsulated within the entity
  changeName(newName: string) {
    if (newName.length < 3) throw new Error("Name too short");
    this.name = newName;
  }
}
```

*Interface/Port Example (`server/domain/interfaces/IUserRepository.ts`):*
```typescript
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

*Service Example (`server/domain/services/UserService.ts`):*
```typescript
export class UserService {
  // Inversion of Control: Dependency Injection via constructor
  constructor(private readonly userRepository: IUserRepository) {}

  async createUser(name: string, email: string): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) throw new BusinessException('User already exists');
    
    const user = new User(crypto.randomUUID(), name, email, new Date());
    await this.userRepository.save(user);
    return user;
  }
}
```

#### B. Infrastructure Layer (DAO & External Services)
**Responsibility:** Implements the interfaces defined by the Domain layer. This is the only layer that knows about SQL, ORMs, or external APIs.

*Repository Example (`server/infrastructure/repositories/PostgresUserRepository.ts`):*
```typescript
export class PostgresUserRepository implements IUserRepository {
  // Uses a real DB connection pool
  async findByEmail(email: string): Promise<User | null> {
    // const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    // return mapToEntity(result.rows[0]);
  }
  // ...
}
```

#### C. API Layer (HTTP & Controllers)
**Responsibility:** Handles HTTP requests, validates input using DTOs, calls the Domain Service, and formats the HTTP response. **No business logic belongs here.**

*Controller Example (`server/api/controllers/UserController.ts`):*
```typescript
export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validate DTO
      const dto = CreateUserSchema.parse(req.body);
      // 2. Call Business Layer
      const user = await this.userService.createUser(dto.name, dto.email);
      // 3. Return Response
      res.status(201).json({ id: user.id, name: user.name });
    } catch (error) {
      next(error);
    }
  };
}
```

---

## 3. Frontend Architecture (React + TypeScript)

### Folder Tree
```text
src/
├── components/                 # Shared UI components
│   └── ui/                     # Shadcn UI components (Design System)
├── features/                   # Feature-based architecture
│   └── users/                  # User feature module (CRUD Demo)
│       ├── api/                # API call definitions (Axios)
│       ├── components/         # Feature-specific UI components (UserList, CreateUserForm)
│       └── types/              # Frontend DTOs and interfaces
├── hooks/                      # Global custom hooks
├── lib/                        # Third-party library configurations (React Query, utils)
└── App.tsx                     # Root component (Tabs, Layout, Theme)
```

### Tech Stack
*   **React 19 & Vite**: Fast, modern frontend rendering and tooling.
*   **Tailwind CSS 4**: Utility-first styling with a minimalist black/white/gray theme.
*   **Shadcn UI & Lucide Icons**: Accessible, customizable UI components and crisp iconography.
*   **React Query (@tanstack/react-query)**: Server state management, caching, and optimistic updates.
*   **Axios**: HTTP client for API communication.

---

## 4. Exception Strategy

We use a hierarchy of custom exceptions to differentiate between expected business errors and unexpected system failures.

1.  **`AppError`**: Base class for all operational errors.
2.  **`BusinessException` (400)**: Rule violations (e.g., "Insufficient funds").
3.  **`ValidationException` (422)**: Invalid input data (caught by Zod).
4.  **`NotFoundException` (404)**: Resource not found.

The global `errorHandler` middleware catches these and formats a consistent JSON response.

---

## 5. Best Practices & Scalability

### Best Practices
1.  **Strict Dependency Rule**: Outer layers can depend on inner layers, but inner layers (Domain) cannot depend on outer layers.
2.  **Constructor Injection**: Always inject dependencies via constructors to make testing trivial (mocking).
3.  **DTO vs Entity**: Never expose Domain Entities directly to the client. Always map them to Response DTOs to prevent over-posting and data leakage.

### Scalability Strategy
*   **Stateless Backend**: Use JWT for authentication. Store session data in Redis if necessary.
*   **Database Scaling**: Separate Read/Write replicas. The Repository pattern makes it easy to route `find` queries to a read replica and `save` queries to the master.

### Microservices Evolution
Because the codebase is modularized by Domain (e.g., `users`, `orders`), extracting a module into a separate microservice is straightforward:
1.  Extract the `domain/` and `api/` folders for that specific feature.
2.  Replace the local `IUserRepository` implementation with an `HttpUserRepository` that calls the new microservice via REST/gRPC.
