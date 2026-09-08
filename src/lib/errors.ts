import axios from 'axios';

/**
 * Shared API error extractor: surfaces the backend `message` when present,
 * falls back otherwise. Use in every catch block instead of hardcoded
 * strings so server-side reasons (lockout, validation, plan gates) reach
 * the user and support instead of "Failed to X".
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}
