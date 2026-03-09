export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive: boolean;
}

export interface CreateUserDTO {
  name: string;
  email: string;
}
