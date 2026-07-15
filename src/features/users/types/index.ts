export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  role: UserRole;
}

export interface CreateUserDTO {
  name: string;
  email: string;
}
