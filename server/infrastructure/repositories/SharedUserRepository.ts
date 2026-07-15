import { FileUserRepository } from './FileUserRepository';

/**
 * Shared singleton repository for Users across auth and user routes.
 * Both auth and user routes must operate on the same data store,
 * otherwise users registered via /auth/register are invisible to /api/users.
 * Swap FileUserRepository for PostgresUserRepository here when wiring
 * up a real database — no other files need to change.
 */
export const userRepository = new FileUserRepository();
