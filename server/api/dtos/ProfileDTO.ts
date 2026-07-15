import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;

export interface ProfileResponseDTO {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}