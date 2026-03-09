import { z } from 'zod';

// DTO: Data Transfer Object
// Defines the exact shape of data expected from the client.
export const CreateUserSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email format")
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;

// Response DTO
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive: boolean;
}
