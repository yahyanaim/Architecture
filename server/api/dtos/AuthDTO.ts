import { z } from 'zod';

// DTO: Data Transfer Objects for the Auth feature.
// Keeps validation schemas out of the controller.

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const RegisterSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').transform(val => val.trim()),
  email: z.string().email('Invalid email format').transform(val => val.toLowerCase().trim()),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format').transform(val => val.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

export interface AuthResponseDTO {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  token: string;
}
