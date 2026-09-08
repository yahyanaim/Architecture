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

// Single-use token flows (verify / reset / invite-accept) share the password
// complexity rule with registration — one source of truth per flow.
export const EmailRequestSchema = z.object({
  email: z.string().email('Invalid email format').transform(val => val.toLowerCase().trim()),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

export const InviteAcceptSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
  name: z.string().min(3, 'Name must be at least 3 characters').trim().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export interface AuthResponseDTO {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  emailVerified: boolean;
  orgId: string;
}
