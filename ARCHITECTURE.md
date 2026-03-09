# How it's built

This is a clean, layered setup using Node and React. It follows **Clean Architecture** and **DDD** rules to keep the business logic separate from the database and the web framework.

## Core concepts

We use a **Hexagonal (Ports and Adapters)** flow. Dependencies always point inward—the domain logic shouldn't care if you're using Express, Fastify, Postgres, or a JSON file.

### Data flow
`React` → `Express` → `Controller` → `Domain Service` → `Repository Interface` → `Implementation (Infra)` → `DB`

---

## Backend (Node + TS)

This structure keeps things modular.

### Layers

- **api/**: The setup for Express routes, controllers, and middlewares. No logic here, just handling requests.
- **domain/**: The "brain" of the app. Pure logic, models, and interfaces. Zero dependencies on external libs.
- **infrastructure/**: The "hands" of the app. Handles DB connections, mailers, and external APIs. This is where domain interfaces get implemented.

### Examples

#### Domain (Business Logic)
This has **no dependencies** on Express or your DB. It’s just pure TypeScript logic.

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

#### Infrastructure (Adapters)
Implements the interfaces defined in the domain. Only this layer knows about SQL or external SDKs.

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

#### API (HTTP)
Wraps everything in Express. It validates inputs, calls the service, and sends back JSON.

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
