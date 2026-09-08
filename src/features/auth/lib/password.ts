/**
 * Single source of truth for password rules on the client.
 * Mirrors the backend Zod `passwordSchema` (server/api/dtos/AuthDTO.ts):
 * min 8 + uppercase + lowercase + number. Keep the two in sync — if the
 * backend rule changes, this file changes with it. Used by Register,
 * Invite, Reset-password, and Profile change-password flows.
 */
export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

/** Login takes any non-empty password (backend LoginSchema: min 1) — strength
 * rules apply at SET time (register/invite/reset/change), never at login. */
export function validateLoginPassword(password: string): string | null {
  if (!password) return 'Password is required';
  return null;
}
