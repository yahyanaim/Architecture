/**
 * Password hashing port interface.
 *
 * ARCHITECTURE (Hexagonal / Clean Architecture):
 * Domain services and entities define this port so that password hashing
 * algorithm details (bcrypt, argon2, etc.) remain in the infrastructure layer.
 */
export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}
